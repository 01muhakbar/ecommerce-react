# Seller Category Selector Smoke Report

- Run ID: `seller-category-selector-smoke-20260420T050030z-k2txam`
- Started At: `2026-04-20T05:00:30.162Z`
- Store Slug: `superseller-demo-store`
- Seller Email: `superseller@local.dev`
- Store ID: `562`
- Product ID: `848`
- Product Slug: `seller-category-selector-smoke-20260420t050030z-k2txam-draft`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and category references
- Status: `passed`
- Summary: Seller session and category references are ready.
- Duration: `138ms`
- Proof:
  - storeId: `562`
  - selectedCategories: `[{"id":6,"name":"Beverages","code":"beverages"},{"id":3,"name":"Bread & Bakery","code":"bakery"}]`
  - searchQuery: `"bakery"`
  - cookieName: `"token"`

### 2. Open Seller Product create page
- Status: `passed`
- Summary: Seller product create page loaded with the new category selector.
- Duration: `1603ms`
- Proof:
  - url: `"http://localhost:5173/seller/stores/superseller-demo-store/catalog/products/new"`

### 3. Search category using the new search box
- Status: `passed`
- Summary: Search narrowed the selector to the expected category entry.
- Duration: `438ms`
- Proof:
  - searchQuery: `"bakery"`
  - matchedCategory: `"Bread & Bakery"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T050030z-k2txam\\01-search-category.png"`

### 4. Select multiple categories and set one as default
- Status: `passed`
- Summary: Multiple categories were selected and one default category was set.
- Duration: `355ms`
- Proof:
  - selectedCategoryIds: `[6,3]`
  - defaultCategoryId: `3`

### 5. Save draft and capture create payload
- Status: `passed`
- Summary: Draft saved with the expected selected categories and default category.
- Duration: `569ms`
- Proof:
  - productId: `848`
  - productSlug: `"seller-category-selector-smoke-20260420t050030z-k2txam-draft"`
  - createPayload: `{"name":"Category Selector seller-category-selector-smoke-20260420T050030z-k2txam","description":"Seller category selector smoke seller-category-selector-smoke-20260420T050030z-k2txam.","sku":"CATSEL-seller-category-selector-smoke-20260420T050030z-k2txam","barcode":null,"slug":"seller-category-selector-smoke-20260420t050030z-k2txam-draft","categoryIds":[6,3],"defaultCategoryId":3,"price":170000,"salePrice":null,"stock":9,"imageUrls":[],"tags":[]}`

### 6. Re-open draft and verify category persistence
- Status: `failed`
- Summary: locator.isVisible: Error: strict mode violation: getByText('Bread & Bakery').locator('..').getByText('Default') resolved to 5 elements:
    1) <p>Default category: Bread & Bakery</p> aka getByText('Default category: Bread &').first()
    2) <p class="text-xs text-slate-500">Default category: Bread & Bakery</p> aka locator('form').getByText('Default category: Bread &')
    3) <span>Bread & Bakery • Default</span> aka getByText('Bread & Bakery • Default')
    4) <span class="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">Default</span> aka getByText('Default', { exact: true })
    5) <option value="">Choose default category</option> aka getByLabel('Default CategoryChoose')

Call log:
[2m    - checking visibility of getByText('Bread & Bakery').locator('..').getByText('Default')[22m

- Duration: `1323ms`
- Root Cause: locator.isVisible: Error: strict mode violation: getByText('Bread & Bakery').locator('..').getByText('Default') resolved to 5 elements:
    1) <p>Default category: Bread & Bakery</p> aka getByText('Default category: Bread &').first()
    2) <p class="text-xs text-slate-500">Default category: Bread & Bakery</p> aka locator('form').getByText('Default category: Bread &')
    3) <span>Bread & Bakery • Default</span> aka getByText('Bread & Bakery • Default')
    4) <span class="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">Default</span> aka getByText('Default', { exact: true })
    5) <option value="">Choose default category</option> aka getByLabel('Default CategoryChoose')

Call log:
[2m    - checking visibility of getByText('Bread & Bakery').locator('..').getByText('Default')[22m

## Regressions

- None

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T050030z-k2txam\01-search-category.png`
