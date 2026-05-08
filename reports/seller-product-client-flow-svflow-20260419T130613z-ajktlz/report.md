# Seller Product Client Flow Report

- Run ID: `svflow-20260419T130613z-ajktlz`
- Started At: `2026-04-19T13:06:13.967Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5174`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Product ID: `840`
- Final Product Slug: `svflow-20260419t130613z-ajktlz-edited`
- Overall Status: `passed`

## Steps

### 1. Create product from Seller
- Status: `passed`
- Summary: Seller authentication, store context, image upload, and draft creation completed.
- Duration: `237ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - uploadedPrimaryImage: `"/uploads/products/1776603974682-207296652.jpg"`
  - uploadedSecondaryImage: `"/uploads/products/1776603974697-779589701.png"`
  - productId: `840`
  - slug: `"svflow-20260419t130613z-ajktlz-draft"`
  - createStatus: `201`

### 2. Save as draft and check DB/API response
- Status: `passed`
- Summary: Draft state is consistent across seller API and database, and remains hidden from public client APIs.
- Duration: `78ms`
- Proof:
  - dbStatus: `"draft"`
  - dbPublished: `0`
  - promoImagePath: `"/uploads/products/1776603974682-207296652.jpg"`
  - imagePaths: `["/uploads/products/1776603974682-207296652.jpg","/uploads/products/1776603974697-779589701.png"]`
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
- Duration: `2354ms`
- Proof:
  - publicListVisibleAfterMs: `12`
  - publicDetailVisibleAfterMs: `21`
  - publicListImageUrl: `"/uploads/products/1776603974682-207296652.jpg"`
  - listingUrl: `"http://localhost:5174/store/super-admin-1?view=products&q=svflow-20260419T130613z-ajktlz"`
  - listingHasImage: `false`
  - listingImageSrc: `null`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130613z-ajktlz\\04-client-listing-published.png"`

### 5. Edit product and check changes in Client
- Status: `passed`
- Summary: Seller edit propagated to DB and client, including primary image order and description changes.
- Duration: `2959ms`
- Proof:
  - updatedSlug: `"svflow-20260419t130613z-ajktlz-edited"`
  - listingUrl: `"http://localhost:5174/store/super-admin-1?view=products&q=svflow-20260419T130613z-ajktlz"`
  - detailUrl: `"http://localhost:5174/store/super-admin-1/products/svflow-20260419t130613z-ajktlz-edited"`
  - dbPromoImagePath: `"/uploads/products/1776603974697-779589701.png"`
  - editedListingHasImage: `true`
  - editedListingImageSrc: `"/uploads/products/1776603974697-779589701.png"`
  - detailHasImage: `true`
  - detailImageSrc: `"http://localhost:3001/uploads/products/1776603974697-779589701.png"`
  - listingScreenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130613z-ajktlz\\05-client-listing-edited-primary.png"`
  - detailScreenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130613z-ajktlz\\06-client-detail-edited.png"`

### 6. Test unpublish and ensure product disappears from Client
- Status: `passed`
- Summary: Unpublish immediately removed the product from public API and client listing.
- Duration: `1822ms`
- Proof:
  - dbPublished: `0`
  - publicListHiddenAfterMs: `9`
  - publicDetailHiddenAfterMs: `9`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130613z-ajktlz\\07-client-listing-unpublished.png"`

### 7. Test image primary in Client listing
- Status: `passed`
- Summary: Client listing uses the seller-selected primary image after reorder.
- Duration: `0ms`
- Proof:
  - expectedPrimaryImage: `"/uploads/products/1776603974697-779589701.png"`
  - clientListingImageSrc: `"/uploads/products/1776603974697-779589701.png"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-product-client-flow-svflow-20260419T130613z-ajktlz\\05-client-listing-edited-primary.png"`

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130613z-ajktlz\04-client-listing-published.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130613z-ajktlz\05-client-listing-edited-primary.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130613z-ajktlz\06-client-detail-edited.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-product-client-flow-svflow-20260419T130613z-ajktlz\07-client-listing-unpublished.png`
