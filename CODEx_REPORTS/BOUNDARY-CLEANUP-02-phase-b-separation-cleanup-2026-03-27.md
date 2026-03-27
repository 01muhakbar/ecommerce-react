TASK ID: BOUNDARY-CLEANUP-02
Status: PASS

Yang diamati

- Domain yang diaudit: store profile/public identity, payment profile, readiness, coupon, inventory/fulfillment.
- Shared backend service yang sudah cukup sehat:
  `server/src/services/publicStoreIdentity.ts`
  `server/src/services/storeProfileGovernance.ts`
  `server/src/services/storePaymentProfileState.ts`
  `server/src/services/sellerWorkspaceReadiness.ts`
  `server/src/services/couponGovernance.ts`
- Shared client normalizer yang sudah cukup sehat:
  `client/src/utils/storePublicIdentity.ts`
  seller/admin API normalizer terpisah untuk store profile, payment profile, readiness, coupon, seller orders.
- Coupling boundary yang paling relevan ada di jalur public-safe serializer dan modul API public storefront.

Coupling utama yang ditemukan

- Public store identity sudah punya service shared, tetapi route public dan preview admin belum memakai helper public-safe yang eksplisit dari satu titik contract.
- Public coupon payload masih dibentuk langsung di route, sehingga boundary public-safe coupon belum setegas admin/seller serializer domain coupon.
- Client storefront pages yang butuh public identity masih mengambil fungsi dari `store.service.ts` yang berisi campuran domain storefront checkout/customization/catalog/public identity; secara runtime aman, tetapi ownership modulnya kurang tegas.
- Coupling yang masih tersisa dan belum saya pecah:
  `server/src/routes/store.customization.ts` masih memakai `sanitizeCustomization` dari `server/src/routes/admin.storeCustomization.ts`.
  Ini boundary leak backend yang nyata, tetapi ekstraksinya akan menyentuh sanitizer customization yang besar, jadi saya tandai sebagai follow-up, bukan saya refactor diam-diam di phase ini.

Cleanup yang dilakukan

- Menambahkan helper backend explicit public-safe store identity payload di `server/src/services/publicStoreIdentity.ts`, lalu memakainya di:
  `server/src/routes/store.customization.ts`
  `server/src/routes/admin.storeProfiles.ts`
- Menambahkan helper backend explicit public coupon snapshot di `server/src/services/couponGovernance.ts`, lalu memakainya di:
  `server/src/routes/store.coupons.ts`
- Menambahkan modul client domain-specific `client/src/api/storePublicIdentity.ts` untuk memisahkan public store identity access dari service storefront yang lebih lebar.
- Memindahkan consumer public identity berikut ke modul baru:
  `client/src/components/kachabazar-demo/StoreHeaderKacha.jsx`
  `client/src/pages/store/StoreContactUsPage.jsx`
  `client/src/pages/store/StoreMicrositePage.jsx`
  `client/src/pages/store/StoreMicrositeProductDetailPage.jsx`

File yang diubah

- client/src/api/storePublicIdentity.ts
- client/src/components/kachabazar-demo/StoreHeaderKacha.jsx
- client/src/pages/store/StoreContactUsPage.jsx
- client/src/pages/store/StoreMicrositePage.jsx
- client/src/pages/store/StoreMicrositeProductDetailPage.jsx
- server/src/routes/admin.storeProfiles.ts
- server/src/routes/store.coupons.ts
- server/src/routes/store.customization.ts
- server/src/services/couponGovernance.ts
- server/src/services/publicStoreIdentity.ts

Hasil verifikasi

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS
- Smoke PASS:
  public identity payload `/api/store/customization/identity` tidak lagi mengandung field internal `id`
  public coupon payload `/api/store/coupons` tetap public-safe dan tidak membawa `governance`/`store`
  admin store profile preview `/api/admin/store/profiles` memakai public-safe identity payload yang sama

Dampak ke Seller / Admin / Client

- Seller
  tidak ada perubahan flow bisnis; boundary store/payment/coupon/inventory seller tetap stabil
- Admin
  preview public store profile kini membaca helper public-safe yang eksplisit, jadi drift terhadap storefront lebih kecil
- Client
  public identity access sekarang punya modul API yang lebih jelas domainnya, dan public coupon payload makin tegas sebagai payload storefront-only

Risiko / debt / follow-up

- `store.customization` masih bergantung ke sanitizer dari route admin customization; ini tetap menjadi blocker boundary split backend untuk domain customization/public CMS.
- `client/src/api/store.service.ts` masih memuat terlalu banyak concern storefront sekaligus; phase berikutnya bisa pecah bertahap menjadi:
  `storeCatalog`
  `storeCheckout`
  `storeCustomization`
  `storePublicIdentity`
- Payment profile, readiness, dan fulfillment sudah cukup backend-driven, tetapi client normalizer masih tersebar per-domain dan belum dikumpulkan ke package shared; ini bukan blocker langsung, tapi penting untuk split runtime nanti.

Butuh keputusan user?

Tidak
