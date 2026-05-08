# RK-3APP-01 Boundary Map

## Ringkasan

Repo saat ini **sudah punya pemisahan domain logis yang cukup jelas**, tetapi **belum siap dipisah menjadi 3 runtime terpisah tanpa cleanup bertahap**.

Boundary yang paling jelas hari ini:

- `Admin Workspace`
  - FE route sudah terkonsentrasi di `/admin/*`
  - API sudah terkonsentrasi di `/api/admin/*`
  - authority final untuk governance global, store core identity, store customization, payment approval, dan operational override
- `Seller Workspace`
  - FE route sudah terkonsentrasi di `/seller/stores/:storeSlug/*`
  - API sudah terkonsentrasi di `/api/seller/*`
  - boundary access sudah store-scoped melalui `requireSellerStoreAccess(...)`
- `Client/storefront`
  - FE route publik dan account ada di `/`, `/store/:slug`, `/product/:slug`, `/user/*`
  - API masih tersebar di beberapa namespace: `/api/store/*`, `/api/*` dari `public.ts`, `/api/cart/*`, `/api/checkout/*`, `/api/payments/*`, `/api/orders/*`

Yang belum bersih:

- auth FE masih satu `AuthProvider` untuk admin, seller, dan client
- seller masih menumpang login customer/storefront, belum punya auth entry terpisah
- client domain memakai beberapa namespace backend sekaligus (`/api/store/*`, `/api/*`, `/api/stores/*`)
- ada lane legacy/account yang masih overlap dengan seller/admin payment/store flow
- beberapa source of truth sudah rapi di service shared, tetapi namespace route publik vs admin customization masih bercampur secara naming

## Boundary Summary

| Domain | Frontend Surface | Backend Surface | Access Boundary | Source of Truth |
| --- | --- | --- | --- | --- |
| Admin Workspace | `/admin/*` | `/api/admin/*`, `/api/auth/admin/*` | role-based: `staff/admin/super_admin` | admin-governed global operations and overrides |
| Seller Workspace | `/seller/stores/:storeSlug/*` | `/api/seller/*` | store-scoped permission matrix via `requireSellerStoreAccess(...)` | seller operations on active store scope, admin-reviewed where needed |
| Client/storefront | `/`, `/store/:slug`, `/product/:slug`, `/user/*` | `/api/store/*`, `/api/*`, `/api/cart/*`, `/api/checkout/*`, `/api/orders/*`, `/api/payments/*` | public + customer auth | public-safe storefront read model and customer account flows |

## Route Per Domain

### Admin Workspace

Frontend route groups:

- `/admin/login`
- `/admin/forbidden`
- `/admin`
- `/admin/dashboard`
- `/admin/products`
- `/admin/products/new`
- `/admin/products/:id`
- `/admin/orders`
- `/admin/orders/:invoiceNo`
- `/admin/customers`
- `/admin/customers/:id`
- `/admin/categories`
- `/admin/categories/:code`
- `/admin/categories/id/:id`
- `/admin/coupons`
- `/admin/attributes`
- `/admin/our-staff`
- `/admin/staff` alias
- `/admin/languages`
- `/admin/currencies`
- `/admin/online-store/store-profile`
- `/admin/online-store/store-payment`
- `/admin/online-store/payment-review`
- `/admin/online-store/payment-audit`
- `/admin/online-store/payment-audit/:orderId`
- `/admin/store/customization`
- `/admin/customization` alias
- `/admin/store/store-settings`
- `/admin/store/payment-profiles`
- `/admin/settings`
- `/admin/profile`

Backend route groups:

- `/api/auth/admin/login`
- `/api/auth/admin/logout`
- `/api/admin/catalog/*`
- `/api/admin/stats/*`
- `/api/admin/analytics/*`
- `/api/admin/products/*`
- `/api/admin/orders/*`
- `/api/admin/customers/*`
- `/api/admin/notifications/*`
- `/api/admin/payments/audit/*`
- `/api/admin/categories/*`
- `/api/admin/coupons/*`
- `/api/admin/attributes/*`
- `/api/admin/attributes/:id/values`
- `/api/admin/products/:id/attributes`
- `/api/admin/settings/*`
- `/api/admin/languages/*`
- `/api/admin/currencies/*`
- `/api/admin/store/customization/*`
- `/api/admin/store/profiles*`
- `/api/admin/store/settings/*`
- `/api/admin/stores/payment-profiles`
- `/api/admin/stores/:storeId/identity`
- `/api/admin/stores/:storeId/payment-profile/review`
- `/api/admin/staff/*`
- `/api/admin/uploads`
- `/api/admin/me`

### Seller Workspace

Frontend route groups:

