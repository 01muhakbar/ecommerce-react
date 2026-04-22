# Seller Category Selector Smoke Report

- Run ID: `seller-category-selector-smoke-20260420T045914z-7ls5yn`
- Started At: `2026-04-20T04:59:14.419Z`
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
- Duration: `129ms`
- Proof:
  - storeId: `562`
  - selectedCategories: `[{"id":6,"name":"Beverages","code":"beverages"},{"id":3,"name":"Bread & Bakery","code":"bakery"}]`
  - searchQuery: `"bakery"`
  - cookieName: `"token"`

### 2. Open Seller Product create page
- Status: `passed`
- Summary: Seller product create page loaded with the new category selector.
- Duration: `1488ms`
- Proof:
  - url: `"http://localhost:5173/seller/stores/superseller-demo-store/catalog/products/new"`

### 3. Search category using the new search box
- Status: `failed`
- Summary: categoryCheckboxLabel is not defined
- Duration: `61ms`
- Root Cause: categoryCheckboxLabel is not defined

## Regressions

- None
