# ACCOUNT-ROLE-UPGRADE-FROM-EXISTING-USER-01 Audit

## Summary

Audit ini memeriksa apakah akun existing `customer` dapat diberi role `admin` atau `staff` tanpa membuat akun baru.

Kesimpulan singkat:

- secara model data: **bisa**
- secara workflow resmi yang aman di UI saat ini: **belum ada**
- secara backend route existing: **ada celah route edit account yang secara teknis bisa mengubah role user existing bila `id` user diketahui**

## Source of truth yang diaudit

- user source of truth: `server/src/models/User.ts`
- admin login guard: `server/src/routes/auth.ts`
- admin account create/edit lane: `server/src/routes/admin.staff.ts`
- customer lane: `server/src/routes/admin.customers.ts`
- client registration source of truth: `server/src/services/clientRegistration.service.ts`
- role guard admin workspace: `server/src/utils/rbac.ts`

## Temuan utama

### 1. Model user adalah single-account lintas lane

`users` adalah tabel tunggal untuk:

- customer
- staff
- admin
- super_admin
- seller

Field kunci:

- `role`
- `status`
- `email` unik global
- `phoneNumber` unik global

Implikasi:

- satu email tidak bisa dipakai untuk akun customer dan staff/admin terpisah
- kalau ingin memberi akses admin workspace ke identitas yang sama, pendekatan yang paling natural adalah mengubah role pada user existing, bukan membuat user kedua

### 2. Customer existing saat registrasi client dibuat sebagai role `customer`

Client registration membuat user dengan:

- `role: "customer"`
- `status: "pending_verification"` lalu `active` setelah verifikasi

Jadi akun buyer yang ada di `/admin/customers` memang berasal dari entitas user yang sama, bukan tabel akun terpisah.

### 3. Admin login hanya mengizinkan role admin workspace

Lane `/api/auth/admin/login` hanya menerima role:

- `staff`
- `admin`
- `super_admin`

dan tetap menolak role lain seperti:

- `customer`
- `seller`

Artinya bila user existing customer diubah role-nya menjadi `staff` atau `admin`, akun yang sama secara teknis akan mulai eligible untuk login ke admin workspace.

### 4. Customer lane dan staff lane saat ini dipisahkan secara list/query, bukan secara model terpisah

`/api/admin/customers` memfilter `role: "customer"`.

`/api/admin/staff` list memfilter role managed:

- `staff`
- `admin`
- `super_admin`
- `seller`

Implikasi:

- jika customer dipromosikan ke `staff/admin`, akun itu akan hilang dari lane customers
- akun yang sama akan muncul di lane account/staff

Jadi role conversion akan mengubah visibility dan ownership lane admin secara nyata.

### 5. Temuan penting: edit route admin account saat ini tidak membatasi target ke managed-role saja

Di `PATCH /api/admin/staff/:id`, backend mengambil target dengan `findByPk(id)` tanpa guard role target terlebih dulu.

Implikasi:

- secara teknis, super admin yang mengetahui `id` customer existing dapat mengubah role user itu lewat route edit account
- ini berarti upgrade existing customer ke `staff/admin` **sudah mungkin secara backend**, tetapi **belum menjadi workflow resmi yang jujur dan aman**

Ini bukan flow yang ideal untuk dipakai operasional karena:

- tidak ada UX khusus “convert existing customer”
- tidak ada helper/copy yang menjelaskan dampak perpindahan lane
- tidak ada guard tambahan untuk mencegah konversi yang tidak disengaja

## Jawaban audit

### Apakah akun existing customer bisa diberi role admin/staff tanpa bikin akun baru?

**Ya, secara model dan backend data itu memungkinkan.**

Karena:

- user memakai tabel tunggal
- role ada pada record user yang sama
- admin login guard membaca role dari user yang sama

Tetapi:

- flow resmi di UI belum ada
- customer lane dan admin account lane akan berubah ownership berdasarkan role baru
- implementasi yang ada sekarang belum membungkus ini sebagai workflow yang aman dan eksplisit

## Risiko jika dipakai langsung dari route existing

- customer bisa “pindah lane” tanpa penjelasan operasional yang jelas
- akun hilang dari `/admin/customers` setelah role bukan `customer`
- flow profile/order/account buyer bisa ikut berubah bila ternyata user itu masih diharapkan tetap menjadi customer aktif
- route edit account existing belum didesain sebagai conversion workflow, jadi truth operasionalnya belum cukup jujur

## Rekomendasi

Jangan memakai route edit existing sebagai cara operasional tersembunyi untuk promosi customer ke staff/admin.

Kalau ingin mendukung use case ini, task yang aman adalah batch kecil terpisah:

`ACCOUNT-ROLE-UPGRADE-FROM-EXISTING-USER-IMPLEMENT-01`

Scope minimal yang disarankan:

- audit dan tentukan policy apakah customer boleh kehilangan role `customer` sepenuhnya
- buat flow eksplisit “promote existing user to admin workspace role”
- tampilkan dampak lane dengan copy yang jujur
- backend tetap source of truth
- guard target role dan target lane dibuat eksplisit

## Status audit

- tidak ada perubahan code
- tidak ada perubahan schema DB
- tidak ada perubahan contract API
