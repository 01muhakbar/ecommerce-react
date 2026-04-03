# ADMIN-PAYMENT-AUDIT-META-01 Report

## 1. Summary perubahan

Task ini memfokuskan hardening lane Admin Payment Audit agar badge dan helper text utama tidak lagi bergantung pada field mentah bila backend bisa menyediakan meta status yang lebih jujur.

Perubahan yang dilakukan:

- Menambahkan field meta additive pada payload backend admin payment audit list/detail untuk:
  - parent payment
  - parent order
  - suborder payment
  - suborder fulfillment
  - payment record status
  - proof review
  - payment timeline status transition
- Menyinkronkan halaman admin payment audit list agar badge parent payment memakai `paymentStatusMeta`.
- Menyinkronkan halaman admin payment audit detail agar parent/suborder/payment/proof/timeline membaca field meta backend lebih dulu.

Tidak ada perubahan schema database.
Tidak ada perubahan contract API besar.
Tidak ada refactor besar.

## 2. Audit boundary ringkas

### Source of truth backend yang dipakai

- `server/src/services/orderLifecycleContract.service.ts`
  - `buildPaymentStatusMeta`
  - `buildOrderStatusMeta`
  - `buildFulfillmentStatusMeta`

### Route aktif yang dipatch

- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditDetailPage.jsx`

### Backend serializer yang dipatch

- `server/src/routes/admin.payments.audit.ts`

## 3. Mismatch yang ditemukan

- Masalah: admin payment audit list menampilkan parent payment badge dari `paymentStatus` mentah saja.
  - Risiko: operator melihat label generik/raw tanpa description backend.
  - Patch terkecil yang aman: tambahkan `paymentStatusMeta` ke list payload dan konsumsi di page.

- Masalah: admin payment audit detail menampilkan parent order, suborder fulfillment, payment record, proof review, dan status timeline dari field mentah.
  - Risiko: audit lane terlihat legacy dan tidak konsisten dengan surface lain yang sudah meta-driven.
  - Patch terkecil yang aman: expose meta additive di detail payload lalu ganti badge/helper text consumer ke meta tersebut.

## 4. Mismatch mana yang diperbaiki

- Diperbaiki: parent payment badge di audit list sekarang memakai `paymentStatusMeta`.
- Diperbaiki: parent payment dan parent order badge di audit detail sekarang memakai meta backend.
- Diperbaiki: suborder payment dan fulfillment badge di audit detail sekarang memakai meta backend.
- Diperbaiki: payment card di audit detail sekarang memakai `statusMeta` dan description backend.
- Diperbaiki: proof badge dan review status text di audit detail sekarang memakai `reviewMeta`.
- Diperbaiki: payment status timeline di audit detail sekarang menampilkan label transition dari meta backend dan description status terbaru bila tersedia.

## 5. File yang diubah

- `server/src/routes/admin.payments.audit.ts`
- `client/src/api/adminPaymentAudit.ts`
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditDetailPage.jsx`

## 6. Dampak lintas app

- Admin:
  - Lane payment audit list/detail kini lebih meta-driven dan lebih konsisten dengan truth backend.
- Seller:
  - Tidak ada perubahan.
- Client:
  - Tidak ada perubahan.
- Backend/API:
  - Contract berubah secara additive kecil saja dengan field `...Meta` baru pada payload audit list/detail.
  - Tidak ada endpoint baru dan tidak ada path yang dipatahkan.

## 7. Hasil verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:stripe-webhook` ✅

Catatan:
- `smoke:order-payment` sempat gagal sekali dengan `ECONNRESET` saat approve scenario create checkout.
- Rerun langsung hijau penuh, jadi indikasinya `flaky infra`, bukan assertion failure patch ini.

### QA/manual

- `pnpm qa:mvf:visibility:frontend` ✅
- Audit manual dilakukan pada admin payment audit list/detail payload dan consumer aktif.

## 8. Risiko / residual issue

- Lane audit sekarang meta-driven untuk status utama, tetapi copy tabel/filter masih sederhana dan belum diubah ke UX yang lebih kaya. Itu sengaja di luar scope.
- Payload audit kini membawa field meta tambahan; meski kompatibel, consumer eksternal lama yang mengabaikannya tetap akan melihat field raw lama.

## 9. Mandatory checklist

- Apakah patch kecil dan terlokalisasi?
  - Ya.
- Apakah backend tetap source of truth?
  - Ya.
- Apakah ada contract API besar yang diubah?
  - Tidak.
- Apakah ada refactor besar?
  - Tidak.

## 10. Rekomendasi task berikutnya

- Audit lane seller payment review backend agar row review juga menerima meta backend native, bukan hanya mapping frontend.
- Jika ingin memperkecil debt lebih jauh, satukan helper status meta reusable untuk lane audit/review yang masih punya serialisasi lokal serupa.
