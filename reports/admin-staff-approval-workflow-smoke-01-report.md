# ADMIN-STAFF-APPROVAL-WORKFLOW-SMOKE-01 Report

## 1. Summary perubahan

Task ini menambahkan smoke browser-level kecil untuk jalur approval staff yang sebelumnya baru terbukti kuat di backend smoke.

Coverage baru membuktikan urutan berikut secara eksplisit di frontend:

1. verify valid menghasilkan `pending_approval`
2. login staff masih ditolak sebelum approval
3. super admin approve akun dari `All Accounts`
4. login staff diizinkan setelah approval

Patch tetap kecil dan hanya menambah harness QA/frontend smoke.

## 2. Pendekatan yang dipilih

Saya menambahkan script baru:

- `tools/qa/admin-staff-approval-workflow-smoke.ts`

Script ini memakai Playwright + mock API stateful ringan untuk meniru transisi:

- `pending_verification`
- `pending_approval`
- `active`

Pendekatan ini dipilih karena:

- tidak perlu menambah framework QA baru
- bisa reuse pola dari smoke frontend auth/admin yang sudah ada
- fokus langsung ke jalur approval happy path tanpa mencampur skenario lain

## 3. File yang diubah

- `tools/qa/admin-staff-approval-workflow-smoke.ts`
- `package.json`

## 4. Script / flow yang ditambah

- script baru:
  - `pnpm qa:admin:staff-approval`

Flow yang dibuktikan:

- `GET /admin/verify-account?token=...`
  - verify valid menampilkan state menunggu approval
- `POST /api/auth/admin/login`
  - staff `pending_approval` tetap ditolak
- `POST /api/admin/staff/:id/approve`
  - approve action dari `All Accounts`
- `POST /api/auth/admin/login`
  - staff yang sudah approved berhasil login

## 5. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke / QA

- `pnpm -F server smoke:admin-public-auth` ✅
- `pnpm qa:admin:staff-approval` ✅

### Coverage yang lolos

- verify valid menghasilkan `pending_approval` ✅
- login masih ditolak sebelum approve ✅
- approve action di `All Accounts` ✅
- login diizinkan setelah approve ✅

## 6. Risiko / residual issue

- Smoke frontend ini masih mock-based browser QA, belum browser live end-to-end terhadap backend lokal.
- Console browser menampilkan `403` expected pada login sebelum approval dan warning `EventSource` dari dev server/HMR; itu tidak memengaruhi assertion smoke.
- Jalur approval masih diuji pada lane super-admin approval yang existing, belum memvalidasi policy actor lain.

## 7. Saran task berikutnya

- Jika ingin coverage lebih kuat, tambahkan satu smoke browser live yang menghubungkan verify + approve ke backend lokal sehat.
- Jika policy approval actor berubah nanti, update smoke ini agar actor matrix tetap eksplisit.
