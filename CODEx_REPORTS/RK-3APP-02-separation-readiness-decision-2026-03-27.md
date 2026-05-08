TASK ID: RK-3APP-02

Separation Readiness Verdict

- Verdict: `Ready for Phase C extraction`
- Makna verdict:
  - repo sudah cukup stabil untuk masuk ke phase pemisahan logical package/module
  - repo belum siap untuk split runtime/deployment 3 aplikasi
  - blocker yang tersisa sudah cukup sempit, jadi tidak butuh refactor arsitektur besar hanya untuk memulai Phase C

Ringkasan keputusan

- Domain seller sudah paling banyak membaik:
  - canonical route stabil
  - store/payment profile sudah backend-driven
  - readiness sudah punya source of truth backend
  - seller coupon sudah store-scoped
  - seller inventory/fulfillment sudah lebih tegas boundary-nya
- Domain admin tetap paling rapi secara ownership:
  - `/admin/*`
  - `/api/admin/*`
  - authority final untuk governance global
- Domain client/public sudah jauh lebih aman daripada audit awal, terutama:
  - public store identity sudah punya serializer eksplisit
  - public coupon payload sudah public-safe
  - multi-store checkout coupon sudah scope-aware per store group
- Blocker besar yang tersisa sekarang lebih banyak di layer packaging/boundary, bukan di business flow inti

Matrix domain ownership terbaru

- Admin-only
  - admin coupon governance untuk `PLATFORM`
  - admin visibility dan override untuk coupon `STORE`
  - admin final review untuk payment profile
  - admin online store customization/CMS
  - admin order audit lintas store
- Seller-only
  - seller store profile editing lane
  - seller payment profile draft/request lane
  - seller readiness workspace lane
  - seller coupon `STORE`
  - seller inventory updates store aktif
  - seller fulfillment/suborder operations
  - seller team/member workspace
- Client/public-only
  - storefront catalog listing/detail
  - `/store/:slug` dan microsite consumption
  - cart/checkout/order placement
  - payment submission flow buyer
  - account pages pembeli
- Shared-safe
  - `packages/schemas`
  - `server/src/services/publicStoreIdentity.ts`
  - `server/src/services/storeProfileGovernance.ts`
  - `server/src/services/storePaymentProfileState.ts`
  - `server/src/services/sellerWorkspaceReadiness.ts`
  - `server/src/services/couponGovernance.ts`
  - `server/src/utils/rbac.ts`
  - `client/src/api/storePublicIdentity.ts`
  - `client/src/utils/storePublicIdentity.ts`

Blocker tersisa

- FE auth masih menyatu di satu provider:
  - `client/src/auth/AuthContext.jsx`
  - dipakai oleh admin, seller, dan client/account
- Backend public customization masih bocor ownership:
  - `server/src/routes/store.customization.ts` masih import `sanitizeCustomization` dari `server/src/routes/admin.storeCustomization.ts`
- API storefront di client masih terlalu gemuk:
  - `client/src/api/store.service.ts` masih mencampur catalog, checkout, coupons, customization, dan public contract
- Seller masih menumpang auth/session storefront:
  - ini belum blocker untuk Phase C extraction
  - ini masih blocker untuk runtime split di fase berikutnya

Candidate shared modules/package extraction

- Backend shared contract/service
  - `publicStoreIdentity`
  - `storeProfileGovernance`
  - `storePaymentProfileState`
  - `sellerWorkspaceReadiness`
  - `couponGovernance`
- Client public modules
  - `storePublicIdentity`
  - `storeCatalog`
  - `storeCheckout`
  - `storeCoupons`
  - `storeCustomization`
- Client workspace modules
  - `sellerWorkspaceRoute`
  - seller API modules yang sudah spesifik domain
  - admin API modules yang sudah spesifik domain

Yang belum layak dipisah sekarang

- Auth/session FE
- route admin customization sanitizer
- `client/src/api/store.service.ts` sebagai satu paket besar

Keputusan lanjut

- Tidak perlu 1 boundary cleanup besar lagi sebelum mulai Phase C.
- Yang dibutuhkan adalah Phase C cleanup terfokus:
  - ekstraksi sanitizer customization ke service netral
  - pecah `store.service.ts`
  - tandai modul auth sebagai blocker runtime, bukan blocker extraction

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS
