# Seller Product DTO Smoke Report

- Run ID: `seller-dto-smoke-20260420T013325z-4ko9p4`
- Started At: `2026-04-20T01:33:25.277Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Store ID: `1`
- Category: `Beverages`
- Product ID: `843`
- Product Slug: `seller-dto-smoke-20260420t013325z-4ko9p4-edited`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and references
- Status: `passed`
- Summary: Seller session, store context, and category references are ready.
- Duration: `181ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - cookieName: `"token"`

### 2. Create seller product through UI and capture payload
- Status: `passed`
- Summary: Create flow succeeded through Seller UI and emitted the expected adapter payload.
- Duration: `3564ms`
- Proof:
  - productId: `843`
  - productSlug: `"seller-dto-smoke-20260420t013325z-4ko9p4-draft"`
  - createPayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T013325z-4ko9p4","description":"Smoke validation create payload for seller-dto-smoke-20260420T013325z-4ko9p4.","sku":"DTO-seller-dto-smoke-20260420T013325z-4ko9p4","barcode":"BAR-seller-dto-smoke-20260420T013325z-4ko9p4","slug":"seller-dto-smoke-20260420t013325z-4ko9p4-draft","categoryIds":[6],"defaultCategoryId":6,"price":125000,"salePrice":99000,"stock":8,"imageUrls":["/uploads/products/1776648809588-403000542.jpg","/uploads/products/1776648809592-878745416.png"],"tags":["dto-smoke","seller-dto-smoke-20260420T013325z-4ko9p4"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T013325z-4ko9p4\\02-create-edit-page.png"`

### 3. Update seller product through UI and capture payload
- Status: `passed`
- Summary: Update flow succeeded through Seller UI and preserved reordered media plus edited fields.
- Duration: `1502ms`
- Proof:
  - updatePayload: `{"name":"DTO Smoke seller-dto-smoke-20260420T013325z-4ko9p4 Edited","description":"Smoke validation update payload for seller-dto-smoke-20260420T013325z-4ko9p4.","sku":"DTO-seller-dto-smoke-20260420T013325z-4ko9p4","barcode":"BAR-seller-dto-smoke-20260420T013325z-4ko9p4","slug":"seller-dto-smoke-20260420t013325z-4ko9p4-edited","categoryIds":[6],"defaultCategoryId":6,"price":149000,"salePrice":109000,"stock":5,"imageUrls":["/uploads/products/1776648809592-878745416.png","/uploads/products/1776648809588-403000542.jpg"],"tags":["edited"]}`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-dto-smoke-20260420T013325z-4ko9p4\\03-updated-edit-page.png"`

### 4. Validate mapped Seller list and detail DTO
- Status: `failed`
- Summary: Mapped detail DTO tags mismatch.
- Duration: `76ms`
- Root Cause: Mapped detail DTO tags mismatch.

## Mismatches

- None

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T013325z-4ko9p4\02-create-edit-page.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-dto-smoke-20260420T013325z-4ko9p4\03-updated-edit-page.png`

## Failure

- Step: `4. Validate mapped Seller list and detail DTO`
- Message: Mapped detail DTO tags mismatch.
- Root Cause: Mapped detail DTO tags mismatch.
