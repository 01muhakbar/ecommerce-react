# P0-STORE-OPS-SMOKE-SYNC-02 Report

## Ringkasan Hasil Smoke

Browser smoke berhasil untuk 8 halaman canonical Admin Store Operations dan 1 detail Store Application memakai login UI di `http://localhost:5173`.

Hasil utama:
- Semua route canonical admin terbuka dengan HTTP 200.
- Tidak ada redirect ke `/admin/login` setelah login UI.
- Tidak ada console warning/error pada route canonical.
- Tidak ada page-level horizontal overflow pada desktop 1440px dan tablet 768px.
- Badge penting terlihat dari data backend: Ready, Verified, Needs attention, Missing, Action needed, Inactive.
- Client/storefront home, microsite public by slug, dan checkout route terbuka tanpa crash atau page overflow.
- Endpoint public store settings/customization/identity tetap 200.

Catatan route:
- Prompt menyebut `/admin/online-store/store-settings`, tetapi route existing yang terdaftar adalah `/admin/store/store-settings`.
- Prompt menyebut `/admin/online-store/store-applications`, tetapi route existing yang terdaftar adalah `/admin/store/applications`.
- Dua prompt-path tersebut menghasilkan React Router `No routes matched location`. Tidak saya ubah karena task melarang perubahan route.

Artifact smoke:
- `reports/p0-store-ops-smoke-sync-02-artifacts/smoke-results-ui-login.json`
- `reports/p0-store-ops-smoke-sync-02-artifacts/sync-endpoint-results.json`
- `reports/p0-store-ops-smoke-sync-02-artifacts/client-storefront-smoke-results.json`
- Screenshot desktop/tablet/client tersimpan di folder artifact yang sama.

## Daftar Route Yang Dicek

Admin canonical:
- `/admin/settings`
- `/admin/store/customization?storeTab=home-settings`
- `/admin/online-store/store-profile`
- `/admin/store/store-settings`
- `/admin/store/payment-profiles`
- `/admin/online-store/payment-audit`
- `/admin/online-store/shipping-reconciliation`
- `/admin/store/applications`
- `/admin/store/applications/30`

Prompt aliases yang diaudit:
- `/admin/online-store/store-settings` -> tidak terdaftar
- `/admin/online-store/store-applications` -> tidak terdaftar

Client/storefront:
- `/`
- `/store/e2e-truth-1779250491935-order-store`
- `/checkout`

## Temuan Visual/UI

- Admin Settings: terbuka normal. Badge settings/brand/SMTP tampil, tidak ada overflow page.
- Store Customization: Ready/Verified tampil, layout desktop dan tablet stabil.
- Store Profile: data 40 stores tampil lengkap, status Needs attention/Missing/Ready terlihat. Risiko sisa: halaman sangat panjang dengan data banyak, tetapi tidak crash dan tidak overflow page.
- Store Settings: Missing/Verified/Inactive/No active method tampil sesuai diagnostics backend.
- Store Payment: Ready/Verified/Inactive snapshot tampil. Nama store panjang ter-truncate, tidak menyebabkan page overflow.
- Payment Audit: Action needed/Needs attention tampil; table memakai `overflow-x-auto`, jadi overflow internal terkontrol.
- Shipping Reconciliation: empty/readiness state tampil ringkas, tidak ada overflow.
- Store Applications list/detail: Ready/Verified/Cancelled/Not Public tampil; table overflow internal terkontrol di tablet.

## Temuan Sinkronisasi Admin <-> Seller <-> Client

Backend-driven checks:
- `/api/admin/store/profiles` -> 200, 40 stores.
- `/api/admin/stores/payment-profiles` -> 200, 40 stores.
- `/api/admin/store/settings` -> 200, includes `storeSettings` dan `diagnostics`.
- `/api/admin/payments/audit` -> 200, 10 items.
- `/api/admin/store-applications` -> 200, 4 applications.
- `/api/store/settings` -> 200, public-safe settings.
- `/api/store/customization?lang=en&include=home` -> 200.
- `/api/store/customization/header?lang=en` -> 200.
- `/api/store/customization/identity` -> 200.
- `/api/store/customization/identity/:slug` for first admin store slug -> 200.

