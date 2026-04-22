# Seller Product Client Flow Report

- Run ID: `svflow-20260419T124926z-0x5su9`
- Started At: `2026-04-19T12:49:26.307Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Product ID: `836`
- Final Product Slug: `svflow-20260419t124926z-0x5su9-draft`
- Overall Status: `failed`

## Steps

### 1. Create product from Seller
- Status: `passed`
- Summary: Seller authentication, store context, image upload, and draft creation completed.
- Duration: `58409ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - uploadedPrimaryImage: `"/uploads/products/1776603025273-586327398.jpg"`
  - uploadedSecondaryImage: `"/uploads/products/1776603025294-88082024.png"`
  - productId: `836`
  - slug: `"svflow-20260419t124926z-0x5su9-draft"`
  - createStatus: `201`

### 2. Save as draft and check DB/API response
- Status: `passed`
- Summary: Draft state is consistent across seller API and database, and remains hidden from public client APIs.
- Duration: `116ms`
- Proof:
  - dbStatus: `"draft"`
  - dbPublished: `0`
  - promoImagePath: `"/uploads/products/1776603025273-586327398.jpg"`
  - imagePaths: `["/uploads/products/1776603025273-586327398.jpg","/uploads/products/1776603025294-88082024.png"]`
  - publicListContainsDraft: `false`
  - publicDetailStatus: `404`

### 3. Publish product
- Status: `passed`
- Summary: Seller publish succeeded and persisted active/public product state.
- Duration: `52ms`
- Proof:
  - publishStatus: `200`
  - responseVisibility: `{"isPublished":true,"storefrontVisible":true,"stateCode":"STOREFRONT_VISIBLE","label":"Published","publishLabel":"Published","sellerLabel":"Visible in storefront","storefrontLabel":"Visible in storefront","storefrontReason":"Public storefront queries include this product because publish is on, status is active, and the store is operational.","sellerHint":"Seller and customer views are aligned for visibility.","blockingSignals":[],"reasonCode":"STOREFRONT_VISIBLE","storeOperational":true,"operationalReadiness":{"code":"READY","label":"Operational","description":"This store has an active approved payment setup and can be treated as operational on public store-facing lanes.","isReady":true}}`
  - dbStatus: `"active"`
  - dbPublished: `1`

### 4. Open Client and check product appears
- Status: `failed`
- Summary: locator.waitFor: Error: strict mode violation: locator('text=Products') resolved to 5 elements:
    1) <p class="max-w-2xl text-sm leading-6 text-emerald-50/95">Shop public products from this store.</p> aka getByText('Shop public products from')
    2) <a data-discover="true" href="/store/super-admin-1?view=products#store-products" class="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Products</a> aka getByRole('link', { name: 'Products' }).first()
    3) <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50/80">Products</p> aka getByRole('paragraph').filter({ hasText: /^Products$/ })
    4) <a data-discover="true" href="/store/super-admin-1?view=products&q=svflow-20260419T124926z-0x5su9#store-products" class="inline-flex h-10 items-center justify-center border-b-2 px-1 text-sm font-semibold transition border-emerald-600 text-slate-900">Products</a> aka getByRole('link', { name: 'Products' }).nth(1)
    5) <span>All Products</span> aka getByRole('button', { name: 'All Products' })

Call log:
[2m  - waiting for locator('text=Products') to be visible[22m

- Duration: `4291ms`
- Root Cause: locator.waitFor: Error: strict mode violation: locator('text=Products') resolved to 5 elements:
    1) <p class="max-w-2xl text-sm leading-6 text-emerald-50/95">Shop public products from this store.</p> aka getByText('Shop public products from')
    2) <a data-discover="true" href="/store/super-admin-1?view=products#store-products" class="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Products</a> aka getByRole('link', { name: 'Products' }).first()
    3) <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50/80">Products</p> aka getByRole('paragraph').filter({ hasText: /^Products$/ })
    4) <a data-discover="true" href="/store/super-admin-1?view=products&q=svflow-20260419T124926z-0x5su9#store-products" class="inline-flex h-10 items-center justify-center border-b-2 px-1 text-sm font-semibold transition border-emerald-600 text-slate-900">Products</a> aka getByRole('link', { name: 'Products' }).nth(1)
    5) <span>All Products</span> aka getByRole('button', { name: 'All Products' })

Call log:
[2m  - waiting for locator('text=Products') to be visible[22m

## Failure

- Step: `4. Open Client and check product appears`
- Message: locator.waitFor: Error: strict mode violation: locator('text=Products') resolved to 5 elements:
    1) <p class="max-w-2xl text-sm leading-6 text-emerald-50/95">Shop public products from this store.</p> aka getByText('Shop public products from')
    2) <a data-discover="true" href="/store/super-admin-1?view=products#store-products" class="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Products</a> aka getByRole('link', { name: 'Products' }).first()
    3) <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50/80">Products</p> aka getByRole('paragraph').filter({ hasText: /^Products$/ })
    4) <a data-discover="true" href="/store/super-admin-1?view=products&q=svflow-20260419T124926z-0x5su9#store-products" class="inline-flex h-10 items-center justify-center border-b-2 px-1 text-sm font-semibold transition border-emerald-600 text-slate-900">Products</a> aka getByRole('link', { name: 'Products' }).nth(1)
    5) <span>All Products</span> aka getByRole('button', { name: 'All Products' })

Call log:
[2m  - waiting for locator('text=Products') to be visible[22m

- Root Cause: locator.waitFor: Error: strict mode violation: locator('text=Products') resolved to 5 elements:
    1) <p class="max-w-2xl text-sm leading-6 text-emerald-50/95">Shop public products from this store.</p> aka getByText('Shop public products from')
    2) <a data-discover="true" href="/store/super-admin-1?view=products#store-products" class="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Products</a> aka getByRole('link', { name: 'Products' }).first()
    3) <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50/80">Products</p> aka getByRole('paragraph').filter({ hasText: /^Products$/ })
    4) <a data-discover="true" href="/store/super-admin-1?view=products&q=svflow-20260419T124926z-0x5su9#store-products" class="inline-flex h-10 items-center justify-center border-b-2 px-1 text-sm font-semibold transition border-emerald-600 text-slate-900">Products</a> aka getByRole('link', { name: 'Products' }).nth(1)
    5) <span>All Products</span> aka getByRole('button', { name: 'All Products' })

Call log:
[2m  - waiting for locator('text=Products') to be visible[22m
