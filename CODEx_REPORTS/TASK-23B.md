# TASK-23B

## Objective

Menghubungkan Product Form admin ke contract backend baru `categoryIds + defaultCategoryId`, mengubah category selector menjadi multi-select hierarchy, dan menjaga add/edit/prefill/persist tetap sinkron.

## Frontend State Decision

- `categoryIds`
  - disimpan di state form sebagai `number[]`
  - menjadi source of truth selected categories
- `defaultCategoryId`
  - disimpan di state form sebagai `number | null`
  - hanya boleh berasal dari `categoryIds`
- rule sinkron final
  - jika user memilih category pertama dan belum ada default, category itu otomatis menjadi default
  - jika category default dihapus dari selected categories, default dipindah ke category terpilih pertama yang tersisa
  - jika selected categories kosong, `defaultCategoryId` dikosongkan

## Files Changed

- `client/src/pages/admin/ProductForm.jsx`
- `CODEx_REPORTS/TASK-23B.md`

## What Changed

### `client/src/pages/admin/ProductForm.jsx`

- mengganti state lama:
  - `categoryId`
  - `defaultCategoryId` single legacy
- menjadi state baru:
  - `categoryIds`
  - `defaultCategoryId`
- mengubah `CategoryTree` dari radio single-select menjadi checkbox multi-select hierarchy
- menambahkan helper sinkronisasi:
  - normalisasi `categoryIds`
  - resolver default category aman saat selection berubah
- memperbaiki prefill edit product:
  - membaca `product.categoryIds`
  - fallback ke `defaultCategoryId/categoryId` bila data lama belum lengkap
- memperbaiki payload submit create/update:
  - mengirim `categoryIds`
  - mengirim `defaultCategoryId`
  - tetap mengirim `categoryId` sebagai alias compatibility ke default category
- menambahkan guard UX:
  - submit ditolak jika belum ada selected category
  - submit ditolak jika default category tidak valid
  - field `Default Category` disable saat belum ada selected categories
  - opsi `Default Category` hanya berasal dari selected categories
- memperjelas selected categories di UI melalui chips dan helper copy

## Before vs After

- sebelum
  - category masih single-select
  - default category bisa memilih semua categories
  - edit prefill selalu memaksa `defaultCategoryId = categoryId`
  - frontend belum memakai `categoryIds`
- sesudah
  - category menjadi multi-select hierarchy
  - default category hanya berasal dari selected categories
  - edit prefill membaca `categoryIds + defaultCategoryId`
  - submit create/update mengirim contract baru backend
  - state default category otomatis dirapikan saat selected categories berubah

## End-to-End Verification

- add product -> PASS
  - payload frontend baru berhasil membuat product dengan `categoryIds=[1,2]` dan `defaultCategoryId=2`
- edit product -> PASS
  - update product berhasil menyimpan `categoryIds=[2]` dan `defaultCategoryId=2`
- default category sync -> PASS
  - payload/detail backend tetap konsisten dengan state form baru
- refresh/persist -> PASS
  - `GET /api/admin/products/:id` mengembalikan category data yang sama setelah create/update

## Regression Check

- product form hasil TASK-14 -> PASS
- price flow hasil TASK-13 -> PASS
- products list existing -> PASS
- backend contract TASK-23A -> PASS
- admin/store MVF umum -> PASS

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- temp Vite route check `/admin/products` -> PASS
  - verified on temporary client port `5180`
- backend persistence check dengan payload frontend baru -> PASS
  - create detail: `categoryIds=[1,2]`, `defaultCategoryId=2`
  - update detail: `categoryIds=[2]`, `defaultCategoryId=2`
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-113948/result.json`

## Notes

- Repo saat ini belum punya browser automation terpasang, jadi verifikasi UI interaktif penuh tidak dijalankan.
- Verifikasi task dilakukan dengan kombinasi:
  - build frontend
  - route runtime check
  - persistence check ke backend dengan payload yang sama seperti form baru

## Final Status

- `PASS`
