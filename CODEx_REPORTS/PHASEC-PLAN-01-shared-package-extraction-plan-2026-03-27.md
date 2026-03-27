# PHASEC-PLAN-01 Shared Package / Module Extraction Plan

## Verdict

Repo saat ini **cukup siap untuk extraction package/module bertahap**, tetapi **belum siap untuk split runtime**. Jalur paling aman adalah memecah boundary menjadi paket logis dulu, bukan memindahkan aplikasi secara agresif.

## Shared-Safe Candidates

### Backend shared-safe

- `server/src/services/publicStoreIdentity.ts`
  - kandidat `server/src/services/sharedContracts/storePublicIdentity.ts`
  - alasan: sudah public-safe, dipakai lintas admin preview dan storefront
- `server/src/services/storeCustomizationSanitizer.ts`
  - kandidat `server/src/services/sharedContracts/storeCustomizationPublic.ts`
  - alasan: shaping public-safe sudah netral, bukan route admin lagi
- `server/src/services/couponGovernance.ts`
  - kandidat `server/src/services/sharedContracts/couponGovernance.ts`
  - alasan: dipakai admin, seller, storefront
- `server/src/services/storeProfileGovernance.ts`
  - kandidat `server/src/services/sharedContracts/storeProfileGovernance.ts`
  - alasan: governance seller/admin/public sudah eksplisit
- `server/src/services/storePaymentProfileState.ts`
  - kandidat `server/src/services/sharedContracts/storePaymentProfileState.ts`
  - alasan: serializer/workflow state dipakai seller dan admin
- `server/src/services/storePaymentProfileCompat.ts`
  - kandidat `server/src/services/sharedContracts/storePaymentProfileCompat.ts`
  - alasan: helper active snapshot store payment profile lintas seller/admin
- `server/src/services/orderPaymentAggregation.service.ts`
  - kandidat `server/src/services/sharedDomain/orderPaymentAggregation.ts`
  - alasan: domain order/payment netral, tidak admin-only
- `server/src/services/paymentCheckoutView.service.ts`
  - kandidat `server/src/services/sharedDomain/paymentCheckoutView.ts`
  - alasan: shaping payment checkout state untuk client/account

### Client shared-safe

- `client/src/api/store.types.ts`
  - kandidat `client/src/api/shared/storefrontTypes.ts`
- `client/src/auth/authDomainHooks.js`
  - kandidat `client/src/auth/shared/domainHooks.js`
  - alasan: sudah jadi adapter boundary admin/seller/account
- `client/src/components/seller/SellerWorkspaceFoundation.jsx`
  - kandidat `client/src/components/workspace/` atau `client/src/components/primitives/workspace/`
  - alasan: primitives seller workspace sudah netral untuk internal workspace UI
- `client/src/components/UI/*`
  - kandidat `client/src/components/primitives/ui/`
- `client/src/components/ui-states/*`
  - kandidat `client/src/components/primitives/state/`
- `client/src/utils/format.js`
  - kandidat `client/src/utils/shared/format.ts`
- `client/src/utils/cn.ts`
  - kandidat `client/src/utils/shared/cn.ts`
- `client/src/utils/orderStatus.js`
  - kandidat `client/src/utils/shared/orderStatus.ts`
- `client/src/utils/storePublicIdentity.ts`
  - kandidat `client/src/utils/storefront/storePublicIdentity.ts`

### Client API shared-safe by package boundary

- `client/src/api/storePublicIdentity.ts`
- `client/src/api/storeCustomizationPublic.ts`
- `client/src/api/storeCoupons.ts`
- `client/src/api/storeProducts.ts`
- `client/src/api/storeOrders.ts`
- `client/src/api/storeCheckout.ts`

Ini sudah cukup dekat ke target package:

- `client/src/api/public/*`
- `client/src/api/shared/*`

## Domain-Specific Modules

### Admin-only

- `client/src/api/admin*.ts`
- `client/src/pages/admin/*`
- `client/src/components/admin/*`
- `client/src/components/AdminGuard.jsx`
- `client/src/components/guards/RequirePerm.jsx`
- `server/src/routes/admin.*.ts`
- `server/src/routes/admin.ts`
- `server/src/services/adminGovernance/*` belum ada folder khusus, tetapi domainnya jelas berasal dari:
  - `admin.storeProfiles.ts`
  - `admin.storePaymentProfiles.ts`
  - `admin.storeCustomization.ts`
  - `admin.analytics.ts`
  - `admin.stats.ts`

### Seller-only

- `client/src/api/seller*.ts`
- `client/src/pages/seller/*`
- `client/src/layouts/SellerLayout.jsx`
- `client/src/utils/sellerWorkspaceRoute.js`
- `server/src/routes/seller.*.ts`
- `server/src/services/seller/*`
- `server/src/services/sellerWorkspaceReadiness.ts`
- `server/src/services/sellerWorkspaceAnalytics.ts`

