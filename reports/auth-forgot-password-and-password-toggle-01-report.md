# AUTH-FORGOT-PASSWORD-AND-PASSWORD-TOGGLE-01 Report

## 1. Summary perubahan

Task ini menambahkan forgot password berbasis email link untuk client auth flow dan toggle show/hide password pada halaman login serta register, dengan patch kecil-menengah yang tetap mengikuti source of truth backend.

Perubahan utama:

- Menambahkan validator forgot/reset password additive di `packages/schemas/src/index.ts`.
- Menambahkan service backend `server/src/services/clientPasswordReset.service.ts` untuk:
  - request forgot password generik tanpa email enumeration
  - token random kuat yang di-hash
  - expiry
  - one-time use
  - anti-bot ringan via honeypot, minimum submit delay, dan rate limit in-memory ringan
- Menambahkan endpoint aktif:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- Menambahkan halaman client:
  - `/auth/forgot-password`
  - `/auth/reset-password`
- Menambahkan link `Forgot password?` di login client.
- Menambahkan toggle show/hide password di:
  - login
  - register
  - reset password

Tidak ada refactor auth besar.
Tidak ada perubahan contract API besar yang merusak consumer existing.
Tidak ada migration/schema DB baru.

## 2. Audit boundary ringkas

### Source of truth backend auth existing

- Route auth aktif client ada di `server/src/routes/auth.ts`
- Session login existing tetap memakai cookie JWT dari route auth yang sama
- Mail delivery existing memakai `server/src/utils/email.ts`
- Registration verification existing memakai `server/src/models/UserRegistrationVerification.ts`

### Gap nyata yang ditemukan

- Route aktif client belum punya forgot/reset password flow.
- Halaman client auth aktif belum punya forgot password page maupun reset password page.
- Login dan register client belum punya toggle show/hide password.
- Tabel `users` runtime lokal yang aktif tidak memiliki kolom reset password token/expiry, jadi patch tidak aman jika mengandalkan field itu langsung.

### Keputusan patch aman

Untuk menghindari migration baru, persistence forgot password memakai tabel existing `user_registration_verifications` yang sudah punya hash, expiry, consumed, dan status fields. Flow reset dibedakan dengan prefix `publicId = pwdreset_*`, sehingga tetap additive dan tidak mematahkan flow registrasi OTP.

## 3. Flow forgot password yang dibangun

1. User membuka `/auth/login`
2. User klik link `Forgot password?`
3. User membuka `/auth/forgot-password`
4. User submit email
5. Backend selalu mengembalikan pesan generik:
   - `If the email is registered, we have sent a password reset link.`
6. Untuk akun aktif yang valid, backend:
   - membuat token random kuat
   - menyimpan hash token + expiry + consumed lifecycle di `user_registration_verifications`
   - mengirim email berisi link `/auth/reset-password?token=...`
7. User membuka halaman reset password client
8. User submit password baru + konfirmasi
9. Backend memvalidasi token:
   - token harus cocok dengan hash
   - token harus belum expired
   - token harus masih berstatus pending
10. Jika valid:
   - password di-update
   - record reset ditandai consumed/verified
   - token tidak bisa dipakai lagi
11. Frontend redirect ke login dengan pesan sukses

## 4. Endpoint yang ditambah/diubah

- Ditambah: `POST /api/auth/forgot-password`
- Ditambah: `POST /api/auth/reset-password`

Tidak ada endpoint existing yang dihapus.

## 5. Halaman client yang diubah

- `client/src/pages/store/StoreLoginPage.jsx`
  - tambah link forgot password
  - tambah toggle show/hide password
  - tampilkan pesan sukses setelah reset
- `client/src/pages/store/StoreRegisterPage.jsx`
  - tambah toggle show/hide password
  - tambah toggle show/hide confirm password
- `client/src/pages/store/StoreForgotPasswordPage.jsx`
  - halaman baru forgot password
- `client/src/pages/store/StoreResetPasswordPage.jsx`
  - halaman baru reset password
- `client/src/App.jsx`
  - tambah route forgot/reset password client

## 6. File yang diubah

- `packages/schemas/src/index.ts`
- `server/src/routes/auth.ts`
- `server/src/services/clientPasswordReset.service.ts`
- `client/src/api/storeAuth.ts`
- `client/src/App.jsx`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/store/StoreRegisterPage.jsx`
- `client/src/pages/store/StoreForgotPasswordPage.jsx`
- `client/src/pages/store/StoreResetPasswordPage.jsx`

## 7. Validasi / build / test yang dijalankan

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Runtime checks

- `GET http://localhost:3001/api/health` ✅
- `POST /api/auth/forgot-password` dengan email non-terdaftar mengembalikan respons generik ✅
- `POST /api/auth/reset-password` dengan token invalid mengembalikan `RESET_TOKEN_INVALID` ✅

### Service-level verification

Inline verification via `pnpm exec tsx` di folder `server`:

- token reset dibuat ✅
- email dispatch path terpanggil via stub sender ✅
- reset link `/auth/reset-password?token=...` terbentuk benar ✅
- reset password berhasil untuk token valid ✅
- token tidak bisa dipakai ulang ✅
- password baru tersimpan dan tervalidasi dengan bcrypt ✅

### Auth smoke existing

- `pnpm smoke:client-registration-otp` ⚠️ existing failure not caused by this patch

Failure yang terlihat:

- skenario `delivery failed register` mengharapkan HTTP `503`
- environment lokal justru benar-benar berhasil mengirim email verifikasi dan route mengembalikan `202`

Ini terlihat sebagai mismatch expectation pada smoke existing terhadap environment email lokal, bukan assertion failure dari forgot password patch ini.

## 8. Risiko / residual issue

- Rate limit anti-abuse masih in-memory, jadi belum shared antar instance proses.
- Forgot password saat ini dibatasi ke akun client aktif (`status=active`) untuk menghindari collision dengan verification table existing yang juga dipakai registrasi OTP.
- Jika SMTP runtime gagal, endpoint forgot password tetap mengembalikan respons generik untuk menjaga anti-enumeration; kegagalan delivery hanya tercatat di log server.
- Patch ini tidak meng-invalidate JWT/session lama yang mungkin masih aktif sebelum reset, karena auth existing memakai JWT stateless tanpa session store terpusat.

## 9. Saran task berikutnya

- Tambahkan invalidation strategy untuk session/JWT lama setelah password reset bila repo nanti punya session store atau token versioning.
- Jika dibutuhkan coverage lebih kuat, buat smoke khusus forgot/reset password yang berjalan dengan stub mail transport terkontrol.
- Audit apakah seller/public auth entry lain perlu memakai forgot password flow yang sama atau tetap cukup di client auth lane.
