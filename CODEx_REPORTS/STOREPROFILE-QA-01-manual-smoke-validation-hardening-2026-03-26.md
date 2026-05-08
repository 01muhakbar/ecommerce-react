# CODEx REPORT

## Task

- Task ID: `STOREPROFILE-QA-01`
- Title: `Manual Smoke Validation + Hardening Fix untuk Seller/Admin/Client Store Profile Sync`
- Date: `2026-03-26`

## Scope Executed

- Manual/browser smoke validation for:
  - Seller legacy route `/seller/stores/:storeSlug/profile`
  - Seller canonical route `/seller/stores/:storeSlug/store-profile`
  - Admin route `/admin/online-store/store-profile`
  - Public storefront `/store/:slug`
  - Public microsite product detail `/store/:slug/products/:productSlug`
- Minimal hardening fix only for defects verified during smoke
- Build verification for `server` and `client`

## Environment Used

- App root: `C:\Users\user\Documents\ecommerce-react`
- Client: `http://localhost:5173`
- Server/API: `http://localhost:3001`
- Browser automation for smoke: Playwright in local repo
- Test store: `super-admin-1`
- Test admin/seller account: `superadmin@local.dev`

## Defects Found

### 1. Seller legacy route did not redirect before auth/layout resolution

**Observed**

- Opening `/seller/stores/super-admin-1/profile` while unauthenticated stayed on the legacy URL.
- The page showed seller session-required state, but the browser URL remained `/profile`.

**Risk**

- Legacy URL contract was only partially honored.
- CTA/back-forward/session restore could preserve deprecated seller URL longer than intended.

**Fix**

- Added a top-level redirect route for `/seller/stores/:storeSlug/profile` so redirect happens before seller layout/auth/context resolution.
- Kept canonical seller route at `/seller/stores/:storeSlug/store-profile`.

### 2. Public store identity payload leaked internal `id`

**Observed**

- Public identity route still returned `id` in `/api/store/customization/identity/:slug`.
- This conflicted with the internal contract note that marks `id` as internal-only.

**Risk**

- Public payload exposed an unnecessary internal identifier.
- Contract drift between public-safe governance and actual client payload.

**Fix**

- Stripped `id` from public identity responses in the public storefront route.
- Updated client-side public identity types/normalizer to match the public-safe contract.

## Files Changed

- `client/src/App.jsx`
- `server/src/routes/store.customization.ts`
- `client/src/api/store.service.ts`
- `client/src/utils/storePublicIdentity.ts`

## Smoke Validation Summary

### Seller

- Legacy route now redirects correctly:
  - `/seller/stores/super-admin-1/profile`
  - redirects to `/seller/stores/super-admin-1/store-profile`
- Canonical route loads normally.
- Seller sidebar active state for `Store Profile` is correct.
- Seller title/subtitle remain correct.
- Seller-owned save flow works.
- Admin-owned `Store Name` remains locked in seller edit mode.

### Admin

- `Online Store > Store Profile` page opens normally.
- Governance sections render:
  - `Seller-Editable Preview`
  - `Public-Safe Storefront Preview`
  - `Admin-Owned Governance Matrix`
- Admin core identity save flow works from the new admin lane.

### Client / Storefront

- Seller-owned store fields synced to `/store/super-admin-1` during smoke:
  - description
  - phone
  - city
- Admin-owned name sync also reflected to the storefront during smoke.
- Empty/incomplete store fallback remains safe on `/store/status-log-store-a`.
- Public microsite product detail remained consistent on:
  - `/store/super-admin-1/products/lorong-keheningan-abadi`

## Public Payload Validation

- Re-checked `/api/store/customization/identity/super-admin-1`
- Result:
  - no `id` field in response payload
  - public-safe fields still present

## Build Verification

- `pnpm --filter server build` ✅
- `pnpm --filter client build` ✅

## Notes

- Smoke test data written during validation was restored to neutral state after verification.
- No schema change, auth change, association change, or large refactor was introduced.

## Outcome

- PASS with hardening fixes applied.
