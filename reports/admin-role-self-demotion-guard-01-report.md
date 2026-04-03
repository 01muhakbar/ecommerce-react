# ADMIN-ROLE-SELF-DEMOTION-GUARD-01 Report

## 1. Summary perubahan

Task ini menutup risiko operasional agar `super_admin` tidak bisa menurunkan role akunnya sendiri secara tidak sengaja dari lane account management admin.

Perubahan utama:

- Backend `PATCH /api/admin/staff/:id` sekarang menolak self-demotion dari `super_admin` ke role yang lebih rendah.
- Frontend edit drawer sekarang mendeteksi saat actor sedang mengedit akun `super_admin` miliknya sendiri.
- Saat kondisi itu terjadi, role selector dinonaktifkan dan helper text menjelaskan alasan lock dengan jujur.
- Smoke admin staff diperluas untuk memverifikasi helper self-demotion guard di level browser.

## 2. Boundary yang disentuh

- `server/src/routes/admin.staff.ts`
- `client/src/components/admin/staff/EditStaffDrawer.jsx`
- `client/src/pages/admin/Staff.jsx`
- `tools/qa/admin-staff-workflow-smoke.ts`

Task ini tidak:

- mengubah schema DB
- mengubah permission-per-menu
- merombak role-management besar
- menyentuh seller block pada `/admin/login`

## 3. Source of truth dan desain patch

### Source of truth

- Actor auth untuk lane ini tetap datang dari backend guard `requireSuperAdmin`
- Policy self-demotion guard diputuskan di backend route edit account

### Desain patch

- Jika actor saat ini adalah `super_admin`
- dan actor sedang mengedit akun miliknya sendiri
- dan payload mencoba mengubah role target dari `super_admin` ke role lain
- maka backend mengembalikan `409`

Frontend hanya menambahkan affordance yang jujur:

- role selector disabled untuk self-edit `super_admin`
- helper text menjelaskan bahwa role sendiri tidak bisa diturunkan dari flow ini

## 4. File yang diubah

- `server/src/routes/admin.staff.ts`
- `client/src/components/admin/staff/EditStaffDrawer.jsx`
- `client/src/pages/admin/Staff.jsx`
- `tools/qa/admin-staff-workflow-smoke.ts`

## 5. Dampak backend

- Self-demotion `super_admin` sekarang ditolak di server, bukan hanya di UI.
- Edit akun sendiri untuk field lain tetap diizinkan.
- Tidak ada contract API besar yang dipatahkan.

## 6. Dampak frontend admin

- Drawer edit sekarang lebih jujur saat super admin membuka akunnya sendiri.
- Role selector tidak lagi memberi affordance misleading pada self-edit `super_admin`.
- Error/helper state tetap konsisten dengan source of truth backend.

## 7. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke / QA

- `pnpm qa:admin:staff` ✅

Coverage smoke relevan:

- create account sukses
- duplicate email ditolak
- list refresh tetap benar
- edit basic info tetap berjalan
- self-edit `super_admin` menampilkan helper lock dan role selector disabled

## 8. Risiko / residual issue

- Guard ini fokus pada self-demotion via edit lane admin aktif, bukan seluruh kemungkinan workflow role transfer lain di sistem.
- Route/page masih bernama `staff`, walau lane-nya sudah lebih luas sebagai account management.
- Belum ada smoke yang menembak backend live untuk self-demotion; coverage saat ini browser-level dengan mock terkontrol.

## 9. Saran task berikutnya

- Tambahkan smoke kecil yang memastikan seller account hasil create/edit tetap gagal login di `/admin/login`.
- Audit apakah lane delete/deactivate juga perlu guard kecil tambahan untuk akun `super_admin` sendiri.
