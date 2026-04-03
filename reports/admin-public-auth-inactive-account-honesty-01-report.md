# ADMIN-PUBLIC-AUTH-INACTIVE-ACCOUNT-HONESTY-01 Report

## 1. Summary perubahan

Task ini merapikan handling akun admin/staff berstatus `inactive` di lane admin public auth agar state blocked lebih jujur dan tidak ambigu.

Patch yang diterapkan:

- login admin sekarang mengembalikan code + message yang konsisten untuk akun `inactive`
- reset password dengan token valid tetapi akun sudah `inactive` sekarang gagal dengan pesan yang jujur
- forgot password dan resend verification tetap generik untuk akun `inactive` dan tidak mengirim email
- copy frontend admin login, forgot password, dan resend verification diselaraskan dengan truth backend
- smoke backend dan smoke frontend diperluas untuk mencakup state inactive

## 2. Alasan desain

Pendekatan yang dipilih adalah:

- membuat `inactive` eksplisit hanya pada flow yang memang sudah membuktikan identitas user atau password benar, yaitu login dan reset token valid
- tetap mempertahankan generic response untuk forgot password dan resend verification agar tidak menambah enumeration leak

Ini menjaga keseimbangan antara kejujuran UX dan boundary keamanan yang sudah ada.

## 3. File yang diubah

- `server/src/routes/auth.ts`
- `server/src/services/adminPublicAuth.service.ts`
- `server/src/scripts/smokeAdminPublicAuth.ts`
- `client/src/pages/admin/AdminLoginPage.jsx`
- `client/src/pages/admin/AdminForgotPasswordPage.jsx`
- `client/src/pages/admin/AdminResendVerificationPage.jsx`
- `tools/qa/admin-public-auth-frontend-smoke.ts`

## 4. Mismatch yang diperbaiki

- login admin sebelumnya menolak akun `inactive` dengan message yang terlalu generik dan tanpa code yang konsisten
- reset password admin untuk akun `inactive` sebelumnya memakai message yang kurang jujur terhadap blocked state
- forgot password dan resend verification untuk akun `inactive` belum punya coverage eksplisit bahwa respons tetap generik dan tanpa dispatch email
- helper text frontend belum cukup jelas soal hanya akun aktif yang bisa menerima reset link dan hanya akun pending verification yang bisa menerima resend verification

## 5. Dampak backend

- `POST /api/auth/admin/login`
  - akun `inactive` sekarang mengembalikan:
    - `code: ACCOUNT_INACTIVE`
    - message yang jujur untuk restore akses
- `POST /api/auth/admin/reset-password`
  - token valid milik akun `inactive` sekarang gagal dengan:
    - `code: ACCOUNT_INACTIVE`
    - message yang jujur untuk menghubungi Admin Workspace
- `POST /api/auth/admin/forgot-password`
  - akun `inactive` tetap menerima generic response dan tidak memicu email
- `POST /api/auth/admin/register/resend-verification`
  - akun `inactive` tetap menerima generic response dan tidak memicu email

## 6. Dampak frontend admin

- login admin sekarang bisa menampilkan helper tambahan yang jelas untuk state `inactive`
- helper text forgot password kini lebih jujur bahwa reset link hanya dikirim untuk akun aktif
- helper text resend verification kini lebih jujur bahwa resend hanya berlaku untuk akun self-signup yang masih menunggu verifikasi email

## 7. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke / QA

- `pnpm -F server smoke:admin-public-auth` ✅
- `pnpm qa:admin:public-auth` ✅

### Coverage yang dibuktikan

- akun `inactive` ditolak login dengan code/message konsisten ✅
- forgot password untuk akun `inactive` tetap generik dan tidak dispatch email ✅
- resend verification untuk akun `inactive` tetap generik dan tidak dispatch email ✅
- reset password token valid untuk akun `inactive` gagal dengan state jujur ✅
- login inactive state di browser-level admin login tampil benar ✅

## 8. Risiko / residual issue

- browser smoke saat ini baru membuktikan inactive login state, belum inactive reset state di level browser
- generic response pada forgot/resend tetap sengaja tidak memberi konfirmasi spesifik apakah akun sedang inactive
- inactive-account policy di lane admin lain di luar admin public auth tidak disentuh pada task ini

## 9. Rekomendasi task berikutnya

- lanjut ke `ADMIN-PUBLIC-AUTH-LIVE-END-TO-END-SUBSET-01`
- jika ingin coverage lebih lengkap, tambahkan browser smoke kecil untuk reset token valid milik akun inactive
