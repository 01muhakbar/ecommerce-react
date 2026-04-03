# AUTH-COPY-UX-ALIGNMENT-01 Report

## 1. Summary perubahan

Task ini menyelaraskan copy, helper text, loading label, cooldown state, success state, dan error state di route auth client aktif:

- login
- register
- forgot password
- reset password
- change password

Perubahan utama:

- Menambahkan helper copy kecil `client/src/utils/authUi.js` untuk menyatukan password helper, cooldown message, cooldown button label, dan tone classes notice.
- Menyelaraskan wording cooldown/rate-limit agar route auth aktif memakai pola yang sama.
- Menyelaraskan copy recovery/password helper agar tidak saling bertabrakan antar halaman.
- Merapikan final state change password agar jujur bahwa user akan diminta sign in lagi dengan password baru.
- Menghilangkan helper validation awal yang misleading di change password page.

Task ini tidak mengubah contract API besar.
Task ini tidak melakukan redesign auth page besar.
Task ini tidak mengubah flow backend auth.

## 2. Mismatch yang ditemukan

- Login, forgot password, reset password, dan register resend memakai wording cooldown yang berbeda-beda.
- Reset password success state dan change password success state belum memakai pola final-state yang seirama.
- Change password page menampilkan helper awal "Please complete all fields." bahkan sebelum user benar-benar mulai mengisi flow, sehingga terasa terlalu negatif dan kurang jujur sebagai helper default.
- Helper password/recovery text belum konsisten antara login, register, reset password, dan change password.
- Notice tone classes masih dideklarasikan ulang di beberapa halaman auth aktif.

## 3. Patch yang diterapkan

- Menambahkan helper copy bersama:
  - `client/src/utils/authUi.js`
- Login:
  - membaca `authNotice` atau legacy `passwordResetMessage`
  - fallback error sign-in lebih rapi
  - helper password hidden diselaraskan
  - label countdown tombol disatukan
- Register:
  - intro copy register dan verify dirapikan
  - helper confirm password diselaraskan
  - resend cooldown message dan button label disatukan
  - tone classes notice memakai helper bersama
- Forgot password:
  - intro privacy copy diperjelas
  - generic success message memakai helper bersama
  - cooldown message dan button label disatukan
- Reset password:
  - success redirect notice disatukan
  - invalid/incomplete link copy dirapikan
  - helper confirm password diselaraskan
  - cooldown message dan button label disatukan
- Change password:
  - intro final-state dirapikan
  - success state diselaraskan dengan forced re-login
  - login redirect mengirim notice sukses yang bisa dibaca halaman login
  - validation helper awal yang misleading dihapus
  - helper hidden/confirm dirapikan
  - loading label submit dibuat lebih spesifik

## 4. File yang diubah

- `client/src/utils/authUi.js`
- `client/src/components/auth/PasswordStrengthIndicator.jsx`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/store/StoreRegisterPage.jsx`
- `client/src/pages/store/StoreForgotPasswordPage.jsx`
- `client/src/pages/store/StoreResetPasswordPage.jsx`
- `client/src/pages/account/AccountChangePasswordPage.jsx`

## 5. Dampak ke route auth aktif

- Login:
  - cooldown, error fallback, dan success notice dari reset/change password lebih konsisten
- Register:
  - verification dan resend state lebih rapi dan seirama dengan forgot/reset flow
- Forgot password:
  - privacy copy dan generic response lebih jelas
- Reset password:
  - invalid/final state lebih selaras dengan backend truth
- Change password:
  - helper default tidak lagi misleading
  - success state sekarang jujur bahwa user harus sign in lagi

## 6. Verifikasi

### Build

- `pnpm -F client build` ✅

### QA/manual

- Audit manual dilakukan pada route auth aktif untuk:
  - loading label
  - success/final state
  - invalid/error state
  - cooldown/rate-limit state
  - password helper / recovery copy

## 7. Risiko / residual issue

- Task ini tidak mengubah backend copy source; jika nanti backend message berubah, beberapa fallback frontend masih tetap lokal.
- Change password copy masih memakai sebagian label dari dashboard customization existing untuk judul field, sesuai boundary task ini.
- Social login CTA placeholder tetap dibiarkan apa adanya karena bukan fokus task ini.

## 8. Saran task berikutnya

- Jika ingin hardening UX lebih lanjut, audit accessibility kecil untuk auth forms aktif seperti focus management setelah error/success.
- Jika ingin konsistensi penuh lintas lane, pertimbangkan follow-up kecil untuk menyelaraskan copy auth non-client yang masih aktif.
