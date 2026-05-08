# ADMIN-SELF-SIGNUP-STAFF-AND-FORGOT-PASSWORD-01

## 1. Summary perubahan

Task ini menambahkan auth publik untuk lane Admin Workspace tanpa rebuild auth besar:

- self-signup publik dari `/admin/login` dengan role backend-forced ke `staff`
- verifikasi email wajib sebelum akun `staff` hasil signup bisa login ke `/admin/login`
- forgot/reset password publik untuk lane admin
- seller-block di `/admin/login` tetap dipertahankan
- reuse helper/table/token flow existing dari lane client agar patch tetap kecil dan aman

Patch dipilih sebagai additive kecil-menengah:

- tidak ada schema DB baru
- tidak ada perubahan contract API besar yang mematahkan consumer lama
- backend tetap source of truth untuk role, verification, aktivasi, dan reset token

## 2. Flow self-signup admin staff yang dibangun

Flow yang dipilih:

1. User membuka `/admin/login`
2. User klik `Create account`
3. Form publik admin menerima:
   - full name
   - email
   - password
   - confirm password
4. Backend `POST /api/auth/admin/register` selalu memaksa role hasil create menjadi `staff`
5. User dibuat dengan status `pending_verification`
6. Sistem mengirim email verifikasi berisi link `/admin/verify-account?token=...`
7. User belum bisa login ke `/admin/login` sebelum verifikasi selesai
8. Setelah token valid diverifikasi, status akun menjadi `active`
9. User `staff` yang valid bisa login ke Admin Workspace

Catatan implementasi:

- tabel/token storage reuse `user_registration_verifications`
- token verifikasi di-hash
- token expiry + single-use diterapkan
- anti-abuse ringan reuse pola existing: honeypot, minimum submit delay, rate limit

## 3. Flow verify email yang dibangun

- Endpoint: `GET /api/auth/admin/verify-email?token=...`
- Token invalid / expired / reuse -> gagal aman dengan code `VERIFY_TOKEN_INVALID`
- Token valid:
  - hanya berlaku untuk akun role `staff`
  - mengaktifkan akun dari `pending_verification` ke `active`
  - menandai verification record sebagai consumed / verified

## 4. Flow forgot/reset password admin yang dibangun

Flow forgot/reset:

1. User membuka `/admin/login`
2. User klik `Forgot password?`
3. Form forgot password admin mengirim `POST /api/auth/admin/forgot-password`
4. Response selalu generik:
   - `If the email is registered, we have sent a password reset link.`
5. Jika email milik akun admin workspace yang eligible (`staff/admin/super_admin`) dan aktif:
   - sistem mengirim email reset
6. User membuka link reset `/admin/reset-password?token=...`
7. User submit password baru
8. `POST /api/auth/admin/reset-password` memvalidasi token
9. Token valid -> password diubah, token consumed, user diarahkan kembali ke `/admin/login`
10. Token invalid/expired/reuse -> gagal aman dengan code `RESET_TOKEN_INVALID`

## 5. File yang diubah

- `packages/schemas/src/index.ts`
- `server/src/services/adminPublicAuth.service.ts`
- `server/src/routes/auth.ts`
- `server/src/scripts/smokeAdminPublicAuth.ts`
- `server/package.json`
- `client/src/api/adminPublicAuth.ts`
- `client/src/api/axios.ts`
- `client/src/auth/AuthContext.jsx`
- `client/src/App.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`
- `client/src/pages/admin/AdminCreateAccountPage.jsx`
- `client/src/pages/admin/AdminVerifyAccountPage.jsx`
- `client/src/pages/admin/AdminForgotPasswordPage.jsx`
- `client/src/pages/admin/AdminResetPasswordPage.jsx`

## 6. Endpoint yang ditambah/diubah

Ditambah:

- `POST /api/auth/admin/register`
- `GET /api/auth/admin/verify-email`
- `POST /api/auth/admin/forgot-password`
- `POST /api/auth/admin/reset-password`

Diubah:

- `POST /api/auth/admin/login`
  - akun admin-workspace yang masih `pending_verification` sekarang ditolak dengan notice jujur
  - seller-block tetap dipertahankan

## 7. Verifikasi / build / test

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:admin-public-auth` ✅
  - signup staff sukses
  - verification email dispatched
  - unverified staff login blocked
  - verify token valid sukses
  - verify token invalid/reuse gagal
  - forgot password generic response aman
  - reset token valid sukses
  - token invalid/reuse/expired gagal
  - seller tetap diblok, admin/super_admin tetap valid
- `pnpm -F server smoke:admin-seller-admin-login-block` ✅
- `pnpm -F server smoke:auth-session-invalidation` ✅

### QA/manual

- audit manual route admin auth publik:
  - `/admin/login`
  - `/admin/create-account`
  - `/admin/verify-account`
  - `/admin/forgot-password`
  - `/admin/reset-password`
- audit memastikan auth-form failure biasa tidak ikut dianggap session-expired global

## 8. Risiko / residual issue

- Self-signup admin publik saat ini hanya membuka role `staff`; ini memang sesuai boundary task, tetapi belum ada resend verification page khusus untuk lane admin.
- Forgot password admin saat ini hanya berlaku untuk akun admin workspace yang sudah `active`; akun `pending_verification` harus menyelesaikan verifikasi dulu.
- UI admin auth publik belum punya smoke browser-level sendiri; coverage saat ini backend smoke + build + audit manual.
- Naming route dan copy tetap ringan; tidak ada redesign visual besar untuk admin auth.

## 9. Saran task berikutnya

- Tambahkan resend verification kecil untuk lane admin self-signup jika memang dibutuhkan operasional.
- Tambahkan smoke frontend auth admin publik agar create/verify/forgot/reset punya coverage browser-level.
- Audit apakah admin login perlu return-to-target flow kecil bila nanti ada lebih banyak entry point admin publik.
