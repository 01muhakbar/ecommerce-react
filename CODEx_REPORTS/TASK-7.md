# TASK-7 - Admin MVF Parity Audit + Polish Prioritas Tinggi pada Orders Flow

## Task ID

`TASK-7`

## Objective

Melakukan audit parity pada flow Orders Admin dan memoles area dengan ROI tertinggi agar lebih dekat ke arah Dashtar, tanpa mengubah backend, contract API, atau logic update status order.

## Audited Pages

- `client/src/pages/admin/Orders.jsx`
- `client/src/pages/admin/OrderDetail.jsx`
- Fokus route:
  - `/admin/orders`
  - `/admin/orders/:invoiceNo`

## Key Parity Gaps

1. `Orders list readability`
   - Tabel sudah lengkap, tetapi status/action area masih terasa seperti utilitas murni.
   - Row belum cukup membantu admin membaca invoice, status, dan aksi secara cepat seperti gaya Dashtar.

2. `Order detail action grouping`
   - Header detail sudah informatif, tetapi belum cukup memberi guidance operasional.
   - Panel update status belum terasa sebagai action area utama.

## Selected Polish Areas

1. `Orders list row/action hierarchy + status clarity`
2. `Order detail hero/summary grouping + update-status clarity`

## Files Changed

- `client/src/pages/admin/Orders.jsx`
- `client/src/pages/admin/OrderDetail.jsx`
- `CODEx_REPORTS/TASK-7.md`

## What Changed

### `client/src/pages/admin/Orders.jsx`

- Menambahkan helper note kecil di kolom invoice.
- Menambahkan status helper text di bawah badge status.
- Menambahkan label `Quick Update` pada area select status per row agar action lebih jelas secara operasional.

### `client/src/pages/admin/OrderDetail.jsx`

- Memperkuat hero/header detail dengan guidance card berbasis status saat ini.
- Menambahkan helper text status pada card `Current Status`.
- Memperjelas panel `Update Status` sebagai `Action Panel` dengan explanatory copy singkat.

## Before vs After

### Before

- Orders list sudah fungsional tetapi masih terasa seperti tabel CRUD biasa.
- Order detail punya data lengkap, tetapi guidance operasional dan next action belum cukup menonjol.

### After

- Orders list lebih cepat dipindai untuk invoice, status, dan action update.
- Order detail lebih terasa seperti halaman operasional admin: status sekarang, guidance, lalu panel aksi yang jelas.

## Verification Run

1. `pnpm --filter client exec vite build`
   - PASS
2. `pnpm qa:mvf`
   - PASS
3. QA artifact:
   - `.codex-artifacts/qa-mvf/20260306-222319/result.json`
   - `.codex-artifacts/qa-mvf/20260306-222319/summary.txt`

## MVF Impact

- Admin login: PASS
- Orders list: PASS
- Order detail: PASS
- Update status: PASS
- Persist after refresh: PASS
- Store MVF smoke tetap PASS

## Risks / Follow-up

- Orders table masih tetap dense karena data dan actions berada dalam satu grid tabel; itu sengaja dipertahankan agar scope tidak melebar ke redesign besar.
- Order detail summary cards masih bisa dipoles lebih dekat ke Dashtar jika nanti ingin meningkatkan visual density dan card rhythm.
- Kandidat task berikutnya yang aman: admin dashboard/topbar parity atau orders filter/header polish lanjutan.

## Recommended Next Task

`[TASK-8] Admin Dashboard Parity Polish - Top Summary + Table Rhythm`

## Final Status

`PASS`
