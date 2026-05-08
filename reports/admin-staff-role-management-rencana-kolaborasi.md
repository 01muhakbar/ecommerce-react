# Rencana Kolaborasi

## Latar Belakang

Permintaan terbaru tidak lagi hanya soal create staff account. Scope-nya sekarang berubah menjadi:

- `super_admin` dapat memilih role akun saat create account
- role yang dapat dipilih: `super_admin`, `admin`, `staff`, `seller`
- `super_admin` dapat mengatur pembatasan fitur/menu untuk akun `admin` dan `staff`
- akun `seller` tidak boleh login dari lane `/admin/login`
- profile image create/edit account admin staff harus berfungsi dengan baik

Sebagian dari kebutuhan ini masih bisa dipatch kecil. Namun bagian pembatasan fitur/menu per akun untuk `admin` dan `staff` menyentuh source of truth permission yang saat ini belum dibangun untuk model per-account.

## Masalah Existing

### 1. Source of truth permission existing masih role-based

Saat ini access control utama berjalan dari:

- backend: `server/src/utils/rbac.ts`
- frontend: `client/src/constants/permissions.js`
- frontend route guard: `RequirePerm`

Semua itu masih memakai rank role:

- `staff`
- `admin`
- `super_admin`

Belum ada policy aktif yang membaca `permissionKeys` untuk akun `admin` atau `staff`.

### 2. `permissionKeys` existing saat ini hanya nyata dipakai untuk seller lane

Di lane staff management existing:

- `sellerRoleCode`
- `permissionKeys`

sudah dipakai untuk akun `seller`, terutama seller workspace access. Tetapi lane admin/staff active guards, sidebar visibility, dan backend route authorization belum membaca permission set per account.

### 3. Admin login saat ini masih menerima seller credentials

`POST /api/auth/admin/login` saat ini masih hanya memeriksa email + password, lalu menerbitkan session. Seller memang tidak lolos ke admin workspace karena guard berikutnya memblokir, tetapi autentikasi awalnya masih terlalu longgar untuk lane admin.

### 4. Profile image upload berisiko rusak karena jalur request create/edit tidak konsisten

Client admin staff saat ini mengirim create/edit payload melalui helper yang membentuk `FormData`, tetapi request dengan file dan tanpa file belum diperlakukan eksplisit berbeda. Ini berisiko membuat upload image tidak sampai ke backend dengan benar.

## Risiko jika patch langsung

Jika langsung memaksakan fitur pembatasan menu per akun tanpa desain bertahap, risikonya:

- frontend sidebar/route guard dan backend route guard membaca truth yang berbeda
- admin/staff melihat menu yang disembunyikan, tapi endpoint backend tetap bisa diakses
- atau sebaliknya, menu tampil tetapi backend melarang
- auth payload `login` dan `/auth/me` harus berubah agar membawa permission set baru
- perubahan bisa melebar ke banyak route admin, bukan hanya halaman create account

Dengan kata lain, bagian ini sudah mendekati perubahan arsitektur permission, bukan sekadar patch form create.

## Ruang Lingkup

### Yang masih aman sebagai patch kecil-menengah

- menolak login `seller` di `/api/auth/admin/login`
- memperbaiki upload profile image pada create/edit admin staff lane
- membuka kembali pilihan role pada create account jika hanya role assignment dasar yang dibutuhkan

### Yang tidak aman jika dipatch langsung tanpa desain bertahap

- pembatasan fitur/menu per akun untuk role `admin` dan `staff`
- permission-aware sidebar dan route guard berdasarkan `permissionKeys`
- backend route authorization per permission key, bukan hanya per role minimum

## Strategi bertahap

### Tahap 1 — Hotfix aman

Tujuan:

- `seller` tidak bisa login dari `/admin/login`
- profile image create/edit staff account benar-benar bekerja
- jika diperlukan, role selection di create flow bisa dibuka lagi untuk `super_admin`, tetapi **tanpa** permission-per-account dulu

Perubahan yang dibutuhkan relatif kecil.

### Tahap 2 — Permission truth design

Tujuan:

- tentukan apakah `permissionKeys` menjadi source of truth untuk `admin/staff`
- tentukan payload auth mana yang membawa permission set:
  - `/api/auth/admin/login`
  - `/api/auth/me`
- tentukan consumer aktif:
  - `RequirePerm`
  - sidebar/menu builder
  - backend admin route guards

Tahap ini butuh desain policy yang eksplisit agar tidak liar.

### Tahap 3 — Implement permission-aware admin/staff restrictions

Baru setelah source of truth disepakati:

- tambahkan permission set untuk admin/staff
- selaraskan login payload, me payload, sidebar, route guard, dan backend guard
- tambahkan smoke/QA khusus untuk akses menu dan forbidden states

## Batasan

- tidak mengubah schema DB tanpa persetujuan eksplisit
- tidak mengganti auth architecture besar
- tidak mengganti role-management besar sekaligus
- tidak mengubah banyak contract API sekaligus tanpa desain yang disetujui

## Bukti selesai

Dokumen ini dibuat karena permintaan terbaru memenuhi kondisi STOP:

- perubahan menyentuh role/permission architecture yang lebih besar dari patch kecil
- pembatasan fitur per akun admin/staff tidak bisa aman jika hanya diubah di UI create form

### Rekomendasi tindak lanjut paling aman

Bagi pekerjaan menjadi dua task:

1. `ADMIN-AUTH-HOTFIX-SELLER-LOGIN-AND-STAFF-IMAGE-01`
   - tolak seller di `/api/auth/admin/login`
   - perbaiki profile image upload create/edit staff

2. `ADMIN-PERMISSION-PER-ACCOUNT-DESIGN-01`
   - rancang source of truth permission per account untuk admin/staff sebelum implementasi
