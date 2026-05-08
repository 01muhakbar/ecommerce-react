# AUTH-SESSION-EXPIRY-FRONTEND-SMOKE-01 Report

## 1. Summary perubahan

Task ini memperluas smoke frontend auth agar coverage browser-level juga membuktikan flow sesi kedaluwarsa pada route protected buyer dan admin. Smoke sekarang memverifikasi bahwa stale session tidak membuat route protected menggantung, redirect menuju login membawa notice yang benar, dan auth form failure biasa tidak tertukar dengan state session expired.

Patch kecil yang ikut dilakukan:

- `AdminGuard` sekarang membaca status `401/403` dari probe `/api/auth/me` secara jujur dan mengarahkan admin ke login dengan notice yang benar
- `AdminLoginPage` diperbaiki karena ada bug runtime `Cannot access 'mutation' before initialization` yang baru terlihat saat smoke admin stale session dijalankan
- Harness `auth-frontend-smoke` sekarang punya skenario khusus buyer/admin stale session dan mock `/auth/me` berurutan untuk mensimulasikan invalid session secara realistis

## 2. Coverage smoke baru

Coverage tambahan yang dibuktikan:

- buyer protected route dengan stale session redirect ke `/auth/login`
- admin protected route dengan stale session redirect ke `/admin/login`
- notice session expired tampil konsisten di login client dan admin
- route protected tidak stuck setelah redirect
- tidak ada loop redirect pada route aktif yang diuji
- login form failure biasa tetap menampilkan error login, bukan notice session expired

## 3. File yang diubah

- `tools/qa/auth-frontend-smoke.ts`
- `client/src/components/AdminGuard.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`

## 4. Mismatch yang diperbaiki

- `AdminGuard` sebelumnya melempar `Error` generik saat `/api/auth/me` mengembalikan `401`, sehingga lane admin stale session berisiko jatuh ke state `API unreachable`
- `AdminLoginPage` punya runtime bug karena `mutation` dipakai di `useEffect` sebelum dideklarasikan
- Smoke auth frontend sebelumnya belum membuktikan redirect stale session pada buyer/admin route protected
- Smoke auth frontend sebelumnya belum memverifikasi bahwa auth form failure biasa tidak bertukar menjadi notice session expired

## 5. Verifikasi

### Build

- `pnpm -F client build` ✅

### QA/smoke

- `pnpm qa:auth:frontend` ✅

## 6. Hasil smoke

Smoke auth frontend kini lulus untuk:

- buyer protected route stale session redirect ✅
- admin protected route stale session redirect ✅
- login error/cooldown notice ✅
- register pending verification/resend cooldown ✅
- forgot password generic success ✅
- reset password invalid token state ✅
- change password success redirect notice ✅

## 7. Risiko / residual issue

- Smoke ini masih memakai API mock pada client dev server, jadi belum menggantikan integrasi backend end-to-end
- Console browser tetap menampilkan `401/429/400` expected dari skenario negatif dan warning HMR EventSource; itu bagian dari mode QA ini
- Smoke hanya mencakup route aktif buyer/admin yang ditentukan task ini, belum seluruh lane protected lain

## 8. Saran task berikutnya

- Lanjutkan `PUBLIC-AUTH-NAV-HONESTY-01` untuk merapikan CTA login-required dan redirect intent di entry point publik
- Setelah itu, lanjutkan `AUTH-RATE-LIMIT-QA-SMOKE-EXTEND-01` agar coverage cooldown/rate-limit auth lebih eksplisit lintas frontend dan backend
