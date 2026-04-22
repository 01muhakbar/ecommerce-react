# Seller Category Selector Smoke Report

- Run ID: `seller-category-selector-smoke-20260420T045839z-c5wt9m`
- Started At: `2026-04-20T04:58:39.628Z`
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
- Duration: `141ms`
- Proof:
  - storeId: `562`
  - selectedCategories: `[{"id":6,"name":"Beverages","code":"beverages"},{"id":3,"name":"Bread & Bakery","code":"bakery"}]`
  - searchQuery: `"bakery"`
  - cookieName: `"token"`

### 2. Open Seller Product create page
- Status: `passed`
- Summary: Seller product create page loaded with the new category selector.
- Duration: `1500ms`
- Proof:
  - url: `"http://localhost:5173/seller/stores/superseller-demo-store/catalog/products/new"`

### 3. Search category using the new search box
- Status: `passed`
- Summary: Search narrowed the selector to the expected category entry.
- Duration: `416ms`
- Proof:
  - searchQuery: `"bakery"`
  - matchedCategory: `"Bread & Bakery"`
  - screenshot: `"C:\\Users\\user\\Documents\\ecommerce-react\\reports\\seller-category-selector-smoke-20260420T045839z-c5wt9m\\01-search-category.png"`

### 4. Select multiple categories and set one as default
- Status: `failed`
- Summary: locator.check: Error: strict mode violation: locator('label').filter({ has: locator('input[type="checkbox"]') }).filter({ hasText: 'Beverages' }).first().locator('input[type="checkbox"]') resolved to 8 elements:
    1) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Beverages Parent category' })
    2) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Bread & Bakery Parent' })
    3) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Fresh Fruits Parent category' })
    4) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Fresh Vegetables Parent' })
    5) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Meat & Fish Parent category' })
    6) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Milk & Dairy Parent category' })
    7) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Pantry Parent category pantry' })
    8) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Snacks Parent category snacks' })

Call log:
[2m  - waiting for locator('label').filter({ has: locator('input[type="checkbox"]') }).filter({ hasText: 'Beverages' }).first().locator('input[type="checkbox"]')[22m

- Duration: `98ms`
- Root Cause: locator.check: Error: strict mode violation: locator('label').filter({ has: locator('input[type="checkbox"]') }).filter({ hasText: 'Beverages' }).first().locator('input[type="checkbox"]') resolved to 8 elements:
    1) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Beverages Parent category' })
    2) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Bread & Bakery Parent' })
    3) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Fresh Fruits Parent category' })
    4) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Fresh Vegetables Parent' })
    5) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Meat & Fish Parent category' })
    6) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Milk & Dairy Parent category' })
    7) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Pantry Parent category pantry' })
    8) <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"/> aka getByRole('checkbox', { name: 'Snacks Parent category snacks' })

Call log:
[2m  - waiting for locator('label').filter({ has: locator('input[type="checkbox"]') }).filter({ hasText: 'Beverages' }).first().locator('input[type="checkbox"]')[22m

## Regressions

- None

## Screenshots

- `C:\Users\user\Documents\ecommerce-react\reports\seller-category-selector-smoke-20260420T045839z-c5wt9m\01-search-category.png`
