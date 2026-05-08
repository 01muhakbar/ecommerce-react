# Seller Product Client Flow Report

- Run ID: `svflow-20260419T130727z-hpip71`
- Started At: `2026-04-19T13:07:27.833Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5174`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Product ID: `841`
- Final Product Slug: `svflow-20260419t130727z-hpip71-edited`
- Overall Status: `passed`

## Steps

### 1. Create product from Seller
- Status: `passed`
- Summary: Seller authentication, store context, image upload, and draft creation completed.
- Duration: `196ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - uploadedPrimaryImage: `"/uploads/products/1776604048443-508694701.jpg"`
  - uploadedSecondaryImage: `"/uploads/products/1776604048458-807506149.png"`
  - productId: `841`
  - slug: `"svflow-20260419t130727z-hpip71-draft"`
  - createStatus: `201`

### 2. Save as draft and check DB/API response
- Status: `passed`
- Summary: Draft state is consistent across seller API and database, and remains hidden from public client APIs.
- Duration: `79ms`
- Proof:
  - dbStatus: `"draft"`
  - dbPublished: `0`
  - promoImagePath: `"/uploads/products/1776604048443-508694701.jpg"`
  - imagePaths: `["/uploads/products/1776604048443-508694701.jpg","/uploads/products/1776604048458-807506149.png"]`
  - publicListContainsDraft: `false`
  - publicDetailStatus: `404`

### 3. Publish product
- Status: `passed`
- Summary: Seller publish succeeded and persisted active/public product state.
- Duration: `28ms`
- Proof:
  - publishStatus: `200`
  - responseVisibility: `{"isPublished":true,"storefrontVisible":true,"stateCode":"STOREFRONT_VISIBLE","label":"Published","publishLabel":"Published","sellerLabel":"Visible in storefront","storefrontLabel":"Visible in storefront","storefrontReason":"Public storefront queries include this product because publish is on, status is active, and the store is operational.","sellerHint":"Seller and customer views are aligned for visibility.","blockingSignals":[],"reasonCode":"STOREFRONT_VISIBLE","storeOperational":true,"operationalReadiness":{"code":"READY","label":"Operational","description":"This store has an active approved payment setup and can be treated as operational on public store-facing lanes.","isReady":true}}`
  - dbStatus: `"active"`
  - dbPublished: `1`

### 4. Open Client and check product appears
- Status: `passed`
- Summary: Published product became visible in public API and client listing without delay symptoms.
- Duration: `2800ms`
- Proof:
  - publicListVisibleAfterMs: `10`
  - publicDetailVisibleAfterMs: `16`
  - publicListImageUrl: `"/uploads/products/1776604048443-508694701.jpg"`
  - listingUrl: `"http://localhost:5174/store/super-admin-1?view=products&q=svflow-20260419T130727z-hpip71"`
  - listingHasImage: `true`
  - listingImageSrc: `"/uploads/products/1776604048443-508694701.jpg"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130727z-hpip71\\04-client-listing-published.png"`

### 5. Edit product and check changes in Client
- Status: `passed`
- Summary: Seller edit propagated to DB and client, including primary image order and description changes.
- Duration: `2964ms`
- Proof:
  - updatedSlug: `"svflow-20260419t130727z-hpip71-edited"`
  - listingUrl: `"http://localhost:5174/store/super-admin-1?view=products&q=svflow-20260419T130727z-hpip71"`
  - detailUrl: `"http://localhost:5174/store/super-admin-1/products/svflow-20260419t130727z-hpip71-edited"`
  - dbPromoImagePath: `"/uploads/products/1776604048458-807506149.png"`
  - editedListingHasImage: `true`
  - editedListingImageSrc: `"/uploads/products/1776604048458-807506149.png"`
  - detailHasImage: `true`
  - detailImageSrc: `"http://localhost:3001/uploads/products/1776604048458-807506149.png"`
  - listingScreenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130727z-hpip71\\05-client-listing-edited-primary.png"`
  - detailScreenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130727z-hpip71\\06-client-detail-edited.png"`

### 6. Test unpublish and ensure product disappears from Client
- Status: `passed`
- Summary: Unpublish immediately removed the product from public API and client listing.
- Duration: `2183ms`
- Proof:
  - dbPublished: `0`
  - publicListHiddenAfterMs: `9`
  - publicDetailHiddenAfterMs: `7`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130727z-hpip71\\07-client-listing-unpublished.png"`

### 7. Test image primary in Client listing
- Status: `passed`
- Summary: Client listing uses the seller-selected primary image after reorder.
- Duration: `0ms`
- Proof:
  - expectedPrimaryImage: `"/uploads/products/1776604048458-807506149.png"`
  - clientListingImageSrc: `"/uploads/products/1776604048458-807506149.png"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130727z-hpip71\\05-client-listing-edited-primary.png"`

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130727z-hpip71\04-client-listing-published.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130727z-hpip71\05-client-listing-edited-primary.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130727z-hpip71\06-client-detail-edited.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130727z-hpip71\07-client-listing-unpublished.png`
