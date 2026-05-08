# Seller Product DTO Smoke Report

- Run ID: `seller-dto-smoke-20260420T013219z-u0c0gq`
- Started At: `2026-04-20T01:32:19.901Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Store ID: `1`
- Category: `Beverages`
- Product ID: `-`
- Product Slug: `-`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and references
- Status: `passed`
- Summary: Seller session, store context, and category references are ready.
- Duration: `176ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - cookieName: `"token"`

### 2. Create seller product through UI and capture payload
- Status: `failed`
- Summary: locator.fill: Error: strict mode violation: getByLabel('Base Price') resolved to 2 elements:
    1) <input min="0" value="0" step="0.01" type="number" placeholder="0" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Base Price', exact: true })
    2) <input min="0" value="" step="0.01" type="number" placeholder="Optional" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Sale Price Must stay below' })

Call log:
[2m  - waiting for getByLabel('Base Price')[22m

- Duration: `2232ms`
- Root Cause: locator.fill: Error: strict mode violation: getByLabel('Base Price') resolved to 2 elements:
    1) <input min="0" value="0" step="0.01" type="number" placeholder="0" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Base Price', exact: true })
    2) <input min="0" value="" step="0.01" type="number" placeholder="Optional" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Sale Price Must stay below' })

Call log:
[2m  - waiting for getByLabel('Base Price')[22m

## Mismatches

- None

## Failure

- Step: `2. Create seller product through UI and capture payload`
- Message: locator.fill: Error: strict mode violation: getByLabel('Base Price') resolved to 2 elements:
    1) <input min="0" value="0" step="0.01" type="number" placeholder="0" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Base Price', exact: true })
    2) <input min="0" value="" step="0.01" type="number" placeholder="Optional" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Sale Price Must stay below' })

Call log:
[2m  - waiting for getByLabel('Base Price')[22m

- Root Cause: locator.fill: Error: strict mode violation: getByLabel('Base Price') resolved to 2 elements:
    1) <input min="0" value="0" step="0.01" type="number" placeholder="0" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Base Price', exact: true })
    2) <input min="0" value="" step="0.01" type="number" placeholder="Optional" class="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 mt-2 "/> aka getByRole('spinbutton', { name: 'Sale Price Must stay below' })

Call log:
[2m  - waiting for getByLabel('Base Price')[22m
