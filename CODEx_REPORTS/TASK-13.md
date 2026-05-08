# TASK-13 - Products Price Field Hardening + Regression Guard

## Objective

Melakukan hardening flow harga produk pada Admin Products agar definisi `price`, `salePrice`, dan `originalPrice` tetap konsisten setelah bug fix sebelumnya, serta mengurangi risiko mismatch serupa muncul lagi pada flow create, edit, detail, dan list.

## Audited Area

- `server/src/routes/admin.products.ts`
- `client/src/pages/admin/Products.jsx`
- `client/src/pages/admin/ProductForm.jsx`
- `client/src/pages/admin/ProductPreviewDrawer.jsx`

## Field Definition Check

- `price`
  - Harga dasar / base price
  - Source of truth untuk flow admin CRUD

- `salePrice`
  - Harga promo
  - Hanya dianggap aktif bila `> 0` dan `< price`

- `originalPrice`
  - Field display-only helper
  - Tidak dipakai sebagai acuan form submit/edit

## Remaining Ambiguities

Temuan ambiguitas sisa sebelum patch:

- Mapper backend list dan detail belum memakai helper harga yang sama, sehingga raw parsing berpotensi menyimpang lagi di masa depan.
- Tabel products masih punya fallback render `originalPrice || price`, padahal setelah bug fix `price` sudah final sebagai base price.
- Form submit belum punya guard kecil untuk mencegah `salePrice >= price`, yang bisa memicu interpretasi berbeda antara form dan list.

Setelah patch:

- tidak ada ambiguitas penting yang tersisa pada list/detail/form utama.

## Files Changed

- `server/src/routes/admin.products.ts`
- `client/src/pages/admin/Products.jsx`
- `client/src/pages/admin/ProductForm.jsx`

## What Changed

### 1. `server/src/routes/admin.products.ts`

- Menambahkan helper `resolveAdminPriceFields()` agar list dan detail memakai definisi harga yang sama.
- Menegaskan bahwa `price` di admin adalah base price.
- Menormalkan `salePrice` agar hanya aktif jika valid sebagai promo.

### 2. `client/src/pages/admin/Products.jsx`

- Menambahkan helper `resolveAdminProductPricing()` agar render tabel tidak lagi bergantung pada fallback ambigu.
- Menampilkan kolom `Price` sebagai base price secara eksplisit.
- Menampilkan kolom `Sale Price` hanya jika promo valid.
- Menghapus pola render lama yang berpotensi menggandakan/menyamarkan base price.

### 3. `client/src/pages/admin/ProductForm.jsx`

- Menambahkan helper kecil untuk normalisasi `salePrice` input.
- Menambahkan guard submit agar `salePrice` tidak boleh sama dengan atau lebih tinggi dari `price`.
- Memperjelas helper copy pada section pricing agar definisi field lebih eksplisit.

## Regression Verification

- `create` -> PASS
  - detail `price` dan list `price` sinkron
  - detail `salePrice` dan list `salePrice` sinkron

- `edit` -> PASS
  - update harga dasar dan harga promo tetap sinkron di detail dan list

- `list` -> PASS
  - tabel membaca base price secara konsisten

- `detail/prefill` -> PASS
  - detail tetap mengembalikan `price` sebagai harga dasar
  - form edit tetap membaca field yang sama

- `refresh/persist` -> PASS
  - fetch detail ulang sesudah update tetap konsisten

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260307-090648/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260307-090648/summary.txt`

### Verifikasi products price flow

Reproduksi ulang via API admin products:

- create:
  - `detailPrice = 165000`
  - `listPrice = 165000`
  - `detailSalePrice = 131000`
  - `listSalePrice = 131000`

- edit:
  - `detailPrice = 222000`
  - `listPrice = 222000`
  - `detailSalePrice = 187000`
  - `listSalePrice = 187000`

- persist:
  - `detailPrice = 222000`
  - `detailSalePrice = 187000`

## Final Status

PASS