### Client/public-only

- `client/src/pages/store/*`
- `client/src/components/store/*`
- `client/src/components/kachabazar-demo/*`
- `client/src/components/Layout/StoreLayout.jsx`
- `client/src/api/store*.ts`
- `client/src/api/cartApi.ts`
- `client/src/api/orderPayments.ts`
- `server/src/routes/store.ts`
- `server/src/routes/store.coupons.ts`
- `server/src/routes/store.customization.ts`
- `server/src/routes/checkout.ts`
- `server/src/routes/cartRoutes.ts`
- `server/src/routes/payments.ts`

### Client/account-only

- `client/src/components/AccountGuard.jsx`
- `client/src/layouts/AccountLayout.jsx`
- `client/src/api/user*.ts`
- `client/src/pages/account/*`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/store/StoreRegisterPage.jsx`
- `server/src/routes/auth.ts`
- `server/src/routes/userRoutes.ts`

## Anti-Candidates

Module berikut belum layak diextract jadi shared package sekarang:

- `client/src/auth/AuthContext.jsx`
  - masih shared session runtime utama
  - masih jadi blocker split auth
- `client/src/routes/ProtectedRoute.jsx`
- `client/src/routes/RoleRoute.jsx`
  - sudah legacy dan admin-oriented; tidak layak dijadikan shared guard package
- `server/src/routes/checkout.ts`
  - domainnya terlalu sensitif dan masih menggabungkan cart, coupon, stock guard, order create, payment create
- `server/src/routes/store.ts`
  - masih memuat banyak surface storefront sekaligus
- `client/src/pages/store/Checkout.jsx`
  - sudah cukup stabil, tetapi terlalu feature-heavy untuk extraction sekarang
- `client/src/components/Layout/Sidebar.jsx`
  - masih admin navigation monolith, bukan shared navigation primitive
- `client/src/components/Layout/MainLayout.jsx`
  - masih menyatukan concern storefront/account shell
- `client/src/api/index.ts`
  - facade lama, tidak cocok jadi source-of-truth package

## Dependency Map

### Bisa dipindah dulu

1. Backend shared contracts
   - `publicStoreIdentity`
   - `storeCustomizationSanitizer`
   - `couponGovernance`
   - `storeProfileGovernance`
   - `storePaymentProfileState`
2. Client public API modules
   - `storePublicIdentity`
   - `storeCustomizationPublic`
   - `storeCoupons`
   - `storeProducts`
   - `storeOrders`
   - `storeCheckout`
3. Shared UI/state primitives
   - `components/UI/*`
   - `components/ui-states/*`
   - `components/seller/SellerWorkspaceFoundation.jsx` setelah direname ke workspace primitives

### Menunggu cleanup kecil lagi

1. `client/src/auth/*`
   - menunggu boundary auth final lebih rapi
2. `server/src/services/sellerWorkspaceReadiness.ts`
   - aman secara seller-only, tetapi belum perlu dijadikan shared package
3. `server/src/services/sellerWorkspaceAnalytics.ts`
   - seller-only, menunggu keputusan apakah analytics jadi domain seller package murni

### Menunggu refactor yang lebih besar

1. `server/src/routes/checkout.ts`
2. `server/src/routes/store.ts`
3. `client/src/pages/store/Checkout.jsx`
4. `client/src/auth/AuthContext.jsx`

## Rencana Extraction Bertahap

### Phase C1

- Bentuk boundary folder/package logis tanpa memindahkan runtime:
  - `server/src/services/sharedContracts/*`
  - `client/src/api/public/*`
  - `client/src/components/primitives/*`
- Pindahkan shared-safe service/helper lebih dulu.
- Pertahankan alias/re-export compatibility.

### Phase C2

- Rapikan package domain internal:
  - `server/src/services/seller/*`
  - `server/src/services/adminGovernance/*`
  - `client/src/api/admin/*`
  - `client/src/api/seller/*`
- Tujuan:
  - import tree sudah bicara domain ownership, bukan lokasi historis file

### Phase C3

- Rapikan boundary auth dan storefront heavy modules untuk split-prep:
  - `client/src/auth/*` dipilah menjadi core + domain adapters + session support
  - audit ulang `checkout.ts` dan `store.ts` untuk decomposition route/service berikutnya
- Hasil target:
  - repo siap masuk ke logical workspace/package extraction yang lebih agresif tanpa mengubah produk

## Area yang Jangan Disentuh Dulu

- auth/session backend
- checkout runtime flow besar
- payment gateway integration
- payout/settlement
- customization CMS UI
- route tree aplikasi

## Output Target Setelah Plan Ini Dieksekusi

- package/module shared-safe benar-benar kecil dan netral
- domain admin/seller/client makin tegas
- import ownership mudah dipetakan ke 3 aplikasi masa depan
- blocker runtime split tersisa hanya auth/session, route shell, dan deployment topology
