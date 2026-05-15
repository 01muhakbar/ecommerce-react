# P0-MVF-CHECKOUT-SYNC-01 Checkout Storefront Sync Stabilization

Tanggal: 2026-05-14

## Ringkasan

Audit checkout menemukan flow utama sudah memakai source of truth yang sama untuk preview dan submit:

- Client preview: `POST /api/checkout/preview`
- Client submit: `POST /api/checkout/create-multi-store`
- Coupon quote: `POST /api/store/coupons/quote`
- Buyer order/payment read model: `GET /api/orders/:orderId/checkout-payment`
- Admin order read: `Order`, `Suborder`, `Shipment`, dan contract status di `admin.orders.ts`
- Seller suborder read: `Suborder` scoped toko di `seller.orders.ts`

Bug kecil yang dipatch: saat store/payment readiness berubah setelah item ada di cart, checkout preview menandai item sebagai `PRODUCT_NOT_PUBLIC` tetapi pesan buyer terlalu generik. Ini membuat buyer sulit membedakan product hilang vs store belum bisa menerima checkout. Patch mempertahankan reason lama untuk backward compatibility, lalu menambahkan `message` dan metadata readiness yang lebih jelas.

## File Diubah

- `server/src/routes/checkout.ts`
- `client/src/pages/store/Checkout.jsx`
- `tools/qa/e2e-truth-smoke.ts`
- `reports/p0-mvf-checkout-sync-01-2026-05-14-report.md`

## Frontend <-> Backend Sync Check

1. Data checkout berasal dari endpoint mana?
   - `POST /api/checkout/preview`, `POST /api/checkout/create-multi-store`, dan post-checkout `GET /api/orders/:orderId/checkout-payment`.
2. Endpoint preview?
   - `POST /api/checkout/preview`.
3. Endpoint submit order?
   - `POST /api/checkout/create-multi-store`.
4. Endpoint coupon quote?
   - `POST /api/store/coupons/quote`.
5. Apakah preview dan submit memakai source of truth angka yang sama?
   - Ya. Keduanya memakai `prepareCartGroups(...)`; submit melakukan quote coupon ulang sebelum order dibuat.
6. Apakah Admin dan Seller membaca order/suborder dari model/DTO yang sama?
   - Ya. Keduanya membaca `Order`/`Suborder`/`Payment`/`Shipment`, lalu serialize lewat route masing-masing.
7. Apakah ada fallback dummy di `Checkout.jsx`?
   - Tidak ada dummy order/payment. Ada fallback display aman untuk copy/customization dan render group, tetapi submit tetap bergantung pada preview backend canonical.
8. Apakah perubahan ini memengaruhi cart/order/payment?
   - Cart/order/payment creation tidak berubah. Patch hanya memperjelas invalid checkout message dan prioritas blocker UI.
9. Smoke paling relevan?
   - `smoke:checkout-variants`, `smoke:checkout-coupons`, `smoke:order-payment`, dan `qa:e2e:truth`.

## Perubahan

- Backend checkout invalid item tetap mengirim reason kompatibel `PRODUCT_NOT_PUBLIC`, tetapi untuk store/payment not-ready sekarang menambahkan pesan seperti store tidak bisa menerima checkout dan metadata readiness (`blockedBy`, `storeReadinessCode`, `paymentProfileCode`).
- `PRODUCT_STORE_UNMAPPED` kini dievaluasi sebelum generic product visibility blocker.
- Frontend Checkout tidak lagi memperlakukan invalid item sebagai cart-sync mismatch utama; pesan blocker invalid item diprioritaskan pada submit handler.
- E2E truth smoke sekarang membaca pesan invalid item dari backend agar regression menangkap readiness message yang actionable.

## Dampak Admin/Seller/Client

- Admin: tidak ada route/admin UI yang diubah. Order/payment read model tetap sama.
- Seller: tidak ada route/seller UI yang diubah. Suborder lifecycle tetap sama.
- Client: checkout blocker untuk store/payment not-ready lebih jelas tanpa mengubah UI layout atau flow submit.
- Backend: response invalid item mendapat field message/meta tambahan; reason lama tetap kompatibel.

## Validasi

- PASS: `pnpm.cmd -F server build`
- PASS: `pnpm.cmd -F client build`
  - Catatan: Vite chunk-size warning `vendor-misc` tetap non-blocking seperti report sebelumnya.
- PASS: `pnpm.cmd -F server smoke:checkout-variants`
- PASS: `pnpm.cmd -F server smoke:checkout-coupons`
- PASS: `pnpm.cmd -F server smoke:order-payment`
- PASS: `pnpm.cmd qa:e2e:truth`
  - Catatan: Node `[DEP0190]` warning dari tooling child process tetap non-blocking.

Catatan eksekusi: command `pnpm -F ...` via PowerShell ditolak oleh execution policy lokal (`pnpm.ps1`). Validasi diulang dengan `pnpm.cmd`.

## Risiko Tersisa

- Field `message`/`meta` invalid item bersifat additive; consumer lama yang hanya membaca `reason` tetap aman.
- Chunk-size warning client masih P1/performance.
- Production env tetap harus memastikan `COOKIE_SECURE=true`, CORS/base URL, dan upload path sesuai target deploy.

## Next Task

- Tambahkan smoke backend spesifik untuk store payment profile inactive pada checkout preview bila ingin mengunci pesan readiness tanpa menunggu browser E2E.
