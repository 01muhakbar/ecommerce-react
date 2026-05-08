# PAYMENT-ACTION-CTA-UNIFY-01 Report

## 1. Summary perubahan

Task ini mengaudit CTA pembayaran lanjutan dan helper text payment actionability di route aktif, dengan backend tetap sebagai source of truth melalui:

- `buildBuyerOrderPaymentEntry`
- `buildPaymentActionability`
- `contract.availableActions`
- grouped payment read model

Patch aktif dilakukan hanya pada consumer yang masih punya mismatch nyata:

- `StoreCheckoutSuccessPage`
- `StoreOrderTrackingPage`
- `AccountOrderPaymentPage`

Tidak ada perubahan backend, schema database, atau contract API besar.

## 2. Source of truth backend

- `server/src/services/paymentCheckoutView.service.ts`
  - `buildBuyerOrderPaymentEntry`
  - `summaryStatus`
  - `summaryLabel`
  - `visible`
  - `label`
- `server/src/services/orderLifecycleContract.service.ts`
  - `buildPaymentActionability`
  - `buildStatusSummary`
  - `buildBuyerOrderContract`
  - `contract.availableActions`
- `server/src/routes/store.ts`
  - `buildBuyerPaymentEntryWithTargetPath`
  - route buyer order/account/tracking contract payload

Kesimpulan audit backend:

- Buyer payment CTA level order seharusnya bertumpu pada `paymentEntry` atau `contract.availableActions`
- State final/non-final dan helper summary seharusnya mengikuti `summaryStatus`, `summaryLabel`, `statusSummary`, atau grouped payment read model, bukan string manual

## 3. Consumer route aktif yang diaudit

### Client

- `client/src/pages/store/StoreCheckoutSuccessPage.jsx`
- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `client/src/pages/account/AccountOrdersPage.jsx`
- `client/src/pages/account/AccountOrderDetailPage.jsx`
- `client/src/pages/account/AccountOrderPaymentPage.jsx`

### Admin

- `client/src/pages/admin/Orders.jsx`
- `client/src/pages/admin/OrderDetail.jsx`

### Seller

- `client/src/pages/seller/SellerPaymentReviewPage.jsx`

## 4. Mismatch yang ditemukan

### Diperbaiki

- `StoreCheckoutSuccessPage` bisa jatuh ke state sukses hijau untuk flow Stripe yang sebenarnya non-paid dan non-actionable, karena branch final-negatif belum ditangani saat `continue` action tidak tersedia.
- `StoreCheckoutSuccessPage` memakai label CTA Stripe manual pada actionable branch, bukan label action dari backend contract.
- `StoreCheckoutSuccessPage` menampilkan helper text “payment is not currently actionable” pada branch error/status-unavailable, padahal backend status terbaru justru belum berhasil dimuat.
- `StoreOrderTrackingPage` masih memakai label CTA Stripe manual, bukan label action backend.
- `AccountOrderPaymentPage` masih memakai field raw split payment status pada store payment step list, padahal grouped payment read model sudah tersedia.
- `AccountOrderPaymentPage` menampilkan status lock message dengan kode raw seperti `PENDING_CONFIRMATION`, bukan label backend seperti `Under review`.

### Diaudit, tidak perlu patch

- `AccountOrdersPage` dan `AccountOrderDetailPage` sudah memakai `paymentEntry.visible`, `paymentEntry.targetPath`, dan `paymentEntry.label` untuk CTA.
- `Admin` order surfaces yang aktif tidak membuka CTA pembayaran buyer; yang ada hanya status display dan link audit.
- `SellerPaymentReviewPage` men-gate approve/reject dari state backend payment/proof dan governance seller. Tidak ditemukan mismatch prioritas tinggi yang butuh patch kecil pada task ini.

## 5. File yang diubah

- `client/src/pages/store/StoreCheckoutSuccessPage.jsx`
- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `client/src/pages/account/AccountOrderPaymentPage.jsx`
- `reports/payment-action-cta-unify-01-report.md`

## 6. Perubahan yang dilakukan

### StoreCheckoutSuccessPage

- Menambahkan branch eksplisit untuk Stripe state non-paid dan non-actionable agar tidak jatuh ke success state palsu.
- Menyamakan label CTA Stripe dengan `contract.availableActions`.
- Mengganti helper text pada branch status unavailable agar jujur: actionability belum bisa dipastikan bila backend status gagal dimuat.

### StoreOrderTrackingPage

- Menyamakan label CTA `Continue Stripe Payment` dengan label action dari backend contract.

### AccountOrderPaymentPage

- Store payment step list sekarang membaca grouped payment read model lebih dulu.
- Label helper state di daftar split memakai `statusMeta.label` backend bila tersedia.
- Locked-state proof submission memakai label backend, bukan kode raw uppercase.

## 7. Dampak lintas app

- Client:
  - CTA lanjutan Stripe kini hanya muncul dengan label backend yang sama di success/tracking.
  - Success page tidak lagi mengklaim pembayaran Stripe selesai untuk state final-negatif.
  - Payment helper text di buyer payment page lebih konsisten dengan backend read model.
- Admin:
  - Tidak ada perubahan baru; audit menunjukkan surface aktif sudah cukup jujur untuk boundary task ini.
- Seller:
  - Tidak ada perubahan baru; payment review CTA tetap backend-driven dari state payment/proof dan governance.
- Backend/API:
  - Tidak ada perubahan.

## 8. Verifikasi

### Build

- `pnpm -F client build` ✅
- `pnpm -F server build` ✅

### Smoke

- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:stripe-webhook` ✅

### QA

- `pnpm qa:mvf:visibility:frontend` ✅

## 9. Risiko / residual issue

- `StoreCheckoutSuccessPage` non-Stripe masih punya copy utama yang bersifat flow-oriented, bukan dibaca dari fetch status live. Pada flow saat ini itu masih aman, tetapi belum sepenuhnya disatukan dengan payload backend live.
- `SellerPaymentReviewPage` belum punya field actionability reason per row dari backend; gating saat ini masih membaca status payment/proof backend secara langsung.
- `AccountOrderPaymentPage` masih punya beberapa copy presentasional lokal untuk langkah pembayaran, walau state utamanya sekarang sudah lebih dekat ke grouped payment read model.

## 10. Acceptance criteria check

- Semua CTA bayar/lanjut Stripe/review payment di route aktif hanya muncul bila backend mengizinkan: ya, pada route aktif yang diaudit dan dipatch
- Helper text final/unavailable/action-required konsisten lintas page aktif: lebih konsisten; mismatch prioritas tinggi sudah ditutup
- Tidak ada CTA aktif pada state `PAID`, `FAILED`, `EXPIRED`, `CANCELLED` kecuali backend memang mengizinkan aksi lain: ya, khususnya success/tracking Stripe sudah ditutup
- Tidak ada refactor besar: ya
- Build dan smoke relevan hijau: ya
- Ada laporan hasil kerja rapi: ya
