# Seller Product Client Flow Report

- Run ID: `svflow-20260419T125443z-us2rxb`
- Started At: `2026-04-19T12:54:43.573Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Product ID: `837`
- Final Product Slug: `svflow-20260419t125443z-us2rxb-draft`
- Overall Status: `failed`

## Steps

### 1. Create product from Seller
- Status: `passed`
- Summary: Seller authentication, store context, image upload, and draft creation completed.
- Duration: `263ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - uploadedPrimaryImage: `"/uploads/products/1776603284358-56040354.jpg"`
  - uploadedSecondaryImage: `"/uploads/products/1776603284379-808958631.png"`
  - productId: `837`
  - slug: `"svflow-20260419t125443z-us2rxb-draft"`
  - createStatus: `201`

### 2. Save as draft and check DB/API response
- Status: `passed`
- Summary: Draft state is consistent across seller API and database, and remains hidden from public client APIs.
- Duration: `111ms`
- Proof:
  - dbStatus: `"draft"`
  - dbPublished: `0`
  - promoImagePath: `"/uploads/products/1776603284358-56040354.jpg"`
  - imagePaths: `["/uploads/products/1776603284358-56040354.jpg","/uploads/products/1776603284379-808958631.png"]`
  - publicListContainsDraft: `false`
  - publicDetailStatus: `404`

### 3. Publish product
- Status: `passed`
- Summary: Seller publish succeeded and persisted active/public product state.
- Duration: `34ms`
- Proof:
  - publishStatus: `200`
  - responseVisibility: `{"isPublished":true,"storefrontVisible":true,"stateCode":"STOREFRONT_VISIBLE","label":"Published","publishLabel":"Published","sellerLabel":"Visible in storefront","storefrontLabel":"Visible in storefront","storefrontReason":"Public storefront queries include this product because publish is on, status is active, and the store is operational.","sellerHint":"Seller and customer views are aligned for visibility.","blockingSignals":[],"reasonCode":"STOREFRONT_VISIBLE","storeOperational":true,"operationalReadiness":{"code":"READY","label":"Operational","description":"This store has an active approved payment setup and can be treated as operational on public store-facing lanes.","isReady":true}}`
  - dbStatus: `"active"`
  - dbPublished: `1`

### 4. Open Client and check product appears
- Status: `failed`
- Summary: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125443z-us2rxb' }).first().locator('img').first()[22m

- Duration: `32464ms`
- Root Cause: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125443z-us2rxb' }).first().locator('img').first()[22m

## Failure

- Step: `4. Open Client and check product appears`
- Message: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125443z-us2rxb' }).first().locator('img').first()[22m

- Root Cause: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('article').filter({ hasText: 'SV Flow svflow-20260419T125443z-us2rxb' }).first().locator('img').first()[22m
