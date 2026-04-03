# MVF-TRUTH-01 Hardening Report

## 1. Summary perubahan

Patch difokuskan pada sinkronisasi consumer order status yang masih membaca `order.status` legacy, padahal backend order lifecycle contract sudah tersedia dan menjadi source of truth.

Perubahan yang dilakukan:

- Menambahkan adapter frontend kecil `client/src/utils/orderTruth.js` untuk membaca `contract.statusSummary` lebih dulu lalu fallback ke status legacy bila contract belum tersedia.
- Menyinkronkan status ringkasan order di Account Dashboard agar badge recent orders dan bucket statistik lebih dekat ke backend truth.
- Menyinkronkan badge status order pada halaman Admin Customer Detail dan Admin Customer Orders agar menggunakan backend contract yang sama dengan halaman admin order utama.

Tidak ada perubahan schema database.
Tidak ada perubahan endpoint besar.
Tidak ada perubahan contract API besar.

## 2. Daftar mismatch yang ditemukan

### Mismatch prioritas tinggi

- Masalah: `AccountDashboardPage` menghitung `pending / processing / complete` dan badge recent orders dari `order.status` mentah.
  - Source of truth seharusnya: `server/src/services/orderLifecycleContract.service.ts` melalui `contract.statusSummary`.
  - Consumer yang salah: `client/src/pages/account/AccountDashboardPage.jsx`
  - Risiko production: buyer bisa melihat status list/dashboard yang tidak sama dengan status utama di account detail/tracking.
  - Patch terkecil yang aman: adapter kecil frontend untuk baca `contract.statusSummary` dulu.

- Masalah: halaman admin customer order list/detail menampilkan badge dari `order.status` hasil normalisasi frontend, bukan dari contract backend.
  - Source of truth seharusnya: `buildAdminOrderContract` pada `server/src/routes/admin.orders.ts`
  - Consumer yang salah:
    - `client/src/pages/admin/AdminCustomerOrdersPage.jsx`
    - `client/src/pages/admin/AdminCustomerDetailPage.jsx`
  - Risiko production: admin customer page bisa menampilkan status berbeda dari halaman admin order detail utama.
  - Patch terkecil yang aman: pakai contract backend yang sudah ikut di payload `/api/admin/orders`.

### Mismatch dicatat sebagai residual issue

- `client/src/pages/store/StoreOrderTrackingPage.jsx` masih punya stepper presentational yang memetakan `order.status` mentah, walau badge utama dan CTA Stripe sudah membaca contract backend.
- Komponen legacy non-core `client/src/components/Orders/OrderDetailsModal.jsx` dan `client/src/components/Tables/OrderRow.jsx` masih membaca status mentah.

## 3. Mismatch mana yang diperbaiki

- Diperbaiki: status recent orders dan bucket statistik di Account Dashboard sekarang membaca truth dari `contract.statusSummary` dulu.
- Diperbaiki: badge status order di Admin Customer Orders sekarang membaca truth dari `contract.statusSummary` dulu.
- Diperbaiki: badge status order di Admin Customer Detail sekarang membaca truth dari `contract.statusSummary` dulu.

## 4. File yang diubah

- `client/src/utils/orderTruth.js`
- `client/src/pages/account/AccountDashboardPage.jsx`
- `client/src/pages/admin/AdminCustomerOrdersPage.jsx`
- `client/src/pages/admin/AdminCustomerDetailPage.jsx`

## 5. Dampak ke Admin

- Admin customer order surfaces sekarang menampilkan badge yang konsisten dengan backend lifecycle contract.
- Tidak ada CTA admin baru.
- Tidak ada perubahan permission atau action backend.

## 6. Dampak ke Seller

- Tidak ada perubahan seller consumer.
- Audit menunjukkan seller order/detail/payment review sudah backend-driven untuk actionability dan governance.

## 7. Dampak ke Client

- Buyer dashboard recent orders kini lebih jujur terhadap backend truth.
- Buyer dashboard summary counts tidak lagi hanya mengandalkan `order.status` mentah bila contract tersedia.
- Public checkout/payment/tracking flow tidak diubah karena audit menunjukkan CTA inti sudah digate backend contract atau payment entry backend.

## 8. Dampak ke Backend/API

- Tidak ada file backend yang diubah.
- Source of truth yang dipakai tetap:
  - store readiness: `buildPublicStoreOperationalReadiness`
  - product visibility: `buildProductVisibilitySnapshot`
  - checkout preview/create gating: `prepareCartGroups` + checkout serializers
  - payment actionability dan order finality: `orderLifecycleContract.service.ts`

## 9. Hasil build/smoke/QA

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:product-visibility` ✅
- `pnpm -F server smoke:store-readiness` ✅
- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:stripe-webhook` ✅

