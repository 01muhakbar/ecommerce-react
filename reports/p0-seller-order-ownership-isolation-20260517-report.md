# P0 Seller Order Ownership Isolation Report

Task ID: P0-SELLER-ORDER-OWNERSHIP-ISOLATION-20260517
Related Task: P1-SMOKE-ORDERS-AUTH-BOOTSTRAP-FIX-20260517
Date: 2026-05-17

## Summary

Seller order ownership routes were audited across order list/detail, fulfillment mutation, payment review, and seller workspace finance summary. The main backend routes already scope seller order reads and mutations by the active store context through `requireSellerStoreAccess` plus `Suborder.storeId` or `Payment.storeId`/`Suborder.storeId` checks.

No seller route guard was weakened and no DB schema was changed. A dedicated smoke script was added to prove isolation across two seller stores once the local API and database are available. The legacy `smoke:orders` script now fails with actionable admin-auth setup instructions instead of an unexplained 401.

## Files Changed

Task-specific changes:

- `server/package.json`
- `server/scripts/smoke-orders-admin.mjs`
- `server/src/scripts/smokeSellerOrderOwnership.ts`
- `reports/p0-seller-order-ownership-isolation-20260517-report.md`

Existing pending P0 changes from previous tasks remain in the worktree:

- `server/src/routes/admin.orders.ts`
- `server/src/routes/admin.products.ts`
- `server/src/routes/checkout.ts`
- `server/src/routes/public.ts`
- `server/src/routes/seller.products.ts`
- `server/src/routes/store.ts`
- `server/src/scripts/smokeCheckoutVariants.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `server/src/services/productVisibility.ts`
- Existing P0 reports under `reports/`

## Seller Order Endpoints Audited

Seller order list:

- Endpoint: `GET /api/seller/stores/:storeId/suborders`
- Guard: `requireSellerStoreAccess(["ORDER_VIEW"])`
- Scope: `Suborder.findAndCountAll({ where: { storeId } })`
- Risk: Low. Query is directly store-scoped.

Seller order detail:

- Endpoint: `GET /api/seller/stores/:storeId/suborders/:suborderId`
- Guard: `requireSellerStoreAccess(["ORDER_VIEW"])`
- Scope: `Suborder.findOne({ where: { id: suborderId, storeId } })`
- Risk: Low. Cross-store suborder id returns not found after store access is authorized.

Seller bulk delete:

- Endpoint: `POST /api/seller/stores/:storeId/suborders/bulk-delete`
- Guard: `requireSellerStoreAccess(["ORDER_VIEW", "ORDER_FULFILLMENT_MANAGE"])`
- Scope: `assertSellerBulkOrderDeletionAllowed({ storeId, suborderIds })`
- Risk: Low, assuming helper remains store-scoped. Smoke coverage added for order mutation paths, not bulk delete.

Seller fulfillment update:

- Endpoint: `PATCH /api/seller/stores/:storeId/suborders/:suborderId/fulfillment`
- Guard: `requireSellerStoreAccess(["ORDER_VIEW", "ORDER_FULFILLMENT_MANAGE"])`
- Scope: locked and hydrated suborder queries both use `{ id: suborderId, storeId }`
- Risk: Low. Mutation target is store-scoped before transition logic runs.

Seller payment review list:

- Endpoint: `GET /api/seller/stores/:storeId/payment-review/suborders`
- Guard: `requireSellerStoreAccess(["ORDER_VIEW", "PAYMENT_STATUS_VIEW"])`
- Scope: `Suborder.findAll({ where: { storeId } })`
- Risk: Low.

Legacy seller payment review list:

- Endpoint: `GET /api/seller/suborders`
- Guard: `requireAuth`
- Scope: resolves seller access from `storeId` query or eligible seller contexts. Multiple accessible stores require explicit scope.
- Risk: Medium by age/compatibility, but current implementation avoids silently merging multiple stores.

Seller payment review mutation:

- Endpoint: `PATCH /api/seller/stores/:storeId/payments/:paymentId/review`
- Guard: `requireSellerStoreAccess(["ORDER_VIEW", "PAYMENT_STATUS_VIEW"])`
- Scope: route `storeId` must match resolved `Payment.storeId`/`Suborder.storeId`; mismatch returns 404.
- Risk: Low.

Legacy seller payment review mutation:

- Endpoint: `PATCH /api/seller/payments/:paymentId/review`
- Guard: `requireAuth`
- Scope: resolves `Payment` store through linked `Suborder`; then `resolveSellerAccess({ storeId: scopedStoreId, userId })`.
- Risk: Medium by legacy shape, but current implementation rejects sellers without access to the payment's store.

Seller finance summary:

- Endpoint: `GET /api/seller/stores/:storeId/finance-summary`
- Guard: `requireSellerStoreAccess(["STORE_VIEW"])`
- Scope: `Suborder.findAll({ where: { storeId } })` and `Payment.findAll({ where: { storeId } })`
- Risk: Low.

Seller analytics summary:

- Endpoint: `GET /api/seller/stores/:storeId/analytics-summary`
- Guard: `requireSellerStoreAccess(["STORE_VIEW"])`
- Scope: active `storeId` is passed into `loadSellerWorkspaceAnalyticsSummary`.
- Risk: Low, based on route-level guard and store-scoped loader contract.

## Ownership Checks Before/After

Before:

- Core seller order endpoints already had active store guards and store-scoped queries.
- Runtime regression coverage for cross-store seller order/detail/payment/fulfillment isolation was missing.
- `smoke:orders` failed with a raw 401 when no admin cookie/token was supplied.

After:

- Added `smoke:seller-order-ownership`.
- New smoke builds two sellers, two stores, two buyers, and two checkout-created orders.
- New smoke verifies Seller A and Seller B list/detail/payment-review/fulfillment lanes cannot cross store boundaries.
- New smoke verifies Admin can read both orders and buyers can only read their own authenticated order detail.
- `smoke:orders` can bootstrap admin login from `MVF_ADMIN_EMAIL` and `MVF_ADMIN_PASSWORD`, or fails with explicit setup instructions for `ADMIN_COOKIE`, `ADMIN_TOKEN`, or admin credentials.

## Bug Ditemukan

- No confirmed seller order ownership code leak was found in the audited routes.
- A security coverage gap existed: there was no focused smoke proving cross-store seller order/payment/fulfillment isolation.
- P1 issue found: `smoke:orders` failed with a confusing HTTP 401 when admin auth env was absent.

## Bug Diperbaiki

- Added focused seller ownership smoke script and package command.
- Improved `smoke:orders` auth bootstrap and error messaging.

## Smoke Coverage

New command:

- `pnpm.cmd -F server smoke:seller-order-ownership`

Coverage intent:

- Seller A can list/detail/update payment/fulfillment for Store A order.
- Seller A cannot list/detail/update Store B order through Store A or Store B routes.
- Seller B cannot detail/update Store A order.
- Payment review route-scoped and legacy mutation lanes reject cross-store access.
- Admin can read both orders.
- Buyer A cannot read Buyer B authenticated order detail.

## Test Command Dan Hasil

- `pnpm.cmd -F server build` PASS
- `pnpm.cmd -F client build` PASS, with existing Vite chunk size warning
- `git diff --check` PASS, with Git autocrlf warning for `server/scripts/smoke-orders-admin.mjs`
- `pnpm.cmd -F server smoke:orders` EXPECTED ACTIONABLE FAIL when no admin auth env is set. Message now explains `ADMIN_COOKIE`, `ADMIN_TOKEN`, or `MVF_ADMIN_EMAIL`/`MVF_ADMIN_PASSWORD`.
- `pnpm.cmd -F server smoke:seller-order-ownership` BLOCKED: API not reachable; `fetch failed` / `ECONNREFUSED`.
- `pnpm.cmd -F server smoke:checkout-variants` BLOCKED: API not reachable; `fetch failed` / `ECONNREFUSED`.
- `pnpm.cmd -F server smoke:order-payment` BLOCKED: API not reachable; `fetch failed` / `ECONNREFUSED`.
- `pnpm.cmd -F server smoke:product-visibility` BLOCKED: API not reachable; `fetch failed` / `ECONNREFUSED`.

Local server start attempt:

- `pnpm.cmd -F server start` BLOCKED by `SequelizeConnectionRefusedError` / MySQL `ECONNREFUSED`.

## Dampak Ke Seller/Admin/Client

Seller:

- No runtime contract change to existing endpoints.
- New smoke protects list/detail/payment review/fulfillment isolation across stores.

Admin:

- Admin full-access behavior was not changed.
- New smoke includes admin read checks when API/DB are available.

Client:

- Client ownership behavior was not changed.
- New smoke includes authenticated client ownership checks when API/DB are available.

## Risiko Tersisa

- Runtime smoke verification is blocked until local MySQL/API is available again.
- Bulk-delete helper was audited by route usage but not yet covered in the new smoke.
- Legacy seller payment routes still exist for compatibility; they are scoped, but store-scoped routes are safer and should remain the preferred frontend contract.

## Rekomendasi Task Berikutnya

- Run the full required smoke set again after MySQL is available.
- Add bulk-delete cross-store smoke coverage if seller order deletion remains a supported workflow.
- Migrate frontend usage away from legacy seller payment review routes where possible, keeping store-scoped routes as the standard.

## Apakah Butuh Rencana Kolaborasi Lanjutan

Tidak untuk patch ini.

Ya hanya jika a future task proposes auth/session architecture changes, DB schema changes, or removal of legacy seller payment routes.
