# ADMIN-STAFF-APPROVAL-AFTER-VERIFY-01 Report

## 1. Summary perubahan

Flow self-signup admin untuk `staff` diubah dari auto-aktif setelah verifikasi email menjadi dua tahap:

1. user self-signup `staff`
2. user verifikasi email
3. akun masuk ke status `pending_approval`
4. super admin approve dari lane `All Accounts`
5. sistem kirim email bahwa akun sudah aktif dan bisa login di `/admin/login`

Patch dibuat additive kecil tanpa migration DB dan tanpa refactor auth/permission besar.

## 2. Flow yang dipilih

Flow akhir:

- `POST /api/auth/admin/register`
  - membuat akun `staff` dengan status `pending_verification`
  - kirim email verifikasi
- `GET /api/auth/admin/verify-email`
  - token valid mengubah status menjadi `pending_approval`
  - UI verify menampilkan bahwa akun menunggu approval admin
- `POST /api/auth/admin/login`
  - akun `pending_approval` ditolak dengan pesan jujur
  - `seller` tetap ditolak
- `POST /api/admin/staff/:id/approve`
  - hanya lane admin existing yang berwenang
  - hanya akun `staff` dengan status `pending_approval` yang bisa di-approve
  - status diubah ke `active`
  - email approval dikirim berisi arahan login ke `/admin/login` menggunakan email terdaftar

## 3. Alasan desain

- Tidak perlu schema DB baru karena field `users.status` sudah cukup untuk status tambahan `pending_approval`.
- Tidak perlu permission redesign besar karena approval ditempatkan di lane admin account existing.
- Approval tetap backend-driven dan tidak bisa dibypass dari UI edit biasa.
- Flow tetap menjaga seller-block di `/admin/login`.

## 4. File yang diubah

- `server/src/services/adminPublicAuth.service.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/admin.staff.ts`
- `server/src/scripts/smokeAdminPublicAuth.ts`
- `client/src/api/adminStaff.ts`
- `client/src/pages/admin/Staff.jsx`
- `client/src/components/admin/staff/EditStaffDrawer.jsx`
- `client/src/pages/admin/AdminVerifyAccountPage.jsx`
- `client/src/pages/admin/AdminCreateAccountPage.jsx`
- `client/src/pages/admin/AdminResendVerificationPage.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`
- `tools/qa/admin-public-auth-frontend-smoke.ts`
- `tools/qa/admin-staff-workflow-smoke.ts`

## 5. Endpoint / flow yang ditambah atau diubah

- `GET /api/auth/admin/verify-email`
  - sukses sekarang menghasilkan state `APPROVAL_PENDING`
- `POST /api/auth/admin/login`
  - akun `pending_approval` ditolak dengan pesan yang jujur
- `POST /api/admin/staff/:id/approve`
  - endpoint baru untuk approve akun staff yang sudah verified

## 6. Dampak backend

- Backend tetap source of truth untuk:
  - role `staff`
  - status `pending_verification` / `pending_approval` / `active`
  - seller-block admin login
  - email approval setelah akun aktif
- Edit lane tidak bisa mengaktifkan akun `pending_approval` lewat toggle biasa.

## 7. Dampak frontend admin

- Verify page kini menampilkan bahwa akun menunggu approval admin.
- Login admin menampilkan alasan yang jujur saat akun sudah verified tetapi belum approved.
- Halaman `All Accounts` menampilkan badge/status `Pending approval`.
- Ada tombol approve berbasis icon pada row akun yang eligible.
- Setelah approve, notice admin menjelaskan bahwa akun sudah aktif dan user bisa login memakai email terdaftar.

## 8. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke / QA

- `pnpm -F server smoke:admin-public-auth` ✅
- `pnpm qa:admin:public-auth` ✅
- `pnpm qa:admin:staff` ✅

### Coverage yang dibuktikan

- self-signup staff membuat akun pending verification ✅
- verify email valid memindahkan akun ke pending approval ✅
- akun pending approval belum bisa login ✅
- super admin bisa approve akun pending approval ✅
- email approval terkirim ✅
- akun yang sudah approved bisa login ✅
- seller tetap diblok di `/admin/login` ✅
- frontend admin public auth tetap benar untuk invalid token / resend / forgot / reset state ✅

## 9. Risiko / residual issue

- Approval action masih mengikuti lane admin account existing yang sekarang tetap super-admin-driven.
- Belum ada browser smoke khusus untuk happy path klik link verify lalu lanjut ke approval live backend; coverage saat ini terpisah antara backend smoke dan frontend smoke.
- Naming internal beberapa lane masih memakai istilah `staff`, walau surface aktif user-facing sudah bergerak ke `All Accounts`.

## 10. Saran task berikutnya

- Tambahkan smoke kecil browser-level untuk approval icon di `All Accounts` terhadap backend lokal sehat.
- Audit apakah actor `admin` biasa memang perlu approval capability atau tetap dibiarkan super-admin-only.
- Tambahkan helper copy kecil di email approval bila ingin menyertakan kontak admin/support workspace.
