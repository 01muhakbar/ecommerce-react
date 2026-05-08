# TASK-14 - Admin Product Form / Drawer Parity Audit + Polish Prioritas Tinggi

## Objective

Meningkatkan parity UI/UX Add/Edit Product Form agar lebih dekat ke arah Dashtar pada area dengan dampak visual dan operasional tertinggi, tanpa mengubah backend, contract API, atau logic CRUD produk.

## Audited Component

- `client/src/pages/admin/ProductForm.jsx`
- `client/src/pages/admin/ProductPreviewDrawer.jsx`

## Key Parity Gaps

- Header form masih terlalu tipis untuk konteks add/edit yang sering dipakai admin.
- Section cards sudah rapi, tetapi hierarchy antar section belum cukup terasa seperti control panel.
- Footer CTA masih fungsional, namun belum cukup kuat sebagai area keputusan akhir.

## Selected Polish Areas

1. `Header context + meta summary rhythm`
2. `Section hierarchy + sticky CTA clarity`

## Files Changed

- `client/src/pages/admin/ProductForm.jsx`

## What Changed

### 1. Header Context

- Menambahkan chips ringkas pada header untuk mode form, kategori aktif, dan jumlah media.
- Mempertahankan breadcrumb dan title existing, tetapi menambahkan context row agar orientasi add/edit lebih cepat terbaca.

### 2. Section Hierarchy

- Menambahkan helper `SectionHeader` untuk memberi eyebrow, title, description, dan meta chip di setiap section utama.
- Menguatkan visual grouping untuk section:
  - Basic Info
  - Category
  - Pricing
  - Inventory
  - Images
  - Metadata

### 3. CTA Footer

- Footer dibuat lebih jelas sebagai final action bar dengan label konteks dan helper summary.
- CTA submit diberi emphasis visual yang lebih kuat, sementara tombol cancel tetap konsisten.

## Before vs After

- Sebelum: form terasa utilitarian dan semua section punya bobot visual yang hampir sama.
- Sesudah: form lebih terasa seperti admin control panel, header lebih informatif, section lebih terstruktur, dan footer action lebih jelas.

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260307-091433/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260307-091433/summary.txt`

### Products flow spot-check

- create/detail -> PASS
- edit/update detail -> PASS
- list after update -> PASS

Validation sample after patch:

- create detail:
  - `price = 175000`
  - `salePrice = 141000`
- update detail:
  - `price = 226000`
  - `salePrice = 189000`
- list after update:
  - `price = 226000`
  - `salePrice = 189000`

## Regression Check

- products list -> PASS
- add/edit form compile -> PASS
- update submit contract -> PASS
- price sync from TASK-13 -> PASS
- refresh/persist via detail/list refetch -> PASS

## Final Status

PASS
