# P0 Production MVF Hardening Report - 2026-05-20

## Summary

- Audited the public Client -> Seller -> Admin minimum viable flow for storefront visibility, cart/checkout, order creation, payment audit, seller order scope, and shipping reconciliation.
- Found one P0 UX honesty gap: checkout always rendered a selectable `QRIS by Store` radio even when backend preview could report payment blocked.
- Fixed the checkout payment section so selectable payment options are shown only when backend preview says all store groups are payment-ready.
- No backend route, API contract, DB schema, auth/session, payment gateway, order shape, or shipping provider changed.

## Flow Audited

- Client product visibility:
  - `server/src/routes/store.ts` public products use active/published/product-review gates and `buildPublicOperationalStoreInclude`.
  - Store include requires `Store.status = ACTIVE` and active approved payment profile.
- Cart/checkout:
  - `server/src/routes/checkout.ts` preview returns grouped store payment readiness and invalid item data.
  - Submit route locks visible products, rejects invalid cart items, blocks not-ready payment groups, and uses checkout idempotency.
- Order creation/payment state:
  - Checkout creates parent order, suborders, payment records, status logs, and shipment records.
  - Parent payment aggregation is handled through `orderPaymentAggregation.service.ts`.
- Seller order visibility:
  - `server/src/routes/seller.orders.ts` list/detail/mutations are scoped by `storeId` and seller permissions.
- Admin payment audit:
  - `server/src/routes/admin.payments.audit.ts` serializes parent payment state plus suborder/store split state and grouped payment read model.
- Shipping reconciliation:
  - `shippingReconciliationReport.service.ts` reads operational shipment status, compatibility status, exceptions, and tracking timeline data.

## Checklist Results

### Store Readiness

- [x] Store inactive does not show as ready.
- [x] Store without active payment profile does not show as checkout-ready.
- [x] Pending/revision payment setup is not treated as active.
- [x] Admin remains final authority for activation and promotion.

### Product Visibility

- [x] Inactive/draft/unpublished products are excluded from public products.
- [x] Products from gated stores are excluded from public product list/detail.
- [x] Product detail returns clear not found/unavailable states.

### Checkout

- [x] Checkout preview is backend-driven.
- [x] Disabled/not-ready payment no longer appears as a selectable radio option.
- [x] Invalid items, preview sync, and payment blockers have visible buyer-facing messages.
- [x] Empty cart state is explicit.
- [x] Single-store and multi-store checkout paths remain covered by QA.

### Seller

- [x] Seller order list/detail are scoped to active `storeId`.
- [x] Seller sees payment/order/shipment status read models aligned with Admin.
- [x] Seller payment setup request cannot self-promote or self-activate without Admin.

### Admin

- [x] Payment Audit reads parent state and store split status.
- [x] Store Payment active snapshot remains admin-governed.
- [x] Shipping Reconciliation reads operational shipment truth and passed release QA.

## Gap Found

Before the patch, `client/src/pages/store/Checkout.jsx` always rendered `QRIS by Store` as a selectable payment option because `PAYMENT_OPTIONS` was static. Backend preview and submit still blocked not-ready stores correctly, but the selectable UI could confuse buyers.

## Files Changed

- `client/src/pages/store/Checkout.jsx`
- `reports/p0-production-mvf-hardening-2026-05-20-report.md`

## Before/After Behavior

Before:
- Checkout payment method radio appeared even while backend preview was not ready or a store group had `paymentAvailable = false`.

After:
- Payment radio appears only when checkout preview is ready and every store group has `paymentAvailable = true`.
- If preview is still syncing or a store is blocked, the section shows a short notice instead of a selectable method.
- Submit blocking behavior and checkout payload remain unchanged.

## Admin/Seller/Client Sync Confirmation

- Client: storefront/product visibility and checkout payment method display now follow backend readiness more honestly.
- Seller: order visibility and payment profile governance are unchanged; seller still cannot self-activate payment.
- Admin: payment audit, store payment snapshot, store profile readiness, and shipping reconciliation contracts are unchanged.
- Backend: no code changed; existing QA confirms checkout/order/payment/shipping read models remain synchronized.

## Manual Route Checklist

Checked through route audit plus browser QA coverage from `qa:shipping:release` / `e2e-truth`:

- Admin:
  - `/admin/online-store/store-payment`
  - `/admin/online-store/payment-audit`
  - `/admin/online-store/shipping-reconciliation`
  - `/admin/online-store/store-profile`
- Seller:
  - `/seller/stores/:storeSlug`
  - `/seller/stores/:storeSlug/orders`
  - `/seller/stores/:storeSlug/payment-profile`
  - `/seller/stores/:storeSlug/store-profile`
- Client:
  - `/`
  - `/product/:slug`
  - `/cart`
  - `/checkout`
  - `/order/:ref`

## Commands Run

- `pnpm.cmd --filter client build` - passed, with existing large chunk warning.
- `pnpm.cmd qa:mvf:store-readiness` - passed.
- `pnpm.cmd qa:mvf:order-payment` - passed.
- `pnpm.cmd qa:shipping:release` - passed.
- `pnpm.cmd qa:admin:public-auth` - passed.
- `git diff --check` - passed.

## Results

- Client checkout no longer shows a selectable disabled/not-ready payment method.
- Store not-ready and payment-not-ready guardrails are still enforced by backend and QA.
- Seller order/store scope and Admin audit/shipping sync remain green.
- No backend build was required because backend files were not touched.

## Remaining Risks

- The checkout page is still large; this task intentionally avoided broad refactor and changed only payment method display honesty.
- `qa:shipping:release` remains long-running, so future runs should keep a long timeout and avoid parallel port usage.

## Recommended Next Task

Add a focused browser smoke for checkout payment method visibility where `/api/checkout/preview` returns one blocked store group, asserting the radio is absent and the blocker notice is visible.