- `/seller/stores/:storeSlug`
- `/seller/stores/:storeSlug/dashboard`
- `/seller/stores/:storeSlug/store-profile`
- legacy redirect `/seller/stores/:storeSlug/profile`
- `/seller/stores/:storeSlug/team`
- `/seller/stores/:storeSlug/team/:memberId`
- `/seller/stores/:storeSlug/team/audit`
- `/seller/stores/:storeSlug/catalog`
- `/seller/stores/:storeSlug/catalog/new`
- `/seller/stores/:storeSlug/catalog/:productId`
- `/seller/stores/:storeSlug/catalog/:productId/edit`
- `/seller/stores/:storeSlug/orders`
- `/seller/stores/:storeSlug/orders/:suborderId`
- `/seller/stores/:storeSlug/payment-review`
- `/seller/stores/:storeSlug/payment-profile`

Backend route groups:

- `/api/seller/stores/:storeId/context`
- `/api/seller/stores/slug/:storeSlug/context`
- `/api/seller/stores/:storeId/readiness`
- `/api/seller/stores/slug/:storeSlug/readiness`
- `/api/seller/stores/:storeId/store-profile`
- legacy alias `/api/seller/stores/:storeId/profile`
- `/api/seller/stores/:storeId/payment-profile`
- `/api/seller/stores/:storeId/payment-profile/submit`
- `/api/seller/stores/:storeId/payment-profile` update lane
- `/api/seller/stores/:storeId/products*`
- `/api/seller/stores/:storeId/suborders*`
- `/api/seller/payments/:paymentId/review`
- `/api/seller/stores/:storeId/team*`
- `/api/seller/invitations*`

### Client / Storefront

Frontend route groups:

- `/`
- `/demo/kachabazar`
- `/search`
- `/category`
- `/category/:slug`
- `/product/:slug`
- `/cart`
- `/checkout`
- `/checkout/success`
- `/order/:ref`
- `/about-us`
- `/contact-us`
- `/privacy-policy`
- `/terms`
- `/terms-and-conditions`
- `/faq`
- `/faqs`
- `/offers`
- `/auth/login`
- `/auth/register`
- `/user/dashboard`
- `/user/my-orders`
- `/user/my-orders/:id`
- `/user/my-orders/:id/payment`
- `/user/notifications`
- `/user/my-reviews`
- `/user/my-account`
- `/user/shipping-address`
- `/user/store-invitations`
- `/user/update-profile`
- `/user/change-password`
- `/store/:slug`
- `/store/:slug/products/:productSlug`

