# SELLER-S3A — Seller Product/Catalog Boundary Review

## Audit Verdict

### Visibility Boundary
Status: `aman`

- Seller catalog list aktif hanya lewat `GET /api/seller/stores/:storeId/products`
- Seller product detail aktif hanya lewat `GET /api/seller/stores/:storeId/products/:productId`
- Keduanya memakai `requireSellerStoreAccess(["PRODUCT_VIEW"])`
- Query backend memaksa `where: { storeId }`, jadi seller tidak bisa membaca product lintas store melalui lane aktif ini
- Setelah S2B, frontend seller memakai `sellerContext.store.id`, bukan route param slug langsung, jadi multi-store account tetap store-aware

### Action Boundary
Status: `aman dengan guardrail phase-1`

- Lane seller catalog aktif saat ini read-only
- Tidak ada create/edit/delete/publish mutation aktif di seller workspace route yang dipakai frontend saat ini
- Publish/status/pricing/inventory mutation tetap berada di domain admin / lane lain di luar seller workspace catalog aktif
- Ada file legacy `server/src/routes/sellerRoutes.ts` dengan edit/update/delete seller product, tetapi route itu tidak dimount di `server/src/app.ts`, jadi bukan lane aktif seller workspace

### Governance Boundary
Status: `rawan ringan -> diperbaiki`

Temuan sebelum hardening:
- Seller catalog dan product detail menampilkan mode read-only dari UI hardcoded, belum dari governance backend
- Serializer seller product masih mengirim `ownership.ownerUserId`, padahal field itu tidak dipakai di seller UI dan bukan kebutuhan read model seller

Perbaikan:
- Menambah governance metadata eksplisit di seller product list/detail:
  - `mode`
  - `roleCode`
  - `canCreate`
  - `canEdit`
  - `canDelete`
  - `canPublish`
  - `canManagePricing`
  - `canManageInventory`
  - `sourceOfTruth`
  - `note`
- Menghapus `ownership.ownerUserId` dari serializer seller product
- Seller catalog/detail sekarang membaca governance backend untuk menampilkan state read-only

### UX Boundary
Status: `aman dengan guardrail phase-1`

- Catalog page dan product detail page sudah native seller workspace, bukan lane account legacy
- Loading / error / forbidden state sudah konsisten dengan seller workspace
- Tidak ada CTA seller yang membuka edit/create lane yang belum resmi
- Read-only messaging sekarang lebih sinkron dengan backend governance

## Files Changed
- `server/src/routes/seller.products.ts`
- `client/src/api/sellerProducts.ts`
- `client/src/pages/seller/SellerCatalogPage.jsx`
- `client/src/pages/seller/SellerProductDetailPage.jsx`

## Intentionally Not Changed
- Tidak menambah seller product create/edit suite baru
- Tidak mengubah admin product contract
- Tidak mengubah storefront/public product flow
- Tidak mengubah schema/database product
- Tidak mengubah permission model lintas modul

## Verification
- `pnpm --filter server build` ✅
- `pnpm --filter client build` ✅
- `pnpm qa:mvf` ❌ pre-existing:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - `QA-MONEY` menandai literal `"$1 $2"`