### QA/manual

- `pnpm qa:mvf:visibility:frontend` ✅
- Code audit manual dilakukan pada:
  - checkout preview/create
  - account orders/detail/payment
  - public success/tracking
  - admin orders/detail/customer order surfaces
  - seller orders/detail/payment review

## 10. Risiko / residual issue

- Tracking stepper publik masih presentational dan belum sepenuhnya digerakkan oleh contract backend. Badge utama dan CTA sudah jujur, tetapi stepper visual belum sepenuhnya satu sumber truth.
- Beberapa komponen legacy non-core masih memakai status mentah. Tidak saya patch agar boundary tetap kecil dan aman untuk task ini.
- Adapter `orderTruth.js` tetap fallback ke status legacy bila contract tidak ada, jadi consumer lama tidak dipatahkan. Ini aman untuk compatibility, tetapi artinya truth penuh tetap bergantung pada coverage contract dari backend endpoint masing-masing.

## 11. Saran task berikutnya

- Sinkronkan `StoreOrderTrackingPage` stepper visual ke `contract.statusSummary` atau ke contract per split agar seluruh tracking page benar-benar satu sumber truth.
- Audit komponen legacy shared order table/modal dan putuskan apakah masih dipakai di route aktif. Jika masih aktif, pindahkan juga ke adapter contract yang sama.
- Bila ingin melanjutkan hardening kecil, audit halaman dashboard atau summary order lain yang masih memetakan `order.status` langsung.

## STEP 1 — Audit boundary ringkas

- Source of truth backend store readiness:
  - `server/src/services/publicStoreIdentity.ts`
  - `buildPublicStoreOperationalReadiness`
- Source of truth backend product visibility:
  - `server/src/services/productVisibility.ts`
  - `buildProductVisibilitySnapshot`
- Source of truth backend payment actionability:
  - `server/src/services/orderLifecycleContract.service.ts`
  - `buildPaymentActionability`
  - `buildBuyerOrderContract`
  - `buildAdminOrderContract`
  - `buildSellerSuborderContract`
- Source of truth backend order status / finality:
  - `server/src/services/orderLifecycleContract.service.ts`
  - `buildStatusSummary`

Frontend consumers yang diaudit:

- Admin:
  - `client/src/pages/admin/Orders.jsx`
  - `client/src/pages/admin/OrderDetail.jsx`
  - `client/src/pages/admin/AdminCustomerOrdersPage.jsx`
  - `client/src/pages/admin/AdminCustomerDetailPage.jsx`
- Seller:
  - `client/src/pages/seller/SellerOrdersPage.jsx`
  - `client/src/pages/seller/SellerOrderDetailPage.jsx`
  - `client/src/pages/seller/SellerPaymentReviewPage.jsx`
- Client:
  - `client/src/pages/store/Checkout.jsx`
  - `client/src/pages/store/StoreCheckoutSuccessPage.jsx`
  - `client/src/pages/store/StoreOrderTrackingPage.jsx`
  - `client/src/pages/account/AccountOrdersPage.jsx`
  - `client/src/pages/account/AccountOrderDetailPage.jsx`
  - `client/src/pages/account/AccountOrderPaymentPage.jsx`
  - `client/src/pages/account/AccountDashboardPage.jsx`

## Mandatory cross-app checklist

- Apakah Admin menampilkan status/order/product truth yang sama dengan backend?
  - Ya untuk route admin orders utama yang diaudit, dan sekarang admin customer order surfaces ikut membaca contract backend yang sama.
- Apakah Seller hanya melihat aksi yang benar-benar diizinkan backend?
  - Ya. Audit menunjukkan seller actionability sudah backend-driven dari governance/contract dan tidak diubah di patch ini.
- Apakah Client tidak menampilkan CTA palsu?
  - Ya pada checkout, success, account order detail, dan account payment flow yang diaudit. CTA pembayaran tetap mengikuti `paymentEntry` / contract backend.
- Apakah checkout hanya bisa lanjut bila readiness dan payment prerequisites valid?
  - Ya. Diverifikasi lewat audit `prepareCartGroups` dan smoke `smoke:product-visibility`, `smoke:store-readiness`, `smoke:order-payment`.
- Apakah order status konsisten di success/tracking/account/admin/seller?
  - Lebih konsisten setelah patch. Core account/admin surfaces yang tertinggal sekarang membaca contract backend. Satu residual visual yang belum disinkronkan penuh adalah stepper presentational di tracking page.
- Apakah helper text/loading/empty/blocked state jujur?
  - Ya pada flow inti yang diaudit. Tidak ada helper state palsu baru yang diperkenalkan.
- Apakah patch ini mengubah contract besar?
  - Tidak.
