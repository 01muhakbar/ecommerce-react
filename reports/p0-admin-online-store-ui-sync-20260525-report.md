# P0 Admin Online Store UI/UX Hardening + Fullstack Sync Audit

Date: 2026-05-25

## Summary

Patch pertama dibatasi ke dua halaman prioritas:

- `/admin/store/applications`
- `/admin/online-store/store-profile`

Perubahan utama:

- Store Applications mendapat primary action `Review Next`, tombol refresh, dan status quick filters agar queue review lebih cepat dipindai.
- Store Profile mendapat ringkasan sync per toko: Admin Core, Seller Profile, dan Client Gate.
- Backend Admin Store Profile sekarang memuat `paymentProfile` dan `activePaymentProfile`, sehingga `publicIdentity.summary.operationalReadiness` di Admin memakai sumber kesiapan yang sama dengan Seller Workspace dan Storefront.

## Files Changed

- `client/src/pages/admin/AdminStoreApplicationsPage.jsx`
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `server/src/routes/admin.storeProfiles.ts`
- `reports/p0-admin-online-store-ui-sync-20260525-report.md`

## Audit Notes

Routes checked:

- `/admin/store/applications`
- `/admin/online-store/store-profile`
- `/admin/store/store-settings`
- `/admin/store/customization`
- `/admin/store/payment-profiles`
- `/admin/online-store/payment-audit`
- `/admin/online-store/shipping-reconciliation`
- `/admin/settings`

Observed state:

- The Online Store navigation already points to canonical admin routes and keeps legacy compatibility redirects.
- Most priority pages already use `AdminOpsPrimitives` for page headers, metric cards, badges, loading, error, and empty states.
- `StoreCustomization.jsx` is still the largest/riskiest UI file and should be handled in a separate patch, not mixed into this first slice.
- No new mock/fallback source of truth was added.

## Admin Impact

- Store application review queue is easier to scan and act on.
- Admin Store Profile now shows a compact cross-workspace status lane per store.
- Admin readiness cards now receive payment profile context from the backend instead of presenting all stores as payment-not-configured when Storefront/Seller might already be ready.

## Seller Impact

- No Seller Workspace routes or UI were changed.
- Store Profile sync now matches the seller route pattern by loading the same payment profile associations for readiness calculation.
- Seller-owned fields remain read-only in Admin and editable only from Seller Workspace.

## Client Impact

- No Storefront route/UI was changed.
- Admin Store Profile now mirrors the Storefront readiness gate more accurately because the admin route includes payment profile associations before calling the public identity serializer.
- Public Storefront/microsite behavior remains gated by existing backend readiness contracts.

## Backend/API Impact

- `GET /api/admin/store/profiles` now includes `paymentProfile` and `activePaymentProfile` associations internally.
- `PATCH /api/admin/store/profiles/:storeId` reloads the same associations for the updated response.
- No DB schema, migration, auth/session, checkout, payment lifecycle, shipping lifecycle, or route canonical change was made.

## Tests

Install:

- `pnpm.cmd install` passed.
- Direct `pnpm install` via PowerShell failed first because local script execution is disabled. Retried with `pnpm.cmd install`.

Build:

- `pnpm.cmd -F client build` passed.
- `pnpm.cmd -F server build` passed.

Smoke:

- `pnpm.cmd -F server smoke:store-application` passed after starting local server.
- `pnpm.cmd -F server smoke:admin-store-application` passed.
- `pnpm.cmd -F server smoke:store-readiness` passed.
- `pnpm.cmd -F server smoke:store-settings` passed.
- `pnpm.cmd -F server smoke:admin-store-payment-profiles` passed.

Initial smoke note:

- First `smoke:store-application` attempt failed with `TypeError: fetch failed` and `ECONNREFUSED` because `http://localhost:3001` was not running.
- A temporary local server was started for smoke tests and stopped after verification.

## Risks

- Store Applications summary cards are still based on the visible page, not aggregate status counts across all pages. That is existing API behavior and was not expanded in this patch.
- Store Customization remains dense and should not be refactored casually due to its breadth and public storefront coupling.
- No browser screenshot QA was run in this patch; verification was build plus backend smoke.

## Next Recommended Task

Patch `/admin/store/payment-profiles` and `/admin/online-store/payment-audit` together next, focusing on payment profile readiness, audit action hierarchy, and checkout payment status visibility without touching payment lifecycle rules.
