# ADMIN-SELLER-ADMIN-LOGIN-BLOCK-SMOKE-01 Report

## 1. Summary perubahan

Task ini menambahkan smoke backend repeatable untuk membuktikan guard login admin tetap jujur:

- akun `seller` ditolak di `/api/auth/admin/login`
- akun `admin` yang valid tetap lolos
- akun `super_admin` yang valid tetap lolos

Smoke ini memakai app lokal ephemeral + fixture user sementara di database, jadi ia benar-benar mengetes guard backend yang aktif, bukan sekadar mock UI.

## 2. Scope yang disentuh

- `server/src/scripts/smokeAdminSellerAdminLoginBlock.ts`
- `server/package.json`

Tidak ada perubahan contract API besar.
Tidak ada perubahan UI.
Tidak ada perubahan auth architecture besar.

## 3. Flow smoke yang dibuktikan

### Seller blocked

- buat user fixture role `seller`
- kirim `POST /api/auth/admin/login`
- assert `403`
- assert message:
  - `This account does not have admin workspace access.`
- assert tidak ada session admin yang terbit:
  - `GET /api/auth/me` tetap `401`

### Admin allowed

- buat user fixture role `admin`
- kirim `POST /api/auth/admin/login`
- assert `200`
- assert body user role = `admin`
- assert session valid lewat `GET /api/auth/me`

### Super Admin allowed

- buat user fixture role `super_admin`
- kirim `POST /api/auth/admin/login`
- assert `200`
- assert body user role = `super_admin`
- assert session valid lewat `GET /api/auth/me`

## 4. File yang diubah

- `server/src/scripts/smokeAdminSellerAdminLoginBlock.ts`
- `server/package.json`

## 5. Command yang dijalankan

- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm -F server smoke:admin-seller-admin-login-block`

## 6. Hasil verifikasi

### Build

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:admin-seller-admin-login-block` ✅

Coverage yang lolos:

- seller ditolak di `/admin/login`
- seller tidak mendapat session auth
- admin tetap lolos `/admin/login`
- super admin tetap lolos `/admin/login`

## 7. Risiko / residual issue

- Smoke ini mengetes backend route langsung, bukan browser/admin login page UI.
- Coverage saat ini fokus pada guard role-block utama; invalid password dan inactive status sudah di-cover lane auth lain, bukan task ini.
- Fixture smoke masih memakai database lokal sehat, jadi tetap bergantung pada environment DB tersedia.

## 8. Saran task berikutnya

- Tambahkan smoke kecil browser-level untuk admin login page agar seller-block message di UI juga ikut terlindungi dari regresi.
- Jika diperlukan, gabungkan smoke ini ke batch auth/admin smoke yang lebih luas untuk lane admin workspace login.
