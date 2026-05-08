# AUTH-SESSION-INVALIDATION-AFTER-RESET-01 Report

## 1. Summary perubahan

Task ini menambahkan invalidasi sesi/JWT lama setelah password reset berhasil, tanpa migration database dan tanpa refactor auth besar.

Pendekatan yang dipakai:

- JWT baru sekarang membawa fingerprint sesi `pwdv` yang diturunkan dari hash password user saat token diterbitkan.
- Middleware auth aktif memverifikasi fingerprint itu terhadap hash password terbaru di database.
- Untuk token lama yang belum punya claim `pwdv`, verifier memakai fallback transisi berbasis `iat` vs `updated_at` agar token pra-patch ikut invalid setelah password berubah, tanpa langsung memutus semua sesi lama secara serentak.

Dengan patch ini:

- token lama tidak lagi valid setelah reset password
- login baru dengan password baru tetap berhasil
- flow forgot/reset password existing tetap hijau
- hardening rate-limit auth sebelumnya tetap hijau

Task ini tidak mengubah schema database.
Task ini tidak mengubah contract API besar.
Task ini tidak melakukan redesign UI.

## 2. Source of truth backend yang diaudit

- `server/src/routes/auth.ts`
- `server/src/middleware/requireAuth.ts`
- `server/src/middleware/authFromCookie.ts`
- `server/src/middleware/authMiddleware.ts`
- `server/src/services/clientPasswordReset.service.ts`

Temuan awal:

- JWT existing hanya diverifikasi signature dan expiry.
- Middleware auth tidak mengaitkan token dengan state password user terbaru.
- Setelah password reset, sesi lama secara teori masih tetap valid sampai token expired.

## 3. Patch yang diterapkan

### Backend auth session helper

Menambahkan helper baru:

- `server/src/services/authSession.service.ts`

Isi patch:

- membangun claim sesi `pwdv` dari hash password user
- membangun claims JWT baru saat login/register verify/admin login
- memuat ulang user dari database saat verifikasi token
- memvalidasi `pwdv` agar token lama langsung gugur ketika password berubah
- menyediakan fallback transisi untuk token legacy tanpa `pwdv`

### Route auth

`server/src/routes/auth.ts`

- `issueAuthSession` sekarang async dan menerbitkan JWT dengan claim `pwdv`
- login client memakai claim baru
- verify registration login otomatis memakai claim baru
- admin login juga diselaraskan agar tidak tertinggal dari verifier baru

### Middleware auth

- `server/src/middleware/requireAuth.ts`
- `server/src/middleware/authFromCookie.ts`
- `server/src/middleware/authMiddleware.ts`

Semua jalur auth aktif sekarang memakai verifier sesi backend yang sama, sehingga sesi lama tidak lolos hanya karena middleware berbeda-beda.

## 4. File yang diubah

- `server/src/services/authSession.service.ts`
- `server/src/routes/auth.ts`
- `server/src/middleware/requireAuth.ts`
- `server/src/middleware/authFromCookie.ts`
- `server/src/middleware/authMiddleware.ts`
- `server/src/scripts/smokeAuthSessionInvalidation.ts`
- `server/package.json`

## 5. Mismatch yang diperbaiki

- Password reset sebelumnya tidak mematikan JWT lama.
- Jalur middleware auth berbeda-beda sebelumnya hanya memercayai signature JWT tanpa mengecek state password user.
- Route auth baru dan route protected lama berisiko punya perilaku sesi yang tidak sinkron.

## 6. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:auth-session-invalidation` ✅
- `pnpm -F server smoke:auth-forgot-password` ✅
- `pnpm -F server smoke:auth-rate-limit` ✅

Coverage smoke baru:

- login awal berhasil
- session lama valid sebelum reset
- forgot password mengirim reset link
- reset password valid berhasil
- session/JWT lama menjadi 401 setelah reset
- login dengan password lama gagal
- login dengan password baru berhasil

## 7. Risiko / residual issue

- Verifier sesi sekarang memerlukan lookup user ke database saat request bertoken masuk, sehingga ada tambahan query per request auth.
- Fallback legacy token memakai `iat` vs `updated_at`, jadi token lama tanpa `pwdv` bisa ikut invalid jika record user berubah setelah token diterbitkan. Ini disengaja sebagai mekanisme transisi aman.
- Task ini mematikan sesi lama di server-side validation, tetapi tidak menambahkan broadcast logout lintas tab/browser di frontend.

## 8. Saran task berikutnya

- Lanjut ke `AUTH-COPY-UX-ALIGNMENT-01` untuk merapikan helper text dan state auth client yang masih tersisa.
- Jika nanti perlu optimasi performa, pertimbangkan cache session-version kecil atau store terpisah, tetapi itu bukan kebutuhan task ini.
