# Seller Product DTO Smoke Report

- Run ID: `seller-dto-smoke-20260420T014810z-bly1hy`
- Started At: `2026-04-20T01:48:10.541Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Store ID: `1`
- Category: `Beverages`
- Product ID: `846`
- Product Slug: `seller-dto-smoke-20260420t014810z-bly1hy-edited`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and references
- Status: `passed`
- Summary: Seller session, store context, and category references are ready.
- Duration: `134ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - cookieName: `"token"`

### 2. Create seller product through UI and capture payload
- Status: `passed`
- Summary: Create flow succeeded through Seller UI and emitted the expected adapter payload.
- Duration: `2566ms`
- Proof:
  - productId: `846`
  - productSlug: `"seller-dto-smoke-20260420t014810z-bly1hy-draft"`
  - createPayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T014810z-bly1hy","description":"Smoke validation create payload for seller-dto-smoke-20260420T014810z-bly1hy.","sku":"DTO-seller-dto-smoke-20260420T014810z-bly1hy","barcode":"BAR-seller-dto-smoke-20260420T014810z-bly1hy","slug":"seller-dto-smoke-20260420t014810z-bly1hy-draft","categoryIds":[6],"defaultCategoryId":6,"price":125000,"salePrice":99000,"stock":8,"imageUrls":["/uploads/products/1776649693943-919037611.jpg","/uploads/products/1776649693946-965645826.png"],"tags":["dto-smoke","seller-dto-smoke-20260420T014810z-bly1hy"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T014810z-bly1hy\\02-create-edit-page.png"`

### 3. Update seller product through UI and capture payload
- Status: `passed`
- Summary: Update flow succeeded through Seller UI and preserved reordered media plus edited fields.
- Duration: `1082ms`
- Proof:
  - updatePayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T014810z-bly1hy Edited","description":"Smoke validation update payload for seller-dto-smoke-20260420T014810z-bly1hy.","sku":"DTO-seller-dto-smoke-20260420T014810z-bly1hy","barcode":"BAR-seller-dto-smoke-20260420T014810z-bly1hy","slug":"seller-dto-smoke-20260420t014810z-bly1hy-edited","categoryIds":[6],"defaultCategoryId":6,"price":149000,"salePrice":109000,"stock":5,"imageUrls":["/uploads/products/1776649693946-965645826.png","/uploads/products/1776649693943-919037611.jpg"],"tags":["edited"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T014810z-bly1hy\\03-updated-edit-page.png"`

### 4. Validate mapped Seller list and detail DTO
- Status: `passed`
- Summary: Shared seller DTO adapter preserved list and detail fields after create/update.
- Duration: `44ms`
- Proof:
  - mappedListItem: `{"id":846,"name":"DTO Smoke seller-dto-smoke-20260420T014810z-bly1hy Edited","slug":"seller-dto-smoke-20260420t014810z-bly1hy-edited","status":"draft","published":false,"category":"Beverages","price":149000,"salePrice":109000,"stock":5,"mediaPreviewUrl":"/uploads/products/1776649693946-965645826.png"}`
  - mappedDetail: `{"id":846,"description":"Smoke validation update payload for seller-dto-smoke-20260420T014810z-bly1hy.","defaultCategory":"Beverages","assignedCategories":["Beverages"],"tags":[],"visibilityState":"INTERNAL_ONLY","submissionStatus":"none"}`

### 5. Validate Seller list UI
- Status: `passed`
- Summary: Seller list still renders key product fields correctly after DTO adapter rollout.
- Duration: `2239ms`
- Proof:
  - rowImageSrc: `"http://localhost:3001/uploads/products/1776649693946-965645826.png"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T014810z-bly1hy\\05-seller-list.png"`

### 6. Validate Seller detail UI
- Status: `failed`
- Summary: Detail UI tags dropped after update.
- Duration: `1499ms`
- Root Cause: Detail UI tags dropped after update.

## Mismatches

- Mapped detail DTO tags dropped "edited". mappedTags=[]

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T014810z-bly1hy\02-create-edit-page.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T014810z-bly1hy\03-updated-edit-page.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T014810z-bly1hy\05-seller-list.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T014810z-bly1hy\06-seller-detail.png`

## Failure

- Step: `6. Validate Seller detail UI`
- Message: Detail UI tags dropped after update.
- Root Cause: Detail UI tags dropped after update.
