# Seller Product Client Flow Report

- Run ID: `svflow-20260419T125846z-8qoj9e`
- Started At: `2026-04-19T12:58:46.228Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5174`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Product ID: `838`
- Final Product Slug: `svflow-20260419t125846z-8qoj9e-draft`
- Overall Status: `failed`

## Steps

### 1. Create product from Seller
- Status: `passed`
- Summary: Seller authentication, store context, image upload, and draft creation completed.
- Duration: `218ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - uploadedPrimaryImage: `"/uploads/products/1776603526942-944206022.jpg"`
  - uploadedSecondaryImage: `"/uploads/products/1776603526960-247651459.png"`
  - productId: `838`
  - slug: `"svflow-20260419t125846z-8qoj9e-draft"`
  - createStatus: `201`

### 2. Save as draft and check DB/API response
- Status: `passed`
- Summary: Draft state is consistent across seller API and database, and remains hidden from public client APIs.
- Duration: `124ms`
- Proof:
  - dbStatus: `"draft"`
  - dbPublished: `0`
  - promoImagePath: `"/uploads/products/1776603526942-944206022.jpg"`
  - imagePaths: `["/uploads/products/1776603526942-944206022.jpg","/uploads/products/1776603526960-247651459.png"]`
  - publicListContainsDraft: `false`
  - publicDetailStatus: `404`

### 3. Publish product
- Status: `passed`
- Summary: Seller publish succeeded and persisted active/public product state.
- Duration: `47ms`
- Proof:
  - publishStatus: `200`
  - responseVisibility: `{"isPublished":true,"storefrontVisible":true,"stateCode":"STOREFRONT_VISIBLE","label":"Published","publishLabel":"Published","sellerLabel":"Visible in storefront","storefrontLabel":"Visible in storefront","storefrontReason":"Public storefront queries include this product because publish is on, status is active, and the store is operational.","sellerHint":"Seller and customer views are aligned for visibility.","blockingSignals":[],"reasonCode":"STOREFRONT_VISIBLE","storeOperational":true,"operationalReadiness":{"code":"READY","label":"Operational","description":"This store has an active approved payment setup and can be treated as operational on public store-facing lanes.","isReady":true}}`
  - dbStatus: `"active"`
  - dbPublished: `1`

### 4. Open Client and check product appears
- Status: `failed`
- Summary: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125846z-8qoj9e' }).first().locator('img').first()[22m

- Duration: `33776ms`
- Root Cause: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125846z-8qoj9e' }).first().locator('img').first()[22m

## Failure

- Step: `4. Open Client and check product appears`
- Message: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125846z-8qoj9e' }).first().locator('img').first()[22m

- Root Cause: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125846z-8qoj9e' }).first().locator('img').first()[22m
