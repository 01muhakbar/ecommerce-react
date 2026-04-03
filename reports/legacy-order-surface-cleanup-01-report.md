# LEGACY-ORDER-SURFACE-CLEANUP-01 Report

## 1. Summary perubahan

Task ini difokuskan pada surface order/payment legacy yang masih aktif di route utama, terutama yang masih menampilkan status mentah atau copy lokal meski backend contract/read model sudah tersedia.

Perubahan yang dilakukan:

- Menambahkan dukungan `label` dan `tone` opsional pada `PaymentStatusBadge`, lalu mengubah default badge agar memakai label manusiawi yang selaras dengan mapping backend untuk status payment umum.
- Menyinkronkan badge payment utama di buyer order list, buyer order detail, buyer order payment, admin order list, dan admin order detail agar membaca meta/read model backend lebih dulu.
- Menyinkronkan recent orders row di admin dashboard agar badge dan helper text status membaca `contract.statusSummary` bila tersedia.
- Merapikan seller payment review agar badge payment/proof dan helper text tidak lagi menampilkan kode teknis mentah di route aktif.

Tidak ada perubahan schema database.
Tidak ada perubahan endpoint besar.
Tidak ada perubahan contract API besar.

## 2. Audit boundary ringkas

### Route aktif yang diaudit

- Client:
  - `client/src/pages/account/AccountOrdersPage.jsx`
  - `client/src/pages/account/AccountOrderDetailPage.jsx`
  - `client/src/pages/account/AccountOrderPaymentPage.jsx`
- Admin:
  - `client/src/pages/Dashboard.jsx` melalui `client/src/components/dashboard/RecentOrderRow.jsx`
  - `client/src/pages/admin/Orders.jsx`
  - `client/src/pages/admin/OrderDetail.jsx`
- Seller:
  - `client/src/pages/seller/SellerPaymentReviewPage.jsx`

### Komponen legacy yang diaudit

- `client/src/components/Orders/OrderDetailsModal.jsx`
- `client/src/components/Tables/OrderRow.jsx`
- `client/src/components/Tables/OrderTable.jsx`

### Hasil audit pemakaian

- `RecentOrderRow.jsx` aktif karena dipakai `RecentOrdersTable.jsx`, lalu dirender dari route aktif admin dashboard.
- `OrderRow.jsx` hanya dipakai `OrderTable.jsx`.
- `OrderTable.jsx` tidak ditemukan dipakai route aktif.
- `OrderDetailsModal.jsx` tidak ditemukan dipakai route aktif.

## 3. Mismatch yang ditemukan

- Masalah: beberapa route aktif buyer/admin masih merender badge payment dari `paymentStatus` mentah meski `paymentStatusMeta` atau payment read model sudah tersedia.
  - Risiko: status badge menampilkan kode teknis atau tone yang tidak konsisten dengan truth backend.
  - Patch terkecil yang aman: izinkan `PaymentStatusBadge` menerima `label/tone` dari backend meta dan gunakan itu di route aktif.

- Masalah: admin dashboard recent orders masih memakai status note lokal dan badge dari `order.status` hasil normalisasi frontend.
  - Risiko: dashboard admin bisa memberi ringkasan yang tidak sama dengan contract backend.
  - Patch terkecil yang aman: pakai `contract.statusSummary` untuk label dan helper text bila tersedia.

- Masalah: seller payment review masih menampilkan label badge dan helper text dengan kode mentah seperti `PENDING_CONFIRMATION`.
  - Risiko: surface review aktif tetap terasa legacy dan kurang jujur untuk operator.
  - Patch terkecil yang aman: gunakan label presentasional yang konsisten dari status backend mentah, tanpa mengubah endpoint.

## 4. Mismatch mana yang diperbaiki

- Diperbaiki: buyer order list/detail/payment sekarang memakai `paymentStatusMeta` atau grouped payment read model lebih dulu untuk badge payment utama.
- Diperbaiki: admin order list/detail sekarang memakai `paymentStatusMeta` lebih dulu untuk badge payment utama.
- Diperbaiki: admin dashboard recent orders sekarang memakai `contract.statusSummary` lebih dulu untuk status utama.
- Diperbaiki: seller payment review kini memakai label payment/proof yang lebih manusiawi dan helper text tidak lagi menyebut kode mentah.
- Diperbaiki secara shared: route aktif lain yang memakai `PaymentStatusBadge` kini otomatis menampilkan label payment yang lebih jujur walau belum mengirim `label/tone` eksplisit.

