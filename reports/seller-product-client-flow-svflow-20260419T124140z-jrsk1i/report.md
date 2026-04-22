# Seller Product Client Flow Report

- Run ID: `svflow-20260419T124140z-jrsk1i`
- Started At: `2026-04-19T12:41:40.030Z`
- Server Base URL: `http://localhost:3001`
- Client Base URL: `http://localhost:5173`
- Store Slug: `super-admin-1`
- Seller Email: `superadmin@local.dev`
- Product ID: `835`
- Final Product Slug: `svflow-20260419t124140z-jrsk1i-draft`
- Overall Status: `failed`

## Steps

### 1. Create product from Seller
- Status: `passed`
- Summary: Seller authentication, store context, image upload, and draft creation completed.
- Duration: `306ms`
- Proof:
  - storeId: `1`
  - categoryId: `6`
  - categoryName: `"Beverages"`
  - uploadedPrimaryImage: `"/uploads/products/1776602500310-191637454.jpg"`
  - uploadedSecondaryImage: `"/uploads/products/1776602500336-76266164.png"`
  - productId: `835`
  - slug: `"svflow-20260419t124140z-jrsk1i-draft"`
  - createStatus: `201`

### 2. Save as draft and check DB/API response
- Status: `failed`
- Summary: Access denied for user 'root'@'localhost' (using password: YES)
- Duration: `46ms`
- Root Cause: Access denied for user 'root'@'localhost' (using password: YES)

## Failure

- Step: `2. Save as draft and check DB/API response`
- Message: Access denied for user 'root'@'localhost' (using password: YES)
- Root Cause: Access denied for user 'root'@'localhost' (using password: YES)
