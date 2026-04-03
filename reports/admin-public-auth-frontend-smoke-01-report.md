# ADMIN-PUBLIC-AUTH-FRONTEND-SMOKE-01 Report

## 1. Summary perubahan

Task ini menambahkan smoke browser-level ringan untuk lane admin public auth agar flow create account, verify account, resend verification, forgot password, dan reset password punya coverage regresi yang eksplisit di frontend.

Patch utama:

- menambahkan script QA baru `qa:admin:public-auth`
- menambahkan harness browser smoke `tools/qa/admin-public-auth-frontend-smoke.ts`
- memakai intercept API mock yang kecil dan terkontrol agar state notice frontend bisa diverifikasi tanpa mengubah contract backend

Tidak ada redesign UI besar.
Tidak ada refactor auth besar.
Tidak ada perubahan contract API besar.

## 2. Coverage yang dibuktikan

Smoke frontend baru memverifikasi:

- create account success path menampilkan pending verification notice
- verify account dengan token invalid/expired menampilkan state gagal yang jujur
- resend verification menampilkan generic success
- forgot password menampilkan generic success
- reset password dengan token invalid menampilkan state gagal yang jujur

## 3. Alasan desain smoke

Dipilih smoke frontend mock-based karena:

- task ini fokus pada regresi UI/browser-level
- backend auth admin publik sudah punya smoke sendiri
- harness auth frontend existing di repo sudah memakai pola serupa
- patch bisa tetap kecil dan tidak perlu menyalakan seluruh backend live untuk setiap skenario negatif

## 4. File yang diubah

- `tools/qa/admin-public-auth-frontend-smoke.ts`
- `package.json`

## 5. Script yang ditambah

- `pnpm qa:admin:public-auth`

## 6. Verifikasi yang dijalankan

### Build

- `pnpm -F client build` ✅

### QA/smoke

- `pnpm qa:admin:public-auth` ✅

Catatan:

- browser console menampilkan `400` expected untuk skenario invalid token
- itu bukan kegagalan smoke, melainkan bagian dari coverage state negatif yang memang diuji

## 7. Risiko / residual issue

- smoke ini masih berbasis API mock, belum backend live end-to-end
- belum ada coverage browser-level untuk happy path verify token valid dan reset token valid
- belum ada coverage browser-level untuk login setelah akun selesai diverifikasi

## 8. Saran task berikutnya

- tambahkan smoke frontend kecil untuk admin public auth happy path bila environment/backend stub sudah siap
- bila ingin coverage lebih dalam, gabungkan smoke frontend ini dengan subset smoke backend admin public auth untuk jalur valid-token
