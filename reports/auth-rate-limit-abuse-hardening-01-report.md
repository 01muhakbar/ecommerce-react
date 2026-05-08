# AUTH-RATE-LIMIT-ABUSE-HARDENING-01 Report

## 1. Summary perubahan

Task ini merapikan dan menyatukan hardening rate-limit untuk route auth client yang paling sensitif terhadap abuse:

- login
- forgot password
- reset password
- resend verification

Perubahan utama:

- Menambahkan helper backend bersama `server/src/services/authRateLimit.service.ts` agar limiter auth memakai pola yang konsisten.
- Menambahkan rate-limit pada login yang sebelumnya belum punya guard setara dengan forgot/reset.
- Menyatukan forgot password, reset password, dan resend verification agar sama-sama memakai error shape `RATE_LIMITED` dengan `retryAfterSeconds`.
- Menambahkan helper frontend kecil untuk membaca `retryAfterSeconds` dan menampilkan cooldown state yang jujur di route aktif.

Task ini tidak mengubah schema database.
Task ini tidak mengubah contract API besar.
Task ini tidak melakukan refactor auth besar.

## 2. Source of truth backend yang diaudit

- `server/src/routes/auth.ts`
- `server/src/services/clientRegistration.service.ts`
- `server/src/services/clientPasswordReset.service.ts`

Gap awal yang ditemukan:

- login belum memakai rate-limit auth yang sebanding dengan forgot/reset
- forgot password dan reset password memakai limiter lokal terpisah
- resend verification memakai limiter lain dengan bentuk error sendiri
- frontend route aktif belum membaca `retryAfterSeconds` secara konsisten untuk helper/cooldown state

## 3. Patch yang diterapkan

### Backend

- Menambahkan helper bersama:
  - `server/src/services/authRateLimit.service.ts`
- Login sekarang dibatasi per IP dan per email normalize.
- Forgot password dan reset password memakai helper yang sama melalui adapter kecil di service reset.
- Resend verification tetap mempertahankan flow existing, tetapi limiter backend sekarang memakai helper bersama dengan error contract yang tetap kompatibel.
- Respons limit tetap generik dan tidak membocorkan detail sensitif atau enumeration.

### Frontend client

- Menambahkan helper kecil:
  - `client/src/utils/authRateLimit.js`
- Login page:
  - menampilkan pesan cooldown jujur saat terkena rate-limit
  - men-disable submit selama cooldown
- Forgot password page:
  - menampilkan pesan cooldown jujur
  - men-disable submit selama cooldown
- Reset password page:
  - menampilkan pesan cooldown jujur
  - men-disable submit selama cooldown
- Register resend verification:
  - memakai `retryAfterSeconds` backend bila tersedia
  - countdown tidak lagi hanya bergantung pada copy lokal

## 4. File yang diubah

- `server/src/services/authRateLimit.service.ts`
- `server/src/routes/auth.ts`
- `server/src/services/clientRegistration.service.ts`
- `server/src/services/clientPasswordReset.service.ts`
- `server/src/scripts/smokeAuthRateLimit.ts`
- `server/package.json`
- `client/src/utils/authRateLimit.js`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/store/StoreForgotPasswordPage.jsx`
- `client/src/pages/store/StoreResetPasswordPage.jsx`
- `client/src/pages/store/StoreRegisterPage.jsx`

## 5. Mismatch yang diperbaiki

- Login sebelumnya belum punya limiter auth yang konsisten dengan forgot/reset.
- Forgot password, reset password, dan resend verification sebelumnya memakai helper limiter yang terpisah-pisah.
- Shape respons limit sebelumnya tidak seragam untuk semua route auth aktif.
- Route aktif client sebelumnya belum menampilkan cooldown berdasarkan `retryAfterSeconds` backend secara konsisten.

## 6. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:auth-forgot-password` ✅
- `pnpm -F server smoke:auth-rate-limit` ✅

Coverage smoke `smoke:auth-rate-limit`:

- login rate limit → 429 generik + `retryAfterSeconds`
- forgot password rate limit → respons generik tetap aman
- reset password rate limit → 429 generik + retry hint
- resend verification rate limit → 429 generik + retry hint

## 7. Risiko / residual issue

- Rate-limit saat ini masih in-memory per instance, jadi belum cocok untuk multi-instance tanpa shared store.
- Threshold limiter masih berbasis konfigurasi lokal di service/helper, belum diekstrak ke config terpusat.
- Smoke saat ini memverifikasi correctness limiter dan non-enumeration, belum menguji abuse distribusi lintas IP/proxy.

## 8. Saran task berikutnya

- Lanjut ke `AUTH-SESSION-INVALIDATION-AFTER-RESET-01` agar password reset juga mematikan sesi/JWT lama.
- Tambahkan follow-up kecil bila ingin memindahkan threshold auth limiter ke config terpusat tanpa mengubah behavior.
