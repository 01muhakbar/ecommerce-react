# P0-MVF-CHECKOUT-IDEMPOTENCY-03

Tanggal eksekusi: 2026-05-15 Asia/Makassar

## Tujuan

Audit dan kunci duplicate submit checkout agar klik ganda, retry browser, atau request identik tidak membuat order/payment/suborder ganda dan tetap memberi response canonical atau retry-safe.

## Frontend <-> Backend Sync Check

1. Tombol submit checkout dikunci oleh state apa?
   - UI disabled oleh `isSubmitting`, remote cart sync, coupon loading, preview blocker, dan coupon blocker. Handler juga memakai `submitLockRef.current` sebagai guard sinkron sebelum request.
2. Apakah `createMultiStoreCheckoutOrder` mengirim idempotency key?
   - Ya. `Checkout.jsx` membuat `checkoutRequestKey` dari signature checkout dan mengirimkannya di body payload.
3. Apakah backend membaca idempotency key?
   - Ya. Backend membaca `checkoutRequestKey` dari body, lalu fallback ke header `Idempotency-Key` atau `X-Idempotency-Key`.
4. Jika request sama dikirim dua kali, apa yang terjadi sekarang?
   - Request replay dengan key sama mengembalikan order canonical `200` dengan `idempotency.replayed = true`. Request paralel juga tidak membuat duplikasi; bila cart sudah dikosongkan oleh request pertama, backend sekarang mencoba replay order canonical sebelum mengembalikan `CART_EMPTY`.
5. Apakah order parent bisa double-create?
   - Tidak untuk key yang sama. Invoice idempotent deterministik memakai `STORE-IDEMP-*` dan `Order.invoiceNo` unique.
6. Apakah payment/suborder bisa double-create?
   - Tidak pada path idempotent yang diuji. Smoke mengassert hanya satu suborder dan satu payment untuk order canonical.
7. Apakah Admin/Seller/Client membaca order hasil duplicate dengan aman?
   - Ya. Replay mengembalikan order canonical dari `loadOrderWithSplitRelations`, sementara Admin/Seller/Client tetap membaca model `Order`, `Suborder`, dan `Payment` yang sama.
8. Smoke apa yang mengunci behavior ini?
   - `smoke:order-payment` untuk duplicate backend sequential, header replay, dan parallel duplicate.
   - `qa:e2e:truth` untuk guard browser checkout saat submit pending.

## Temuan

- Frontend sudah punya `isSubmitting` dan `submitLockRef`, jadi double-submit dari UI sudah diblokir.
- Backend idempotency sudah ada dan smoke lama sudah mengunci replay sequential.
- Gap nyata ditemukan saat smoke paralel: request kedua dengan key sama dapat menerima `400 CART_EMPTY` jika request pertama sudah commit dan mengosongkan cart sebelum request kedua masuk fase cart validation. Ini tidak membuat order ganda, tetapi response retry tidak canonical.

## Perubahan

- `server/src/routes/checkout.ts`
  - Pada branch `CART_EMPTY` di `create-multi-store`, jika request punya idempotent invoice, backend menunggu/mencari order canonical dan mengembalikan `200` replay sebelum jatuh ke `CART_EMPTY`.
  - Tidak mengubah lifecycle order/payment/suborder.
  - Tidak mengubah public route atau contract lama; response replay memakai struktur idempotency existing.
- `server/src/scripts/smokeOrderPayment.ts`
  - Menambahkan duplicate submit paralel dengan `checkoutRequestKey` yang sama.
  - Mengassert response duplicate harus canonical atau retry-safe.
  - Mengassert parent order, suborder, dan payment masing-masing tetap satu.
- `tools/qa/e2e-truth-smoke.ts`
  - Menambahkan browser guard assertion untuk checkout submit pending.
  - Smoke memastikan `checkoutRequestKey` dikirim, CTA disabled saat pending, dan submit kedua saat pending tidak membuka request aktif kedua.

## Dampak Admin/Seller/Client

- Admin: tidak ada UI/route Admin yang diubah. Pembacaan order/payment tetap divalidasi oleh `smoke:order-payment` dan `qa:e2e:truth`.
- Seller: tidak ada UI/route Seller yang diubah. Suborder/payment seller tetap divalidasi oleh smoke lama.
- Client: tidak ada redesign UI. Guard existing dikunci oleh E2E; submit pending tetap disabled dan `submitLockRef` mencegah request aktif kedua.
- Backend: idempotent retry menjadi lebih aman pada race cart-empty setelah commit.

## Validasi

- PASS: `pnpm.cmd -F server build`
- PASS: `pnpm.cmd -F client build`
- PASS: `pnpm.cmd -F server smoke:checkout-variants`
- PASS: `pnpm.cmd -F server smoke:checkout-coupons`
- PASS: `pnpm.cmd -F server smoke:order-payment`
- PASS: `pnpm.cmd qa:e2e:truth`

## Catatan Validasi

- `pnpm.cmd` digunakan karena PowerShell lokal memblokir `pnpm` tanpa ekstensi `.cmd`.
- `pnpm.cmd -F client build` masih menampilkan warning chunk-size Vite existing.
- `pnpm.cmd qa:e2e:truth` masih menampilkan warning Node `[DEP0190]` existing setelah PASS.

## Risiko Tersisa

- Idempotency bergantung pada client mengirim `checkoutRequestKey` atau caller mengirim header idempotency. Request tanpa key tetap memakai behavior lama.
- Race lain di luar cart-empty branch tetap mengandalkan unique invoice dan recovery idempotency existing.

## Next Suggested Task

Tambahkan observability/report kecil untuk tingkat replay idempotency di production logs bila ingin memantau retry checkout publik setelah release.
