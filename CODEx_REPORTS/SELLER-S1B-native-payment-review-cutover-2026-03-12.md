# SELLER-S1B - Native Seller Payment Review Page Cutover

Date: 2026-03-12
Scope: add a seller-native payment review page that uses the store-scoped boundary from SELLER-S1A, while keeping legacy account/admin entry paths intact.

## Goal

Move seller payment review UX into Seller Workspace as the primary native entry, without deleting the legacy lane or changing admin and storefront contracts.

## Repo audit before coding

Files audited:

- `client/src/layouts/SellerLayout.jsx`
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- `client/src/pages/account/AccountStorePaymentReviewPage.jsx`
- `client/src/api/sellerPayments.ts`
- `client/src/App.jsx`
- `client/src/pages/seller/sellerAccessState.js`
- `server/src/routes/seller.payments.ts`
- `CODEx_REPORTS/SELLER-S1A-boundary-hardening-2026-03-12.md`

## ACUAN

- Amati:
  - seller workspace page rhythm in orders, order detail, and payment profile pages
  - seller sidebar and page meta handling in `SellerLayout`
  - store-scoped seller payment review endpoints from SELLER-S1A
- Tiru:
  - seller-native section header, state panel, badge, notice, and panel patterns
  - route namespace `/seller/stores/:storeId/...`
  - backend-governed read-only versus mutation-open UI
- Modifikasi:
  - add one new seller page
  - add one new seller route
  - add one new seller sidebar entry
  - add explicit store-scoped client API helpers

## What changed

### Seller-native page

- Added `SellerPaymentReviewPage` as a native Seller Workspace module.
- Page always resolves scope from seller route `:storeId`.
- No scope picker is used in this native page.
- Page shows:
  - payment review governance
  - filter tabs
  - loading / error / empty / read-only state
  - proof summary
  - approve / reject actions when backend governance allows mutation

### Routing and navigation

- Added route:
  - `/seller/stores/:storeId/payment-review`
- Added seller sidebar entry:
  - `Payment Review`
- Entry visibility follows existing permission keys:
  - `ORDER_VIEW`
  - `PAYMENT_STATUS_VIEW`

### Client API layer

- Added explicit store-scoped helpers:
  - `getSellerPaymentReviewSuborders(storeId, paymentStatus)`
  - `reviewSellerStorePayment(storeId, paymentId, payload)`
- Kept compatibility helper paths for legacy consumers untouched.

## Mandatory sync check

### Seller Workspace

- Native seller entry now exists and no longer depends on the account-style page as the main seller UX.
- Seller route is fully store-scoped and aligned with the seller workspace shell.
- Read-only seller roles can still inspect payment review data safely.

### Admin Workspace

- No admin route changed.
- No admin API contract changed.
- Legacy admin wrapper page still points to the old compatibility lane.

### Client / Storefront

- No checkout route changed.
- No payment proof upload contract changed.
- No storefront tracking or payment flow contract changed.

### Permission / route guard / query key

- Native seller page uses existing seller workspace context plus backend governance from store-scoped payment review response.
- No new permission key was introduced.
- Query keys are isolated under `["seller", "payment-review", storeId, filter]`.

## Files changed

- `client/src/api/sellerPayments.ts`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`
- `client/src/layouts/SellerLayout.jsx`
- `client/src/App.jsx`
- `CODEx_REPORTS/SELLER-S1B-native-payment-review-cutover-2026-03-12.md`

## Risks

- Legacy account/admin review page still exists, so there are now two UX entry points until a later cleanup phase.
- Sidebar entry is permission-based and intentionally small; broader seller finance IA was not refactored.
- Review mutation still follows the current backend governance model and does not introduce a new write permission key.

## Verification

Planned verification for this task:

- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm qa:mvf` only to confirm whether the same unrelated pre-existing failure still remains

## Not changed on purpose

- No backend contract refactor
- No admin contract change
- No storefront flow change
- No legacy route removal
- No permission model expansion
