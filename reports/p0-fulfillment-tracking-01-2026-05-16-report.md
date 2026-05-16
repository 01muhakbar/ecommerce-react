# P0-FULFILLMENT-TRACKING-01 Report

## Ringkasan
Audit fulfillment/tracking selesai. Flow setelah payment approved sudah sinkron: Seller melakukan fulfillment suborder, backend memblokir fulfillment sebelum split payment `PAID`, Admin membaca monitor/reconciliation dari read model yang sama, Client account order page dan Public Tracking membaca status shipment/tracking yang sama. Patch minimal hanya dilakukan pada smoke shipment reconciliation agar assertion mengikuti boundary public tracking dan fixture memenuhi guard shipping setup production.

## Product Boundary Decision
- Seller adalah aktor utama fulfillment suborder.
- Admin monitor/reconciliation membaca shipment truth; existing Admin correction lane untuk exception shipment tetap ada dan tidak diubah.
- Buyer account/order page dan Public Tracking membaca status fulfillment/shipping dari backend.
- Backend tetap source of truth untuk `Order`, `Suborder`, `Shipment`, `TrackingEvent`, dan read model.

## Scope
- Seller fulfillment route: `PATCH /api/seller/stores/:storeId/suborders/:suborderId/fulfillment`.
- Backend guard sebelum fulfillment dan shipment mutation.
- Shipping/tracking read model di `orderShippingReadModel.service.ts`.
- Admin order detail dan shipping reconciliation.
- Buyer account order detail dan public tracking `/order/:ref`.
- Smoke/e2e fulfillment visibility dan shipment reconciliation.

## File Diubah
- `tools/qa/shipment-reconciliation-smoke.ts`
- `reports/p0-fulfillment-tracking-01-2026-05-16-report.md`

## Fulfillment/Tracking Flow Audit
- Seller fulfillment route: `server/src/routes/seller.orders.ts` route `PATCH /stores/:storeId/suborders/:suborderId/fulfillment`.
- Backend fulfillment guard: route guard `resolveFulfillmentTransitionBlocker` dan service guard `applySellerShipmentFulfillment` sama-sama mensyaratkan `Suborder.paymentStatus=PAID`.
- Admin monitor/reconciliation route: `GET /api/admin/orders/:id`, `GET /api/admin/orders/by-invoice/:invoiceNo`, dan `GET /api/admin/orders/shipping-reconciliation/report`. Existing `PATCH /api/admin/orders/:id/suborders/:suborderId/shipment-correction` hanya untuk correction lane yang sudah ada.
- Client account order page: `client/src/pages/account/AccountOrderDetailPage.jsx` membaca grouped order/payment/shipment data dari backend.
- Public tracking route/page: `GET /api/store/orders/:ref` di `server/src/routes/store.ts` dan `client/src/pages/store/StoreOrderTrackingPage.jsx`.
- Read model source: `server/src/services/orderShippingReadModel.service.ts`, plus `buildSplitOperationalTruth` untuk split status presentation.
- Risiko awal: public tracking sengaja menyembunyikan internal shipment/store/suborder IDs, sedangkan smoke shipment reconciliation lama membandingkan ID internal lintas public/client route.

## Existing Fulfillment Status Matrix

| Event | Order.status | Order.paymentStatus | Suborder.paymentStatus | Suborder.fulfillmentStatus | Shipment.status | TrackingEvent | Admin View | Seller View | Client/Public View |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Order created | `pending` | `UNPAID` | `UNPAID` | `UNFULFILLED` | `WAITING_PAYMENT` when shipment MVP persists shipment | `WAITING_PAYMENT` system event | Sees unpaid/unfulfilled split and waiting shipment | Sees fulfillment blocked by payment | Sees payment required and shipment waiting |
| Payment approved | `processing` | `PAID` when all splits paid | `PAID` | `UNFULFILLED` | effective `READY_TO_FULFILL` | `READY_TO_FULFILL` sync event when mutation path starts | Sees paid split and ready shipment | MARK_PROCESSING/pack becomes available | Sees paid and ready-to-fulfill shipment |
| Seller marks processing/packed | `processing` | `PAID` | `PAID` | `PROCESSING` | `PACKED` | `PACKED` seller event | Sees split fulfillment `PROCESSING`, shipping `PACKED` | Sees next action MARK_SHIPPED | Sees packed/preparing shipment |
| Tracking number added | same as shipped event | `PAID` | `PAID` | `SHIPPED` | `SHIPPED` | `SHIPPED` seller event with courier/tracking metadata | Sees tracking number/courier in shipment audit | Sees tracking retained and next action MARK_DELIVERED | Public/client show tracking number and shipped status |
| Delivered/completed if existing | `delivered` for all active splits delivered | `PAID` | `PAID` | `DELIVERED` | `DELIVERED` | `DELIVERED` seller event | Sees delivered aggregate/split shipment | No forward seller action remains | Client/Public show delivered |

