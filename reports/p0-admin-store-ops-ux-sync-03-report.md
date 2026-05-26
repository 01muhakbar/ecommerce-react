# P0-ADMIN-STORE-OPS-UX-SYNC-03 Report

## Ringkasan perubahan

- Memadatkan primitive Admin Store Ops: badge/header/metric/loading state lebih ringkas, tahan teks panjang, dan konsisten untuk halaman target.
- Mengubah Admin Global Settings agar memakai `AdminOpsPageHeader`, `AdminOpsLoadingState`, dan `AdminOpsErrorState`.
- Menambahkan redirect alias aman:
  - `/admin/online-store/store-settings` -> `/admin/store/store-settings`
  - `/admin/online-store/store-applications` -> `/admin/store/applications`
- Memperbaiki key React duplikat di Admin Store Profile agar browser smoke bersih dari console error.
- Tidak mengubah schema, backend behavior, auth, permission, payment, checkout, order, shipping, atau source of truth runtime.

## File diubah

- `client/src/App.jsx`
- `client/src/components/admin/AdminOpsPrimitives.jsx`
- `client/src/pages/Settings.jsx`
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-ops-ux-sync-03-report.md`

## File dibaca

- `README.md`
- `CODex_PLAYBOOK.md`
- `ACUAN_UI_MAP.md`
- `reports/p0-store-ops-smoke-sync-02-report.md`
- `client/src/App.jsx`
- `client/src/components/admin/AdminOpsPrimitives.jsx`
- `client/src/pages/Settings.jsx`
- `client/src/pages/admin/StoreCustomization.jsx`
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `client/src/pages/admin/StoreSettings.jsx`
- `client/src/pages/admin/AdminStorePaymentProfilesPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminShippingReconciliationPage.jsx`
- `client/src/pages/admin/AdminStoreApplicationsPage.jsx`
- `client/src/pages/admin/AdminStoreApplicationDetailPage.jsx`
- `client/src/api/adminStoreProfile.ts`
- `client/src/api/storePaymentProfiles.ts`
- `client/src/api/sellerStoreProfile.ts`
- `client/src/api/sellerPaymentProfile.ts`
- `client/src/api/storeCustomizationPublic.ts`
- `client/src/api/storePublicIdentity.ts`
- `client/src/lib/adminApi.js`
- `server/src/app.ts`
- `server/src/routes/admin.storeProfiles.ts`
- `server/src/routes/admin.storeCustomization.ts`
- `server/src/routes/admin.storeSettings.ts`
- `server/src/routes/admin.storePaymentProfiles.ts`
- `server/src/routes/admin.payments.audit.ts`
- `server/src/routes/admin.storeApplications.ts`
- `server/src/routes/store.customization.ts`
- `server/src/routes/store.settings.ts`
- `server/src/routes/seller.storeProfile.ts`
- `server/src/routes/seller.paymentProfiles.ts`

## QA command + hasil

- `pnpm --filter client exec vite build`: NOT RUN via PowerShell alias, blocked by local `pnpm.ps1` execution policy.
- `pnpm -F server build`: NOT RUN via PowerShell alias, blocked by local `pnpm.ps1` execution policy.
- `pnpm.cmd --filter client exec vite build`: PASS. Vite emitted existing large chunk warning only.
- `pnpm.cmd -F server build`: PASS.
- `pnpm.cmd -F server smoke:store-settings`: PASS.
- `pnpm.cmd -F server smoke:admin-store-payment-profiles`: PASS.
- `pnpm.cmd -F server smoke:store-readiness`: PASS.
- `pnpm.cmd -F server smoke:admin-store-application`: PASS.
- `pnpm.cmd -F server smoke:order-payment`: PASS.
- `pnpm.cmd -F server smoke:shipment-regression`: PASS. Expected negative-path logs appeared for guarded shipment transitions.
- `git diff --check`: PASS.
- Playwright browser check on `http://localhost:5173`: PASS for desktop 1440px and tablet 768px.

Browser check covered:
- `/admin/settings`
- `/admin/store/customization?storeTab=home-settings`
- `/admin/online-store/store-profile`
- `/admin/store/store-settings`
- `/admin/online-store/store-settings`
- `/admin/store/payment-profiles`
- `/admin/online-store/payment-audit`
- `/admin/online-store/shipping-reconciliation`
- `/admin/store/applications`
- `/admin/online-store/store-applications`
- First available `/admin/store/applications/:applicationId`

Artifact:
- `.codex-artifacts/p0-admin-store-ops-ux-sync-03/admin-store-ops-browser-check.json`

## Dampak Admin/Seller/Client/Backend

### Admin
- Header, badge, metric, loading, and error surfaces are denser and more consistent.
- Alias routes now redirect to existing canonical routes with the same permission guard.
- Store Profile no longer emits duplicate React key console errors during browser smoke.

### Seller
- No Seller route, permission, API, payment profile, or store profile behavior changed.
- Seller Store Profile and Seller Payment Profile contracts were reviewed; smoke coverage stayed green through readiness/payment tests.

### Client / Storefront
- No public storefront route or public customization/settings contract changed.
- Public readiness and checkout-facing settings were validated by `smoke:store-readiness`, `smoke:store-settings`, `smoke:order-payment`, and `smoke:shipment-regression`.

### Backend / API
- No backend files were changed.
- Admin/Seller/Store endpoints remain the source of truth.
- No schema, migration, payment, checkout, order, shipment, auth, permission, or store ownership behavior changed.

## Risiko tersisa

- Browser check used the existing local dev server at `localhost:5173`; starting an additional dev server moved Vite to `5174`, but that helper process was stopped.
- Store Profile and Store Payment pages can still be long with large store counts; this task improved density and key stability, not pagination/search architecture.
- Vite still reports an existing large chunk warning.

## Saran next task

- Add a dedicated checked-in Playwright Admin Store Ops smoke that logs in, verifies canonical routes plus aliases, and checks desktop/tablet overflow.
- Add stable seller browser fixture coverage for Seller Store Profile and Seller Payment Profile.
