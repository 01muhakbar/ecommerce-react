TASK ID: PHASEC-PLAN-01
Status: PASS

Yang diamati

- `CODEx_REPORTS/RK-3APP-01-boundary-map-2026-03-26.md`
- `CODEx_REPORTS/RK-3APP-02-phase-c-cleanup-plan-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-01-domain-api-modules-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-02-boundary-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-03-auth-boundary-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-04-auth-cleanup-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-05-guard-auth-boundary-summary-2026-03-27.md`
- struktur `client/src/api`
- struktur `client/src/auth`
- struktur `client/src/components`
- struktur `client/src/pages/admin`
- struktur `client/src/pages/seller`
- struktur `client/src/pages/store`
- struktur `server/src/routes`
- struktur `server/src/services`

Shared-safe candidates

- Backend:
  - `publicStoreIdentity.ts`
  - `storeCustomizationSanitizer.ts`
  - `couponGovernance.ts`
  - `storeProfileGovernance.ts`
  - `storePaymentProfileState.ts`
  - `storePaymentProfileCompat.ts`
  - `orderPaymentAggregation.service.ts`
  - `paymentCheckoutView.service.ts`
- Client:
  - `storePublicIdentity.ts`
  - `storeCustomizationPublic.ts`
  - `storeCoupons.ts`
  - `storeProducts.ts`
  - `storeOrders.ts`
  - `storeCheckout.ts`
  - `store.types.ts`
  - `authDomainHooks.js`
  - `components/UI/*`
  - `components/ui-states/*`
  - `components/seller/SellerWorkspaceFoundation.jsx`
  - `utils/cn.ts`
  - `utils/format.js`
  - `utils/orderStatus.js`

Domain-specific modules

- Admin-only:
  - `client/src/api/admin*.ts`
  - `client/src/pages/admin/*`
  - `client/src/components/admin/*`
  - `server/src/routes/admin.*.ts`
- Seller-only:
  - `client/src/api/seller*.ts`
  - `client/src/pages/seller/*`
  - `client/src/layouts/SellerLayout.jsx`
  - `client/src/utils/sellerWorkspaceRoute.js`
  - `server/src/routes/seller.*.ts`
  - `server/src/services/seller/*`
  - `server/src/services/sellerWorkspaceReadiness.ts`
  - `server/src/services/sellerWorkspaceAnalytics.ts`
- Client/public-only:
  - `client/src/pages/store/*`
  - `client/src/components/store/*`
  - `client/src/components/kachabazar-demo/*`
  - `client/src/api/store*.ts`
  - `client/src/api/cartApi.ts`
  - `server/src/routes/store.ts`
  - `server/src/routes/store.coupons.ts`
  - `server/src/routes/store.customization.ts`
  - `server/src/routes/checkout.ts`
- Client/account-only:
  - `client/src/components/AccountGuard.jsx`
  - `client/src/api/user*.ts`
  - `client/src/pages/account/*`
  - `server/src/routes/auth.ts`
  - `server/src/routes/userRoutes.ts`

Anti-candidates

- `client/src/auth/AuthContext.jsx`
- `server/src/routes/checkout.ts`
- `server/src/routes/store.ts`
- `client/src/pages/store/Checkout.jsx`
- `client/src/components/Layout/Sidebar.jsx`
- `client/src/components/Layout/MainLayout.jsx`
- `client/src/api/index.ts`
- legacy guard files:
  - `client/src/routes/ProtectedRoute.jsx`
  - `client/src/routes/RoleRoute.jsx`

Dependency map

- First move:
  - backend shared contract services
  - client public API modules
  - shared UI/state primitives
- Move later:
  - auth support modules
  - seller analytics/readiness modules as seller-only package candidates
- Hold:
  - checkout route/page
  - storefront monolith route
  - auth core/session runtime

Rencana extraction bertahap

- Phase C1:
  - bentuk boundary folder/package logis shared-safe
  - pindahkan service/helper netral dengan compatibility re-export
- Phase C2:
  - rapikan package domain internal admin/seller/client API
  - bikin import tree berbasis ownership domain
- Phase C3:
  - cleanup auth core + storefront heavy routes untuk split-prep lebih lanjut
  - audit ulang `checkout.ts` dan `store.ts` setelah package boundary stabil

File yang diubah

- `CODEx_REPORTS/PHASEC-PLAN-01-shared-package-extraction-plan-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-PLAN-01-shared-package-extraction-report-2026-03-27.md`

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Butuh keputusan user?

- Tidak
