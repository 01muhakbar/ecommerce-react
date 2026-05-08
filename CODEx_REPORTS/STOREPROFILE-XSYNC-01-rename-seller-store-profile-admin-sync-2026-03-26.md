# STOREPROFILE-XSYNC-01 — Rename Seller Store Profile URL ke `/store-profile` + Admin Online Store > Store Profile

Tanggal: 2026-03-26

## Scope yang dikerjakan

- canonical seller route berubah ke `/seller/stores/:storeSlug/store-profile`
- legacy redirect dari `/seller/stores/:storeSlug/profile`
- helper/internal seller route disinkronkan
- seller layout title/meta/nav disinkronkan
- backend seller endpoint compatibility dipertahankan dan diberi alias `/store-profile`
- shared governance/serializer store profile untuk seller + admin
- admin lane baru `Online Store > Store Profile`
- client `/store/:slug` tetap mengikuti public-safe serializer existing
- verifikasi build `server` dan `client`

## Hasil audit awal

- seller workspace sebelumnya masih canonical ke `/profile`
- backend seller API juga masih `/seller/stores/:storeId/profile`
- admin belum punya lane eksplisit untuk store profile di bawah Online Store
- public storefront sudah punya fondasi serializer shared melalui public store identity
- tidak perlu schema migration
- tidak perlu ubah association utama Store/Product/Customization
- tidak perlu ubah auth/permission global

## Perubahan utama

### 1. Canonical seller route menjadi `/store-profile`

Files:
- `client/src/App.jsx`
- `client/src/utils/sellerWorkspaceRoute.js`
- `client/src/layouts/SellerLayout.jsx`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`

Perubahan:
- route seller baru:
  - `/seller/stores/:storeSlug/store-profile`
- route lama:
  - `/seller/stores/:storeSlug/profile`
  sekarang redirect aman ke route baru
- helper seller sekarang canonical ke `storeProfile()`
- alias `profile()` tetap ada untuk compatibility internal sementara, tetapi mengarah ke route baru
- seller layout title/subtitle mengenali `/store-profile`
- CTA internal seller home/readiness sudah mengarah ke route baru

### 2. Backend seller endpoint tetap kompatibel

Files:
- `server/src/routes/seller.storeProfile.ts`

Perubahan:
- endpoint lama tetap hidup:
  - `GET /api/seller/stores/:storeId/profile`
  - `PATCH /api/seller/stores/:storeId/profile`
- endpoint alias baru:
  - `GET /api/seller/stores/:storeId/store-profile`
  - `PATCH /api/seller/stores/:storeId/store-profile`
- handler GET/PATCH dipakai bersama

Hasil:
- frontend baru dapat memakai naming `/store-profile`
- backward compatibility endpoint lama tetap aman

### 3. Shared governance/serializer store profile untuk seller dan admin

File baru:
- `server/src/services/storeProfileGovernance.ts`

Isi utama:
- field ownership:
  - `ADMIN_OWNED_STORE_PROFILE_FIELDS`
  - `SELLER_EDITABLE_STORE_PROFILE_FIELDS`
  - `PUBLIC_SAFE_STORE_PROFILE_FIELDS`
- shared serializer:
  - `serializeStoreProfileSnapshot(store, { actor, canEdit })`
- shared contract:
  - categories `adminOwnedFields`
  - categories `sellerEditableFields`
  - categories `publicSafeFields`
- shared validation schema:
  - seller patch schema
  - admin patch schema

Hasil:
- seller/admin membaca governance store profile dari source yang sama
- public-safe boundary tetap eksplisit dan tidak drift dari store identity contract

### 4. Admin Online Store > Store Profile baru

Files:
- `server/src/routes/admin.storeProfiles.ts`
- `server/src/app.ts`
- `client/src/api/adminStoreProfile.ts`
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `client/src/components/Layout/Sidebar.jsx`
- `client/src/App.jsx`

Perubahan:
- backend route baru:
  - `GET /api/admin/store/profiles`
  - `PATCH /api/admin/store/profiles/:storeId`
- admin menu baru:
  - `Online Store > Store Profile`
- admin page baru route:
  - `/admin/online-store/store-profile`

Fungsi admin page:
- edit minimal field admin-owned:
  - `name`
  - `slug`
  - `status`
- tampilkan preview seller-editable fields
- tampilkan preview public-safe storefront fields
- tampilkan governance notes + completeness
- link langsung ke `/store/:slug`

Boundary:
- page ini khusus `Store Profile`
- tidak mengambil alih `Store Customization`

### 5. Storefront sync tetap aman

Perubahan yang disengaja:
- tidak ada breaking change pada route publik `/store/:slug`
- storefront tetap membaca serializer public-safe existing
- perubahan admin-owned dan seller-owned tetap tercermin lewat source of truth Store + public serializer existing

## Acceptance criteria status

- Canonical seller route berubah ke `/seller/stores/:storeSlug/store-profile`: ✅
- Route lama `/seller/stores/:storeSlug/profile` tetap hidup sebagai redirect aman: ✅
- Semua link internal seller memakai route baru: ✅
- Seller layout/title/sidebar tetap sinkron: ✅
- Backend store profile contract tetap stabil: ✅
- Endpoint lama tetap aman untuk compatibility: ✅
- Admin menu Online Store > Store Profile muncul: ✅
- Admin page baru bisa dibuka dan menampilkan governance field dengan jelas: ✅
- Client `/store/:slug` tetap sinkron terhadap public-safe fields: ✅ by contract, tidak diubah secara breaking
- Tidak ada field internal/admin-only bocor ke client: ✅ public-safe boundary tetap dipakai
- `pnpm --filter server build` lulus: ✅
- `pnpm --filter client build` lulus: ✅

## Verification

### Yang tervalidasi dari implementasi/build

- seller route lama sekarang punya redirect component ke route baru
- helper seller canonical sekarang `/store-profile`
- seller home CTA store profile memakai route baru
- backend seller route lama + alias baru sama-sama hidup
- admin store profile lane baru sudah terpasang di router dan sidebar
- build server lulus
- build client lulus

### Smoke check manual yang masih perlu dijalankan di browser

Seller:
- buka `/seller/stores/super-admin-1/profile`
- pastikan redirect ke `/seller/stores/super-admin-1/store-profile`
- buka route baru langsung
- cek sidebar highlight + title/subtitle
- cek CTA dari seller home menuju route baru

Admin:
- buka `Online Store > Store Profile`
- edit `name`, `slug`, `status`
- pastikan page tidak overlap dengan `Store Customization`

Client:
- buka `/store/:slug`
- cek name/logo/banner/bio/contact tetap sesuai contract
- cek perubahan seller-owned field tercermin
- cek perubahan admin-owned field tercermin bila relevan

## Validasi build

- `pnpm --filter server build`
- `pnpm --filter client build`

Hasil:
- keduanya lulus pada 2026-03-26
- build client hanya memberi warning chunk size non-blocking

## Risiko residual kecil

- route helper alias `profile()` masih dipertahankan sementara untuk compatibility internal; canonical baru tetap `storeProfile()`.
- perubahan slug dari admin akan mengubah route publik store terkait; ini tetap perilaku yang konsisten dengan store identity source of truth, tetapi perlu smoke check manual pada link lama.
