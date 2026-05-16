# P0-PAYMENT-PROOF-01 Report

## Ringkasan
Audit payment proof selesai dengan boundary produksi seller-only review dan Admin read-only audit. Buyer proof submit, Seller approve/reject, fulfillment gating, Admin audit, Client order payment page, dan Public Tracking sudah memakai backend sebagai source of truth. Tidak ada runtime patch yang diperlukan karena smoke dan e2e truth existing sudah membuktikan jalur approve, reject, dan fulfillment gating.

## Product Boundary Decision
Current production boundary:
- Buyer submits proof.
- Seller reviews proof.
- Admin audits payment proof/status read-only.

Reason:
- Matches existing implementation.
- Avoids competing approval authorities.
- Avoids race between Seller and Admin.
- Keeps production scope minimal.

## Scope
- Buyer proof submit route: `POST /api/payments/:paymentId/proof`.
- Seller review route: `PATCH /api/seller/stores/:storeId/payments/:paymentId/review`.
- Admin read-only audit routes: `GET /api/admin/payments/audit` and `GET /api/admin/payments/audit/:orderId`.
- Seller order detail payment status, proof summary, and fulfillment gating.
- Client payment/order page proof actionability and status rendering.
- Public tracking payment/order status sync.
- Existing smoke/e2e assertions for proof submit, seller approval/rejection, Admin visibility, and fulfillment unlock.

## File Diubah
- `reports/p0-payment-proof-01-2026-05-16-report.md`

No runtime files were changed for this task.

## Payment Proof Flow Audit
- Buyer payment page: `client/src/pages/account/AccountOrderPaymentPage.jsx` reads order payment groups, payment read model, proof metadata, and backend actionability. Proof submission calls `submitPaymentProof` from `client/src/api/orderPayments.ts`.
- Proof submit/upload route: `POST /api/payments/:paymentId/proof` in `server/src/routes/payments.ts`, protected by auth and payment mutation rate limit. It verifies buyer ownership, accepts only `CREATED` or `REJECTED` payment states, creates `PaymentProof(reviewStatus=PENDING)`, sets `Payment.status=PENDING_CONFIRMATION`, sets `Suborder.paymentStatus=PENDING_CONFIRMATION`, recalculates parent order payment status, logs actor `BUYER`, and notifies Seller.
- Admin audit route: `server/src/routes/admin.payments.audit.ts` exposes only `GET /` and `GET /:orderId`. It serializes parent order status, split status, latest payment status, latest proof summary, proof review metadata, and logs.
- Seller order read route: `server/src/routes/seller.orders.ts` returns suborder payment status, latest payment/proof summary, payment summary, fulfillment governance, and shipment/read model data.
- Public tracking route: `GET /api/store/orders/:ref` in `server/src/routes/store.ts` reads invoice, payment/split contract, grouped payment read model, and shipping read model from backend.
- Payment status source: `Payment.status` for payment proof lifecycle; `Suborder.paymentStatus` for seller split operational state; `Order.paymentStatus` is recalculated from suborders and remains parent aggregate truth.
- Order/Suborder status sync source: `recalculateParentOrderPaymentStatus` and seller payment review transaction updates.
- Risiko awal: Admin approval was not implemented, which is now accepted as product boundary: Admin audits only; Seller is the review authority.

## Existing Payment Status Matrix

| Event | Payment.status | Order.paymentStatus | Suborder.paymentStatus | Admin Audit | Seller View | Client/Public View |
| --- | --- | --- | --- | --- | --- | --- |
| Order created | `CREATED` | `UNPAID` | `UNPAID` | Read-only sees created payment, unpaid parent/split, no reviewed proof | Sees unpaid split, proof not ready, fulfillment blocked | Sees unpaid order/split and payment instruction/proof action |
| Buyer proof submitted | `PENDING_CONFIRMATION` | `UNPAID` | `PENDING_CONFIRMATION` | Read-only sees pending payment/proof metadata/logs | Sees pending review lane and can approve/reject | Sees proof under review; public split contract shows pending confirmation while parent remains unpaid |
| Seller approved | `PAID` | `PAID` when all suborders are paid | `PAID` | Read-only sees paid payment, approved proof, seller log | Sees paid split and fulfillment actions unlock | Sees paid order/split; public tracking shows paid split/status |
| Seller rejected | `REJECTED` | `UNPAID` | `UNPAID` | Read-only sees rejected payment/proof and seller log | Sees rejected payment/proof, fulfillment stays blocked | Sees rejected proof/action required and can resubmit from allowed state |

Notes:
- Parent `Order.paymentStatus` is aggregate-only: `UNPAID`, `PAID`, or `PARTIALLY_PAID`. It does not become `PENDING_CONFIRMATION`; pending review truth lives on `Payment.status` and `Suborder.paymentStatus`.
- No new status enum or lifecycle state was added.

