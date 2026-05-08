TASK ID: PHASEC-EXTRACT-01

Extraction Summary

Tujuan yang tercapai

- `client/src/api/store.service.ts` tidak lagi menjadi implementasi monolitik.
- Implementasi storefront API sudah dipisah per domain.
- `store.service.ts` sekarang hanya facade compatibility untuk import lama.

Domain API modules yang dibuat

- `client/src/api/store.types.ts`
  - shared types untuk storefront/public domain
- `client/src/api/storeProducts.ts`
  - categories
  - products
  - product detail
- `client/src/api/storeOrders.ts`
  - create order legacy single-store
  - fetch order
  - fetch my orders
- `client/src/api/storeCheckout.ts`
  - multi-store checkout create
  - checkout preview
- `client/src/api/storeCoupons.ts`
  - public coupon list
  - coupon validate
  - coupon quote
- `client/src/api/storeCustomizationPublic.ts`
  - public customization
  - header customization
  - microsite rich about
  - store settings
- `client/src/api/storePublicIdentity.ts`
  - public store identity

Ownership domain hasil extraction

- `storeProducts`
  - client/public storefront catalog domain
- `storeCheckout`
  - client/public checkout domain
- `storeCoupons`
  - client/public coupon validation domain
- `storeOrders`
  - client/account order tracking domain
- `storeCustomizationPublic`
  - client/public CMS snapshot domain
- `storePublicIdentity`
  - client/public store identity domain
- `store.types`
  - shared-safe contract untuk client/public modules

Compatibility note

- `client/src/api/store.service.ts` tetap dipertahankan sebagai facade re-export.
- Behavior runtime tidak diubah.
- Import lama masih aman, tetapi consumer aktif sudah dipindah ke modul domain yang lebih tepat.

Consumer yang sudah dipindah dari facade

- `client/src/hooks/useStoreCategories.ts`
- `client/src/components/Layout/StoreLayout.jsx`
- `client/src/components/kachabazar-demo/StoreHeaderKacha.jsx`
- `client/src/storefront.jsx`
- `client/src/layouts/AccountLayout.jsx`
- `client/src/pages/account/AccountDashboardPage.jsx`
- `client/src/pages/account/AccountOrdersPage.jsx`
- `client/src/pages/account/AccountProfilePage.jsx`
- `client/src/pages/store/Checkout.jsx`
- `client/src/pages/store/KachaBazarDemoHomePage.jsx`
- `client/src/pages/store/StoreAboutUsPage.jsx`
- `client/src/pages/store/StoreCategoryPage.jsx`
- `client/src/pages/store/StoreCheckoutPage.jsx`
- `client/src/pages/store/StoreContactUsPage.jsx`
- `client/src/pages/store/StoreFaqPage.jsx`
- `client/src/pages/store/StoreMicrositePage.jsx`
- `client/src/pages/store/StoreMicrositeProductDetailPage.jsx`
- `client/src/pages/store/StoreOffersPage.jsx`
- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `client/src/pages/store/StorePrivacyPolicyPage.jsx`
- `client/src/pages/store/StoreTermsAndConditionsPage.jsx`

Verifikasi boundary

- Tidak ada import langsung `store.service.ts` yang tersisa di `client/src`.
- Circular import baru tidak terdeteksi pada build client.
- `storePublicIdentity.ts` tidak lagi bergantung ke `store.service.ts`.
