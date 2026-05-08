# TASK-23C

## Objective

Melakukan hardening pada consumer utama data product admin agar konsep `categoryIds + defaultCategoryId` konsisten di products list, preview/detail, export, dan import tanpa refactor besar.

## Audit Summary

### Products List

- sebelum patch masih membaca `product.category?.name` seolah category tunggal
- `categories` dan `defaultCategoryId` dari contract baru belum dipakai untuk context display

### Preview / Detail

- sebelum patch hanya menampilkan satu baris `Category: ...`
- `defaultCategory` dan selected categories lain belum terlihat jelas

### Export

- sudah membawa `categoryIds`, `defaultCategoryId`, `categories`, dan `defaultCategory`
- masih perlu sedikit penguatan agar file ekspor lebih eksplisit untuk round-trip import

### Import

- masih berasumsi single category lama:
  - `categoryId`
  - `categoryCode`
  - `categoryName`
- belum memahami:
  - `categoryIds`
  - `defaultCategoryId`
  - `categories`
  - `defaultCategory`

## Selected Hardening Scope

- products list category/default category display
- product preview/detail category/default category display
- export payload category clarity
- import parsing + validation untuk `categoryIds/defaultCategoryId`

## Files Changed

- `client/src/pages/admin/Products.jsx`
- `client/src/pages/admin/ProductPreviewDrawer.jsx`
- `server/src/routes/admin.products.ts`
- `CODEx_REPORTS/TASK-23C.md`

## What Changed

### `client/src/pages/admin/Products.jsx`

- menambahkan helper category context untuk membaca:
  - `defaultCategory`
  - `categories`
  - related categories selain default
- category cell sekarang:
  - menampilkan default category sebagai badge utama
  - menampilkan related categories sebagai chips tambahan
  - memberi fallback yang lebih jujur saat secondary category belum ada

### `client/src/pages/admin/ProductPreviewDrawer.jsx`

- menambahkan category context untuk preview detail
- area detail sekarang menampilkan:
  - default category
  - selected categories
  - penanda visual untuk default category
  - hint jumlah secondary categories

### `server/src/routes/admin.products.ts`

- export item ditambah field eksplisit:
  - `defaultCategoryCode`
  - `defaultCategoryName`
  - `categoryCodes`
  - `categoryNames`
- import sekarang memahami contract baru:
  - `categoryIds`
  - `defaultCategoryId`
  - `categories`
  - `defaultCategory`
  - masih tetap kompatibel dengan format lama `categoryId/categoryCode/categoryName`
- import sekarang memakai validasi contract yang sama dengan create/update:
  - `defaultCategoryId` harus anggota `categoryIds`
  - assignment join table ikut disinkronkan saat import create/update

## End-to-End Verification

- add/edit downstream sync -> PASS
  - create product:
    - `categoryIds=[1,2]`
    - `defaultCategoryId=2`
  - update via import:
    - `categoryIds=[1]`
    - `defaultCategoryId=1`
- list/detail display -> PASS
  - list API dan detail API sama-sama mengembalikan category data yang sinkron
- export -> PASS
  - format: `admin-products.v1`
  - payload export membawa:
    - `categoryIds`
    - `defaultCategoryId`
    - `defaultCategoryCode`
    - `categoryCodes`
- import -> PASS
  - valid import melakukan `updated=1`, `failed=0`
  - join table category ikut sinkron setelah import
- invalid import case -> PASS
  - `defaultCategoryId` di luar `categoryIds` menghasilkan row failure
  - message: `defaultCategoryId must belong to categoryIds.`
- refresh/persist -> PASS
  - setelah import, detail/list tetap mengembalikan category data yang benar

## Regression Check

- Product Form hasil TASK-23B -> PASS
- hardening harga hasil TASK-13 -> PASS
- export/import MVP hasil TASK-15 -> PASS
- operational hardening hasil TASK-16 -> PASS
- products page umum -> PASS
- admin/store MVF umum -> PASS

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `pnpm --filter server build` -> PASS
- temporary Vite route check `/admin/products` -> PASS
  - verified on temporary client port `5181`
- downstream API verification -> PASS
  - create/list/detail/export/import/invalid-import/persist checked against live backend
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-115305/result.json`

## Remaining Risk

- list filter masih tetap memakai `categoryId` query param transisi, tetapi backend filter sudah aman karena memetakan ke selected categories
- browser automation untuk preview/list rendering belum tersedia di repo, jadi UI hardening diverifikasi lewat build + route runtime + API persistence, bukan scripted browser interaction penuh

## Final Status

- `PASS`
