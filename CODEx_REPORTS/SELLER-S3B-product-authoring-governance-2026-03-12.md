# SELLER-S3B — Seller Product Authoring Governance

## Audit Verdict

### Write Boundary
Status: `aman dengan guardrail phase-1`

- Seller workspace product lane aktif saat ini masih read-only
- Route aktif seller product hanya:
  - `GET /api/seller/stores/:storeId/products`
  - `GET /api/seller/stores/:storeId/products/:productId`
- Keduanya memakai `requireSellerStoreAccess(["PRODUCT_VIEW"])` dan query `Product.storeId`
- Repo masih punya jejak write lane legacy di `server/src/routes/sellerRoutes.ts` dan `server/src/controllers/productController.ts`
- Jejak legacy itu tidak dimount di `server/src/app.ts`, jadi bukan lane aktif seller workspace
- Permission map seller memang sudah menyiapkan permission write seperti `PRODUCT_CREATE`, `PRODUCT_EDIT`, `PRODUCT_PUBLISH`, `PRODUCT_ARCHIVE`, `PRODUCT_MEDIA_MANAGE`, `PRODUCT_VARIANT_MANAGE`, dan `INVENTORY_MANAGE`, tetapi belum ada contract write seller workspace aktif yang menggunakannya

### Field Governance
Status: `rawan ringan -> dipetakan dan diperjelas`

#### Seller-editable
- Belum ada field editable pada lane aktif seller workspace saat ini

#### Seller-read-only
- `name`
- `slug`
- `description`
- `notes`
- `images`
- `video`
- `categories`
- `tags`
- `price`
- `salePrice`
- `stock`
- `sku`
- `variations`
- `wholesale`
- `weight`
- `dimensions`
- `condition`
- `dangerousProduct`
- `youtubeLink`
- `parentSku`
- `barcode`
- `gtin`
- `preOrder`
- `preorderDays`

#### Admin-owned / backend-owned
- `status`
- `isPublished`
- publish visibility terhadap storefront
- delete / archive operational lane
- `storeId`
- ownership / tenant binding

#### Belum jelas / butuh keputusan sebelum phase-1
- apakah seller boleh mengubah `categories`
- apakah `notes` aman untuk seller atau harus dipisah dari internal notes admin
- apakah `price` dan `salePrice` seller-owned atau tetap perlu admin governance
- apakah `stock` dibuka bersama pricing atau dipisah sebagai lane inventory
- apakah `variations`, `wholesale`, dan media dibuka pada phase yang sama atau bertahap

### Action Governance
Status: `rawan ringan`

#### Active now
- read catalog
- read product detail

#### Not active in current seller workspace
- create draft
- edit own product
- submit for review
- publish langsung
- unpublish
- archive
- delete
- edit price
- edit stock

#### Recommendation
- Phase-1 paling aman adalah `draft-first` dengan field set terbatas dan semua status/publish transition tetap backend-owned
- Jangan membuka publish, archive, delete, atau moderation transition di seller workspace phase-1

### State / Status Governance
Status: `rawan ringan -> diperjelas`

- Status yang terlihat di repo saat ini: `draft`, `active`, `inactive`
- Publish flag masih terpisah di `Product.isPublished`
- Visibilitas storefront tetap ditentukan oleh kombinasi `isPublished === true` dan `status === active`
- Seller workspace saat ini belum punya write contract untuk state transition product
- Governance response seller sekarang menegaskan:
  - authoring phase: `INACTIVE`
  - recommended phase-1: `DRAFT_FIRST_LIMITED_FIELDS`
  - seller state transitions active: `false`
  - publish flag: `admin-owned`

### UX Boundary
Status: `aman dengan guardrail phase-1`

- Catalog page dan product detail page seller sudah native workspace
- UI seller sekarang membaca governance backend eksplisit untuk mode authoring, bukan hanya badge hardcoded
- Tidak ada CTA write seller yang dibuka secara diam-diam
- Read-only notice sekarang menjelaskan bahwa write lane legacy ada di repo tetapi tidak aktif

## Hardening Applied

- Menambah governance metadata seller product untuk authoring lane:
  - `authoring.phase`
  - `authoring.phaseLabel`
  - `authoring.writeLaneActive`
  - `authoring.recommendedPhase1`
  - `authoring.legacySellerRoutesPresent`
  - `authoring.legacySellerRoutesMounted`
  - `authoring.note`
- Menambah metadata status governance:
  - `statusGovernance.productStatuses`
  - `statusGovernance.publishFlag`
  - `statusGovernance.sellerStateTransitionsActive`
  - `statusGovernance.note`
- Client seller product API sekarang menormalisasi governance authoring/status
- Seller catalog/detail page sekarang menampilkan source-of-truth governance authoring dari backend

## Recommended Safe Phase-1

- Tambah write lane seller hanya untuk `create draft` dan `edit own draft`
- Tetap store-scoped lewat `Product.storeId`
- Field awal yang paling aman dibuka:
  - `name`
  - `description`
  - media terbatas
  - `sku`
  - `stock` atau inventory, jika diputuskan seller-owned
- Tahan dulu field/state berikut sampai governance lebih jelas:
  - `status`
  - `isPublished`
  - archive/delete
  - moderation / approval
  - featured / highlight / promo flags
  - ownership binding

## Files Changed
- `server/src/routes/seller.products.ts`
- `client/src/api/sellerProducts.ts`
- `client/src/pages/seller/SellerCatalogPage.jsx`
- `client/src/pages/seller/SellerProductDetailPage.jsx`

## Intentionally Not Changed
- Tidak membangun full seller product create page
- Tidak membangun full seller product edit form
- Tidak mengubah admin product contract
- Tidak mengubah storefront/public product flow
- Tidak mengubah schema/database product
- Tidak mengaktifkan legacy seller write routes
- Tidak mengubah permission model lintas modul

## Verification
- `pnpm --filter server build` ✅
- `pnpm --filter client build` ✅
- `pnpm qa:mvf` ❌ pre-existing:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - `QA-MONEY` menandai literal `"$1 $2"`
