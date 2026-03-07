# TASK-23A

## Objective

Finalisasi persistence backend untuk `categoryIds` dan `defaultCategoryId` pada product admin, menambahkan backfill data lama, dan memperluas contract `create/update/detail/list` tanpa menyentuh frontend.

## Data Model Decision

- `products.defaultCategoryId`
  - disimpan di tabel `products`
  - menjadi source of truth category tunggal kompatibilitas lama
- `product_categories`
  - join table `productId` x `categoryId`
  - menyimpan multi selected categories
- compatibility transition
  - `categoryId` tetap dipertahankan
  - `categoryId` dimirror ke `defaultCategoryId`
  - response admin tetap mengembalikan `categoryId` sebagai alias ke default category

## Migration / Backfill Summary

- Repo ini masih mengandalkan `sequelize.sync({ alter: true })`, jadi saya tidak menambah migration file terpisah.
- Saya menambahkan schema field/model berikut:
  - `products.defaultCategoryId`
  - model join `ProductCategory`
- Saya menambahkan backfill di `syncDb()`:
  - jika product lama punya `categoryId` dan belum punya `defaultCategoryId`, maka `defaultCategoryId = categoryId`
  - buat row `product_categories(productId, categoryId)` untuk category default lama
- Hasil verifikasi backfill:
  - produk lama `id=24` mengembalikan `categoryIds=[1,2]`, `defaultCategoryId=2`, `categoryId=2`

## Contract Changes

### Create / Update Product

- menerima `categoryIds?: number[]`
- menerima `defaultCategoryId?: number | null`
- tetap menerima `categoryId` sebagai compatibility alias
- validasi aktif:
  - `defaultCategoryId` tidak boleh ada di luar `categoryIds`
  - jika `categoryIds` dikirim, `defaultCategoryId` wajib valid
  - semua `categoryIds` harus benar-benar ada di tabel categories

### Detail / List Product

- sekarang mengembalikan:
  - `categoryIds`
  - `defaultCategoryId`
  - `categories`
  - `defaultCategory`
- tetap mengembalikan `categoryId` untuk kompatibilitas frontend lama

## Files Changed

- `server/src/models/Product.ts`
- `server/src/models/Category.ts`
- `server/src/models/ProductCategory.ts`
- `server/src/models/index.ts`
- `server/src/routes/admin.products.ts`
- `CODEx_REPORTS/TASK-23A.md`

## What Changed

### `server/src/models/Product.ts`

- menambahkan field `defaultCategoryId`
- menambahkan association:
  - `defaultCategory`
  - `categories` melalui join table

### `server/src/models/Category.ts`

- menambahkan association:
  - `products`
  - `defaultProducts`
  - `relatedProducts`

### `server/src/models/ProductCategory.ts`

- model join table baru untuk relasi multi-category per product

### `server/src/models/index.ts`

- mendaftarkan model `ProductCategory`
- menambahkan backfill helper setelah `sequelize.sync({ alter: true })`

### `server/src/routes/admin.products.ts`

- menambahkan normalisasi dan validasi contract category:
  - `normalizeCategoryIdsInput`
  - `resolveCategorySelection`
  - `assertCategoryIdsExist`
  - `syncProductCategoryAssignments`
- memperluas mapper detail/list/export agar memuat:
  - `categoryIds`
  - `defaultCategoryId`
  - `categories`
  - `defaultCategory`
- memperbarui `GET /api/admin/products`
- memperbarui `GET /api/admin/products/:id`
- memperbarui `POST /api/admin/products`
- memperbarui `PATCH /api/admin/products/:id`

## Verification Run

- `pnpm --filter server build` -> PASS
- `pnpm --filter server db:sync` -> PASS
- `GET /api/health` -> PASS
- backend contract verification -> PASS
  - login admin via cookie auth
  - create product dengan `categoryIds=[1,2]` dan `defaultCategoryId=2`
  - detail/list mengembalikan `categoryIds=[1,2]`, `defaultCategoryId=2`, `categoryId=2`
  - update product ke `categoryIds=[1]` dan `defaultCategoryId=1`
  - detail/list mengembalikan `categoryIds=[1]`, `defaultCategoryId=1`, `categoryId=1`
  - invalid patch `defaultCategoryId` di luar `categoryIds` -> `400`
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-111413/result.json`
  - artifact: `.codex-artifacts/qa-mvf/20260307-111413/summary.txt`

## Regression Risk

- frontend lama masih hanya mengirim `categoryId`, jadi multi-category belum bisa dioperasikan dari UI sampai fase `TASK-23B`
- contract admin products sekarang lebih kaya; area yang masih perlu hardening sesudah frontend wiring:
  - import/export products
  - product form prefill/edit sync
  - list/detail rendering category chips
- pendekatan schema saat ini masih dev-style karena memakai `sync({ alter: true })`, belum migration formal

## Final Status

- `PASS`
