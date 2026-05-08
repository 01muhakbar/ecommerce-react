# MVF-LOCK-01 Report

## Yang diamati

- Backend source of truth untuk task ini tetap berada di:
  - `server/src/services/publicStoreIdentity.ts`
  - `server/src/services/productVisibility.ts`
  - `server/src/services/orderLifecycleContract.service.ts`
  - `server/src/services/paymentCheckoutView.service.ts`
- Consumer aktif yang diaudit:
  - Client: checkout, success, tracking, account orders/detail/payment
  - Seller: orders, order detail, payment review
  - Admin: orders, order detail, customer order surfaces, payment audit surfaces
- Mayoritas route aktif sudah memakai contract/meta backend. Drift prioritas yang masih tersisa ada pada:
  - helper readiness/payment availability di checkout client yang masih terlalu generik
  - admin payment audit list yang belum menampilkan parent order status bersama parent payment state pada tabel utama

## Gap utama

- Checkout client masih menulis blocker message generik seperti semua store hanya “tidak punya QRIS aktif”, padahal backend sudah memberi warning/snapshot yang lebih spesifik per store.
- Badge/snapshot checkout masih menampilkan kode status payment profile mentah, sehingga helper text dan badge readiness terasa kurang jujur.
- Admin payment audit list hanya menonjolkan parent payment state pada kolom utama, sehingga operator tidak langsung melihat parent order status yang menjadi pasangan source of truth backend.
- Audit seller tidak menemukan mismatch prioritas tinggi baru; actionability dan helper utama sudah backend-driven.

## Patch yang dipilih dan kenapa itu yang paling kecil dan aman

- Client checkout:
  - tetap memakai payload preview existing
  - hanya menambahkan formatter kecil di frontend untuk membaca `group.warning` dan `group.paymentProfileStatus` dengan label yang lebih jujur
  - tidak mengubah endpoint, request payload, atau checkout flow
- Admin payment audit list:
  - menambah field additive kecil `orderStatus` dan `orderStatusMeta` pada serializer list
  - menampilkan badge parent order dan parent payment berdampingan di tabel
  - tidak mengubah schema, route, atau behavior audit lain

## File yang diubah

- `client/src/pages/store/Checkout.jsx`
- `client/src/api/adminPaymentAudit.ts`
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `server/src/routes/admin.payments.audit.ts`
- `reports/mvf-lock-01-report.md`

## Dampak ke Admin

- Admin payment audit list sekarang menampilkan parent order status dan parent payment state secara bersamaan.
- Helper deskripsi di kolom utama audit tidak lagi hanya bertumpu pada parent payment bila order meta tersedia.

## Dampak ke Seller

- Tidak ada file seller yang diubah.
- Hasil audit menunjukkan seller orders, seller order detail, dan seller payment review sudah cukup sinkron dengan governance/meta backend untuk scope task ini.

## Dampak ke Client

- Checkout blocker sekarang lebih jujur karena mengikuti warning backend per store.
- Snapshot payment setup di checkout tidak lagi menampilkan kode mentah tanpa label.
- Buyer guidance untuk store yang diblokir kini menjelaskan bahwa checkout tertahan oleh backend payment readiness, bukan sekadar copy generik.

## Hasil verifikasi

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅
- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:store-readiness` ✅
- `pnpm -F server smoke:product-visibility` ✅
- `pnpm qa:mvf:visibility:frontend` ✅

## Residual risk

- Checkout preview masih menerima `paymentProfileStatus` sebagai kode backend, lalu dilabeli di frontend. Ini aman untuk patch kecil, tetapi belum sebersih bila backend nanti mengirim meta readiness penuh.
- Seller surfaces tetap mengandalkan audit manual pada task ini karena tidak ada mismatch prioritas tinggi yang butuh patch.
- Tidak ada smoke browser khusus untuk admin payment audit list; coverage admin pada task ini berasal dari build dan audit payload/UI code path.

## Next task paling logis

- Tambahkan meta readiness additive kecil pada payload checkout preview jika ingin menghapus formatter label lokal di checkout sepenuhnya.
- Audit lagi seller/admin summary cards yang masih menghitung statistik dari raw status field agar seluruh dashboard ringkas juga konsisten dengan contract backend.
