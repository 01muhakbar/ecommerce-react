# ADMIN-ACCOUNT-ROLE-SELECTION-01 Report

## 1. Summary perubahan

Task ini membuka kembali pemilihan role akun pada lane create/edit account admin dengan boundary kecil dan aman.

Perubahan utama:

- Backend `POST /api/admin/staff` dan `PATCH /api/admin/staff/:id` sekarang menerima role allowlist yang sama: `super_admin`, `admin`, `staff`, `seller`.
- Backend tetap menjadi source of truth: role dinormalisasi dan divalidasi ulang di server, bukan dipercaya mentah dari frontend.
- Seller tetap ditolak pada `/api/auth/admin/login`; task ini tidak mengubah guard login admin.
- Drawer create/edit admin sekarang menampilkan role selector lagi, tetapi tetap tidak membuka permission per-menu untuk `admin` dan `staff`.
- Seller access preset/permission tetap hanya muncul saat role yang dipilih adalah `seller`.
- Smoke admin staff yang sudah ada ikut diselaraskan agar create/edit lane tetap punya regression coverage.

## 2. Audit boundary ringkas

### Source of truth role existing

- Route admin account management aktif berada di `server/src/routes/admin.staff.ts`
- Route ini dipasang di `server/src/app.ts` dengan guard `requireSuperAdmin`
- Guard login admin tetap berada di `server/src/routes/auth.ts`
- Enum role yang relevan dan stabil untuk task ini:
  - `super_admin`
  - `admin`
  - `staff`
  - `seller`

### Gap nyata sebelum patch

- Create flow masih hardcoded ke role `staff`
- Edit flow masih menolak semua role change
- UI create/edit masih menyatakan fixed role / locked role
- Seller login block sudah aman, tetapi belum tersambung ke copy/create-edit role selection yang jujur

### Alasan patch aman

- Permission per-menu detail belum disentuh
- Role selection hanya dibuka kembali pada lane yang sudah super-admin-only
- Tidak ada schema DB baru
- Tidak ada contract API besar yang dipatahkan

## 3. Endpoint / flow yang diubah

- `POST /api/admin/staff`
  - sekarang menerima role allowlist backend
  - seller preset/permission ikut diproses bila role = `seller`
- `PATCH /api/admin/staff/:id`
  - sekarang menerima perubahan role allowlist backend
  - seller preset/permission ikut disinkronkan bila role berubah ke/dari `seller`
- `/admin/our-staff`
  - create/edit drawer sekarang mendukung role selection lagi

## 4. File yang diubah

- `server/src/routes/admin.staff.ts`
- `client/src/api/adminStaff.ts`
- `client/src/components/admin/staff/AddStaffDrawer.jsx`
- `client/src/components/admin/staff/EditStaffDrawer.jsx`
- `client/src/pages/admin/Staff.jsx`
- `tools/qa/admin-staff-workflow-smoke.ts`

## 5. Dampak backend

- Backend sekarang menerima pemilihan role yang diizinkan dari lane admin account management.
- Role ilegal tetap ditolak oleh server.
- Seller tetap tidak bisa login lewat `/admin/login`.
- Seller-only permission payload tetap dibatasi ke allowlist seller yang aman.

## 6. Dampak frontend admin

- Super Admin sekarang dapat memilih role akun saat create/edit account.
- Copy create/edit menjadi lebih jujur: lane ini mengelola account role, bukan staff-only lagi.
- Untuk role `seller`, drawer menampilkan preset dan permission seller yang memang sudah ada.
- Untuk role `admin` dan `staff`, UI hanya menampilkan helper state tanpa membuka permission per-menu detail.

## 7. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### QA / smoke

- `pnpm qa:admin:staff` ✅

Coverage smoke yang tetap lolos:

- create account sukses
- duplicate email ditolak dengan jujur
- list refresh setelah create
- edit basic info
- edit role change dasar pada lane aktif

## 8. Risiko / residual issue

- Lane ini masih memakai route/page bernama `staff`, walau sekarang memuat account role yang lebih luas.
- Permission per-menu detail untuk `admin` dan `staff` memang belum ada dan tetap di luar scope task ini.
- Self-demotion / operational policy yang lebih kompleks belum dibatasi khusus pada task ini.

## 9. Saran task berikutnya

- Audit apakah perlu guard kecil untuk mencegah super admin menurunkan role akunnya sendiri secara tidak sengaja.
- Jika lane account role ini akan jadi workflow inti, tambahkan smoke kecil untuk create seller account dan memastikan seller tetap ditolak pada `/admin/login`.
