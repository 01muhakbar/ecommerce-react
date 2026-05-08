# Seller Product DTO Smoke Report

- Run ID: `seller-dto-smoke-20260420T013721z-4ayvpu`
- Started At: `2026-04-20T01:37:21.313Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Store ID: `1`
- Category: `Beverages`
- Product ID: `844`
- Product Slug: `seller-dto-smoke-20260420t013721z-4ayvpu-edited`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and references
- Status: `passed`
- Summary: Seller session, store context, and category references are ready.
- Duration: `326183ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - cookieName: `"token"`

### 2. Create seller product through UI and capture payload
- Status: `passed`
- Summary: Create flow succeeded through Seller UI and emitted the expected adapter payload.
- Duration: `3346ms`
- Proof:
  - productId: `844`
  - productSlug: `"seller-dto-smoke-20260420t013721z-4ayvpu-draft"`
  - createPayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T013721z-4ayvpu","description":"Smoke validation create payload for seller-dto-smoke-20260420T013721z-4ayvpu.","sku":"DTO-seller-dto-smoke-20260420T013721z-4ayvpu","barcode":"BAR-seller-dto-smoke-20260420T013721z-4ayvpu","slug":"seller-dto-smoke-20260420t013721z-4ayvpu-draft","categoryIds":[6],"defaultCategoryId":6,"price":125000,"salePrice":99000,"stock":8,"imageUrls":["/uploads/products/1776649371513-444135661.jpg","/uploads/products/1776649371515-645059014.png"],"tags":["dto-smoke","seller-dto-smoke-20260420T013721z-4ayvpu"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T013721z-4ayvpu\\02-create-edit-page.png"`

### 3. Update seller product through UI and capture payload
- Status: `passed`
- Summary: Update flow succeeded through Seller UI and preserved reordered media plus edited fields.
- Duration: `1409ms`
- Proof:
  - updatePayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T013721z-4ayvpu Edited","description":"Smoke validation update payload for seller-dto-smoke-20260420T013721z-4ayvpu.","sku":"DTO-seller-dto-smoke-20260420T013721z-4ayvpu","barcode":"BAR-seller-dto-smoke-20260420T013721z-4ayvpu","slug":"seller-dto-smoke-20260420t013721z-4ayvpu-edited","categoryIds":[6],"defaultCategoryId":6,"price":149000,"salePrice":109000,"stock":5,"imageUrls":["/uploads/products/1776649371515-645059014.png","/uploads/products/1776649371513-444135661.jpg"],"tags":["edited"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T013721z-4ayvpu\\03-updated-edit-page.png"`

### 4. Validate mapped Seller list and detail DTO
- Status: `passed`
- Summary: Shared seller DTO adapter preserved list and detail fields after create/update.
- Duration: `66ms`
- Proof:
  - mappedListItem: `{"id":844,"name":"DTO Smoke seller-dto-smoke-20260420T013721z-4ayvpu Edited","slug":"seller-dto-smoke-20260420t013721z-4ayvpu-edited","status":"draft","published":false,"category":"Beverages","price":149000,"salePrice":109000,"stock":5,"mediaPreviewUrl":"/uploads/products/1776649371515-645059014.png"}`
  - mappedDetail: `{"id":844,"description":"Smoke validation update payload for seller-dto-smoke-20260420T013721z-4ayvpu.","defaultCategory":"Beverages","assignedCategories":["Beverages"],"tags":[],"visibilityState":"INTERNAL_ONLY","submissionStatus":"none"}`

### 5. Validate Seller list UI
- Status: `failed`
- Summary: List UI base price is not visible.
- Duration: `2762ms`
- Root Cause: List UI base price is not visible.

## Mismatches

- Mapped detail DTO tags dropped "edited". mappedTags=[]

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T013721z-4ayvpu\02-create-edit-page.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T013721z-4ayvpu\03-updated-edit-page.png`

## Failure

- Step: `5. Validate Seller list UI`
- Message: List UI base price is not visible.
- Root Cause: List UI base price is not visible.
