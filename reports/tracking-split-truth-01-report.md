# TRACKING-SPLIT-TRUTH-01 Report

## 1. Summary perubahan

Patch difokuskan pada kartu `storeSplits` di tracking publik agar status utama per store tidak lagi dirender dari campuran field mentah.

Perubahan yang dilakukan:

- Menambahkan resolver presentasi split kecil di `client/src/pages/store/StoreOrderTrackingPage.jsx`.
- Mengubah badge status split utama agar membaca `split.contract.statusSummary` lebih dulu.
- Mengubah badge fulfillment split agar memakai `split.fulfillmentStatusMeta.label/tone` lebih dulu.
- Mengubah badge payment split agar memakai `paymentReadModel.statusMeta.label/tone` lebih dulu dengan fallback aman ke meta backend lain yang sudah ada.

Tidak ada perubahan schema database.
Tidak ada perubahan endpoint besar.
Tidak ada perubahan contract API besar.

## 2. Audit boundary ringkas

### Source of truth backend

- Tracking payload publik: `server/src/routes/store.ts`
- Contract split: `buildSellerSuborderContract`
- Payment split read model: `buildGroupedPaymentReadModel`
- Fulfillment split meta: `buildFulfillmentStatusMeta`
- Payment split meta: `buildPaymentStatusMeta`

### Consumer route aktif yang diaudit

- `client/src/pages/store/StoreOrderTrackingPage.jsx`

## 3. Mismatch yang ditemukan

- Masalah: kartu `storeSplits` di tracking publik masih menampilkan badge fulfillment dari `split.fulfillmentStatus` mentah.
  - Source of truth seharusnya: `split.fulfillmentStatusMeta`
  - Risiko: buyer melihat kode teknis atau tone visual yang berbeda dari read model backend.
  - Patch terkecil yang aman: render label/tone dari meta fulfillment backend.

- Masalah: badge payment split masih menampilkan `split.paymentStatus` mentah.
  - Source of truth seharusnya: `split.paymentReadModel` atau `split.payment.readModel`
  - Risiko: buyer melihat state payment per split yang tidak sejalan dengan read model display status backend.
  - Patch terkecil yang aman: pakai `getGroupedPaymentReadModel(split)` lalu render `statusMeta`.

- Masalah: kartu split tidak memiliki status ringkas utama yang mengikuti `split.contract.statusSummary`.
  - Source of truth seharusnya: `split.contract.statusSummary`
  - Risiko: parent tracking sudah contract-driven tetapi kartu split masih terasa campuran dan bisa misleading.
  - Patch terkecil yang aman: tambahkan summary badge + description split dari contract backend yang sudah tersedia.

## 4. Mismatch mana yang diperbaiki

- Diperbaiki: badge status utama per split sekarang membaca `split.contract.statusSummary`.
- Diperbaiki: badge fulfillment per split sekarang membaca meta fulfillment backend, bukan kode mentah sebagai label utama.
- Diperbaiki: badge payment per split sekarang membaca grouped payment read model/meta backend, bukan `split.paymentStatus` mentah.

## 5. File yang diubah

- `client/src/pages/store/StoreOrderTrackingPage.jsx`

## 6. Dampak lintas app

- Client: tracking publik sekarang lebih konsisten antara parent status dan kartu split per store.
- Admin: tidak ada perubahan.
- Seller: tidak ada perubahan.
- Backend/API: tidak ada perubahan file; payload backend yang sudah ada dipakai lebih jujur oleh consumer.

## 7. Hasil verifikasi

### Build

- `pnpm -F client build` ✅
- `pnpm -F server build` ✅

### Smoke

- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:stripe-webhook` ✅

Catatan:
- `smoke:order-payment` sempat gagal sekali karena `ECONNRESET` pada reject scenario saat fetch admin audit detail, lalu rerun langsung hijau. Ini terlihat seperti flake test harness, bukan efek patch client.

### QA/manual

- `pnpm qa:mvf:visibility:frontend` ✅
- Audit manual dilakukan pada tracking page split card dan payload source of truth di route store backend.

## 8. Risiko / residual issue

- Kartu split sekarang sudah contract/read-model driven untuk badge dan summary utama, tetapi belum menampilkan reason/actionability yang lebih detail per split. Itu tidak dibutuhkan untuk task ini.
- Tone `stone` dari contract tetap jatuh ke styling netral di helper badge page ini. Secara truth aman, hanya bukan diferensiasi visual baru.

## 9. Mandatory checklist

- Apakah tracking split publik memakai backend/read model sebagai source of truth?
  - Ya.
- Apakah status visual utama di route aktif masih melawan `contract.statusSummary` bila contract tersedia?
  - Tidak pada tracking split cards yang dipatch.
- Apakah patch ini mengubah contract besar?
  - Tidak.

## 10. Rekomendasi task berikutnya

- Jika ingin hardening kecil berikutnya, audit detail copy/actionability reason per split agar helper text tracking juga sepenuhnya backend-driven.
- Pertimbangkan merapikan helper badge tone shared bila `stone` perlu dibedakan visualnya dari `slate`, tanpa mengubah contract atau behavior.
