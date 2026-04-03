# ADMIN-STAFF-WORKFLOW-SMOKE-01

## 1. Summary perubahan

Task ini menambahkan QA/smoke frontend repeatable untuk workflow admin staff aktif di route `/admin/our-staff`.

Perubahan utama:

- Menambahkan script QA browser-level `tools/qa/admin-staff-workflow-smoke.ts`
- Menambahkan script npm root `pnpm qa:admin:staff`
- Menambahkan selector/id ringan pada create/edit drawer staff agar smoke lebih stabil
- Menambahkan notice id pada page staff agar assertion success/error tidak rapuh

Smoke ini memakai API mock in-memory yang mengikuti route aktif, sehingga bisa membuktikan:

- create staff sukses
- duplicate email ditolak dengan jujur
- list refresh/sync setelah create tetap benar
- edit basic info tetap bekerja

## 2. Flow yang diverifikasi

### Route aktif

- `/admin/our-staff`

### Coverage minimum yang lolos

- create staff sukses
- duplicate email mengembalikan error yang jujur
- list menampilkan row baru setelah create
- edit basic info memperbarui row yang sama

## 3. File yang diubah

- `tools/qa/admin-staff-workflow-smoke.ts`
- `package.json`
- `client/src/components/admin/staff/AddStaffDrawer.jsx`
- `client/src/components/admin/staff/EditStaffDrawer.jsx`
- `client/src/pages/admin/Staff.jsx`

## 4. Alasan desain smoke

Saya memilih smoke frontend browser-level dengan API mock karena:

- route admin staff yang diuji adalah workflow UI aktif
- harness Playwright ringan sudah ada di repo
- patch ini bisa memberi regression coverage cepat tanpa bergantung environment backend lokal
- scope tetap kecil dan tidak perlu test framework baru

## 5. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### QA/smoke

- `pnpm qa:admin:staff` ✅

### Catatan skenario yang lolos

- create staff:
  - submit form create staff
  - notice sukses muncul
  - row baru muncul di list
- duplicate email:
  - submit email yang sama lagi
  - error duplicate muncul dengan pesan yang jujur
- edit basic info:
  - buka drawer edit pada row baru
  - ubah nama dan nomor telepon
  - notice sukses edit muncul
  - row list ikut berubah

## 6. Risiko / residual issue

- Smoke ini masih mock-based, bukan backend live end-to-end.
- Coverage masih fokus pada create/edit lane inti; publish toggle dan delete belum ikut diuji.
- Parser request mock sekarang mendukung JSON dan multipart, tetapi hanya secukupnya untuk workflow admin staff aktif.

## 7. Rekomendasi task berikutnya

- Lanjutkan `ADMIN-STAFF-PASSWORD-POLICY-UNIFY-01` bila ingin menutup semua lane password legacy yang masih tersisa.
- Jika coverage operasional ingin diperluas, tambahkan skenario publish toggle dan delete ke smoke admin staff ini tanpa mengubah harness besar.
