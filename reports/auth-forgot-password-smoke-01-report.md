# AUTH-FORGOT-PASSWORD-SMOKE-01 Report

## 1. Summary perubahan

Task ini menambahkan smoke test terkontrol untuk forgot/reset password client dengan SMTP stub lokal, agar flow baru bisa diverifikasi repeatable tanpa bergantung SMTP eksternal.

Patch utama:

- Menambahkan script smoke baru `server/src/scripts/smokeForgotPassword.ts`
- Menambahkan script npm `pnpm -F server smoke:auth-forgot-password`

Smoke ini menyalakan:

- app Express lokal pada port ephemeral
- SMTP sink lokal pada port ephemeral
- fixture user aktif terkontrol
- assertion untuk generik response, dispatch path, token valid, token reuse, token invalid, dan token expired

## 2. Cakupan verifikasi

Scenario yang diverifikasi:

1. Forgot password dengan email terdaftar
   - HTTP `202`
   - pesan generik sama
   - email dispatch path terpanggil
   - row reset token `pwdreset_*` dibuat

2. Forgot password dengan email tidak terdaftar
   - HTTP `202`
   - body respons identik dengan email terdaftar
   - tidak ada email yang terkirim

3. Reset password dengan token valid
   - HTTP `200`
   - password user benar-benar berubah
   - token ditandai consumed / `VERIFIED`

4. Token reuse
   - HTTP `400`
   - code `RESET_TOKEN_INVALID`

5. Token invalid
   - HTTP `400`
   - code `RESET_TOKEN_INVALID`

6. Token expired
   - HTTP `400`
   - code `RESET_TOKEN_INVALID`

## 3. File yang diubah

- `server/src/scripts/smokeForgotPassword.ts`
- `server/package.json`

## 4. Command yang dijalankan

- `pnpm -F server build`
- `pnpm -F server smoke:auth-forgot-password`

## 5. Hasil verifikasi

### Build

- `pnpm -F server build` ✅

### Smoke

- `pnpm -F server smoke:auth-forgot-password` ✅

Detail pass:

- forgot password generic response and dispatch path ✅
- reset password valid token ✅
- token reuse blocked ✅
- invalid token blocked ✅
- expired token blocked ✅

## 6. Catatan implementasi

- SMTP sink menangkap email reset secara lokal, jadi smoke tidak memerlukan SMTP nyata.
- Parser token di smoke menormalkan body MIME/quoted-printable sebelum mengambil token reset.
- Purpose reset token tetap terisolasi jelas dengan prefix `publicId = pwdreset_*`.

## 7. Risiko / residual issue

- Smoke ini memverifikasi flow pada app lokal ephemeral, bukan terhadap deployment runtime eksternal.
- Rate limiting belum diuji exhaustively; smoke fokus pada correctness utama forgot/reset flow.

## 8. Rekomendasi berikutnya

- Jika dibutuhkan, tambahkan smoke kecil untuk rate limit forgot/reset password.
- Jika nanti ada pipeline CI, script ini bisa dijadikan gate untuk auth forgot/reset lane.
