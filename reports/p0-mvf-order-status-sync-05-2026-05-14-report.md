# P0-MVF-ORDER-STATUS-SYNC-05 Report

## Ringkasan

Task ini mengunci sinkronisasi status awal setelah checkout antara Client, Admin, Seller, dan persisted model tanpa mengubah lifecycle order/payment/suborder.

Perubahan hanya berupa assertion smoke tambahan di `smoke:order-payment`.

## Frontend <-> Backend Sync Check

1. Status order parent setelah checkout:
   - Persisted `Order.status = pending`
   - Persisted `Order.paymentStatus = UNPAID`
2. Status payment setelah checkout:
   - Persisted `Payment.status = CREATED`
3. Status suborder setelah checkout:
   - Persisted `Suborder.paymentStatus = UNPAID`
   - Persisted `Suborder.fulfillmentStatus = UNFULFILLED`
   - Shipment/read model awal tetap blocked/waiting payment.
4. Status yang dilihat Admin:
   - Admin audit detail membaca parent `paymentStatus = UNPAID`, parent `orderStatus = pending`, split payment `CREATED`, suborder `UNPAID/UNFULFILLED`.
   - Admin order detail membaca `paymentActionability.code = ACTION_REQUIRED`.
5. Status yang dilihat Seller:
   - Seller order detail membaca suborder `paymentStatus = UNPAID`, `fulfillmentStatus = UNFULFILLED`, payment record `CREATED`, dan fulfillment action disabled sebelum payment paid.
6. Status yang dilihat Client:
   - Buyer grouped order view sudah memakai initial state `UNPAID/pending`.
   - Public tracking membaca `paymentActionability.code = ACTION_REQUIRED`, split payment read model `CREATED`, dan shipment `WAITING_PAYMENT`.
7. Source status:
   - Route/read model tetap berasal dari model existing `Order`, `Suborder`, `Payment`, dan shipment/operational truth serializer existing.
8. Mapping UI:
   - Ada mapping buyer/admin/seller friendly label di frontend, tetapi smoke mengunci canonical code/read model backend.
9. Smoke existing:
   - `smoke:order-payment` sebelumnya sudah mengunci cross-lane approve/reject/expiry.
   - `qa:e2e:truth` mengunci surface browser Admin/Seller/Client setelah order approved.
10. Gap yang dikunci:
   - Status awal pasca-checkout sebelum buyer submit proof belum eksplisit dicek di Admin/Public/Seller read model. Assertion baru menutup gap ini.

## File Diubah

- `server/src/scripts/smokeOrderPayment.ts`
  - Menambahkan `assertPersistedInitialCheckoutStatus`.
  - Menambahkan assertion initial Seller order detail.
  - Menambahkan assertion initial Admin payment audit/order detail.
  - Menambahkan assertion initial public tracking.
- `reports/p0-mvf-order-status-sync-05-2026-05-14-report.md`

Catatan worktree: file lain yang terlihat modified berasal dari task checkout sebelumnya dalam rangkaian P0 MVF, bukan perubahan lifecycle status task ini.

## Dampak Admin/Seller/Client

- Admin:
  - Tidak ada perubahan route/UI.
  - Smoke sekarang membuktikan Admin read model status awal sesuai persisted checkout.
- Seller:
  - Tidak ada perubahan route/UI.
  - Smoke sekarang membuktikan Seller melihat suborder `UNPAID/UNFULFILLED` dan tidak bisa fulfillment sebelum payment paid.
- Client:
  - Tidak ada perubahan UI.
  - Smoke sekarang membuktikan buyer/public tracking tetap action required/waiting payment sebelum bukti bayar.
- Backend:
  - Tidak ada perubahan lifecycle/status.
  - Hanya assertion regression di smoke.

## Validasi

- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F client build` - PASS
- `pnpm.cmd -F server smoke:checkout-variants` - PASS
- `pnpm.cmd -F server smoke:checkout-coupons` - PASS
- `pnpm.cmd -F server smoke:order-payment` - PASS
- `pnpm.cmd qa:e2e:truth` - PASS

Catatan validasi: `qa:e2e:truth` mencetak log 404 asset demo dan satu log deadlock transient dari add-to-cart, tetapi command selesai `OK` dan exit code 0.

## Risiko Tersisa

- Smoke ini mengunci status awal dan lifecycle utama approve/reject/expiry, tetapi belum memperluas semua variasi shipment lanjutan.
- Log deadlock transient pada QA truth menunjukkan DB lokal masih bisa menampilkan kontensi singkat pada add-to-cart, meskipun flow uji selesai PASS.

## Next Suggested Task

Tambahkan coverage kecil untuk transisi fulfillment setelah payment `PAID`, terutama konsistensi shipment status antara Seller fulfillment, Admin shipment reconciliation, dan public/client tracking.
