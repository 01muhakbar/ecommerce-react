# Seller Product DTO Smoke Report

- Run ID: `seller-dto-smoke-20260420T013247z-cjazyt`
- Started At: `2026-04-20T01:32:47.587Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Store ID: `1`
- Category: `Beverages`
- Product ID: `842`
- Product Slug: `seller-dto-smoke-20260420t013247z-cjazyt-draft`
- Overall Status: `failed`

## Steps

### 1. Bootstrap seller session and references
- Status: `passed`
- Summary: Seller session, store context, and category references are ready.
- Duration: `193ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - cookieName: `"token"`

### 2. Create seller product through UI and capture payload
- Status: `failed`
- Summary: Create payload slug mismatch.
- Duration: `3101ms`
- Root Cause: Create payload slug mismatch.

## Mismatches

- None

## Failure

- Step: `2. Create seller product through UI and capture payload`
- Message: Create payload slug mismatch.
- Root Cause: Create payload slug mismatch.
