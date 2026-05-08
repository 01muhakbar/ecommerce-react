# Seller Category Selector Smoke Report

- Run ID: `seller-category-selector-smoke-20260420T050002z-6w3st4`
- Started At: `2026-04-20T05:00:02.122Z`
- Store Slug: `superseller-demo-store`
- Seller Email: `superseller@local.dev`
- Store ID: `562`
- Product ID: `-`
- Product Slug: `-`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and category references
- Status: `passed`
- Summary: Seller session and category references are ready.
- Duration: `150ms`
- Proof:
  - storeId: `562`
  - selectedCategories: `[{"id":6,"name":"Beverages","code":"beverages"},{"id":3,"name":"Bread & Bakery","code":"bakery"}]`
  - searchQuery: `"bakery"`
  - cookieName: `"token"`

### 2. Open Seller Product create page
- Status: `passed`
- Summary: Seller product create page loaded with the new category selector.
- Duration: `1483ms`
- Proof:
  - url: `"http://localhost:5173/seller/stores/superseller-demo-store/catalog/products/new"`

### 3. Search category using the new search box
- Status: `passed`
- Summary: Search narrowed the selector to the expected category entry.
- Duration: `511ms`
- Proof:
  - searchQuery: `"bakery"`
  - matchedCategory: `"Bread & Bakery"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T050002z-6w3st4\\01-search-category.png"`

### 4. Select multiple categories and set one as default
- Status: `failed`
- Summary: locator.waitFor: Error: strict mode violation: getByText('Default category: Bread & Bakery') resolved to 2 elements:
    1) <p>Default category: Bread & Bakery</p> aka getByText('Default category: Bread &').first()
    2) <p class="text-xs text-slate-500">Default category: Bread & Bakery</p> aka locator('form').getByText('Default category: Bread &')

Call log:
[2m  - waiting for getByText('Default category: Bread & Bakery') to be visible[22m

- Duration: `499ms`
- Root Cause: locator.waitFor: Error: strict mode violation: getByText('Default category: Bread & Bakery') resolved to 2 elements:
    1) <p>Default category: Bread & Bakery</p> aka getByText('Default category: Bread &').first()
    2) <p class="text-xs text-slate-500">Default category: Bread & Bakery</p> aka locator('form').getByText('Default category: Bread &')

Call log:
[2m  - waiting for getByText('Default category: Bread & Bakery') to be visible[22m

## Regressions

- None

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T050002z-6w3st4\01-search-category.png`