Seller boundary:
- Seller profile/payment endpoints with admin session returned 401, which is expected workspace isolation.
- Seller-specific API behavior was covered by relevant server smokes that create seller clients and passed.

Payment/order/shipping:
- `smoke:order-payment` passed, covering checkout guardrails, proof approval/rejection, payment expiry, and Seller/Admin visibility sync.
- `smoke:shipment-regression` passed, covering seller shipping setup, shipment mutation gating, tracking timeline, admin correction, and legacy fallback.
- Shipping reconciliation UI stayed read-only in the browser smoke; no fulfillment mutation was changed.

## File Diubah

Current task:
- `server/src/scripts/smokeAdminStoreApplications.ts`
- `reports/p0-store-ops-smoke-sync-02-report.md`
- `reports/p0-store-ops-smoke-sync-02-artifacts/*`

Small smoke-script fix:
- Admin fixture login in `smokeAdminStoreApplications.ts` now uses `/api/auth/admin/login`.
- Reason: current auth policy rejects admin role login through `/api/auth/login` with `ADMIN_WORKSPACE_LOGIN_REQUIRED`.
- No runtime route/API/permission/payment/schema behavior changed.

## File Dibaca Tapi Tidak Diubah

Frontend/admin:
- `client/src/components/admin/AdminOpsPrimitives.jsx`
- `client/src/pages/admin/StoreCustomization.jsx`
- `client/src/pages/admin/StoreSettings.jsx`
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `client/src/pages/admin/AdminStorePaymentProfilesPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminShippingReconciliationPage.jsx`
- `client/src/pages/admin/AdminStoreApplicationsPage.jsx`
- `client/src/pages/admin/AdminStoreApplicationDetailPage.jsx`
- `client/src/App.jsx`

Frontend/seller/client/api:
- `client/src/pages/seller/SellerStoreProfilePage.jsx`
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- `client/src/api/adminStoreProfile.ts`
- `client/src/api/storePaymentProfiles.ts`
- `client/src/api/storeCustomizationPublic.ts`
- `client/src/api/storePublicIdentity.ts`
- `client/src/api/sellerStoreProfile.ts`
- `client/src/api/sellerPaymentProfile.ts`

Backend/routes:
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

## QA Command + Hasil

- Browser smoke Admin canonical routes: PASS.
- Browser smoke Client/storefront routes: PASS.
- Endpoint sync audit: PASS, except seller endpoints with admin cookie correctly returned 401 boundary.
- `pnpm.cmd --filter client exec vite build`: PASS.
- `pnpm.cmd -F server build`: PASS.
- `git diff --check`: PASS.
- `pnpm.cmd -F server smoke:store-settings`: PASS.
- `pnpm.cmd -F server smoke:admin-store-payment-profiles`: PASS.
- `pnpm.cmd -F server smoke:store-readiness`: PASS.
- `pnpm.cmd -F server smoke:admin-store-application`: PASS after smoke-script login fix.
- `pnpm.cmd -F server smoke:order-payment`: PASS.
- `pnpm.cmd -F server smoke:shipment-regression`: PASS.

Note:
- Vite at `localhost:5174` hit expected dev CORS restriction because server only whitelists `http://localhost:5173` by default. Final browser smoke used `http://localhost:5173`.

## Risiko Tersisa

- Two prompt paths are not real app routes. This is a documentation/navigation alignment risk, not a regression from this task.
- Store Profile and Store Payment pages can become very long with many stores. Current smoke shows no crash/overflow, but a future UX task may need search/filter density improvements.
- Seller browser workspace was not smoke-tested with a persistent manual seller credential; seller sync was validated through endpoint contract review and server smokes.
- Checkout browser route only validated safe render state without an active cart. Full checkout/payment semantics were validated by server smoke scripts.

## Rekomendasi Next Task

- Decide whether to add approved redirects for `/admin/online-store/store-settings` and `/admin/online-store/store-applications`, or update task/navigation docs to canonical routes.
- Add a dedicated Playwright smoke script for Admin Store Ops that performs UI login and captures these canonical routes.
- Add a stable seller browser smoke fixture so Seller Store Profile and Seller Payment Profile can be tested visually without relying on ad hoc credentials.
