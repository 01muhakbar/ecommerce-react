# SELLER-S2C — Seller Workspace Route Canonical Guardrail

## Canonical Pattern
- User-facing Seller Workspace URL resmi: `Store.slug`
- Internal seller operational boundary: `Store.id`
- Resolution flow: `storeSlug -> seller workspace context -> store.id`
- Link generation user-facing: wajib lewat helper route seller terpusat

## Audit Classification

### Sudah canonical
- Route utama seller di frontend sudah memakai `:storeSlug`
- Seller layout sudah resolve context dari slug dan redirect legacy numeric ke slug canonical
- Seller API internal tetap memakai `storeId` dari seller context

### Hardcoded kecil yang dirapikan
- Beberapa page seller masih menyusun suffix route sendiri lewat helper generik:
  - catalog detail
  - orders detail
  - payment review -> order detail
  - team -> member lifecycle
  - back links ke orders/catalog/team
- Entry dari account invitation masih membentuk home route seller secara langsung
- Sidebar seller masih menyusun tiap lane dari helper path generik

### Area yang dibiarkan
- API seller internal masih string endpoint berbasis `storeId` karena itu boundary operasional resmi dan bukan scope task ini
- Route definition di `App.jsx` tetap eksplisit

## Changes Applied
- Menambah route map helper di `client/src/utils/sellerWorkspaceRoute.js`
  - `home`
  - `profile`
  - `catalog`
  - `productDetail`
  - `orders`
  - `orderDetail`
  - `paymentReview`
  - `paymentProfile`
  - `team`
  - `teamAudit`
  - `memberLifecycle`
- Menambah resolver route param helper agar store object dengan `slug` menjadi input utama, dengan fallback compatibility ke `id` hanya jika slug belum tersedia
- Mengubah seller layout/sidebar untuk memakai route map helper, bukan suffix string tersebar
- Mengubah CTA seller utama dan entry invitation account untuk memakai helper canonical route

## Why This Matters
- Mengurangi peluang modul baru kembali menulis `/seller/stores/${storeId}` di layer user-facing
- Menurunkan drift karena call site tidak lagi menyusun suffix route sendiri
- Menjaga pemisahan yang jelas antara slug sebagai identitas URL dan id sebagai identitas operasional

## Intentionally Not Changed
- Tidak menghapus compatibility numeric path lama
- Tidak mengubah backend seller route selain yang sudah ada dari S2B
- Tidak mengubah admin/storefront
- Tidak menambah abstraction router besar di luar kebutuhan seller workspace

## Verification
- `pnpm --filter client build` ✅
- `pnpm qa:mvf` ❌ gagal pada issue pre-existing yang sama:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - `QA-MONEY` menandai literal `"$1 $2"`
