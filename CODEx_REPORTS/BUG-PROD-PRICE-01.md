# BUG-PROD-PRICE-01 - Investigasi dan Perbaikan Sinkronisasi Product Price pada Halaman Admin Products

## Objective

Memperbaiki mismatch harga produk pada halaman Admin Products agar nilai `Product Price` di tabel sinkron dengan data hasil Add/Edit Product, tanpa mengubah contract API secara besar dan tanpa refactor besar.

## Reproduction Summary

### Reproduksi sebelum patch

1. Login admin via `POST /api/auth/admin/login`
2. Create product baru dengan:
   - `price = 150000`
   - `salePrice = 120000`
3. Ambil:
   - `GET /api/admin/products/:id`
   - `GET /api/admin/products?q=<slug>`
4. Update product yang sama menjadi:
   - `price = 210000`
   - `salePrice = 180000`
5. Ambil lagi detail dan list.

### Mismatch yang ditemukan

- `create` response: `price = 150000`, `salePrice = 120000`
- `detail` response: `price = 150000`, `salePrice = 120000`
- `list` response: `price = 120000`, `originalPrice = 150000`, `salePrice = 120000`

Sesudah update:

- `update` response: `price = 210000`, `salePrice = 180000`
- `detail` response: `price = 210000`, `salePrice = 180000`
- `list` response: `price = 180000`, `originalPrice = 210000`, `salePrice = 180000`

Kesimpulan reproduksi:

- mismatch terjadi di `render source` tabel karena `GET /api/admin/products` mengirim `price` yang berbeda dari source field form/detail.

## Root Cause

Akar masalah ada di mapper backend list admin products pada:

- `server/src/routes/admin.products.ts`

Fungsi `toAdminProductListItem()` mengubah:

- `price` menjadi harga efektif diskon (`salePrice`) saat produk memiliki promo

Padahal:

- flow Add Product
- flow Edit Product
- response detail produk

semuanya memperlakukan `price` sebagai **harga dasar / base price**.

Akibatnya:

- tabel products menampilkan `Product Price` dari nilai promo,
- sementara form edit memuat `Product Price` dari nilai dasar,
- sehingga admin melihat data yang tampak tidak sinkron.

## Source of Truth Decision

Field harga acuan utama ditetapkan sebagai berikut:

- `price` = base/original product price
- `salePrice` = promo/discounted price bila ada

Aturan sinkron:

- form Add/Edit membaca dan menulis `price` sebagai harga dasar
- list admin juga harus mengirim `price` sebagai harga dasar
- `salePrice` tetap dikirim terpisah
- `originalPrice` tetap boleh dipakai sebagai helper display saat ada diskon

## Files Changed

- `server/src/routes/admin.products.ts`

## What Changed

### 1. `server/src/routes/admin.products.ts`

- Memperbaiki mapper `toAdminProductListItem()` agar `price` selalu memakai `basePrice`.
- Mempertahankan `salePrice` sebagai field terpisah.
- Mempertahankan `originalPrice` sebagai helper saat diskon aktif.

Patch inti:

- sebelum: `price = hasDiscount ? salePrice : basePrice`
- sesudah: `price = basePrice`

## Before vs After

### Sebelum

- Form create/update/detail: `price = harga dasar`
- List/table: `price = harga promo`

Hasil:

- kolom `Product Price` di tabel tidak sinkron dengan data yang diisi di form.

### Sesudah

- Form create/update/detail: `price = harga dasar`
- List/table: `price = harga dasar`
- `salePrice` tetap tampil sebagai kolom promo terpisah

Hasil:

- tabel, detail, dan form edit memakai source harga yang sama.

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260307-085026/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260307-085026/summary.txt`

### Verifikasi create/edit/list khusus bug ini

Setelah patch, reproduksi ulang menghasilkan:

- after create:
  - `detailPrice = 155000`
  - `listPrice = 155000`
  - `detailSalePrice = 123000`
  - `listSalePrice = 123000`
- after update:
  - `detailPrice = 211000`
  - `listPrice = 211000`
  - `detailSalePrice = 181000`
  - `listSalePrice = 181000`

Status verifikasi khusus bug:

- create sync -> PASS
- edit sync -> PASS
- list render sync -> PASS
- persist/detail sync -> PASS

## Regression Check

- Products page query shape tetap aman -> PASS
- Product form Add/Edit tidak diubah -> PASS
- Publish toggle dan action lain tidak disentuh -> PASS
- Admin MVF orders flow tetap PASS -> PASS
- Store MVF smoke tetap PASS -> PASS

## Final Status

PASS
