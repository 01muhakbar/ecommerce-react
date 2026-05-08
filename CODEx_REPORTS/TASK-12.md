# TASK-12 - Admin Products Parity Audit + Polish Prioritas Tinggi

## Objective

Meningkatkan parity UI/UX halaman Products Admin agar lebih dekat ke arah Dashtar pada area operasional paling penting, tanpa mengubah backend, contract API, atau logic CRUD produk.

## Audited Page

- `client/src/pages/admin/Products.jsx`

## Key Parity Gaps

- Header dan filter area masih fungsional, tetapi belum cukup layered untuk kerja admin harian.
- Product rows sudah lengkap secara data, tetapi hierarchy nama, category, price, stock, dan action belum cukup cepat dipindai.

## Selected Polish Areas

1. `Header/filter rhythm + action clarity`
2. `Product row hierarchy + price/category/status emphasis`

## Files Changed

- `client/src/pages/admin/Products.jsx`

## What Changed

### 1. Header / Filter Rhythm

- Menambahkan chips ringkas pada hero header untuk `Catalog Workspace`, jumlah selected item, dan posisi page.
- Menambahkan subheader `Product Controls` agar area search/filter/actions lebih terasa seperti control panel.
- Menambahkan label kecil di atas search, select, dan tombol apply/reset agar ritme visual lebih jelas.
- Menambahkan hint `Quick actions` untuk kelompok tombol kanan.

### 2. Product Row Readability

- Menambahkan `ProductCategoryBadge` agar category lebih cepat terbaca.
- Menambahkan metadata row di product name: slug, `SKU #id`, dan chip `On sale`.
- Memperjelas hierarchy price dengan base/original price dan sale helper text.
- Menambahkan stock meta `In stock / Low stock / Out of stock`.
- Menambahkan helper text `Quick edit` di kolom action.

## Before vs After

- Sebelum: halaman products rapi, tetapi terasa seperti tabel CRUD generik.
- Sesudah: control area lebih jelas, row produk lebih cepat dipindai, dan hierarchy informasi lebih dekat ke pola Dashtar.

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260307-083716/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260307-083716/summary.txt`
- Spot-check direct route `http://127.0.0.1:5173/admin/products` sesudah QA tidak bisa dipakai sebagai bukti runtime karena tidak ada dev server persisten di port itu pada akhir run.

## MVF Impact

- Admin login -> PASS
- Dashboard -> PASS
- Orders list -> PASS
- Order detail -> PASS
- Update status -> PASS
- Persist after refresh -> PASS
- Store MVF smoke tetap PASS

## Risks / Follow-up

- Halaman ini masih single-file; parity lebih dalam pada products table atau bulk toolbar sebaiknya tetap dipisah sebagai task terpisah.
- Preview drawer dan product form belum dipoles di task ini.
- Kandidat aman berikutnya: `Product form parity polish` atau `Categories admin parity polish`.

## Final Status

PASS
