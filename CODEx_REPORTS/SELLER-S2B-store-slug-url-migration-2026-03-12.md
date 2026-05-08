# SELLER-S2B — Seller Workspace URL Migration: `storeId` -> `storeSlug`

## Goal
Menjadikan URL Seller Workspace canonical berbasis `Store.slug` tanpa memaksa refactor massal endpoint seller backend.

## Audit Summary
- Seller frontend sebelumnya memakai route `/seller/stores/:storeId` dan hampir semua page seller langsung meneruskan param route itu ke API.
- Seller backend masih sangat luas memakai `:storeId` pada route operasi (`orders`, `products`, `team`, `payment-profile`, `payment-review`).
- Mengubah seluruh endpoint seller backend ke slug dalam task ini akan melebar menjadi refactor lintas modul dan melanggar batasan task.

## Chosen Approach
Dipilih pendekatan hybrid yang paling minim risiko:

1. URL user-facing Seller Workspace sekarang canonical berbasis slug.
2. Seller frontend me-resolve workspace context dari slug lebih dulu.
3. Setelah context didapat, seluruh API internal seller tetap memakai `store.id`.
4. URL legacy numerik tetap diterima sementara, lalu di-redirect ringan ke slug canonical.

## Changes Applied
- Menambah helper route seller di frontend untuk path building, route param normalization, dan canonical redirect.
- Menambah endpoint context seller berbasis slug:
  - `GET /api/seller/stores/slug/:storeSlug/context`
- Menambah resolver backend `resolveSellerAccessBySlug(...)` yang tetap memakai source of truth tenancy yang sama.
- Mengubah route frontend seller dari `:storeId` ke `:storeSlug`.
- Mengubah `SellerLayout` agar:
  - menerima slug canonical
  - tetap menerima legacy numeric path
  - me-redirect numeric path ke slug canonical setelah context ter-resolve
- Mengubah seller pages agar tidak lagi memakai param route sebagai `storeId` API, tetapi memakai `sellerContext.store.id`.
- Mengubah internal navigation seller dan entry dari account invitation agar menghasilkan URL slug.

## Compatibility Notes
- Route legacy `/seller/stores/:numericId/...` tidak diputus.
- Compatibility ditangani di frontend layout, bukan dengan dual-routing backend yang rumit.
- Backend seller operasi lain tetap berbasis `storeId`, sehingga admin contract dan storefront flow tidak berubah.

## Intentionally Not Changed
- Tidak mengubah route backend seller selain context resolver.
- Tidak mengubah schema store atau slug generation.
- Tidak mengubah admin workspace contract.
- Tidak mengubah storefront/public route.
- Tidak menghapus compatibility path lama.

## Risks
- Sebagian copy teknis seller masih menyebut `storeId` sebagai tenant boundary internal karena memang backend operasi masih memakainya.
- Jika nanti ada seller module baru yang bypass `sellerContext.store.id` dan membaca route param langsung, pattern slug bisa drift lagi.
- Redirect compatibility bergantung pada context resolver berhasil dimuat lebih dulu.

## Verification
- `pnpm --filter server build` ✅
- `pnpm --filter client build` ✅
- `pnpm qa:mvf` ❌ masih gagal pada issue pre-existing:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - rule `QA-MONEY` menandai literal `"$1 $2"`
