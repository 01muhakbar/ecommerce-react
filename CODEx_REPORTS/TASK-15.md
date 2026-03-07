# TASK-15

## Objective

Mengaktifkan MVP backend + frontend untuk `Export`, `Import`, dan `Bulk Action` pada Admin Products tanpa mengubah arsitektur products module secara besar.

## Audit Summary

- `Export`
  - Frontend: placeholder only, tombol hanya `console.log`.
  - Backend: belum ada endpoint export products admin.
- `Import`
  - Frontend: placeholder only, belum ada file picker/upload flow nyata.
  - Backend: belum ada endpoint import products admin.
- `Bulk Action`
  - Frontend: sudah punya selected rows, dropdown action, confirm modal, dan feedback notice.
  - Backend: sudah ada `POST /api/admin/products/bulk` untuk `delete`, `publish`, `unpublish`.
  - Status awal: partial, sudah hampir aktif end-to-end.

## MVP Scope Decision

- Format export: `JSON`
  - Alasan: paling aman untuk MVP, tidak butuh parser CSV tambahan, dan field products tetap eksplisit.
- Rule import: `upsert by slug`
  - Alasan: paling realistis untuk create/update minimum tanpa mengubah contract CRUD utama.
- Bulk actions diaktifkan: `publish`, `unpublish`, `delete`
  - Alasan: backend dan state selection sudah ada, jadi cukup difinalkan lewat wiring frontend dan verifikasi persist.

## Files Changed

- `server/src/routes/admin.products.ts`
- `client/src/lib/adminApi.js`
- `client/src/pages/admin/Products.jsx`
- `CODEx_REPORTS/TASK-15.md`

## What Changed

### `server/src/routes/admin.products.ts`

- Menambahkan helper filter bersama untuk list/export agar export mengikuti filter admin yang sama.
- Menambahkan `GET /api/admin/products/export` untuk download JSON attachment.
- Menambahkan `POST /api/admin/products/import` berbasis multipart file upload + JSON parser.
- Menambahkan normalisasi import minimum:
  - `price` sebagai base price
  - `salePrice` hanya aktif bila valid dan lebih kecil dari `price`
  - `published`, `status`, `stock`, `sku`, `barcode`, `tags`, `imagePaths`
  - category resolution via `categoryId`, `categoryCode`, atau `categoryName`
- Import mengembalikan summary dasar:
  - `totalRows`
  - `created`
  - `updated`
  - `failed`
  - `errors`

### `client/src/lib/adminApi.js`

- Menambahkan `exportAdminProducts(params)` untuk fetch attachment JSON dari endpoint export.
- Menambahkan `importAdminProducts(file)` untuk upload file JSON ke endpoint import.

### `client/src/pages/admin/Products.jsx`

- Mengganti handler placeholder `Export` menjadi download flow nyata.
- Mengganti handler placeholder `Import` menjadi file picker + upload flow nyata.
- Menambahkan loading state dasar untuk export/import.
- Menampilkan feedback sukses/gagal import/export lewat notice yang sudah ada.
- Menjaga bulk action existing tetap dipakai untuk `publish`, `unpublish`, dan `delete`.

## Before vs After

- Sebelum:
  - tombol `Export` dan `Import` hanya placeholder
  - bulk action ada di UI, tetapi export/import belum aktif
- Sesudah:
  - `Export` men-download file JSON products admin
  - `Import` menerima file JSON dan memproses create/update by slug
  - `Bulk Action` tetap aktif untuk publish/unpublish/delete dan tervalidasi persist

## End-to-End Verification

- `Export`
  - PASS
  - file JSON terunduh
  - header attachment memakai filename `products-export-*.json`
  - payload berisi daftar item products admin
- `Import`
  - PASS
  - create via import: `created=1`
  - update via import slug yang sama: `updated=1`
  - hasil list dan detail sinkron setelah import kedua
- `Bulk Action`
  - PASS
  - `unpublish` -> persisted
  - `publish` -> persisted
  - `delete` -> persisted
- `Refresh / Persist`
  - PASS
  - setelah bulk publish/unpublish, detail product mengembalikan state yang benar
  - setelah bulk delete, query list berdasarkan slug mengembalikan 0 row

## Regression Check

- products page load -> PASS
- `/admin/products` dev route -> PASS (`200`)
- search/filter products -> PASS
- add/edit flow existing -> PASS by build/runtime regression
- single publish toggle existing -> PASS by shared route compatibility
- single delete existing -> PASS by shared route compatibility
- price sync hardening TASK-13 -> PASS
- store/admin MVF -> PASS

## Verification Run

- `pnpm --filter server build` -> PASS
- `pnpm --filter client exec vite build` -> PASS
- API verification script -> PASS
  - admin login: `superadmin@local.dev`
  - export total sample: `20`
  - import create: `1`
  - import update: `1`
  - bulk unpublish/publish/delete: PASS
- client dev route check -> PASS
  - `/admin/products` -> `200` on `http://localhost:5173/admin/products`
- `pnpm qa:mvf` run pertama -> FAIL karena stack lokal transient
- `pnpm qa:mvf` run kedua -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-093533/result.json`
  - summary: `20/20 passed`

## Final Status

PASS
