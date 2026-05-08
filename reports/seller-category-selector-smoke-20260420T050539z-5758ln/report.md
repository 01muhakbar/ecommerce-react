# Seller Category Selector Smoke Report

- Run ID: `seller-category-selector-smoke-20260420T050539z-5758ln`
- Started At: `2026-04-20T05:05:39.498Z`
- Store Slug: `superseller-demo-store`
- Seller Email: `superseller@local.dev`
- Store ID: `562`
- Product ID: `849`
- Product Slug: `seller-category-selector-smoke-20260420t050539z-5758ln-draft`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and category references
- Status: `passed`
- Summary: Seller session and category references are ready.
- Duration: `298170ms`
- Proof:
  - storeId: `562`
  - selectedCategories: `[{"id":6,"name":"Beverages","code":"beverages"},{"id":3,"name":"Bread & Bakery","code":"bakery"}]`
  - searchQuery: `"bakery"`
  - cookieName: `"token"`

### 2. Open Seller Product create page
- Status: `passed`
- Summary: Seller product create page loaded with the new category selector.
- Duration: `1507ms`
- Proof:
  - url: `"http://localhost:5173/seller/stores/superseller-demo-store/catalog/products/new"`

### 3. Search category using the new search box
- Status: `passed`
- Summary: Search narrowed the selector to the expected category entry.
- Duration: `458ms`
- Proof:
  - searchQuery: `"bakery"`
  - matchedCategory: `"Bread & Bakery"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T050539z-5758ln\\01-search-category.png"`

### 4. Select multiple categories and set one as default
- Status: `passed`
- Summary: Multiple categories were selected and one default category was set.
- Duration: `381ms`
- Proof:
  - selectedCategoryIds: `[6,3]`
  - defaultCategoryId: `3`

### 5. Save draft and capture create payload
- Status: `passed`
- Summary: Draft saved with the expected selected categories and default category.
- Duration: `539ms`
- Proof:
  - productId: `849`
  - productSlug: `"seller-category-selector-smoke-20260420t050539z-5758ln-draft"`
  - createPayload: `{"name":"Category Selector seller-category-selector-smoke-20260420T050539z-5758ln","description":"Seller category selector smoke seller-category-selector-smoke-20260420T050539z-5758ln.","sku":"CATSEL-seller-category-selector-smoke-20260420T050539z-5758ln","barcode":null,"slug":"seller-category-selector-smoke-20260420t050539z-5758ln-draft","categoryIds":[6,3],"defaultCategoryId":3,"price":170000,"salePrice":null,"stock":9,"imageUrls":[],"tags":[]}`

### 6. Re-open draft and verify category persistence
- Status: `passed`
- Summary: Selected categories, default category, and badges persisted after reopening the draft.
- Duration: `1707ms`
- Proof:
  - defaultSelectValue: `"3"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T050539z-5758ln\\02-reopened-draft.png"`

### 7. Remove the default category and verify safe fallback
- Status: `passed`
- Summary: Removing the default category safely re-normalized the fallback before save.
- Duration: `257ms`
- Proof:
  - fallbackValue: `"6"`
  - updatePayload: `{"name":"Category Selector seller-category-selector-smoke-20260420T050539z-5758ln","description":"Seller category selector smoke seller-category-selector-smoke-20260420T050539z-5758ln.","sku":"CATSEL-seller-category-selector-smoke-20260420T050539z-5758ln","barcode":null,"slug":"seller-category-selector-smoke-20260420t050539z-5758ln-draft","categoryIds":[6],"defaultCategoryId":6,"price":170000,"salePrice":null,"stock":9,"imageUrls":[],"tags":[]}`

### 8. Verify final product detail remains valid
- Status: `failed`
- Summary: Seller detail response no longer includes the remaining selected category.
- Duration: `1166ms`
- Root Cause: Seller detail response no longer includes the remaining selected category.

## Regressions

- None

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T050539z-5758ln\01-search-category.png`
- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T050539z-5758ln\02-reopened-draft.png`
