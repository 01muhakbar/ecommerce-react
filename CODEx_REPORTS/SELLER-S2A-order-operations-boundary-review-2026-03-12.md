# SELLER-S2A - Seller Order Operations Boundary Review

Date: 2026-03-12
Scope: audit and harden seller order operations boundary for list, detail, and fulfillment mutation without changing admin or storefront contracts.

## Goal

Confirm that seller order operations stay store-scoped, permission-aware, and operationally safe, then patch any small-to-medium boundary gap found during the audit.

## Repo audit before coding

Files audited:

- `server/src/routes/seller.orders.ts`
- `client/src/api/sellerOrders.ts`
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`
- `server/src/middleware/requireSellerStoreAccess.ts`
- `server/src/services/seller/resolveSellerAccess.ts`
- `CODEx_REPORTS/SELLER-S0-audit-stabilization-map-2026-03-11.md`

## Boundary review

### A. Visibility boundary

Assessment: mostly safe

- Seller list route uses `GET /api/seller/stores/:storeId/suborders`.
- Seller detail route uses `GET /api/seller/stores/:storeId/suborders/:suborderId`.
- Both routes are protected by `requireSellerStoreAccess(["ORDER_VIEW"])`.
- Backend query scope is anchored to `Suborder.storeId`.
- Multi-store ambiguity is avoided because store context is route-driven, not inferred from account defaults.

Residual note:

- Parent order data is intentionally exposed as read-only reference through the seller suborder read model, which is acceptable because seller visibility still originates from the scoped suborder.

### B. Action boundary

Assessment: mostly safe

- Seller fulfillment mutation is limited to:
  - `PATCH /api/seller/stores/:storeId/suborders/:suborderId/fulfillment`
- Route requires:
  - `ORDER_VIEW`
  - `ORDER_FULFILLMENT_MANAGE`
- Action set is intentionally narrow:
  - `MARK_PROCESSING`
  - `MARK_SHIPPED`
  - `MARK_DELIVERED`
- Admin-only actions remain described as admin-only in governance metadata and are not opened to seller mutation.

### C. Status governance

Assessment: one critical UI/API consistency gap found and fixed

Expected rules already present in backend:

- seller fulfillment cannot move when parent order is cancelled
- seller fulfillment cannot move until the scoped suborder payment is settled
- seller fulfillment transitions are forward-only and suborder-scoped

Gap found:

- `GET seller suborder detail` recalculated `governance.fulfillment` without carrying the blocker info already computed inside `serializeDetail`.
- Result:
  - detail page could show fulfillment actions as available even when the suborder payment was not paid or the parent order was cancelled
  - mutation endpoint still rejected the action, so backend safety remained intact
  - but the seller detail lane became operationally misleading

Fix applied:

- detail route now returns the serializer output directly instead of overwriting governance with a weaker version

### D. UX boundary

Assessment: safe enough for current phase after fix

- Orders list and detail are native seller workspace pages, not account-lane reuse.
- Empty, error, and read-only states already exist and follow seller workspace patterns.
- After the governance fix, detail-page action visibility is aligned more closely with backend mutation rules.

## Change applied

- Patched `server/src/routes/seller.orders.ts` so seller order detail no longer drops fulfillment blocker context from the serialized governance payload.

## Files changed

- `server/src/routes/seller.orders.ts`
- `CODEx_REPORTS/SELLER-S2A-order-operations-boundary-review-2026-03-12.md`

## Why this change was enough

- No schema issue was discovered.
- No route namespace refactor was required.
- No admin contract or client/storefront contract had to move.
- The main boundary problem was a detail-response governance mismatch, not a systemic seller-order architecture failure.

## Risks

- Seller orders still depend on a phase-1 fulfillment model, so future expansion to returns, cancellations, or richer shipment events will need a separate governance review.
- Parent order data remains visible as read-only reference; this is correct now, but future seller-write features must keep that distinction strict.

## Verification

Planned verification:

- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm qa:mvf` only to confirm whether the same unrelated pre-existing QA failure still remains

## Not changed on purpose

- No payout work
- No admin order contract change
- No checkout/storefront change
- No permission model expansion
- No route refactor
