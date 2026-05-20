# P0-ADMIN-PRODUCT-APPROVAL-SMOKE-10 Report

## Ringkasan
Menambahkan regression assertion pada `smoke:product-visibility` untuk memastikan Admin approval pada seller product yang submitted tidak berubah menjadi auto-publish atau kembali menampilkan status `Submitted for review` di Seller list.

## File Diubah
- `server/src/scripts/smokeProductVisibility.ts`

## Coverage yang Ditambahkan
- Seller draft disubmit untuk review.
- Admin approve lewat `PATCH /api/admin/products/:id/published`.
- Response admin tetap memastikan:
  - `published = false`
  - `status = active`
  - `sellerSubmission.status = none`
- Seller list setelah approve sekarang juga memastikan:
  - item masih muncul di seller catalog,
  - label `Submitted for review` sudah hilang,
  - `submission.status = none`,
  - `status = active`,
  - `published = false`.
- Client visibility tetap dicek hidden sampai seller publish.

## Validasi
- `pnpm.cmd -F server build`: PASS.
- `pnpm.cmd -F server smoke:product-visibility`: percobaan pertama gagal transient `ECONNRESET`; rerun PASS penuh.
- `git diff --check -- server/src/scripts/smokeProductVisibility.ts`: PASS.

## Risiko Tersisa
- Smoke ini masih API-level, bukan browser UI-level. Action menu `Approve` di Admin Products sudah dilindungi oleh mutation behavior, tetapi visibilitas menu perlu dicek manual/UI test bila ingin coverage frontend penuh.
