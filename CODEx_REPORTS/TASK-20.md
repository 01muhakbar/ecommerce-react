# TASK-20

## Objective

Meningkatkan parity UI/UX halaman Coupons Admin agar lebih dekat ke Dashtar pada area dengan dampak visual dan operasional tertinggi, tanpa mengubah backend, contract API, atau logic CRUD coupon/promosi.

## Audited Page

- `client/src/pages/admin/AdminCouponsPage.jsx`

## Key Parity Gaps

- Header/filter area masih terlalu utilitarian dan belum terasa seperti admin control panel.
- Hierarchy informasi coupon row belum cukup kuat untuk membaca campaign, discount type, minimum order, validitas, dan status secara cepat.
- Kolom published, status, dan date range masih benar secara data, tetapi belum cukup tegas secara scanability.

## Selected Polish Areas

- `Header/filter rhythm + control context`
- `Coupon row hierarchy + discount/validity/status emphasis`

## Files Changed

- `client/src/pages/admin/AdminCouponsPage.jsx`
- `CODEx_REPORTS/TASK-20.md`

## What Changed

### `client/src/pages/admin/AdminCouponsPage.jsx`

- Menambahkan blok `Promotion Controls` di atas area search/action agar header terasa lebih dekat ke control panel admin Dashtar.
- Menambahkan context chips untuk `Visible now`, `Selected`, dan `Active filters`.
- Menambahkan label kecil `Search promotion` dan `Quick actions` agar ritme area filter/action lebih konsisten dengan halaman admin lain yang sudah dipoles.
- Menambahkan `CouponDiscountTypeBadge` untuk membedakan coupon percent vs fixed amount secara cepat.
- Memperkuat hierarchy row:
  - campaign name + code context
  - minimum order helper di kolom code
  - discount helper text
  - publish helper text
  - start/end date helper label
  - status helper text
  - action helper text
- Memperjelas empty state ketika hasil search tidak menemukan coupon apa pun.

## Before vs After

- Sebelum:
  - halaman coupons rapi tetapi masih terasa seperti tabel CRUD biasa
  - discount, status, dan validity tersebar tanpa hierarchy yang cukup tegas
  - header action belum cukup memberi konteks kerja admin
- Sesudah:
  - area atas terasa lebih seperti admin promotion workspace
  - row coupons lebih cepat dipindai untuk nilai diskon, syarat minimum order, status, dan tanggal aktif
  - empty state search lebih jelas

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `/admin/coupons` route check -> PASS (`200`)
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-101222/result.json`

## MVF Impact

- Admin login -> PASS
- Dashboard -> PASS
- Orders list -> PASS
- Order detail -> PASS
- Update status -> PASS
- Coupons page -> PASS
- Store MVF smoke tetap PASS

## Final Status

PASS