## 5. File yang diubah

- `client/src/components/payments/PaymentReadModelBadges.jsx`
- `client/src/pages/account/AccountOrdersPage.jsx`
- `client/src/pages/account/AccountOrderDetailPage.jsx`
- `client/src/pages/account/AccountOrderPaymentPage.jsx`
- `client/src/components/dashboard/RecentOrderRow.jsx`
- `client/src/pages/admin/Orders.jsx`
- `client/src/pages/admin/OrderDetail.jsx`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`

## 6. Dampak lintas app

- Admin:
  - Dashboard recent orders lebih dekat ke `contract.statusSummary`.
  - Orders list/detail memakai payment meta backend lebih dulu untuk badge payment utama.
- Seller:
  - Payment review lane tetap read-only/mutation governance yang sama, tetapi label badge/helper text tidak lagi terlalu teknis.
- Client:
  - Buyer order list/detail/payment memakai truth payment meta/read model lebih dulu pada surface aktif.
- Backend/API:
  - Tidak ada perubahan file backend.
  - Consumer aktif memanfaatkan truth yang sudah tersedia dengan lebih jujur.

## 7. Komponen non-aktif / deferred

- `client/src/components/Orders/OrderDetailsModal.jsx`
  - Tidak ditemukan dipakai route aktif.
  - Deferred / candidate removal.

- `client/src/components/Tables/OrderRow.jsx`
  - Hanya dipakai `client/src/components/Tables/OrderTable.jsx`.
  - Tidak ditemukan dipakai route aktif.
  - Deferred / candidate removal.

- `client/src/components/Tables/OrderTable.jsx`
  - Tidak ditemukan dipakai route aktif.
  - Deferred / candidate removal.

## 8. Hasil verifikasi

### Build

- `pnpm -F client build` ✅
- `pnpm -F server build` ✅

### Smoke

- `pnpm -F server smoke:order-payment` ⚠️ blocked
- `pnpm -F server smoke:stripe-webhook` ⚠️ blocked

Catatan:
- Keduanya gagal pada `ensureServerReady` karena `BASE_URL` lokal mengembalikan `ECONNREFUSED` sebelum scenario test berjalan.
- Saya rerun sekali dan hasilnya sama.
- Saya juga coba bootstrap server lokal singkat untuk memverifikasi readiness, tetapi health check tetap belum tersedia, jadi blocker ini saya catat sebagai isu environment verifikasi, bukan assertion failure dari patch.

### QA/manual

- `pnpm qa:mvf:visibility:frontend` ✅
- Audit manual pemakaian route aktif dan komponen legacy dilakukan via pencarian repo.

## 9. Risiko / residual issue

- Lane aktif seperti admin payment audit masih bergantung pada payload raw-only di beberapa bagian, walau badge payment kini lebih manusiawi karena helper shared.
- Karena task ini dibatasi tetap kecil dan tanpa perubahan endpoint besar, saya tidak menambah field meta baru ke endpoint audit/review yang belum membawanya.
- Smoke backend belum bisa dijadikan sinyal akhir di environment ini sampai server lokal benar-benar siap di `BASE_URL`.

## 10. Mandatory checklist

- Apakah semua route aktif yang menampilkan status order/payment utama kini memakai contract truth atau read model lebih dulu bila tersedia?
  - Ya, untuk surface aktif yang diaudit dan punya meta/read model tersedia.
- Apakah komponen non-aktif didokumentasikan jelas?
  - Ya.
- Apakah patch ini melakukan refactor besar?
  - Tidak.

## 11. Rekomendasi task berikutnya

- Jika ingin menutup residual secara penuh, tambahkan meta status kecil ke lane audit/review backend yang masih raw-only, lalu sinkronkan consumer-nya.
- Setelah ada bukti aman, hapus atau arsipkan `OrderDetailsModal.jsx`, `OrderTable.jsx`, dan `OrderRow.jsx`.
