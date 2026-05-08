# Seller Product DTO Smoke Report

- Run ID: `seller-dto-smoke-20260420T014324z-y9qxef`
- Started At: `2026-04-20T01:43:24.341Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Store ID: `1`
- Category: `Beverages`
- Product ID: `845`
- Product Slug: `seller-dto-smoke-20260420t014324z-y9qxef-edited`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and references
- Status: `passed`
- Summary: Seller session, store context, and category references are ready.
- Duration: `183179ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - cookieName: `"token"`

### 2. Create seller product through UI and capture payload
- Status: `passed`
- Summary: Create flow succeeded through Seller UI and emitted the expected adapter payload.
- Duration: `3317ms`
- Proof:
  - productId: `845`
  - productSlug: `"seller-dto-smoke-20260420t014324z-y9qxef-draft"`
  - createPayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T014324z-y9qxef","description":"Smoke validation create payload for seller-dto-smoke-20260420T014324z-y9qxef.","sku":"DTO-seller-dto-smoke-20260420T014324z-y9qxef","barcode":"BAR-seller-dto-smoke-20260420T014324z-y9qxef","slug":"seller-dto-smoke-20260420t014324z-y9qxef-draft","categoryIds":[6],"defaultCategoryId":6,"price":125000,"salePrice":99000,"stock":8,"imageUrls":["/uploads/products/1776649591329-982171915.jpg","/uploads/products/1776649591332-319222815.png"],"tags":["dto-smoke","seller-dto-smoke-20260420T014324z-y9qxef"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T014324z-y9qxef\\02-create-edit-page.png"`

### 3. Update seller product through UI and capture payload
- Status: `passed`
- Summary: Update flow succeeded through Seller UI and preserved reordered media plus edited fields.
- Duration: `1371ms`
- Proof:
  - updatePayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T014324z-y9qxef Edited","description":"Smoke validation update payload for seller-dto-smoke-20260420T014324z-y9qxef.","sku":"DTO-seller-dto-smoke-20260420T014324z-y9qxef","barcode":"BAR-seller-dto-smoke-20260420T014324z-y9qxef","slug":"seller-dto-smoke-20260420t014324z-y9qxef-edited","categoryIds":[6],"defaultCategoryId":6,"price":149000,"salePrice":109000,"stock":5,"imageUrls":["/uploads/products/1776649591332-319222815.png","/uploads/products/1776649591329-982171915.jpg"],"tags":["edited"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T014324z-y9qxef\\03-updated-edit-page.png"`

### 4. Validate mapped Seller list and detail DTO
- Status: `passed`
- Summary: Shared seller DTO adapter preserved list and detail fields after create/update.
- Duration: `58ms`
- Proof:
  - mappedListItem: `{"id":845,"name":"DTO Smoke seller-dto-smoke-20260420T014324z-y9qxef Edited","slug":"seller-dto-smoke-20260420t014324z-y9qxef-edited","status":"draft","published":false,"category":"Beverages","price":149000,"salePrice":109000,"stock":5,"mediaPreviewUrl":"/uploads/products/1776649591332-319222815.png"}`
  - mappedDetail: `{"id":845,"description":"Smoke validation update payload for seller-dto-smoke-20260420T014324z-y9qxef.","defaultCategory":"Beverages","assignedCategories":["Beverages"],"tags":[],"visibilityState":"INTERNAL_ONLY","submissionStatus":"none"}`

### 5. Validate Seller list UI
- Status: `passed`
- Summary: Seller list still renders key product fields correctly after DTO adapter rollout.
- Duration: `2633ms`
- Proof:
  - rowImageSrc: `"http://localhost:3001/uploads/products/1776649591332-319222815.png"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T014324z-y9qxef\\05-seller-list.png"`

### 6. Validate Seller detail UI
- Status: `failed`
- Summary: Detail UI primary image src does not match reordered primary image.
- Duration: `1219ms`
- Root Cause: Detail UI primary image src does not match reordered primary image.

## Mismatches

- Mapped detail DTO tags dropped "edited". mappedTags=[]

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T014324z-y9qxef\02-create-edit-page.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T014324z-y9qxef\03-updated-edit-page.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T014324z-y9qxef\05-seller-list.png`

## Failure

- Step: `6. Validate Seller detail UI`
- Message: Detail UI primary image src does not match reordered primary image.
- Root Cause: Detail UI primary image src does not match reordered primary image.