Notes:
- There is no separate standalone tracking-number-only endpoint in this flow. Tracking number is required by `MARK_SHIPPED`.
- Compatibility status maps `Shipment.status=PACKED` to `Suborder.fulfillmentStatus=PROCESSING`.
- Shipment exception statuses (`FAILED_DELIVERY`, `RETURNED`, `CANCELLED`) already exist; no enum or lifecycle was changed.

## Fulfillment Guard Audit
- Guard location: `server/src/routes/seller.orders.ts` and `server/src/services/shipmentMutation.service.ts`.
- Required payment status: `Suborder.paymentStatus=PAID`.
- Error response before paid: HTTP 409 with `code: "SUBORDER_PAYMENT_NOT_SETTLED"`.
- Smoke/e2e coverage: `pnpm -F server smoke:order-payment` asserts pre-payment fulfillment is blocked, then packed/shipped/delivered sync across Seller/Admin/Public. `pnpm -F server smoke:shipment-regression` and `pnpm qa:e2e:shipment-reconciliation` further verify shipment route parity.
- Risiko bypass: low; route-level and service-level guards both enforce payment settlement and parent order non-final state.
- Patch minimal: no runtime guard patch required.

## Cross-App Fulfillment Read Model Audit
- Backend source endpoint:
  - Seller: `/api/seller/stores/:storeId/suborders/:suborderId`.
  - Admin: `/api/admin/orders/:id`, `/api/admin/orders/by-invoice/:invoiceNo`, and shipping reconciliation report.
  - Client account: `/api/store/orders/my/:orderId` and grouped payment/order endpoint.
  - Public tracking: `/api/store/orders/:ref`.
- Admin mapping: order detail and reconciliation use `buildOrderShippingReadModel`, `shipmentAuditMeta`, `suborderShipmentSummary`, persisted `Shipment`, and `TrackingEvent`.
- Seller mapping: seller detail reads split-scoped payment/fulfillment/shipment summary and backend actionability.
- Client mapping: account order detail reads grouped backend data, normalized shipment list, split operational truth, and tracking events.
- Public tracking mapping: public route sanitizes shipment data and intentionally omits internal IDs while preserving status, courier/tracking, timeline, and split shipment truth.
- Mismatch: no runtime mismatch found. Smoke mismatch was QA-only: public route privacy sanitization conflicted with internal-ID parity assertion.
- Patch minimal: adjusted shipment reconciliation smoke to compare public-safe shipment truth and aligned fixture store shipping setup with backend guard.

## Patch Minimal
- `tools/qa/shipment-reconciliation-smoke.ts`: route parity assertion now ignores internal `shipmentId`, `storeId`, and `suborderId` because Public Tracking intentionally does not expose them.
- `tools/qa/shipment-reconciliation-smoke.ts`: fixture stores now include valid shipping setup/origin fields, matching `smokeShipmentRegression` and the production backend guard.
- No runtime route, schema, lifecycle enum, UI redesign, or Admin/Seller/Client API contract was changed.

## Dampak Admin/Seller/Client
### Admin
Admin monitor/reconciliation continues to read persisted shipment truth, compatibility status, tracking anomalies, and existing correction lane. No new Admin fulfillment mutation was added.

### Seller
Seller remains the fulfillment authority for suborders. Fulfillment stays blocked until split payment is `PAID`, then seller can pack, ship with courier/tracking, and deliver according to backend actionability.

### Client
Buyer account order page reads the same shipment summary/tracking timeline from backend grouped order data.

### Backend
Backend remains source of truth. Existing guards and read models were verified; only QA smoke was adjusted.

## Validasi
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm -F server smoke:checkout-variants`: PASS
- `pnpm -F server smoke:checkout-coupons`: PASS
- `pnpm -F server smoke:order-payment`: PASS
- `pnpm qa:e2e:truth`: PASS
- `pnpm -F server smoke:shipment-regression`: PASS
- `pnpm qa:e2e:shipment-reconciliation`: PASS after QA smoke patch
- `git diff --check`: PASS

## Risiko Tersisa
- Public Tracking intentionally does not expose internal shipment/store/suborder IDs. Future public parity tests should compare public-safe shipment truth, not private identifiers.
- Existing Admin shipment correction lane can mutate exception shipment states; this task did not change that authority and treats it as existing reconciliation behavior.
- Shipment readiness depends on store shipping setup. Production seed/onboarding must keep store shipping setup complete before seller shipment mutation.

## Next Suggested Task
Run production-like browser QA for a multi-store order with one split shipped and another delivered, then capture Seller/Admin/Client/Public tracking screenshots for release sign-off.
