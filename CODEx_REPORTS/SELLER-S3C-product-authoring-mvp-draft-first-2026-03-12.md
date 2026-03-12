# SELLER-S3C — Seller Product Authoring MVP (Draft-First)

## Scope Verdict

- Tidak perlu STOP
- MVP draft-first bisa dibuka tanpa schema change
- Implementasi aman dilakukan dengan lane seller baru yang store-scoped dan field set sempit

## Governance Applied

### Write Boundary
Status: `aman dengan guardrail phase-1`

- Seller create draft aktif lewat `POST /api/seller/stores/:storeId/products/drafts`
- Seller edit draft aktif lewat `PATCH /api/seller/stores/:storeId/products/:productId/draft`
- Keduanya memakai `requireSellerStoreAccess(...)`
- Create butuh `PRODUCT_CREATE`
- Edit butuh `PRODUCT_EDIT`
- Backend tetap mengikat `storeId` dari route seller dan `userId` dari auth context, bukan dari payload frontend
- Edit hanya diizinkan untuk product `status = draft`

### Field Governance
Status: `aman dengan guardrail phase-1`

#### Seller-editable now
- `name`
- `description`
- `sku`

#### Seller-read-only now
- `slug`
- `categories`
- `defaultCategoryId`
- `price`
- `salePrice`
- `stock`
- `promoImagePath`
- `imagePaths`
- `videoPath`
- `tags`
- `status`
- `isPublished`
- `variations`
- `wholesale`
- `weight`
- `dimensions`
- `dangerousProduct`
- `preOrder`
- `preorderDays`
- `barcode`
- `gtin`
- `condition`
- `parentSku`
- `youtubeLink`

#### Admin-owned now
- `status`
- `isPublished`
- `storeId`
- `userId`
- `notes`

#### Deferred / not in MVP
- categories selection
- pricing
- inventory
- media upload
- notes/internal notes editing
- publish / unpublish
- archive / delete
- variations / wholesale
- moderation / approval

### State Governance
Status: `aman dengan guardrail phase-1`

- Create draft selalu menyimpan:
  - `status = draft`
  - `isPublished = false`
- Seller MVP tidak bisa memicu publish state transition
- Edit lane ditutup otomatis untuk product yang bukan draft

### UX Boundary
Status: `aman`

- Seller workspace sekarang punya page native:
  - create draft
  - edit draft
- Catalog CTA `Create Draft` hanya muncul bila governance backend mengizinkan
- Row action `Edit draft` hanya muncul untuk draft yang editable menurut backend
- Detail page juga hanya menampilkan CTA edit bila governance backend mengizinkan

## Files Changed

- `server/src/routes/seller.products.ts`
- `client/src/api/sellerProducts.ts`
- `client/src/utils/sellerWorkspaceRoute.js`
- `client/src/App.jsx`
- `client/src/pages/seller/SellerCatalogPage.jsx`
- `client/src/pages/seller/SellerProductDetailPage.jsx`
- `client/src/pages/seller/SellerProductAuthoringPage.jsx`

## Verification

- `pnpm --filter server build` ✅
- `pnpm --filter client build` ✅
- `pnpm qa:mvf` ❌ pre-existing:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - `QA-MONEY` menandai literal `"$1 $2"`

## Intentionally Not Changed

- Tidak membuka publish flow seller
- Tidak membuka price / salePrice editing
- Tidak membuka stock editing
- Tidak membuka categories/media authoring
- Tidak mengubah admin product contract
- Tidak mengubah storefront/public product flow
- Tidak mengaktifkan legacy seller write routes
- Tidak mengubah schema/database
