# ADMIN-STAFF-EDIT-POLICY-ALIGN-01

## 1. Summary perubahan

Task ini merapikan lane edit staff aktif agar tidak bertabrakan dengan create-flow staff-only yang baru selesai.

Perubahan utama:

- Backend `PATCH /api/admin/staff/:id` sekarang menolak perubahan role lintas account type dari edit flow aktif.
- Backend edit password sekarang mengikuti rule minimum yang sama dengan create-flow staff baru.
- Drawer edit di admin sekarang menampilkan role sebagai read-only/fixed state, bukan select bebas.
- Helper copy di edit lane dirapikan agar jujur:
  - role changes locked
  - seller access hanya muncul untuk akun yang memang sudah seller
  - password fields optional tetapi jika diisi harus mengikuti policy yang sama dengan create flow
- Success notice edit di halaman staff diselaraskan menjadi account-oriented.

Tidak ada migration DB.
Tidak ada contract API besar yang dipatahkan.
Tidak ada redesign besar Admin Workspace.

## 2. Audit ringkas

### Gap nyata yang ditemukan

- Edit lane masih bisa mengubah role lintas jenis akun, padahal create-flow baru sudah dikunci staff-only.
- Password update di edit lane masih memakai rule legacy yang lebih longgar daripada create-flow baru.
- Copy edit lane masih memberi kesan bahwa role access bisa diubah bebas dari drawer yang sama.
- Frontend dan backend belum benar-benar sinkron untuk policy role edit.

### Patch terkecil yang aman

- Kunci role change di backend edit route.
- Ubah role section di edit drawer menjadi read-only.
- Pertahankan seller access editor hanya untuk akun yang memang seller.
- Selaraskan helper copy dan password rule di edit flow tanpa membangun role-management besar.

## 3. File yang diubah

- `server/src/routes/admin.staff.ts`
- `client/src/components/admin/staff/EditStaffDrawer.jsx`
- `client/src/pages/admin/Staff.jsx`

## 4. Endpoint yang diubah

- `PATCH /api/admin/staff/:id`
  - tetap additive kecil
  - role change lintas account type sekarang ditolak dengan pesan yang jelas
  - password update sekarang mengikuti policy minimum yang sama dengan create flow

## 5. Halaman admin yang diubah

- `client/src/components/admin/staff/EditStaffDrawer.jsx`
  - role sekarang fixed/read-only
  - helper role/access lebih jujur
  - password optional + confirm + strength indicator
- `client/src/pages/admin/Staff.jsx`
  - success notice edit diselaraskan

## 6. Verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Test/smoke

- Tidak ada smoke khusus workflow edit staff di repo saat ini.

### QA/manual

- Audit kode memastikan edit flow aktif tidak lagi membuka role conversion bebas dari drawer.
- Audit kode memastikan backend menjadi source of truth untuk role-lock pada edit lane.
- Audit kode memastikan password update edit flow sudah sejalur dengan create-flow baru.

## 7. Risiko / residual issue

- Lane staff page masih merupakan surface campuran yang menampilkan beberapa role legacy; task ini hanya merapikan policy edit, bukan memecah lane berdasarkan role.
- Seller access editor masih ada untuk akun seller existing karena itu bagian dari perilaku aktif yang tidak aman untuk dihapus diam-diam.
- Belum ada smoke khusus create/edit workflow admin staff; coverage otomatis masih menjadi follow-up terpisah.

## 8. Rekomendasi task berikutnya

- Lanjutkan `ADMIN-STAFF-WORKFLOW-SMOKE-01` untuk menutup gap coverage create/edit/publish workflow admin staff.
- Setelah itu, evaluasi apakah lane admin staff perlu pemisahan visual kecil antara staff account dan role legacy lain, tanpa refactor besar.
