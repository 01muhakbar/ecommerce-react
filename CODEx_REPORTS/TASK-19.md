# TASK-19

## Objective

Melakukan hardening operasional dan UX guard pada Categories Admin agar flow add/edit, delete, publish, dan search/filter lebih aman, jelas, dan tahan regresi tanpa mengubah backend, contract API, atau logic CRUD categories secara luas.

## Audit Summary

### add/edit

- Tombol submit sudah punya disabled state dasar, tetapi `handleSubmit` belum punya guard eksplisit terhadap double-trigger saat request atau upload sedang berjalan.
- Feedback sukses/gagal masih generik dan belum dibedakan secara tegas dari notice error lainnya.

### delete

- Delete confirmation masih terlalu singkat.
- Konteks parent-child category belum ikut tampil saat admin menghapus row tertentu.

### publish/unpublish

- Toggle publish memakai mutation update form yang sama, sehingga feedback status terlalu generik.
- Tidak ada pending state per row untuk toggle visibility.

### search/filter

- Empty state belum membedakan data benar-benar kosong dengan hasil filter yang tidak cocok.
- No-result state belum memberi arahan yang cukup jelas untuk reset atau menambah category baru.

## Selected Hardening Scope

- Guard eksplisit untuk submit form saat save/upload masih berjalan
- Delete confirmation dengan context parent-child yang lebih jelas
- Publish/unpublish feedback yang spesifik + pending state per row
- Empty/no-result state yang membedakan filtered result vs empty dataset

## Files Changed

- `client/src/pages/admin/AdminCategoriesPage.jsx`
- `CODEx_REPORTS/TASK-19.md`

## What Changed

### `client/src/pages/admin/AdminCategoriesPage.jsx`

- Mengubah notice menjadi notice object (`success` / `error`) agar feedback aksi lebih jelas.
- Menambahkan helper `showNotice()` supaya feedback sukses/gagal tetap konsisten.
- Menambahkan `isFormBusy` dan guard eksplisit di `handleSubmit` agar submit add/edit tidak double-trigger saat save atau upload image sedang berjalan.
- Menambahkan `publishMutation` terpisah dari form update agar toggle publish/unpublish punya feedback spesifik dan pending state per row.
- Menambahkan state `publishingCategoryId`, `deletingCategoryId`, dan `deletingCategoryName` untuk mengunci row action yang sedang berjalan.
- Menambahkan `handleDeleteCategory()` dengan confirmation copy yang menyebut context parent-child sebelum delete.
- Memperjelas bulk delete guard untuk kondisi no-selection dan copy confirmation berdasarkan scope aktif.
- Memperjelas empty state menjadi:
  - no results karena search/filter
  - dataset masih kosong
  - child category kosong di bawah parent tertentu
- Mengubah label CTA submit menjadi `Saving...` / `Creating...` saat request berjalan.

## Before vs After

- Sebelum:
  - submit form bisa masuk ke handler lagi sebelum request selesai
  - publish/unpublish hanya menghasilkan feedback update umum
  - delete confirmation belum cukup memberi konteks hierarchy
  - empty state tidak membedakan no-result vs empty dataset
- Sesudah:
  - submit form aman dari double-trigger
  - publish/unpublish memberi feedback status yang spesifik dan row yang aktif terkunci sementara
  - delete confirmation lebih jelas untuk parent/child category
  - empty/search state lebih jujur dan lebih mudah dipahami admin

## End-to-End Verification

- `add/edit` -> PASS
  - open add/edit drawer normal
  - submit state berubah ke loading label
  - refresh/persist tetap benar
- `delete` -> PASS
  - confirmation copy menampilkan konteks yang lebih jelas
  - hasil delete tetap persist setelah refresh
- `publish/unpublish` -> PASS
  - toggle memberi feedback spesifik
  - row status terkunci saat update berjalan
  - hasil persist setelah refresh
- `search/filter/reset` -> PASS
  - no-result state jelas
  - reset kembali ke full list dengan aman
- `refresh/persist` -> PASS

API spot-check after patch:

- create category -> PASS (`create_id=9`)
- update publish state -> PASS (`published_after_update=False`)
- search by name before delete -> PASS (`count=1`)
- search by name after delete -> PASS (`count=0`)

## Regression Check

- categories list render -> PASS
- add/edit form hasil TASK-18 -> PASS
- parent-child relation display -> PASS
- admin navigation -> PASS
- admin/store MVF smoke -> PASS

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- categories API verification -> PASS
- `/admin/categories` route check -> PASS (`200`)
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-101222/result.json`

## Final Status

PASS
