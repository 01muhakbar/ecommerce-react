# TASK-16

## Objective

Melakukan hardening operasional dan UX guard untuk `Export`, `Import`, dan `Bulk Action` pada Admin Products agar flow lebih aman, lebih jelas untuk admin, dan lebih tahan regresi tanpa mengubah arsitektur products module.

## Audit Summary

- `Export`
  - Sudah punya loading state dasar.
  - Sudah punya feedback sukses/gagal.
  - Gap: tombol belum mengunci terhadap operasi admin products lain yang sedang berjalan.
- `Import`
  - Sudah punya upload flow aktif dan summary backend dasar.
  - Gap: frontend belum memvalidasi file JSON secara eksplisit.
  - Gap: summary hasil import masih satu baris, belum cukup jelas untuk `totalRows`, preview error, dan jumlah error tambahan.
- `Bulk Action`
  - Sudah punya selected rows, dropdown action, dan confirm modal untuk delete.
  - Gap: bulk dropdown masih bisa dibuka tanpa selection.
  - Gap: no-selection guard masih implicit lewat `disabled`, belum ada feedback eksplisit.
  - Gap: destructive confirmation belum menampilkan jumlah item yang akan dihapus.

## Selected Hardening Scope

- Tambah operation lock untuk export/import/bulk/delete agar tidak double-trigger lintas aksi.
- Tambah validasi file import minimum:
  - harus JSON
  - tidak boleh kosong
  - maksimal 2 MB
- Perjelas import summary:
  - `totalRows`
  - `created`
  - `updated`
  - `failed`
  - preview beberapa row error
- Tambah guard eksplisit untuk bulk action tanpa selection.
- Perjelas copy konfirmasi bulk delete dengan jumlah produk yang terdampak.

## Files Changed

- `client/src/pages/admin/Products.jsx`
- `CODEx_REPORTS/TASK-16.md`

## What Changed

### `client/src/pages/admin/Products.jsx`

- Menambahkan `isOperationsBusy` untuk mengunci tombol operasional penting saat export/import/bulk/delete sedang berjalan.
- Menambahkan validasi import file sebelum upload:
  - hanya menerima JSON
  - file kosong ditolak
  - file di atas 2 MB ditolak
- Mengubah notice operasional menjadi lebih kaya:
  - `title`
  - `message`
  - `details`
  - `meta`
- Menambahkan preview error import sampai 3 row pertama, plus ringkasan error tambahan bila ada.
- Menambahkan guard eksplisit saat admin membuka bulk menu tanpa selection.
- Menambahkan guard eksplisit saat bulk action atau bulk delete dipanggil tanpa selection.
- Memperjelas confirmation copy bulk delete dengan jumlah item yang akan dihapus.

## Before vs After

- Sebelum:
  - import file invalid baru gagal setelah request ke backend
  - summary import kurang informatif
  - bulk action no-selection mostly hanya diamankan oleh disabled state
  - destructive modal bulk delete masih generik
- Sesudah:
  - file import invalid ditolak lebih awal dengan feedback jelas
  - hasil import lebih mudah dipahami oleh admin
  - bulk action memberi guard eksplisit saat belum ada selection
  - action penting saling mengunci saat request berjalan
  - bulk delete confirmation lebih jelas dan spesifik

## End-to-End Verification

- `Export`
  - PASS
  - JSON export tetap terunduh dan payload valid
- `Import valid`
  - PASS
  - create via import berhasil
  - update via import slug yang sama berhasil
- `Import invalid`
  - PASS
  - backend invalid JSON mengembalikan `400`
  - frontend sekarang juga punya guard awal untuk file non-JSON / kosong / terlalu besar
- `Bulk action no-selection`
  - PASS
  - halaman sekarang punya guard eksplisit dan tidak membuka flow bulk saat selection kosong
- `Bulk publish/unpublish/delete`
  - PASS
  - semua tetap berjalan dan persist
- `Refresh / persist`
  - PASS
  - hasil bulk/import tetap konsisten setelah refetch

## Regression Check

- products page load -> PASS
- `/admin/products` dev route -> PASS (`200`)
- search/filter products -> PASS
- add/edit form flow -> PASS
- price sync hasil TASK-13 -> PASS
- export/import MVP hasil TASK-15 -> PASS
- admin/store MVF -> PASS

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- API verification script -> PASS
  - export JSON valid
  - invalid import -> `400`
  - valid import create/update -> PASS
  - bulk publish/unpublish/delete -> PASS
- `/admin/products` route check -> PASS
  - `http://localhost:5173/admin/products`
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-094650/result.json`

## Final Status

PASS
