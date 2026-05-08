TASK ID: RK-3APP-01
Status: PASS

Ringkasan boundary

- Admin Workspace sudah paling rapi: FE di `/admin/*`, API di `/api/admin/*`, authority final untuk governance global.
- Seller Workspace sudah cukup jelas: FE di `/seller/stores/:storeSlug/*`, API di `/api/seller/*`, access boundary sudah store-scoped melalui `requireSellerStoreAccess(...)`.
- Client/storefront paling menyebar: FE route publik dan account sudah jelas, tetapi API masih tersebar di beberapa namespace.
- Boundary map bisa ditentukan tanpa refactor besar, jadi STOP condition tidak kena.

Route per domain

- Admin:
  - `/admin/*` untuk dashboard, catalog, orders, customers, staff, settings, online-store, profile.
- Seller:
  - `/seller/stores/:storeSlug/*` untuk overview, store profile, catalog, orders, payment review, payment profile, team.
- Client/storefront:
  - `/`, `/product/:slug`, `/store/:slug`, `/store/:slug/products/:productSlug`, `/cart`, `/checkout`, `/auth/*`, `/user/*`, static content pages.

API per domain

- Admin:
  - `/api/auth/admin/*`
  - `/api/admin/*`
- Seller:
  - `/api/seller/*`
- Client/storefront:
  - `/api/auth/*`
  - `/api/cart/*`
  - `/api/checkout/*`
  - `/api/orders/*`
  - `/api/payments/*`
  - `/api/store/*`
  - `/api/store/coupons/*`
  - `/api/store/customization/*`
  - `/api/store/settings`
  - `/api/categories`
  - `/api/products`
  - `/api/user/*`
  - `/api/stores/*` legacy/account overlap

Ownership entity

- Store core identity:
  - owner utama: Admin
  - seller/client consume snapshot
- Store profile metadata:
  - owner utama: Seller
  - admin lihat preview
  - client baca public-safe subset
- Customer-facing store identity:
  - source of truth: `Store` dengan serializer public-safe
- Store customization:
  - owner utama: Admin
- Product:
  - seller owns store-scoped authoring and operations
  - admin keeps global override/governance
  - client reads published storefront-safe version
- Order / payment:
  - client initiates checkout
  - seller handles store-scoped operations
  - admin keeps cross-store audit/override
- Payment profile:
  - seller owns request/draft lane
  - admin owns final approval and activation
- Team/member:
  - owner utama: Seller domain

Shared module yang aman

- `packages/schemas`
- `server/src/services/publicStoreIdentity.ts`
- `server/src/services/storeProfileGovernance.ts`
- `server/src/services/storePaymentProfileState.ts`
- `server/src/services/storePaymentProfileCompat.ts`
- `server/src/services/sellerWorkspaceReadiness.ts`
- `server/src/services/seller/resolveSellerAccess.ts`
- `server/src/utils/rbac.ts`
- `client/src/utils/storePublicIdentity.ts`

Coupling/risk

- Shared FE auth context untuk admin, seller, dan client masih jadi coupling terbesar.
- Seller masih menumpang login storefront, belum punya auth/session adapter terpisah.
- Client domain masih memakai banyak namespace backend, sehingga split gateway belum bersih.
- Legacy account/store payment lane masih overlap dengan seller/admin lane baru.
- Public store identity dan store customization sudah dipisah secara logic, tapi namespace route publiknya masih berdekatan dan bisa membingungkan saat split.

Rekomendasi phase split

- Phase A: logical boundary clean-up
  - tetapkan canonical route dan API ownership per domain
  - tandai/depresiasi legacy lane yang overlap
- Phase B: package/shared module extraction
  - ekstrak contract serializer/governance yang sudah stabil
  - pisahkan API client per domain aplikasi
- Phase C: runtime separation readiness
  - siapkan entrypoint/build terpisah
  - siapkan boundary gateway API
  - putuskan strategi auth/session lintas 3 app

File yang diubah

- `CODEx_REPORTS/RK-3APP-01-boundary-map-2026-03-26.md`
- `CODEx_REPORTS/RK-3APP-01-boundary-map-separation-readiness-report-2026-03-26.md`

Hasil build

- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus

Butuh keputusan user?

- Ya
- Keputusan yang akan dibutuhkan sebelum split runtime:
  - seller tetap memakai auth storefront atau dipisah
  - lane account legacy yang overlap mau dipertahankan sementara atau dijadwalkan sunset
  - namespace API public/client mau disatukan atau tetap multi-namespace dengan gateway
