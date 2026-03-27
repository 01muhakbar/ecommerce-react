TASK ID: PHASEC-EXTRACT-01
Status: PASS

Yang diamati

- `client/src/api/store.service.ts` berisi campuran domain:
  - products/catalog
  - orders
  - checkout
  - coupons
  - customization public
  - store settings
  - public identity
- Consumer storefront, account, dan checkout masih banyak menarik langsung dari file monolitik itu.
- `storePublicIdentity.ts` sebelumnya masih hanya facade ke `store.service.ts`, jadi boundary public identity belum benar-benar lepas.

Perubahan yang dilakukan

- Membuat shared type module:
  - `client/src/api/store.types.ts`
- Memecah implementasi ke modul domain:
  - `client/src/api/storeProducts.ts`
  - `client/src/api/storeOrders.ts`
  - `client/src/api/storeCheckout.ts`
  - `client/src/api/storeCoupons.ts`
  - `client/src/api/storeCustomizationPublic.ts`
  - `client/src/api/storePublicIdentity.ts`
- Mengubah `client/src/api/store.service.ts` menjadi compatibility facade berbasis re-export.
- Memindahkan consumer utama storefront/account/checkout ke modul domain yang lebih tepat.

File yang diubah

- `client/src/api/store.types.ts`
- `client/src/api/storeProducts.ts`
- `client/src/api/storeOrders.ts`
- `client/src/api/storeCheckout.ts`
- `client/src/api/storeCoupons.ts`
- `client/src/api/storeCustomizationPublic.ts`
- `client/src/api/storePublicIdentity.ts`
- `client/src/api/store.service.ts`
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

API/route yang ditambah

- Tidak ada route/backend contract baru.
- API client module baru:
  - `storeProducts`
  - `storeOrders`
  - `storeCheckout`
  - `storeCoupons`
  - `storeCustomizationPublic`
  - `storePublicIdentity`

Hasil verifikasi

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS
- Tidak ada import langsung `store.service.ts` yang tersisa di `client/src`.
- `store.service.ts` sekarang hanya facade compatibility.
- Tidak ada perubahan behavior produk yang terdeteksi dari extraction ini.

Dampak ke Seller / Admin / Client

- Seller
  - tidak ada perubahan behavior
- Admin
  - tidak ada perubahan behavior
- Client
  - ownership modul API public jauh lebih jelas
  - storefront, checkout, order tracking, dan customization public tidak lagi tergantung langsung ke satu file API monolitik

Risiko / debt / follow-up

- `store.service.ts` masih ada sebagai compatibility layer; ini aman untuk sekarang, tetapi bisa didepresiasi setelah semua import eksternal benar-benar pindah.
- `storeCart` belum dibuat karena fungsi cart tidak berada di `store.service.ts`; domain cart tetap ada di store/hook terpisah.
- Langkah Phase C berikutnya yang paling alami:
  - extraction boundary backend customization sanitizer
  - audit package candidate untuk `client/src/api/public/*`

Butuh keputusan user?

- Tidak
