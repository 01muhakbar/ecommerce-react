# P0-MVF-FULFILLMENT-PAID-SYNC-06 Report

## Ringkasan

Task ini mengunci transisi setelah payment `PAID` tanpa membuat lifecycle baru:

`Payment PAID -> Seller MARK_PROCESSING/Mark packed -> suborder fulfillment PROCESSING -> canonical shipment PACKED -> Admin dan Client/Public tracking membaca status split yang sama.`

Perubahan utama berupa assertion smoke tambahan di `smoke:order-payment` dan adapter kecil pada read model shipment split.

## Frontend <-> Backend Sync Check

1. Payment menjadi `PAID` melalui `PATCH /api/seller/stores/:storeId/payments/:paymentId/review` dengan `action: "APPROVE"`.
2. Setelah payment `PAID`, parent order menjadi:
   - `Order.paymentStatus = PAID`
   - `Order.status = processing`
3. Setelah payment `PAID`, split menjadi:
   - `Suborder.paymentStatus = PAID`
   - `Payment.status = PAID`
   - `Suborder.fulfillmentStatus = UNFULFILLED`
   - shipment/read model `READY_TO_FULFILL`
4. Seller action yang allowed setelah paid:
   - `MARK_PROCESSING` / `Mark packed` dari `UNFULFILLED`
   - next step tetap `MARK_SHIPPED` dari `PROCESSING` dengan tracking dan courier.
5. Admin membaca fulfillment/shipment dari:
   - `groups[*].fulfillmentStatus`
   - `groups[*].shippingStatus`
   - `suborderShipmentSummary[*].shippingStatus`
   - `shipments[*].shipmentStatus`
6. Client/public tracking membaca dari:
   - `GET /api/store/orders/:invoiceNo`
   - `storeSplits[*].shippingStatus`
   - `storeSplits[*].shippingStatusMeta`
   - `storeSplits[*].operationalTruth`
   - `storeSplits[*].paymentReadModel`
7. Mapping sesuai truth table:
   - `PAID + READY_TO_FULFILL + UNFULFILLED` membuka `Mark packed`.
   - Setelah `MARK_PROCESSING`, compatibility fulfillment menjadi `PROCESSING` dan canonical shipment menjadi `PACKED`.
   - Client buyer-friendly label untuk `PACKED` tersedia sebagai `Packed`.
8. Smoke yang mengunci:
   - `smoke:order-payment` sekarang mengunci pre-payment block, post-payment unblocked state, seller `MARK_PROCESSING`, Admin packed read model, dan Public tracking packed read model.
   - `qa:e2e:truth` tetap mengunci browser surfaces Admin/Seller/Client untuk approved order.
9. Gap yang ditutup:
   - Sebelumnya smoke berhenti di `READY_TO_FULFILL` dan belum menjalankan fulfillment seller setelah paid.
   - Saat smoke baru pertama dijalankan, ditemukan mismatch split read model: persisted shipment sudah `PACKED`, tetapi split `shippingStatus` masih jatuh ke aggregate `PROCESSING`.

## File Diubah

- `server/src/scripts/smokeOrderPayment.ts`
  - Menambahkan fixture store shipping origin agar shipment mutation menguji gate payment/fulfillment, bukan gagal karena setup dummy.
  - Menambahkan helper fulfillment mutation dan persisted shipment assertion.
  - Menambahkan assertion PAID membuka `MARK_PROCESSING`.
  - Menambahkan assertion Seller/Admin/Public tracking setelah seller `MARK_PROCESSING`.
- `server/src/services/orderShippingReadModel.service.ts`
  - Split-level `shippingStatus` sekarang memakai canonical shipment status (`PACKED`) dari shipment tunggal.
  - Parent/order aggregate tetap dihitung dari aggregate shipment terpisah.

## Dampak Admin/Seller/Client

- Admin:
  - Tidak ada route/UI baru.
  - Admin order detail dan reconciliation summary sekarang menerima split `PACKED` untuk suborder yang sudah dipacked.
- Seller:
  - Tidak ada lifecycle baru.
  - Seller tetap blocked sebelum payment settled, lalu `MARK_PROCESSING` terbuka setelah `PAID`.
- Client/Public:
  - Tidak ada perubahan UI.
  - Public tracking split menerima `PACKED` dan label `Packed` setelah seller packing.
- Backend:
  - Tidak ada schema DB, rename route, atau dependency baru.
  - Adapter hanya membedakan split-level shipment status dari parent aggregate status.

## Validasi

- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F client build` - PASS
- `pnpm.cmd -F server smoke:checkout-variants` - PASS
- `pnpm.cmd -F server smoke:checkout-coupons` - PASS
- `pnpm.cmd -F server smoke:order-payment` - PASS
- `pnpm.cmd qa:e2e:truth` - PASS

Catatan: `qa:e2e:truth` mencetak `DEP0190` warning dari child process shell args, tetapi command selesai `OK` dan exit code 0.

## Risiko Tersisa

- Coverage baru mengunci transisi awal `MARK_PROCESSING` sampai `PACKED`; variasi lanjutan `MARK_SHIPPED`, failed delivery, returned, dan admin correction tetap bergantung pada smoke shipment/reconciliation existing.
- Worktree masih berisi perubahan checkout/idempotency dari rangkaian task sebelumnya yang bukan bagian utama perubahan read model fulfillment ini.

## Next Suggested Task

Tambahkan coverage kecil untuk `PACKED -> SHIPPED` dengan tracking/courier agar truth table mandatory seller sequence terkunci sampai client tracking `Shipped`.
