# ADMIN-PUBLIC-AUTH-RESEND-VERIFICATION-01

## 1. Summary perubahan

Task ini menambahkan jalur `resend verification` kecil untuk lane admin self-signup `staff` tanpa mengubah auth architecture besar.

Perubahan utama:

- backend menambah endpoint publik untuk meminta ulang email verifikasi akun admin self-signup yang masih `pending_verification`
- response tetap generik agar tidak membocorkan apakah email tertentu benar-benar pending atau tidak
- frontend admin auth menambah halaman kecil `/admin/resend-verification`
- login admin dan verify page sekarang punya entry point recovery yang jujur ke flow resend ini
- smoke admin-public auth diperluas untuk membuktikan resend verification bekerja dan tetap aman terhadap enumeration

## 2. Flow resend verification yang dibangun

Flow baru:

1. User membuka `/admin/login` lalu gagal login karena akun masih `pending_verification`, atau membuka halaman verify yang invalid/expired
2. User masuk ke `/admin/resend-verification`
3. User memasukkan email signup admin
4. Backend `POST /api/auth/admin/register/resend-verification` memproses request secara aman
5. Jika email cocok dengan akun `staff` yang masih `pending_verification` dan cooldown internal sudah lewat:
   - sistem mengirim ulang email verifikasi
6. Jika email tidak cocok / akun sudah aktif / role tidak eligible / cooldown belum lewat:
   - backend tetap mengembalikan response generik yang sama

Response generik:

- `If the account is pending verification, we have sent another verification email.`

## 3. File yang diubah

- `packages/schemas/src/index.ts`
- `server/src/services/adminPublicAuth.service.ts`
- `server/src/routes/auth.ts`
- `server/src/scripts/smokeAdminPublicAuth.ts`
- `client/src/api/adminPublicAuth.ts`
- `client/src/api/axios.ts`
- `client/src/App.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`
- `client/src/pages/admin/AdminVerifyAccountPage.jsx`
- `client/src/pages/admin/AdminResendVerificationPage.jsx`

## 4. Endpoint yang ditambah/diubah

Ditambah:

- `POST /api/auth/admin/register/resend-verification`

Diubah:

- `/admin/login`
  - saat login gagal karena `VERIFICATION_REQUIRED`, sekarang ada link ke resend verification dengan email yang sudah diisi user
- `/admin/verify-account`
  - sekarang ada link recovery ke resend verification
- `/admin/resend-verification`
  - halaman publik baru untuk meminta ulang email verifikasi

## 5. Verifikasi / build / smoke

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:admin-public-auth` ✅

Coverage yang dibuktikan:

- self-signup staff pending verification ✅
- resend verification untuk akun pending mengirim email baru ✅
- resend verification untuk email tak dikenal memberi response generik yang sama ✅
- unverified staff tetap diblok di `/admin/login` ✅
- verify valid/reuse/invalid tetap benar ✅
- forgot/reset password admin tetap benar ✅
- seller tetap diblok, admin/super_admin valid tetap lolos ✅

## 6. Risiko / residual issue

- Response resend tetap generik, jadi UI tidak bisa mengonfirmasi secara eksplisit apakah email memang pending atau tidak; ini sengaja untuk keamanan.
- Cooldown internal resend untuk akun pending diserap aman di backend dan tidak diekspos detailnya ke email tak dikenal; yang diekspos ke UI hanya rate-limit route umum bila benar-benar kena limit.
- Belum ada smoke browser-level khusus untuk halaman `/admin/resend-verification`; coverage saat ini backend smoke + build frontend.

## 7. Saran task berikutnya

- Tambahkan smoke frontend kecil untuk admin public auth agar login/create/verify/resend/forgot/reset punya coverage browser-level.
- Jika lane admin publik akan dipakai operasional lebih sering, pertimbangkan notice kecil setelah create account yang langsung menawarkan jalur resend tanpa menambah detail sensitif.