Backend route groups:

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/cart/*`
- `/api/checkout/*`
- `/api/orders/:orderId/checkout-payment`
- `/api/payments/:paymentId`
- `/api/payments/:paymentId/proof`
- `/api/payments/:paymentId/cancel`
- `/api/store/*`
  - catalog/product detail/store microsite data
  - checkout-facing store grouping
  - reviews
  - order tracking
- `/api/store/coupons/*`
- `/api/store/customization/*`
- `/api/store/settings`
- `/api/categories`
- `/api/products`
- `/api/products/:slug`
- `/api/user/*`
- `/api/notifications*`
- `/api/stores/mine`
- `/api/stores/:storeId/payment-profile` legacy/account-owned lane

## API Ownership Map

### Admin Workspace Owns

- global catalog administration
- global order and payment audit visibility
- store core identity governance: `Store.name`, `Store.slug`, `Store.status`
- store customization and marketplace-wide content
- payment profile approval, rejection, and active snapshot promotion
- staff and admin operations

### Seller Workspace Owns

- store-scoped operational view
- seller product drafting/edit/publish lane
- store-scoped suborder handling
- seller team/member management
- seller-editable store profile fields
- seller payment profile request/draft lane
- onboarding/readiness read model for active store

### Client / Storefront Owns

- public catalog consumption
- customer account and addresses
- cart and checkout
- buyer payment proof upload
- public store identity and microsite consumption
- customer notifications and profile

## Ownership Entity Matrix

| Entity | Primary Owner | Other Consumers | Seller-Owned Fields | Admin-Owned Fields | Public-Safe Fields | Source of Truth |
| --- | --- | --- | --- | --- | --- | --- |
| Store core identity | Admin | Seller, Client | none | `name`, `slug`, `status` | `name`, `slug` | `Store` + `storeProfileGovernance.ts` |
| Store profile metadata | Seller | Admin preview, Client | `description`, logo/banner, contact, social, address | none | same seller-owned fields | `Store` + `storeProfileGovernance.ts` + `publicStoreIdentity.ts` |
| Customer-facing store identity | Shared contract over `Store` | Seller preview, Admin preview, Client | description/contact/media/address | name/slug/status feed | public-safe subset only | `publicStoreIdentity.ts` |
| Store customization | Admin | Client | none | header copy, contact-page layout, rich microsite content | sanitized public output only | `admin.storeCustomization.ts` + `store.customization.ts` |
| Product | Seller operationally, Admin globally | Client | draft/edit/store-scoped product data | global moderation/override still available | published storefront-safe fields | `Product` + seller/admin product routes |
| Order / Suborder | Client creates, Admin global oversight, Seller store-scoped ops | all 3 | seller handles store-owned suborders | admin global status and audit | buyer-facing order/payment status only | `Order`, `Suborder`, `Payment` |
| Payment profile | Seller drafts request, Admin final approval | Client checkout reads active snapshot | request payload fields | review decision, activation, promotion | checkout-safe active snapshot only | `StorePaymentProfile`, `StorePaymentProfileRequest`, `storePaymentProfileState.ts` |
| Team / Membership | Seller domain | Admin only indirectly | member lifecycle, invites, store roles | none global in current flow | none | `StoreMember`, `StoreRole`, `resolveSellerAccess.ts` |
| Customer account | Client | none direct | personal profile, addresses, notifications | none | n/a | `public.ts` account controllers |

## Auth and Access Boundary

### Current State

- Admin FE and storefront FE share one `AuthProvider`.
- Both admin login and customer login write the same auth cookie name.
- Admin authorization is role-based after `/api/auth/me`.
- Seller authorization is **not role-only**; it is store-scoped and permission-scoped via:
  - `requireSellerStoreAccess(...)`
  - `resolveSellerAccess(...)`

### What Is Already Good

- seller boundary is store-scoped, not global-role-scoped
- admin boundary is explicit at backend route mount level
- public storefront can already consume public-safe store identity without reading admin-only fields

### What Blocks Runtime Separation Later

- one FE auth context currently mixes admin and storefront session semantics
- one auth cookie and one `/api/auth/me` probe are still shared
- seller has no dedicated login/session adapter; it piggybacks storefront user auth

## Shared Modules Yang Aman Dipertahankan

These are good candidates to stay shared or be extracted into shared packages before runtime split:

- `packages/schemas`
- `server/src/services/publicStoreIdentity.ts`
- `server/src/services/storeProfileGovernance.ts`
- `server/src/services/storePaymentProfileState.ts`
- `server/src/services/storePaymentProfileCompat.ts`
- `server/src/services/sellerWorkspaceReadiness.ts`
- `server/src/services/seller/resolveSellerAccess.ts`
- `server/src/utils/rbac.ts`
- `client/src/utils/storePublicIdentity.ts`

## Coupling dan Split Risks

### High

- **Shared FE auth context**
  - admin, seller, and client still share one session provider and storage hint strategy
- **Seller depends on storefront login**
  - seller has its own workspace routes, but not its own auth entry or isolated session contract
- **Client domain spans multiple backend namespaces**
  - split gateway will be harder while client consumes `/api`, `/api/store`, `/api/cart`, `/api/checkout`, `/api/payments`, `/api/orders`, `/api/stores`

### Medium

- **Account pages still overlap legacy business lanes**
  - `/user/store-payment-profile` and related account-era payment/store flows overlap newer seller/admin lanes
- **Store identity and store customization are logically separate but still adjacent in public route namespace**
  - `store.customization.ts` serves both customization-derived content and public store identity helpers
- **Legacy compatibility routes still exist**
  - good for transition now, but they increase split surface later

### Low to Medium

- **Admin pages consume seller/shared serializers**
  - this is healthy today, but shared contracts must be versioned carefully once runtimes split
- **Public seller info on product/store pages depends on shared store serializer**
  - good shared contract, but should move into explicit shared package before split

## Recommended Phase Split

### Phase A: Logical Boundary Cleanup

- freeze canonical route ownership:
  - admin only under `/admin/*`
  - seller only under `/seller/*`
  - client only under public + `/user/*`
- deprecate or mark legacy account/store payment lanes that overlap seller/admin
- define one canonical API namespace per app domain
- document canonical entity ownership in code comments and report docs
- keep compatibility aliases, but tag them as legacy

### Phase B: Shared Contract Extraction

- extract shared serializers/contracts into shared package(s):
  - store public identity contract
  - store profile governance contract
  - payment profile workflow contract
  - seller readiness summary contract
- isolate frontend API clients by domain:
  - `client app` API module
  - `seller app` API module
  - `admin app` API module
- isolate auth adapters from UI layout logic

### Phase C: Runtime Separation Readiness

- prepare three FE entrypoints/builds without changing business logic yet
- prepare backend route gateway boundaries:
  - admin API
  - seller API
  - storefront API
- decide cookie/session topology:
  - shared auth gateway
  - or dedicated session surfaces per app
- only after contracts stabilize, separate deployments

## Readiness Verdict

Current readiness for split:

- **Logical split readiness**: `PASS`
- **Shared contract readiness**: `PARTIAL`
- **Runtime separation readiness**: `PARTIAL`

Conclusion:

- The repo is ready for **boundary cleanup and shared-contract extraction**
- The repo is **not yet ready for immediate 3-runtime separation** without added auth/session and namespace cleanup
