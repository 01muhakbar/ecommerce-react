# SELLER-S4B — Seller Add Product Media/Inventory Hardening

## Goal
Open the smallest safe seller-native media lane for draft authoring and harden the phase-2 commerce fields introduced in S4A.

## Repo audit before coding
- Seller product authoring and governance:
  - `server/src/routes/seller.products.ts`
  - `client/src/api/sellerProducts.ts`
  - `client/src/pages/seller/SellerProductAuthoringPage.jsx`
  - `client/src/pages/seller/SellerProductDetailPage.jsx`
  - `client/src/pages/seller/SellerCatalogPage.jsx`
- Existing upload/media infra:
  - `server/src/routes/public.ts`
  - `server/src/app.ts`

## Findings
- Existing upload infra already exposes `POST /api/upload` with JPEG/PNG validation and a 2MB limit.
- Uploaded assets are already served from `/uploads`, so seller draft media can reuse the current infrastructure without opening admin-only upload lanes.
- Seller product detail/list read models already expose `promoImagePath` / `imagePaths`, so media minimum can stay inside the current product contract.

## Changes made
- Opened seller-safe `imageUrls` handling in draft create/update payloads.
- Reused existing upload endpoint through seller API helper instead of building a new media module.
- Added seller authoring UI for a minimal image set:
  - upload JPEG/PNG only
  - up to 6 images
  - first image becomes the primary preview
  - remove image before save
- Hardened phase-2 field handling:
  - client-side sale price guard
  - stock must be a whole non-negative number
  - category/default category checks stay explicit
  - clearer upload and payload error messages
- Updated seller detail/catalog previews to resolve `/uploads/...` assets correctly.

## Governance summary
- Seller-editable now:
  - `name`
  - `description`
  - `sku`
  - `categoryIds`
  - `defaultCategoryId`
  - `price`
  - `salePrice`
  - `stock`
  - `imageUrls`
- Seller-read-only / admin-owned:
  - publish/status controls
  - review outcomes
  - advanced media management
  - admin notes/internal governance fields
  - featured/highlight/promo controls
  - advanced variations/wholesale

## Risks / deferred
- Media remains a minimal seller draft lane only; there is still no gallery manager, crop flow, ordering UI, or asset library.
- Uploads happen immediately to shared storage, while draft linkage happens only after save; abandoned uploads remain possible debt in the existing infra.
- Video/media lanes outside image URLs remain deferred.

## Verification
- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm qa:mvf` still fails on the pre-existing `QA-MONEY` issue in `client/src/pages/seller/SellerStoreProfilePage.jsx`

## Next safe step
- If seller media needs to expand beyond minimal image URLs, the next task should scope a dedicated seller media governance pass rather than extending this draft lane ad hoc.
