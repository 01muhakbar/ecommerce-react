# P0-CHECKOUT-PREVIEW-CLEANUP-HARDEN-12 Report

Date: 2026-05-15

## Scope
- Hardened checkout cart loading against duplicate join rows from historical store payment profiles.
- Kept checkout preview debug tooling development-only.
- Added regression assertions for preview and create-order duplicate line protection.

## Files Changed
- `client/src/pages/store/Checkout.jsx`
- `server/src/routes/checkout.ts`
- `server/src/scripts/smokeCheckoutVariants.ts`
- `tools/qa/e2e-truth-smoke.ts`

## Backend Hardening
- Cart loading for checkout uses the shared `loadCheckoutCartProducts` path for preview and create order.
- Cart line queries include `activePaymentProfile` only; historical `paymentProfile` rows are not joined into cart line reads.
- Fallback payment profile data remains loaded through a separate per-store lookup.
- Added a small dedupe safety net after checkout cart products are read:
  - primary key: `cartItemId`;
  - fallback key: `store + product + variant identity`;
  - duplicate rows are ignored before preview/order calculation;
  - warning logs are limited to non-production.

## Frontend Cleanup
- Checkout debug panel remains gated by `import.meta.env.DEV`.
- Checkout preview console diagnostics are guarded by the same DEV flag.
- The debug panel does not alter checkout state or submit logic.
- No checkout UX redesign was made.

## QA Coverage
- `smoke:checkout-variants` now explicitly covers one cart item with many historical store payment profiles.
- Assertions lock:
  - preview item count stays `1`;
  - unique `cartItemId` count stays `1`;
  - preview subtotal remains the unit price;
  - create order stores one suborder item;
  - stored suborder/payment amounts are not multiplied by duplicate join rows.
- `qa:e2e:truth` locks checkout debug snapshot parity:
  - `mismatchReason = MATCHED`;
  - preview item count equals visible cart item count;
  - no duplicate preview line ids;
  - checkout groups and total remain visible.

## Admin/Seller/Client Impact
- Admin: no route or contract changes.
- Seller: no route or contract changes.
- Client storefront: checkout preview and order create remain source-of-truth backend flows; debug remains development-only.

## Validation
- `pnpm.cmd -F server build` PASS
- `pnpm.cmd -F client build` PASS
- `pnpm.cmd -F server smoke:checkout-variants` PASS
- `pnpm.cmd -F server smoke:checkout-coupons` PASS
- `pnpm.cmd -F server smoke:order-payment` PASS
- `pnpm.cmd qa:e2e:truth` PASS

## Risk
- Low. The backend patch is defensive and scoped to duplicate exact cart line reads.
- Remaining historical payment profile include is on suborder payment detail reads, not checkout cart line loading.

## Rollback Plan
- Revert the checkout cart dedupe helper and smoke/e2e assertions.
- Keep the previous active payment profile separate-load pattern unless a specific regression is found.
