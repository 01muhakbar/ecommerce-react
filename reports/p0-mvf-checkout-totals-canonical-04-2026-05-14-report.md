# P0-MVF-CHECKOUT-TOTALS-CANONICAL-04

Tanggal eksekusi: 2026-05-15 Asia/Makassar

## Tujuan

Audit dan kunci konsistensi angka checkout antara cart display, checkout preview, coupon quote, final checkout order, payment, suborder, dan read model lintas Client/Admin/Seller.

## Frontend <-> Backend Sync Check

1. Field yang ditampilkan Client:
   - `subtotalValue`, `discountValue`, `shippingCost`, `taxValue`, dan `total`.
   - Per-store display memakai `group.subtotalAmount`, `group.shippingAmount`, `group.totalAmount`, dan discount coupon group bila ada.
2. Field backend preview:
   - `summary.totalItems`, `summary.subtotalAmount`, `summary.shippingAmount`, `summary.grandTotal`, `summary.invalidItemCount`.
   - Per-store `subtotalAmount`, `shippingAmount`, `totalAmount`, `paymentAvailable`, dan item line totals.
3. Field coupon quote:
   - `valid`, `discount`, `total`, `discountType`, `discountValue`, `minSpend`, `scopeType`, `storeId`, serta `reason/message` untuk invalid.
4. Field final order/payment/suborder:
   - Parent `Order`: `subtotalAmount`, `shippingAmount`, `discountAmount`, `totalAmount`.
   - `Suborder`: `subtotalAmount`, `shippingAmount`, `totalAmount`, coupon attribution.
   - `Payment`: `amount` per suborder.
5. Fallback hitung total frontend:
   - Ada fallback lokal dari cart visible untuk guard/mismatch dan display sementara.
6. Dampak fallback ke submit:
   - Tidak menjadi source of truth final. Submit tidak mengirim subtotal/discount/total; backend menghitung ulang dari cart, coupon code, dan group coupons.
7. Smoke yang sudah mengunci total:
   - `smoke:checkout-variants`: preview/submit variant line price, qty, stock snapshot.
   - `smoke:checkout-coupons`: coupon final order/suborder/payment totals.
   - `smoke:order-payment`: lifecycle payment/order/suborder after checkout.
   - `qa:e2e:truth`: Client/Admin/Seller/browser read model truth.
8. Gap yang dikunci task ini:
   - `smoke:checkout-coupons` belum eksplisit membandingkan canonical preview totals -> coupon quote totals -> final response/order/suborder/payment dalam skenario yang sama.

## Perubahan

- `server/src/scripts/smokeCheckoutCoupons.ts`
  - Menambahkan helper `previewCheckout`.
  - Menambahkan assertion `assertPreviewTotals` untuk parent summary dan per-store group preview.
  - Menambahkan assertion `assertCheckoutResponseTotals` untuk final response summary, group totals, dan payment amount.
  - Mengunci single-store platform coupon dan seller coupon:
    - preview subtotal/shipping/grand total;
    - quote discount/total dari angka preview;
    - final response summary/group/payment;
    - persisted order/suborder/payment totals.
  - Mengunci multi-store group coupon:
    - preview parent total dan per-store totals;
    - quote per store dari group preview;
    - final parent total 24.900;
    - store A total/payment 18.500;
    - store B total/payment 6.400;
    - sum suborder/payment sama dengan parent order total.

## Dampak Admin/Seller/Client

- Admin: tidak ada route/UI Admin diubah. Read model tetap divalidasi oleh `qa:e2e:truth`.
- Seller: tidak ada route/UI Seller diubah. Suborder totals/payment tetap divalidasi lewat smoke coupon dan order-payment.
- Client: tidak ada UI Checkout diubah untuk task ini. Audit memastikan fallback frontend tidak mengirim angka final ke backend.
- Backend: tidak ada pricing engine/rule coupon/lifecycle yang diubah; hanya smoke coverage ditambah.

## Validasi

- PASS: `pnpm.cmd -F server build`
- PASS: `pnpm.cmd -F client build`
- PASS: `pnpm.cmd -F server smoke:checkout-variants`
- PASS: `pnpm.cmd -F server smoke:checkout-coupons`
- PASS: `pnpm.cmd -F server smoke:order-payment`
- PASS: `pnpm.cmd qa:e2e:truth`

## Catatan Validasi

- Percobaan build server pertama gagal karena type inference helper smoke baru (`Map` value dianggap `{}`); sudah diperbaiki dengan cast lokal pada script smoke.
- `pnpm.cmd` digunakan karena PowerShell lokal memblokir `pnpm` tanpa ekstensi `.cmd`.
- `pnpm.cmd -F client build` masih menampilkan warning chunk-size Vite existing.
- `pnpm.cmd qa:e2e:truth` masih menampilkan warning Node `[DEP0190]` existing setelah PASS.

## Risiko Tersisa

- Smoke ini mengunci rule saat ini: shipping fallback 0, tax 0, platform coupon single-store, dan store-scoped group coupon multi-store.
- Jika nanti pricing engine menambah shipping/tax/service fee dinamis, smoke totals ini perlu diperbarui agar tetap menjadi kontrak canonical.

## Next Suggested Task

Tambahkan coverage totals untuk shipping/tax dinamis setelah fitur ongkir/tax benar-benar diaktifkan, supaya canonical totals tetap terkunci lintas preview, quote, submit, dan read model.
