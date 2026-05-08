# ADMIN-ACCOUNT-SELF-DEACTIVATE-DELETE-GUARD-01 Report

## 1. Summary perubahan

Task ini menambahkan guard defensif agar actor admin workspace tidak bisa memutus akses akunnya sendiri secara tidak sengaja dari lane `All Accounts`.

Patch yang diterapkan:

- backend menolak self-deactivate lewat `PATCH /api/admin/staff/:id`
- backend menolak self-delete lewat `DELETE /api/admin/staff/:id`
- edit drawer men-disable toggle `Status Active` untuk akun sendiri
- list action mempertahankan delete self dalam keadaan disabled dengan alasan yang lebih jujur
- smoke admin staff diperluas untuk membuktikan affordance UI ini

Tidak ada migration DB dan tidak ada perubahan contract API besar.

## 2. Alasan desain

Guard dibuat kecil dan langsung di lane aktif yang sudah ada, tanpa refactor role-management besar.

Backend tetap source of truth, sehingga request langsung tetap ditolak walaupun UI di-bypass.
Frontend hanya menyelaraskan affordance agar tidak misleading.

## 3. File yang diubah

- `server/src/routes/admin.staff.ts`
- `client/src/pages/admin/Staff.jsx`
- `client/src/components/admin/staff/EditStaffDrawer.jsx`
- `tools/qa/admin-staff-workflow-smoke.ts`

## 4. Mismatch yang diperbaiki

- backend sebelumnya masih mengizinkan deactivate akun sendiri lewat edit flow
- backend sebelumnya masih mengizinkan delete akun sendiri lewat direct request
- edit drawer masih memberi affordance untuk mematikan akun sendiri
- alasan disable delete di list masih terlalu generik untuk kasus akun sendiri

## 5. Dampak backend

- `PATCH /api/admin/staff/:id`
  - sekarang menolak self-deactivate dengan `409`
- `DELETE /api/admin/staff/:id`
  - sekarang menolak self-delete dengan `409`
- guard memakai actor yang login sebagai source of truth, bukan asumsi frontend

## 6. Dampak frontend admin

- toggle `Status Active` disabled saat user mengedit akunnya sendiri
- helper text menjelaskan bahwa akun sendiri tidak bisa dinonaktifkan dari flow ini karena akan memutus akses workspace
- tombol delete akun sendiri tetap disabled dan reason-nya lebih jujur

## 7. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke / QA

- `pnpm qa:admin:staff` ✅

### Coverage yang dibuktikan

- self-role change guard sebelumnya tetap lolos ✅
- self-deactivate affordance sekarang disabled di edit drawer ✅
- helper self-deactivate tampil dengan copy yang jujur ✅
- self-delete button tetap disabled di list ✅

## 8. Risiko / residual issue

- smoke admin staff saat ini membuktikan affordance UI, bukan backend live direct-request untuk self-delete/self-deactivate
- lane lain di luar `All Accounts` tidak disentuh, sesuai boundary task ini
- policy ini berlaku untuk actor admin workspace yang mengedit dirinya sendiri; tidak mengubah governance actor lain terhadap akun berbeda

## 9. Rekomendasi task berikutnya

- lanjut ke `ADMIN-PUBLIC-AUTH-INACTIVE-ACCOUNT-HONESTY-01`
- jika ingin coverage lebih kuat, tambahkan backend smoke kecil yang menembak self-deactivate/self-delete guard secara langsung
