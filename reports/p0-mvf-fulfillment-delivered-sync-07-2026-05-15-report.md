# P0-MVF-FULFILLMENT-DELIVERED-SYNC-07 Report

Tanggal: 2026-05-15

## Tujuan

Audit dan kunci transisi fulfillment lanjutan setelah payment `PAID` agar Seller, Admin, dan Client/public tracking membaca status yang konsisten dari `PACKED` sampai `SHIPPED` dan `DELIVERED`.

## Temuan Sinkronisasi

1. Status persisted setelah `PACKED`:
   - Seller action `MARK_PROCESSING` menyimpan `Suborder.fulfillmentStatus=PROCESSING`.
   - Shipment canonical menyimpan `Shipment.status=PACKED`.
   - Parent single-split tersinkron ke `Order.status=processing`.

2. Action lanjutan setelah `PACKED`:
   - `MARK_SHIPPED` tersedia setelah fulfillment `PROCESSING`.
   - Backend mewajibkan `trackingNumber` dan salah satu dari `courierCode` atau `courierService`.

3. Status persisted setelah shipped/delivered:
   - `MARK_SHIPPED` menyimpan `Suborder.fulfillmentStatus=SHIPPED`, `Shipment.status=SHIPPED`, dan parent single-split `Order.status=shipped`.
   - `MARK_DELIVERED` menyimpan `Suborder.fulfillmentStatus=DELIVERED`, `Shipment.status=DELIVERED`, dan parent single-split `Order.status=delivered`.
   - `Order.paymentStatus`, `Suborder.paymentStatus`, dan `Payment.status` tetap `PAID`.

4. Admin membaca status shipping dari:
   - `groups[*].shippingStatus`
   - `suborderShipmentSummary[*].shippingStatus`
   - `shipments[*].shipmentStatus`
   - top-level `shippingStatus`

5. Seller membaca fulfillment/shipping dari:
   - `fulfillmentStatus`
   - `shippingStatus`
   - `shipments[*].shipmentStatus`
   - `operationalTruth.shipment.status`

6. Client/public tracking membaca status dari:
   - `GET /api/store/orders/:invoiceNo`
   - top-level `shippingStatus`
   - `storeSplits[*].shippingStatus`
   - `storeSplits[*].shippingStatusMeta`
   - `storeSplits[*].operationalTruth.statusSummary`
   - `shipments[*].shipmentStatus`

7. Parent aggregate dan split/suborder boleh berbeda pada multi-store partial fulfillment. Smoke ini mengunci kasus single-split agar parent mengikuti split, dan tetap memastikan canonical split/shipment tidak tertimpa oleh presentational status.

8. Delivered tidak mengubah settlement/payout readiness pada flow yang diaudit. Task ini hanya melaporkan audit, tidak menambah fitur settlement.

9. Smoke yang sudah mengunci flow delivered/completed:
   - `server smoke:order-payment` sekarang mengunci `PAID -> PACKED -> SHIPPED -> DELIVERED` lintas Seller/Admin/Public.
   - `qa:e2e:truth` tetap pass untuk public/client/admin shipment browser assertions.

10. Gap sebelum task ini:
    - `smoke:order-payment` sebelumnya sudah mengunci payment paid dan packed readiness, tetapi belum mengunci action `MARK_SHIPPED`, guard tracking/courier, action `MARK_DELIVERED`, dan pembacaan status lanjutannya di Admin serta Client/public tracking.

## Perubahan

- `server/src/scripts/smokeOrderPayment.ts`
  - Menambahkan body opsional pada helper guard seller fulfillment.
  - Menambahkan helper mutasi fulfillment seller yang reusable untuk action existing.
  - Menambahkan assertion `MARK_SHIPPED` guard:
    - tanpa tracking number -> `TRACKING_NUMBER_REQUIRED`
    - tanpa courier detail -> `COURIER_DETAILS_REQUIRED`
  - Menambahkan assertion valid `MARK_SHIPPED`:
    - Seller membaca `SHIPPED`.
    - Admin reconciliation membaca `SHIPPED`.
    - Client/public tracking membaca canonical `SHIPPED` dengan label buyer-friendly `Shipped`.
    - Tracking number dan courier service tetap terbaca.
  - Menambahkan assertion valid `MARK_DELIVERED`:
    - Seller membaca `DELIVERED`.
    - Admin reconciliation membaca `DELIVERED`.
    - Client/public tracking membaca canonical `DELIVERED` dengan label buyer-friendly `Delivered`.
    - Tidak ada forward seller fulfillment action setelah delivered.
  - Menyesuaikan assertion public top-level status presentational:
    - shipped dapat tampil sebagai `shipping`.
    - delivered dapat tampil sebagai `complete`.
    - canonical split/shipment tetap dikunci sebagai `SHIPPED` dan `DELIVERED`.

Tidak ada perubahan schema DB, route publik, lifecycle status, auth/session, dependency, build tooling, atau UI.

## Dampak Boundary

- Admin Workspace:
  - Tidak ada perubahan UI/API contract.
  - Smoke memastikan Admin order detail/reconciliation membaca status shipping sama dengan shipment canonical.

- Seller Workspace:
  - Tidak ada perubahan UI/API contract.
  - Smoke memastikan seller tidak blocked setelah paid, dapat lanjut `MARK_PROCESSING`, `MARK_SHIPPED`, dan `MARK_DELIVERED` sesuai action existing.

- Client/Storefront:
  - Tidak ada perubahan UI/API contract.
  - Smoke memastikan public tracking membaca buyer-friendly label dan canonical split/shipment status yang benar.

## Validasi

- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F client build` - PASS
- `pnpm.cmd -F server smoke:checkout-variants` - PASS
- `pnpm.cmd -F server smoke:checkout-coupons` - PASS
- `pnpm.cmd -F server smoke:order-payment` - PASS
- `pnpm.cmd qa:e2e:truth` - PASS
- `pnpm.cmd git diff --check` - PASS
- `git diff --check` - PASS

Catatan: saat checkout smoke sempat dijalankan paralel, DB lokal mengembalikan transient deadlock pada operasi add-to-cart. Rerun serial untuk `smoke:checkout-variants` dan `smoke:checkout-coupons` keduanya PASS.

## Risiko Tersisa

- Coverage `smoke:order-payment` untuk delivered flow memakai skenario single-split. Multi-store partial aggregate tetap perlu mengandalkan smoke reconciliation/shipment existing atau task khusus bila ingin dikunci lebih dalam.
- Public top-level status menggunakan presentational normalization (`shipping`, `complete`), sehingga smoke mengunci canonical status pada split/shipment dan mengizinkan presentational alias di top-level.

## Rollback

Rollback aman dengan mengembalikan perubahan pada `server/src/scripts/smokeOrderPayment.ts` dan menghapus report ini. Tidak ada data migration atau contract change yang perlu di-rollback.