## Seller Review Audit
- Review authority: Seller only.
- Review endpoint: `PATCH /api/seller/stores/:storeId/payments/:paymentId/review`.
- Allowed current state: `Payment.status=PENDING_CONFIRMATION`.
- Required proof state: latest proof exists and `PaymentProof.reviewStatus=PENDING`.
- Approve behavior: sets `Payment.status=PAID`, `Payment.paidAt`, `Suborder.paymentStatus=PAID`, `Suborder.fulfillmentStatus=UNFULFILLED`, latest proof `APPROVED`, status log actor `SELLER`, and recalculates parent order payment status.
- Reject behavior: sets `Payment.status=REJECTED`, clears paid timestamps, sets `Suborder.paymentStatus=UNPAID`, latest proof `REJECTED`, status log actor `SELLER`, and recalculates parent order payment status.
- Smoke coverage: `pnpm -F server smoke:order-payment` covers approve and reject scenarios end-to-end.

## Admin Read-only Audit
- Admin API: only `GET /api/admin/payments/audit` and `GET /api/admin/payments/audit/:orderId` exist for payment audit.
- Admin client API: `client/src/api/adminPaymentAudit.ts` uses read-only `GET` calls.
- Admin UI: payment audit list/detail pages show payment status, parent/split status, proof metadata/path/status, review metadata, and logs.
- Admin mutation: not added.
- Admin approve/reject UI: not added.
- Boundary risk: low after decision, because one review authority avoids conflicting seller/admin approvals.

## Fulfillment Gating Audit
- Seller UI gating: `client/src/pages/seller/SellerOrderDetailPage.jsx` renders fulfillment/shipment actions from backend governance/actionability and hides or disables actions when payment is not valid.
- Backend route guard: `server/src/routes/seller.orders.ts` calls `resolveFulfillmentTransitionBlocker` before fulfillment mutation; payment must be `PAID`, otherwise it returns 409 with `SUBORDER_PAYMENT_NOT_SETTLED`.
- Service guard: `server/src/services/shipmentMutation.service.ts` also blocks shipment/fulfillment mutation unless `Suborder.paymentStatus=PAID`.
- Status that opens fulfillment: `Suborder.paymentStatus=PAID`.
- Risiko bypass: low; both route and service layers enforce the payment guard.
- Patch minimal: none required.

## Cross-App Payment Read Model Audit
- Backend source endpoint:
  - Buyer payment detail: `/api/payments/:paymentId`.
  - Buyer/public order truth: `/api/store/orders/:ref` and account order APIs.
  - Seller order detail/payment review: seller orders/payment routes.
  - Admin payment audit: `/api/admin/payments/audit`.
- Admin mapping: read-only audit uses parent order status, split payment status, latest payment status, latest proof summary, and payment logs.
- Seller mapping: seller detail uses suborder payment status, latest payment/proof summary, payment summary, and fulfillment governance.
- Client mapping: account payment page reads backend read model/actionability and proof metadata; no local lifecycle is invented.
- Public tracking mapping: reads backend public order/tracking response and split contract payment status.
- Mismatch: none found under selected seller-only boundary.
- Patch minimal: none required.

## Patch Minimal
No runtime patch was applied for this task. Existing backend guards and smoke/e2e coverage already match the accepted product boundary:
- Buyer submits proof.
- Seller approves/rejects proof.
- Admin audits read-only.
- Fulfillment unlocks only after seller-approved paid status.

## Dampak Admin/Seller/Client
### Admin
Admin remains read-only for payment proof audit. It can monitor proof metadata, review status, payment status, split status, and logs, but does not approve/reject.

### Seller
Seller remains the only manual payment proof review authority. Seller fulfillment stays blocked until `Suborder.paymentStatus=PAID`.

### Client
Buyer can view payment instructions, upload/submit proof, see pending review/rejected/paid state, and follow public tracking using backend status.

### Backend
Backend remains the source of truth. No schema, lifecycle enum, public route, or permission boundary was changed.

## Validasi
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm -F server smoke:checkout-variants`: PASS
- `pnpm -F server smoke:checkout-coupons`: PASS
- `pnpm -F server smoke:order-payment`: PASS
- `pnpm qa:e2e:truth`: PASS
- `git diff --check`: PASS

## Risiko Tersisa
- Parent `Order.paymentStatus` intentionally stays aggregate-only and does not show `PENDING_CONFIRMATION`; UI/read models must continue to use split/payment read model when displaying proof review state.
- Manual payment proof review remains seller-operated; Admin audit wording should continue to avoid implying Admin can review payment proof.

## Next Suggested Task
Run a focused production rehearsal with seeded manual-payment orders: proof upload, seller reject/resubmit, seller approve, fulfillment, public tracking, and Admin audit screenshots against the production-like environment.
