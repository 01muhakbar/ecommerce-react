# Seller Category Selector Smoke Report

- Run ID: `seller-category-selector-smoke-20260420T045934z-2l6vmc`
- Started At: `2026-04-20T04:59:34.425Z`
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
- Duration: `136ms`
- Proof:
  - storeId: `562`
  - selectedCategories: `[{"id":6,"name":"Beverages","code":"beverages"},{"id":3,"name":"Bread & Bakery","code":"bakery"}]`
  - searchQuery: `"bakery"`
  - cookieName: `"token"`

### 2. Open Seller Product create page
- Status: `passed`
- Summary: Seller product create page loaded with the new category selector.
- Duration: `1465ms`
- Proof:
  - url: `"http://localhost:5173/seller/stores/superseller-demo-store/catalog/products/new"`

### 3. Search category using the new search box
- Status: `passed`
- Summary: Search narrowed the selector to the expected category entry.
- Duration: `394ms`
- Proof:
  - searchQuery: `"bakery"`
  - matchedCategory: `"Bread & Bakery"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T045934z-2l6vmc\\01-search-category.png"`

### 4. Select multiple categories and set one as default
- Status: `failed`
- Summary: locator.selectOption: Error: strict mode violation: getByLabel('Default Category') resolved to 2 elements:
    1) <input value="" type="search" placeholder="Search category name or code" class="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-700 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"/> aka getByRole('searchbox', { name: 'Categories 2 categories' })
    2) <select class="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 ">…</select> aka getByLabel('Default CategoryChoose')

Call log:
[2m  - waiting for getByLabel('Default Category')[22m

- Duration: `305ms`
- Root Cause: locator.selectOption: Error: strict mode violation: getByLabel('Default Category') resolved to 2 elements:
    1) <input value="" type="search" placeholder="Search category name or code" class="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-700 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"/> aka getByRole('searchbox', { name: 'Categories 2 categories' })
    2) <select class="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 ">…</select> aka getByLabel('Default CategoryChoose')

Call log:
[2m  - waiting for getByLabel('Default Category')[22m

## Regressions

- None

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T045934z-2l6vmc\01-search-category.png`
