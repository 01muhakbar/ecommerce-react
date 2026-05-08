# SELLER-PAYMENT-REVIEW-META-01 Report

## 1. Summary perubahan

Task ini memfokuskan hardening lane Seller Payment Review agar row review tidak perlu lagi bergantung pada mapping label lokal untuk payment/proof status dan helper text lock utama.

Perubahan yang dilakukan:

- Menambahkan field additive kecil pada payload backend seller payment review:
  - `paymentStatusMeta`
  - `fulfillmentStatusMeta`
  - `payment.statusMeta`
  - `payment.proof.reviewMeta`
  - `payment.reviewActionability`
- Menyinkronkan `SellerPaymentReviewPage.jsx` agar badge payment/proof dan helper text utama membaca meta backend lebih dulu.
- Mengubah lock message review seller agar memakai `payment.reviewActionability.reason` dari backend bila tersedia.

Tidak ada perubahan schema database.
Tidak ada perubahan contract API besar.
Tidak ada redesign UI.

## 2. Audit boundary ringkas

### Backend source of truth yang dipakai

- `server/src/services/orderLifecycleContract.service.ts`
  - `buildPaymentStatusMeta`
  - `buildFulfillmentStatusMeta`

### Route aktif yang dipatch

- `client/src/pages/seller/SellerPaymentReviewPage.jsx`

### Backend serializer yang dipatch

- `server/src/routes/seller.payments.ts`

## 3. Mismatch yang ditemukan

- Masalah: seller review row badge masih memakai mapping lokal dari `payment.status` dan `proof.reviewStatus`.
  - Risiko: label/tone bisa berbeda dari truth backend atau surface lain.
  - Patch terkecil yang aman: expose meta additive pada payload review list.

- Masalah: helper text utama dan lock reason review seller masih dirakit lokal dari kombinasi status payment/proof.
  - Risiko: lane review seller tidak jujur atau tidak konsisten saat state berubah.
  - Patch terkecil yang aman: expose `reviewActionability` kecil dari backend dan konsumsi reason-nya di page.

## 4. Mismatch mana yang diperbaiki

- Diperbaiki: payment badge seller review sekarang membaca `payment.statusMeta` atau `paymentStatusMeta` dari backend lebih dulu.
- Diperbaiki: proof badge dan review status text sekarang membaca `proof.reviewMeta` dari backend lebih dulu.
- Diperbaiki: helper text utama row sekarang memakai description/reason backend lebih dulu.
- Diperbaiki: lock message review action sekarang memakai `payment.reviewActionability.reason` dari backend lebih dulu.

## 5. File yang diubah

- `server/src/routes/seller.payments.ts`
- `client/src/api/sellerPayments.ts`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`

## 6. Dampak lintas app

- Seller:
  - Payment review lane kini lebih meta-driven dan helper text lock/review lebih jujur ke state backend.
- Admin:
  - Tidak ada perubahan.
- Client:
  - Tidak ada perubahan.
- Backend/API:
  - Contract berubah secara additive kecil pada payload seller payment review.
  - Tidak ada endpoint baru dan tidak ada compatibility path yang dipatahkan.

## 7. Hasil verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:stripe-webhook` ✅

Catatan:
- `smoke:order-payment` sempat gagal sekali dengan `ECONNRESET` di tengah request network.
- Rerun langsung hijau penuh, jadi indikasinya `flaky infra`, bukan assertion failure patch ini.

### QA/manual

- `pnpm qa:mvf:visibility:frontend` ✅
- Audit manual dilakukan pada payload seller payment review dan consumer aktif seller review page.

## 8. Risiko / residual issue

- Lane seller review sekarang meta-driven untuk status utama, tetapi layout tetap sederhana dan tidak diubah.
- Fallback frontend lama tetap dipertahankan untuk kompatibilitas bila ada payload lama yang belum membawa meta baru.

## 9. Mandatory checklist

- Apakah seller payment review row/detail memakai meta backend lebih dulu bila tersedia?
  - Ya.
- Apakah helper text lock/review reason konsisten dengan backend state?
  - Ya, melalui `payment.reviewActionability.reason` dan description meta.
- Apakah patch kecil dan tanpa refactor besar?
  - Ya.

## 10. Rekomendasi task berikutnya

- Jika ingin melanjutkan batch kecil berikutnya, audit lane audit/review lain yang masih punya serializer status lokal tanpa meta reason.
- Setelah coverage meta cukup luas, pertimbangkan helper shared ringan untuk konsumsi status/review meta agar fallback frontend makin tipis.
