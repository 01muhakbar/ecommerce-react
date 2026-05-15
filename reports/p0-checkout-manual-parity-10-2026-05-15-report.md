# P0-CHECKOUT-MANUAL-PARITY-10 Report

Date: 2026-05-15

## Scope

Task focused on proving why manual browser checkout could still look stale after the e2e smoke passed, and on exposing the same checkout preview snapshot identity in both manual development mode and `qa:e2e:truth`.

## Files Changed

- `client/src/api/storeCheckout.ts`
- `client/src/pages/store/Checkout.jsx`
- `tools/qa/e2e-truth-smoke.ts`
- `reports/p0-checkout-manual-parity-10-2026-05-15-report.md`

## Root Cause / Finding

Follow-up manual debugging found the concrete root cause: raw backend checkout preview could return duplicate preview items for one visible cart line when the product store had multiple `store_payment_profiles` rows.

The duplication came from backend Sequelize includes, not from the frontend adapter. Checkout cart loading included `Store -> paymentProfile` in the cart item/product query. The `paymentProfile` association is modeled as `hasOne`, but the table can contain multiple historical profiles for the same store, so the SQL join can multiply one `CartItem` into many rows. Cart drawer did not include that relation, so it still showed one visible item while `/checkout/preview` could return many.

Clean manual browser context against `http://localhost:5173/checkout` matched e2e before this follow-up, but it did not cover stores with many historical payment profiles. The regression is now locked in backend smoke.

## Implementation

- Changed checkout backend cart product loading to avoid joining the historical `paymentProfile` relation directly.
- Checkout still includes `activePaymentProfile` and now loads fallback payment profiles through a separate store-level query, so one store profile history cannot multiply cart lines.
- Added smoke coverage with one visible banana cart line plus 15 historical store payment profiles. Preview must expose one item, and checkout create must persist one order item.
- Added preview HTTP status metadata to the checkout preview API helper for dev diagnostics.
- Added a development-only checkout preview debug panel with:
  - `previewLoading`
  - `previewError`
  - `previewReady`
  - `previewMismatch`
  - `mismatchReason`
  - `disabledReason`
  - visible and preview fingerprints
  - normalized visible and preview item snapshots
  - raw preview groups/items counts
  - last request payload and response status
- Added e2e extraction/assertions for the same debug snapshot after Organic Banana qty 3 checkout readiness.

## Manual Parity Check

- Clean session: yes, verified using a fresh Playwright browser context with local/session storage cleared.
- Dev server restarted: yes.
- Frontend URL: `http://localhost:5173`
- Backend base URL: Vite proxy `/api` to local backend on port `3001`.
- Manual fixture user: new buyer fixture for this run.
- Cart storage key/source: authenticated server cart; browser local/session storage cleared before login.
- Preview endpoint: `POST http://localhost:5173/api/checkout/preview`
- Preview endpoint status: `200`
- Preview response has groups/items: yes (`groups=1`, `items=1`)
- `mismatchReason`: `MATCHED`
- `disabledReason`: `null`
- Visible fingerprint: `store:|pid:1553|variant:215:458|qty:3`
- Preview fingerprint: `sslug:manual-parity-1778824047298-store|pid:1553|variant:215:458|qty:3`
- Order Summary by Store visible: yes
- Total Cost visible: yes (`Rp 75.000`)
- Coupon sync-blocked: no
- Place Order blocked by preview sync: no

Follow-up backend source check:

- Raw duplication source: backend preview query, not frontend adapter.
- Trigger: multiple historical `store_payment_profiles` rows joined through `Store.paymentProfile`.
- Patch location: `server/src/routes/checkout.ts`.
- Submit safety: `create-multi-store` uses the same corrected cart loading path and existing stale explicit `cartId` guard remains active.

## E2E Comparison

`qa:e2e:truth` now logs and asserts the debug snapshot:

- `mismatchReason=MATCHED`
- `rawPreviewGroupsLength=1`
- `rawPreviewItemsLength=1`
- `disabledReason=""`

The e2e run was executed twice after adding the browser assertion.

## Validation

- `pnpm.cmd -F server build` PASS
- `pnpm.cmd -F client build` PASS
- `pnpm.cmd -F server smoke:checkout-variants` PASS after serial retry
- `pnpm.cmd -F server smoke:checkout-coupons` PASS
- `pnpm.cmd -F server smoke:order-payment` PASS
- `pnpm.cmd qa:e2e:truth` PASS
- `pnpm.cmd qa:e2e:truth` PASS, second run

Note: an earlier `smoke:checkout-variants` attempt failed with `ECONNRESET` while the dev watcher restarted after backend edits. The serial retry against a stable backend passed.

## Impact

- Admin Workspace: no route/UI contract changes.
- Seller Workspace: no route/UI contract changes.
- Client/Storefront: dev-only diagnostics added to checkout; production build does not render the debug panel.
- Backend contracts: unchanged. The API helper only preserves response status locally for diagnostics.

## Risk

Low. Runtime behavior is unchanged in production except for the existing checkout readiness fixes from the previous preview-stuck work. The debug panel is gated by `import.meta.env.DEV`.

## Next Suggested Task

If the user browser still shows a stuck checkout after hard refresh and clean storage, read the new `Checkout preview debug` panel and compare `mismatchReason`, fingerprints, raw preview counts, and response status against this report.
