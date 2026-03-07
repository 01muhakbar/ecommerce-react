# TASK-21

## Objective

Meningkatkan parity UI/UX Add/Edit Coupon Form agar lebih dekat ke Dashtar pada area dengan dampak visual dan operasional tertinggi, tanpa mengubah backend, contract API, atau logic CRUD coupon/promosi.

## Audited Component

- `client/src/components/admin/coupons/AddCouponDrawer.jsx`
- `client/src/components/admin/coupons/EditCouponDrawer.jsx`

## Key Parity Gaps

- Header drawer masih cukup tipis untuk menunjukkan mode add/edit dan konteks promo yang sedang dikerjakan.
- Grouping `discount/value/minimum order` dan `validity/publish` sudah ada, tetapi belum cukup terasa sebagai panel keputusan operasional.
- Footer CTA masih fungsional, tetapi belum cukup dominan sebagai action area penutup.

## Selected Polish Areas

- `Header context + meta rhythm`
- `Discount/validity/status grouping + footer CTA clarity`

## Files Changed

- `client/src/components/admin/coupons/AddCouponDrawer.jsx`
- `client/src/components/admin/coupons/EditCouponDrawer.jsx`
- `CODEx_REPORTS/TASK-21.md`

## What Changed

### `client/src/components/admin/coupons/AddCouponDrawer.jsx`

- Menambahkan `CouponDrawerSectionHeader` untuk hierarchy section yang lebih konsisten.
- Memperkuat header drawer dengan chips mode, mode diskon, dan publish state.
- Memperjelas section `Basic Info`, `Discount Setup`, dan `Validity` dengan helper text dan meta chips.
- Menambahkan helper panel kecil di section discount dan summary chips di validity.
- Memperkuat footer menjadi action panel dengan summary campaign singkat dan CTA yang lebih jelas.

### `client/src/components/admin/coupons/EditCouponDrawer.jsx`

- Menambahkan `CouponDrawerSectionHeader` agar hierarchy section konsisten dengan add drawer.
- Memperkuat header edit dengan chips mode, code, dan visibility state.
- Memperjelas section `Basic Info`, `Validity`, dan `Discount Setup` dengan helper copy dan meta chips.
- Menambahkan summary chips untuk start/end/publish state serta helper panel di discount section.
- Memperkuat footer menjadi action panel dengan summary update campaign dan CTA yang lebih dominan.

## Before vs After

- Sebelum:
  - drawer coupon sudah rapi tetapi masih terasa seperti form utilitarian
  - konteks promo aktif belum cukup kuat di header
  - discount/value dan validity controls belum cukup tegas secara hierarchy
  - CTA footer masih generik
- Sesudah:
  - drawer lebih terasa seperti admin promotion control panel
  - mode add/edit dan status campaign lebih cepat terbaca
  - grouping discount dan validity lebih jelas untuk review operasional
  - footer action lebih dominan dan terarah

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- coupons API verification -> PASS
- create/update/list/delete coupon spot-check -> PASS
- `/admin/coupons` route check -> PASS (`200`)
- `pnpm qa:mvf` -> PASS
  - artifact: `.codex-artifacts/qa-mvf/20260307-102455/result.json`

## Regression Check

- coupons list -> PASS
- add/edit form render -> PASS
- update submit contract -> PASS
- status/validity controls -> PASS
- refresh/persist -> PASS

Coupons API spot-check:

- `coupon_id=1`
- `list_matches=1`
- `updated_type=fixed`
- `updated_amount=25000`
- `updated_active=False`

## Final Status

PASS
