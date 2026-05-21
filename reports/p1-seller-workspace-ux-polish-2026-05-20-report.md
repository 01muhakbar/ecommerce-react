# P1 Seller Workspace UX Polish Report

Date: 2026-05-20

## Summary

Seller Workspace was audited and lightly polished for store readiness, payment setup, order list, order detail, and dashboard readiness. The changes are UI-only and backend-driven. No backend route, API contract, database schema, checkout payload, order payload, payment enum, or seller approval authority was changed.

## Seller Flow Audited

- Seller dashboard readiness summary at `/seller/stores/:storeSlug` and `/seller/stores/:storeSlug/dashboard`.
- Seller store profile readiness at `/seller/stores/:storeSlug/store-profile`.
- Seller payment profile at `/seller/stores/:storeSlug/payment-profile`.
- Seller orders at `/seller/stores/:storeSlug/orders`.
- Seller order detail at `/seller/stores/:storeSlug/orders/:suborderId`.

## UX Gaps Found

- Payment profile already separated seller draft/request data from active checkout data, but the page needed a clearer buyer checkout availability summary.
- Store profile already had readiness checks, but public gate and backend readiness authority were not surfaced as compact summary cards.
- Seller orders already showed status/action data, but the queue needed clearer store scope and fulfillment dependency cues.
- Seller order detail already had detailed payment/shipment data, but the next seller action was not summarized near the top.
- Seller dashboard already used backend readiness, but the public readiness boundary was less visible.

## Files Changed

- `client/src/pages/seller/SellerWorkspaceHome.jsx`
- `client/src/pages/seller/SellerStoreProfilePage.jsx`
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`
- `reports/p1-seller-workspace-ux-polish-2026-05-20-report.md`

## Before / After Behavior

Before:
- Seller payment setup showed request and QRIS details, but sellers had to infer whether checkout could use the setup.
- Store readiness showed setup checks, but public gate/source-of-truth messaging was not compact.
- Order list next-action blockers were mostly implicit when no seller action was available.
- Order detail status data existed, but the first action a seller should care about was not summarized.

After:
- Payment profile now shows a "Checkout authority" card with buyer checkout availability, active setup, open request, and admin authority note.
- Store profile now shows "Public gate" and "Readiness source" cards based on backend readiness/boundary fields.
- Orders now show compact scope chips: active store only, fulfill after paid, and admin audit aligned.
- Blocked/no-action order rows now display the blocked reason directly.
- Order detail now includes a "Seller action snapshot" with next seller action, store split payment, shipment, and parent order state.
- Dashboard readiness now surfaces backend boundary text when provided by the readiness API.

## Admin / Seller / Client Sync Confirmation

- Payment: Seller UI still reads `activeSnapshot`, `pendingRequest`, and `readModel` from `getSellerPaymentProfile`. Pending/revision requests are not treated as active checkout setup.
- Store readiness: Seller UI still reads backend readiness via store profile and workspace readiness APIs. Storefront/public readiness remains backend-owned.
- Order: Seller order list/detail still read seller-scoped suborders only. Status display remains derived from existing seller order read models.
- Client checkout: No checkout code changed in this task. Existing payment readiness guard remains intact.
- Admin authority: Seller payment/profile copy explicitly states admin remains final reviewer/activation authority. No seller self-activation path was introduced.

## Manual Route Checklist

Seller:
- `/seller/stores/:storeSlug`
- `/seller/stores/:storeSlug/dashboard`
- `/seller/stores/:storeSlug/store-profile`
- `/seller/stores/:storeSlug/payment-profile`
- `/seller/stores/:storeSlug/orders`
- `/seller/stores/:storeSlug/orders/:suborderId`

Client cross-check:
- Product detail remains guarded by previous backend readiness work.
- Cart/checkout payment availability remains backend-preview driven.
- Order tracking remains unchanged.

Admin cross-check:
- Store profile, store payment, payment audit, and shipping reconciliation contracts were not changed.
- `qa:shipping:release` included seller, client, and admin browser assertions across shipment reconciliation.

## Commands Run

- `pnpm.cmd --filter client build`
- `pnpm.cmd qa:mvf:store-readiness`
- `pnpm.cmd qa:mvf:order-payment`
- `pnpm.cmd qa:shipping:release`
- `pnpm.cmd qa:admin:public-auth`
- `git diff --check`

## Results

- `pnpm.cmd --filter client build`: passed on rerun. First run completed TypeScript and Vite build, then hit a Windows Node/libuv post-build assertion: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`. Rerun passed cleanly.
- `pnpm.cmd qa:mvf:store-readiness`: passed.
- `pnpm.cmd qa:mvf:order-payment`: passed.
- `pnpm.cmd qa:shipping:release`: passed.
- `pnpm.cmd qa:admin:public-auth`: passed. Expected negative-case console 400/403 messages appeared.
- `git diff --check`: passed.

## Remaining Risks

- This task did not perform a visual browser walkthrough beyond the QA browser coverage included in the existing scripts.
- Seller dashboard and seller order detail can still be further refined visually, but current changes stay intentionally small for production safety.

## Recommended Next Task

Run a focused visual QA pass for Seller Workspace responsive states on mobile/tablet, especially order tables and payment profile QRIS preview.
