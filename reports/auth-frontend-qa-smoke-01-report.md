# AUTH-FRONTEND-QA-SMOKE-01 Report

## 1. Summary perubahan

Task ini menambahkan smoke frontend auth yang repeatable untuk route auth aktif dengan Playwright + Vite dev server lokal. Script baru menguji state inti yang paling rawan regress setelah rangkaian hardening auth selesai.

Patch utama:

- Menambahkan script QA baru `tools/qa/auth-frontend-smoke.ts`
- Menambahkan command root `pnpm qa:auth:frontend`
- Memakai mock API terkontrol untuk route auth/public minimum yang dibutuhkan auth pages aktif
- Memperbaiki interceptor client agar `401` dari auth form submission tidak dianggap sebagai session-expired global
- Memastikan notice sukses change password tetap bertahan saat redirect ke login setelah logout

## 2. Coverage smoke

Coverage yang diverifikasi oleh script:

- login error notice
- login cooldown notice dari retry hint backend
- register pending verification state
- resend verification cooldown
- forgot password generic success
- reset password invalid token state
- change password success redirect notice ke login

## 3. File yang diubah

- `tools/qa/auth-frontend-smoke.ts`
- `package.json`
- `client/src/api/axios.ts`
- `client/src/pages/account/AccountChangePasswordPage.jsx`

## 4. Mismatch / bug yang ikut ditutup

- QA harness awal gagal karena mock frontend terlalu longgar dan memotong module path `/src/api/*` sebagai `/api/*`
- Stub publik awal tidak sesuai dengan endpoint yang benar-benar dipakai `StoreLayout` dan header publik
- Selector tombol submit terlalu generik dan bentrok dengan tombol search di header
- `401` dari login form ikut memicu unauthorized global notice, sehingga bisa menimpa notice sukses change password saat redirect ke login
- Notice sukses change password berisiko hilang karena race antara logout di route protected dan redirect ke login

## 5. Command verifikasi

### Build

- `pnpm -F client build` ✅

### QA/smoke

- `pnpm qa:auth:frontend` ✅

## 6. Hasil verifikasi

Smoke frontend auth sekarang lulus untuk coverage minimum:

- login error/cooldown notice ✅
- register pending verification/resend cooldown ✅
- forgot password generic success ✅
- reset password invalid token state ✅
- change password success redirect notice ✅

## 7. Risiko / residual issue

- Script ini berjalan terhadap client dev server dengan API mock, bukan terhadap backend hidup
- Console browser masih menampilkan network error expected seperti `401`, `429`, dan `400` dari skenario negatif; ini bagian dari coverage, bukan kegagalan smoke
- HMR dev server memunculkan warning `EventSource` saat route API dimock; tidak memengaruhi assertion smoke

## 8. Saran task berikutnya

- Tambahkan smoke frontend kecil untuk expired-session redirect notice agar task `AUTH-SESSION-EXPIRY-CLIENT-HONESTY-01` juga punya coverage browser-level
- Jika ingin coverage lebih dekat ke integrasi nyata, tambahkan varian smoke auth yang memakai backend lokal sehat untuk subset happy-path terpilih
