# Seller Category Selector Smoke Report

- Run ID: `seller-category-selector-smoke-20260420T051204z-qpq95f`
- Started At: `2026-04-20T05:12:04.303Z`
- Store Slug: `superseller-demo-store`
- Seller Email: `superseller@local.dev`
- Store ID: `562`
- Product ID: `850`
- Product Slug: `seller-category-selector-smoke-20260420t051204z-qpq95f-draft`
- Overall Status: `passed`

## Steps

### 1. Bootstrap seller session and category references
- Status: `passed`
- Summary: Seller session and category references are ready.
- Duration: `97133ms`
- Proof:
  - storeId: `562`
  - selectedCategories: `[{"id":6,"name":"Beverages","code":"beverages"},{"id":3,"name":"Bread & Bakery","code":"bakery"}]`
  - searchQuery: `"bakery"`
  - cookieName: `"token"`

### 2. Open Seller Product create page
- Status: `passed`
- Summary: Seller product create page loaded with the new category selector.
- Duration: `1409ms`
- Proof:
  - url: `"http://localhost:5173/seller/stores/superseller-demo-store/catalog/products/new"`

### 3. Search category using the new search box
- Status: `passed`
- Summary: Search narrowed the selector to the expected category entry.
- Duration: `425ms`
- Proof:
  - searchQuery: `"bakery"`
  - matchedCategory: `"Bread & Bakery"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T051204z-qpq95f\\01-search-category.png"`

### 4. Select multiple categories and set one as default
- Status: `passed`
- Summary: Multiple categories were selected and one default category was set.
- Duration: `338ms`
- Proof:
  - selectedCategoryIds: `[6,3]`
  - defaultCategoryId: `3`

### 5. Save draft and capture create payload
- Status: `passed`
- Summary: Draft saved with the expected selected categories and default category.
- Duration: `486ms`
- Proof:
  - productId: `850`
  - productSlug: `"seller-category-selector-smoke-20260420t051204z-qpq95f-draft"`
  - createPayload: `{"name":"Category Selector seller-category-selector-smoke-20260420T051204z-qpq95f","description":"Seller category selector smoke seller-category-selector-smoke-20260420T051204z-qpq95f.","sku":"CATSEL-seller-category-selector-smoke-20260420T051204z-qpq95f","barcode":null,"slug":"seller-category-selector-smoke-20260420t051204z-qpq95f-draft","categoryIds":[6,3],"defaultCategoryId":3,"price":170000,"salePrice":null,"stock":9,"imageUrls":[],"tags":[]}`

### 6. Re-open draft and verify category persistence
- Status: `passed`
- Summary: Selected categories, default category, and badges persisted after reopening the draft.
- Duration: `1670ms`
- Proof:
  - defaultSelectValue: `"3"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T051204z-qpq95f\\02-reopened-draft.png"`

### 7. Remove the default category and verify safe fallback
- Status: `passed`
- Summary: Removing the default category safely re-normalized the fallback before save.
- Duration: `247ms`
- Proof:
  - fallbackValue: `"6"`
  - updatePayload: `{"name":"Category Selector seller-category-selector-smoke-20260420T051204z-qpq95f","description":"Seller category selector smoke seller-category-selector-smoke-20260420T051204z-qpq95f.","sku":"CATSEL-seller-category-selector-smoke-20260420T051204z-qpq95f","barcode":null,"slug":"seller-category-selector-smoke-20260420t051204z-qpq95f-draft","categoryIds":[6],"defaultCategoryId":6,"price":170000,"salePrice":null,"stock":9,"imageUrls":[],"tags":[]}`

### 8. Verify final product detail remains valid
- Status: `passed`
- Summary: Payload and final product detail stayed valid after create/edit category selection changes.
- Duration: `1511ms`
- Proof:
  - assignedCategories: `[6]`
  - defaultCategoryId: `6`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T051204z-qpq95f\\03-final-edit-state.png"`

## Regressions

- None

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T051204z-qpq95f\01-search-category.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T051204z-qpq95f\02-reopened-draft.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T051204z-qpq95f\03-final-edit-state.png`
