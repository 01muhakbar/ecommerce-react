# ADMIN-STAFF-CREATE-ACCOUNT-01

## 1. Summary perubahan

Patch ini menyelesaikan flow create account `staff` di Admin Workspace dengan memanfaatkan lane admin staff yang sudah ada, lalu memperketatnya agar tidak lagi ambigu.

Perubahan utama:

- Backend `POST /api/admin/staff` sekarang mengunci role hasil create ke `staff` di server, tanpa mempercayai role dari payload frontend.
- Form create di admin sekarang menjadi staff-only, tidak lagi membuka opsi `admin`, `super_admin`, atau `seller`.
- Validasi create form dirapikan agar lebih dekat ke pola client create account:
  - password + confirm password
  - helper password yang jujur
  - password strength indicator
  - fixed role notice
- Copy success/admin page dirapikan agar jelas bahwa flow ini adalah create staff account.

Tidak ada migration database.
Tidak ada perubahan contract API besar.
Tidak ada redesign besar Admin Workspace.

## 2. Flow create staff yang dipilih

Flow yang dipakai: **Direct Create Staff**

Urutan flow:

1. Super admin membuka halaman admin staff.
2. Super admin membuka drawer create.
3. Super admin mengisi nama, email, phone opsional, password, konfirmasi password, dan avatar opsional.
4. Frontend mengirim payload create ke `/api/admin/staff`.
5. Backend memvalidasi payload, memastikan email belum dipakai, meng-hash password, dan **memaksa role = `staff`**.
6. Setelah sukses, UI menutup drawer, menampilkan konfirmasi jelas, dan me-refresh list staff.

## 3. Alasan memilih direct-create

- Repo sudah punya lane admin staff create yang aktif dan reusable.
- Tidak ditemukan invitation flow admin/staff yang kecil dan siap pakai tanpa melebar.
- Direct-create adalah patch terkecil yang aman dan paling konsisten dengan implementasi admin existing.

## 4. File yang diubah

- `server/src/routes/admin.staff.ts`
- `client/src/api/adminStaff.ts`
- `client/src/components/admin/staff/AddStaffDrawer.jsx`
- `client/src/pages/admin/Staff.jsx`

## 5. Endpoint yang ditambah/diubah

- Diubah: `POST /api/admin/staff`
  - create account staff tetap pada endpoint existing
  - role hasil create sekarang dipaksa menjadi `staff`
  - password create sekarang divalidasi dengan rule yang lebih jelas untuk flow baru
  - duplicate email tetap ditangani dengan `409`

## 6. Halaman admin yang diubah

- `client/src/pages/admin/Staff.jsx`
  - copy halaman dan success notice dirapikan
- `client/src/components/admin/staff/AddStaffDrawer.jsx`
  - drawer create staff sekarang staff-only
  - role tidak lagi selectable bebas
  - password + confirm password + strength helper ditambahkan

## 7. Verifikasi/build/test

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Test/smoke

- Tidak ada smoke/admin-create-staff yang dedicated di repo saat ini.

### QA/manual

- Audit guard menunjukkan route admin staff tetap dibatasi oleh `STAFF_MANAGE` di frontend dan `requireSuperAdmin` di backend.
- Verifikasi kode menunjukkan create payload frontend tidak lagi mengirim role bebas untuk flow create staff.
- Verifikasi kode menunjukkan response success tetap sinkron dengan invalidasi query `admin-staff`.

## 8. Risiko / residual issue

- Lane edit staff existing masih lebih luas dan masih bisa mengubah role ke role lain. Task ini sengaja tidak merombak flow edit agar boundary tetap kecil.
- Rule password kuat diterapkan pada flow create staff baru, tetapi lane update password staff existing masih mengikuti perilaku legacy.
- Halaman list staff existing tetap menampilkan account lintas role yang sudah ada; task ini hanya mengunci **flow create** agar staff-only.

## 9. Saran task berikutnya

- Audit lane `EditStaffDrawer` jika ingin menyelaraskan kebijakan role/password dengan create flow baru.
- Tambahkan smoke kecil untuk admin create staff jika lane ini akan sering dipakai sebagai workflow operasional.
