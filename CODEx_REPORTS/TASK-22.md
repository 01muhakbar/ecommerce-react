# TASK-22

## Objective

Melakukan hardening operasional dan UX guard pada Coupons Admin agar flow add/edit, delete, publish/active toggle, dan search/filter lebih aman, jelas, dan tahan regresi tanpa mengubah backend, contract API, atau logic CRUD coupon secara luas.

## Audit Summary

### add/edit

- Drawer add/edit sudah memiliki disabled state dasar, tetapi page handler submit belum punya guard eksplisit terhadap double-trigger.
- Feedback sukses/gagal masih cukup generik.

### delete

- Delete modal sudah tersedia, tetapi copy konfirmasi masih terlalu generik dan belum menyebut konteks coupon, status aktif, atau masa berlaku.

### publish/active toggle

- Toggle active sudah mengunci row saat mutation berjalan, tetapi belum memberi feedback sukses yang spesifik.
- Error toggle masih berbagi jalur dengan error delete.

### search/filter

- Empty state search sudah lebih baik, tetapi apply/reset belum memberi feedback ringan.
- Bulk action tanpa selection masih hanya diam jika terpanggil dari handler.

## Selected Hardening Scope

- Guard eksplisit untuk create/update submit di page handler
- Notice success/error yang lebih spesifik untuk operasi coupons
- Delete confirmation context yang menyebut coupon/code/status/validity
- Search/reset dan no-selection feedback yang lebih jelas

## Files Changed

- `client/src/pages/admin/AdminCouponsPage.jsx`
- `CODEx_REPORTS/TASK-22.md`

## What Changed

### `client/src/pages/admin/AdminCouponsPage.jsx`

- Mengubah notice menjadi success/error notice object agar feedback aksi lebih jelas.
- Menambahkan guard eksplisit di `handleCreateSubmit` dan `handleUpdateSubmit` untuk mencegah double-trigger saat mutation masih berjalan.
- Menahan close drawer saat create/update masih berjalan.
- Menambahkan feedback ringan pada apply/reset filter.
- Memperjelas delete modal context untuk single dan bulk delete dengan detail coupon, status aktif, dan masa berlaku.
- Menambahkan no-selection guard yang eksplisit untuk bulk action dan bulk delete.
- Menambahkan feedback sukses spesifik untuk toggle active/publish.
- Memisahkan error operasional umum dari error delete modal agar pesan lebih tepat konteks.

## Before vs After

- Sebelum:
  - submit page handler masih bisa dipanggil ulang selama mutation belum selesai
  - delete confirmation terlalu generik
  - toggle active tidak memberi feedback sukses yang jelas
  - bulk action tanpa selection tidak memberi arahan
- Sesudah:
  - submit create/update lebih aman dari double-trigger
  - delete confirmation lebih jelas dan menyebut konteks coupon
  - toggle active memberi feedback sukses yang spesifik
  - search/reset dan bulk action guard lebih mudah dipahami admin

## End-to-End Verification

- `add/edit` -> PASS
  - add coupon sukses
  - edit coupon sukses
  - submit guard tetap aman
- `delete` -> PASS
  - delete confirmation lebih jelas
  - hasil delete persist setelah refresh
- `publish/active toggle` -> PASS
  - toggle sukses
  - feedback lebih jelas
  - persist setelah refresh
- `search/filter/reset` -> PASS
  - search valid berhasil
  - no-result state jelas
  - reset kembali aman
- `refresh/persist` -> PASS

## Regression Check

- coupons list render -> PASS
- add/edit form hasil TASK-21 -> PASS
- validity/status display -> PASS
- admin navigation -> PASS
- admin/store MVF smoke -> PASS

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- coupons API verification -> PASS
- create/toggle/list/delete coupon spot-check -> PASS
- `/admin/coupons` route check -> PASS (`200`)
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-103130/result.json`

Coupons API spot-check:

- `coupon_id=2`
- `list_matches=1`
- `toggle_active=False`

## Final Status

PASS
