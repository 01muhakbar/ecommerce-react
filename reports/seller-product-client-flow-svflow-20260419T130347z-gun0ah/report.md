# Seller Product Client Flow Report

- Run ID: `svflow-20260419T130347z-gun0ah`
- Started At: `2026-04-19T13:03:47.010Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5174`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Product ID: `839`
- Final Product Slug: `svflow-20260419t130347z-gun0ah-edited`
- Overall Status: `failed`

## Steps

### 1. Create product from Seller
- Status: `passed`
- Summary: Seller authentication, store context, image upload, and draft creation completed.
- Duration: `99210ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - uploadedPrimaryImage: `"/uploads/products/1776603926638-980919744.jpg"`
  - uploadedSecondaryImage: `"/uploads/products/1776603926654-582714953.png"`
  - productId: `839`
  - slug: `"svflow-20260419t130347z-gun0ah-draft"`
  - createStatus: `201`

### 2. Save as draft and check DB/API response
- Status: `passed`
- Summary: Draft state is consistent across seller API and database, and remains hidden from public client APIs.
- Duration: `81ms`
- Proof:
  - dbStatus: `"draft"`
  - dbPublished: `0`
  - promoImagePath: `"/uploads/products/1776603926638-980919744.jpg"`
  - imagePaths: `["/uploads/products/1776603926638-980919744.jpg","/uploads/products/1776603926654-582714953.png"]`
  - publicListContainsDraft: `false`
  - publicDetailStatus: `404`

### 3. Publish product
- Status: `passed`
- Summary: Seller publish succeeded and persisted active/public product state.
- Duration: `30ms`
- Proof:
  - publishStatus: `200`
  - responseVisibility: `{"isPublished":true,"storefrontVisible":true,"stateCode":"STOREFRONT_VISIBLE","label":"Published","publishLabel":"Published","sellerLabel":"Visible in storefront","storefrontLabel":"Visible in storefront","storefrontReason":"Public storefront queries include this product because publish is on, status is active, and the store is operational.","sellerHint":"Seller and customer views are aligned for visibility.","blockingSignals":[],"reasonCode":"STOREFRONT_VISIBLE","storeOperational":true,"operationalReadiness":{"code":"READY","label":"Operational","description":"This store has an active approved payment setup and can be treated as operational on public store-facing lanes.","isReady":true}}`
  - dbStatus: `"active"`
  - dbPublished: `1`

### 4. Open Client and check product appears
- Status: `passed`
- Summary: Published product became visible in public API and client listing without delay symptoms.
- Duration: `2516ms`
- Proof:
  - publicListVisibleAfterMs: `11`
  - publicDetailVisibleAfterMs: `26`
  - publicListImageUrl: `"/uploads/products/1776603926638-980919744.jpg"`
  - listingUrl: `"http://localhost:5174/store/super-admin-1?view=products&q=svflow-20260419T130347z-gun0ah"`
  - listingHasImage: `false`
  - listingImageSrc: `null`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130347z-gun0ah\\04-client-listing-published.png"`

### 5. Edit product and check changes in Client
- Status: `failed`
- Summary: locator.waitFor: Error: strict mode violation: locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') resolved to 2 elements:
    1) <span class="font-medium text-slate-700">SV Flow svflow-20260419T130347z-gun0ah Edited</span> aka getByRole('navigation').getByText('SV Flow svflow-')
    2) <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">SV Flow svflow-20260419T130347z-gun0ah Edited</h1> aka getByRole('heading', { name: 'SV Flow svflow-' })

Call log:
[2m  - waiting for locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') to be visible[22m

- Duration: `2833ms`
- Root Cause: locator.waitFor: Error: strict mode violation: locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') resolved to 2 elements:
    1) <span class="font-medium text-slate-700">SV Flow svflow-20260419T130347z-gun0ah Edited</span> aka getByRole('navigation').getByText('SV Flow svflow-')
    2) <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">SV Flow svflow-20260419T130347z-gun0ah Edited</h1> aka getByRole('heading', { name: 'SV Flow svflow-' })

Call log:
[2m  - waiting for locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') to be visible[22m

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130347z-gun0ah\04-client-listing-published.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130347z-gun0ah\05-client-listing-edited-primary.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130347z-gun0ah\06-client-detail-edited.png`

## Failure

- Step: `5. Edit product and check changes in Client`
- Message: locator.waitFor: Error: strict mode violation: locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') resolved to 2 elements:
    1) <span class="font-medium text-slate-700">SV Flow svflow-20260419T130347z-gun0ah Edited</span> aka getByRole('navigation').getByText('SV Flow svflow-')
    2) <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">SV Flow svflow-20260419T130347z-gun0ah Edited</h1> aka getByRole('heading', { name: 'SV Flow svflow-' })

Call log:
[2m  - waiting for locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') to be visible[22m

- Root Cause: locator.waitFor: Error: strict mode violation: locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') resolved to 2 elements:
    1) <span class="font-medium text-slate-700">SV Flow svflow-20260419T130347z-gun0ah Edited</span> aka getByRole('navigation').getByText('SV Flow svflow-')
    2) <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">SV Flow svflow-20260419T130347z-gun0ah Edited</h1> aka getByRole('heading', { name: 'SV Flow svflow-' })

Call log:
[2m  - waiting for locator('text=SV Flow svflow-20260419T130347z-gun0ah Edited') to be visible[22m
