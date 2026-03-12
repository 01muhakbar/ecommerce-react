# SELLER-S1A - Seller Access Boundary Hardening

Date: 2026-03-12
Scope: hardening seller payment review boundary for legacy payment/suborder lane without deleting compatibility routes.

## Goal

Tighten seller payment review authorization so the legacy payment/suborder lane no longer drifts away from the newer store-scoped seller workspace model.

## Repo audit before coding

Files audited:

- `server/src/routes/seller.payments.ts`
- `server/src/routes/seller.orders.ts`
- `server/src/routes/seller.paymentProfiles.ts`
- `server/src/routes/seller.workspace.ts`
- `server/src/routes/admin.payments.audit.ts`
- `server/src/routes/admin.storePaymentProfiles.ts`
- `client/src/api/sellerPayments.ts`
- `client/src/api/sellerOrders.ts`
- `client/src/pages/account/AccountStorePaymentReviewPage.jsx`
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`
- `CODEx_REPORTS/SELLER-S0-audit-stabilization-map-2026-03-11.md`
- `CODEx_REPORTS/SW-04-PERMISSION-ARCH.md`

## ACUAN

- Amati:
  - seller workspace routes already using `/api/seller/stores/:storeId/...`
  - `requireSellerStoreAccess` and `resolveSellerAccess`
  - seller order lane as the strongest existing store-scoped payment/suborder read model
- Tiru:
  - backend-driven permission resolution
  - explicit tenant boundary in route shape
  - compatibility-first approach without removing legacy endpoints
- Modifikasi:
  - only seller payment review route and its direct frontend consumer
  - no schema change
  - no admin payment audit rewrite

## What changed

### Backend

- Added explicit store-scoped bridge routes:
  - `GET /api/seller/stores/:storeId/payment-review/suborders`
  - `PATCH /api/seller/stores/:storeId/payments/:paymentId/review`
- Kept legacy compatibility routes:
  - `GET /api/seller/suborders`
  - `PATCH /api/seller/payments/:paymentId/review`
- Split payment review policy into:
  - `canViewSellerPaymentReview`
  - `canMutateSellerPaymentReview`
- View access now follows seller permission matrix:
  - requires `ORDER_VIEW`
  - requires `PAYMENT_STATUS_VIEW`
- Mutation remains limited to:
  - `STORE_OWNER`
  - `STORE_ADMIN`
- Added governance metadata in payment review list response so frontend can render read-only state without guessing from role code.
- Added explicit store-scope mismatch guard for store-scoped review mutation route.

### Frontend

- `sellerPayments` API can now call either:
  - legacy review route
  - store-scoped bridge route
- `AccountStorePaymentReviewPage` now:
  - handles `SELLER_STORE_SCOPE_REQUIRED`
  - lets user choose store scope when legacy route is ambiguous
  - uses store-scoped mutation route when store scope is known
  - respects backend governance and disables review actions for read-only roles

## Source of truth after this task

- Seller access source of truth:
  - `resolveSellerAccess`
  - `requireSellerStoreAccess`
- Seller payment review read boundary:
  - seller permission keys `ORDER_VIEW + PAYMENT_STATUS_VIEW`
- Seller payment review mutation boundary:
  - store-scoped seller access plus role restriction `STORE_OWNER | STORE_ADMIN`
- Legacy route status:
  - still supported as compatibility bridge
  - no longer the only path
  - no longer silently assumes store scope when multiple stores exist

## Mandatory sync check

### Admin Workspace

- Checked `admin.payments.audit.ts` and `admin.storePaymentProfiles.ts`
- No admin API contract changed
- No admin route removed
- Admin payment audit remains read/audit authority

### Seller Workspace

- New store-scoped bridge route aligns payment review with existing `/api/seller/stores/:storeId/...` tenancy pattern
- Seller orders/detail routes remain unchanged
- Seller finance/order roles now have consistent read visibility model for payment review data
- Mutation is still intentionally not opened to `FINANCE_VIEWER`

### Client / Storefront

- Buyer payment proof submission and order tracking routes were audited conceptually through existing payment and order flow usage
- No client/storefront API contract changed
- Parent order aggregation still uses existing `recalculateParentOrderPaymentStatus`

### Permission matrix / query keys / route guard

- Permission behavior now matches `SW-04-PERMISSION-ARCH` more closely:
  - `FINANCE_VIEWER` stays read-only
  - `ORDER_MANAGER` can view payment status data, not mutate payment review
- Query keys for review page now include explicit review scope state
- Seller workspace route guard pattern reused via `requireSellerStoreAccess`

## Files changed

- `server/src/routes/seller.payments.ts`
- `client/src/api/sellerPayments.ts`
- `client/src/pages/account/AccountStorePaymentReviewPage.jsx`
- `CODEx_REPORTS/SELLER-S1A-boundary-hardening-2026-03-12.md`

## Risks

- Legacy account/admin wrapper page still represents an older UX lane and is not yet a first-class seller workspace page.
- Payment review mutation still relies on role-code restriction because there is no dedicated payment-review write permission key yet.
- Multi-store users now need explicit scope selection on the legacy page; this is safer, but changes old ambiguous behavior.

## Verification

Planned verification for this task:

- `pnpm --filter server build`
- `pnpm --filter client build`

## Not done

- No new seller workspace payment review page was added.
- No schema migration or permission registry expansion was introduced.
- No legacy route was deleted.
- No admin/client payment architecture rewrite was attempted.
