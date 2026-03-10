# SW-02-PRD-TO-TECH-SPEC

## CODEx REPORT

### Task

Turunkan PRD Multi-Vendor Seller Workspace menjadi technical specification yang spesifik untuk repo `ecommerce-react`.

### Input Basis yang Dipakai

- task prompt ini sebagai working PRD
- hasil audit baseline repo
- dokumen [SW-01-RK-ARCHITECTURE](./SW-01-RK-ARCHITECTURE.md)
- struktur repo aktif di `server/`, `client/`, dan `packages/schemas/`

### Catatan Input yang Tidak Ditemukan di Repo

Tidak ditemukan artefak terpisah untuk:

- PRD seller workspace dalam file tersendiri
- draft database schema seller workspace
- draft API contract seller workspace
- role permission matrix seller workspace

Karena itu technical spec ini memakai task prompt dan dokumen yang sudah disetujui sebagai source of truth kerja yang tersedia saat ini. Ini cukup untuk membuat spec repo-specific untuk phase awal owner-only bridge, tetapi detail DB delta final dan permission matrix final tetap perlu difinalkan pada task berikutnya.

### Files Changed

- `CODEx_REPORTS/SW-02-PRD-TO-TECH-SPEC.md`

### Verification

- cross-check static ke route aktif di `server/src/app.ts` dan `server/src/routes/*`
- cross-check static ke model aktif di `server/src/models/*`
- cross-check static ke frontend route tree di `client/src/App.jsx`
- cross-check static ke frontend API layer dan guards di `client/src/api/*`, `client/src/components/guards/*`, `client/src/components/*`
- verified planning-only scope: tidak ada perubahan runtime code

### Risks / Decisions Needed

- technical spec phase awal cukup matang untuk read-first seller workspace
- write-heavy module tetap tergantung task berikutnya untuk DB delta mapping dan access foundation detail

---

# Technical Specification

## 1. Executive Summary

Technical specification ini menerjemahkan requirement Seller Workspace ke struktur teknis repo `ecommerce-react` dengan constraint arsitektur yang sudah dikunci:

- phase awal harus `owner-only bridge`
- namespace seller workspace final adalah `/api/seller/stores/:storeId/...`
- frontend seller harus area baru terpisah
- compatibility path lama `/api/seller/*` tetap dipertahankan
- checkout, order, dan payment existing tidak disentuh di phase awal

Spec ini memetakan requirement bisnis ke modul teknis yang bisa diimplementasikan bertahap tanpa rewrite besar. Fokus phase awal adalah:

- seller workspace shell
- owner-only access bridge
- store context read
- seller suborder visibility read
- payment profile read

Modul yang butuh fondasi baru atau berisiko tinggi, seperti membership, team members, product write, coupon tenancy, dan storefront content seller, ditandai eksplisit sebagai phase berikutnya atau ditunda.

## 2. Scope Alignment with Approved Architecture

Technical spec ini konsisten dengan keputusan yang sudah disetujui di `SW-01`:

- final architecture option:
  - owner-only bridge phase lalu evolusi ke membership plus store-role
- final backend namespace:
  - `/api/seller/stores/:storeId/...`
- final frontend area:
  - `/seller/*`
  - `client/src/layouts/SellerLayout.jsx`
  - `client/src/pages/seller/*`
- compatibility paths:
  - `/api/seller/suborders`
  - `/api/seller/payments/:paymentId/review`
  - tetap hidup
- non-target phase awal:
  - no checkout rewrite
  - no order contract rewrite
  - no payment contract rewrite
  - no mutation-heavy seller product management

## 3. Existing Repo Baseline Summary

### Active Backend Baseline

- app registration ada di `server/src/app.ts`
- seller-compatible active path:
  - `server/src/routes/seller.payments.ts`
- storefront and account path aktif:
  - `server/src/routes/store.ts`
  - `server/src/routes/stores.ts`
- multi-store checkout foundation aktif:
  - `server/src/routes/checkout.ts`
- grouped order payment read model aktif:
  - `server/src/routes/orders.ts`
- payment detail and proof flow aktif:
  - `server/src/routes/payments.ts`
- admin audit and store payment management aktif:
  - `server/src/routes/admin.payments.audit.ts`
  - `server/src/routes/admin.storePaymentProfiles.ts`

### Active Model Baseline

- `Store` masih single-owner centric via `ownerUserId`
- `Product` memakai `userId + storeId`
- `Suborder`, `SuborderItem`, `Payment`, `PaymentProof`, `StorePaymentProfile` sudah seller-aware
- `Coupon` masih global-only
- `ProductImage` dan `ProductVariant` model terpisah belum ada
- membership dan store-role model belum ada

### Active Frontend Baseline

- admin route tree aktif di `client/src/App.jsx`
- account route tree aktif di `client/src/App.jsx`
- seller-like UI existing masih menempel pada:
  - `client/src/pages/account/AccountStorePaymentProfilePage.jsx`
  - `client/src/pages/account/AccountStorePaymentReviewPage.jsx`
  - `client/src/pages/admin/AdminStorePaymentPage.jsx`
  - `client/src/pages/admin/AdminStorePaymentReviewPage.jsx`
- seller workspace terpisah belum ada

## 4. Technical Design Principles

- seller workspace baru harus coexist dengan route lama
- semua seller access baru harus tenant-scoped by `storeId`
- phase awal access memakai owner-only bridge, bukan membership final
- domain transaksi seller reuse model aktif
- route baru harus lahir dengan bentuk final namespace, supaya transisi access tidak mengubah contract root lagi
- write-heavy features ditahan sampai ownership dan access foundation cukup matang
- `store.ts` overloaded router tidak dijadikan target seller workspace baru
- `admin` tetap platform authority
- `account` tetap buyer/account area, bukan seller workspace final

## 5. Module Breakdown

Modul yang dipetakan dalam spec ini:

- A. Seller Workspace Shell
- B. Store Context
- C. Store Profile
- D. Team Members & Roles
- E. Product Management
- F. Product Media
- G. Product Variants
- H. Store Categories / Collections
- I. Store Attributes
- J. Coupons
- K. Inventory
- L. Seller Suborders
- M. Payment Profile
- N. Storefront Content
- O. Audit Logs
- P. Membership + Store-Role Evolution Layer

## 6. Repo Mapping by Module

### Summary Map

| Module | Phase | Classification | Risk |
|---|---|---|---|
| Seller Workspace Shell | Phase 1 | CREATE NEW | Low |
| Store Context | Phase 1 | EXTEND EXISTING | Low-Medium |
| Store Profile | Phase 3 | EXTEND EXISTING | Medium |
| Team Members & Roles | Phase 2+ | CREATE NEW | High |
| Product Management | Phase 3 | EXTEND EXISTING | High |
| Product Media | Phase 3+ | EXTEND EXISTING | High |
| Product Variants | Phase 3+ | CREATE NEW or EXTEND TRANSITIONAL | High |
| Store Categories / Collections | Phase 3+ | EXTEND EXISTING plus CREATE NEW | Medium-High |
| Store Attributes | Phase 3+ | REUSE EXISTING plus EXTEND EXISTING | Medium |
| Coupons | Phase 4 | EXTEND EXISTING | High |
| Inventory | Phase 4 | EXTEND EXISTING | High |
| Seller Suborders | Phase 1 | REUSE EXISTING | Low |
| Payment Profile | Phase 1 read, Phase 5 write | EXTEND EXISTING | Medium |
| Storefront Content | Phase 4 | EXTEND EXISTING plus CREATE NEW | High |
| Audit Logs | Phase 2+ | REUSE EXISTING plus EXTEND EXISTING | Medium |
| Membership + Store-Role Evolution Layer | Phase 2 | CREATE NEW | High |

## 7. Backend Design Mapping

### Backend Naming Convention

Untuk phase seller workspace, rekomendasi backend adalah:

- route files:
  - `server/src/routes/seller.<module>.ts`
- service files:
  - `server/src/services/seller/<module>.service.ts`
- middleware files:
  - `server/src/middleware/requireSellerStoreAccess.ts`
  - `server/src/middleware/requireSellerMembership.ts`

### Controller Strategy

Repo aktif saat ini lebih route-centric daripada controller-centric untuk domain yang paling baru. Karena itu phase seller workspace disarankan:

- tidak memaksa folder `controllers/seller` di phase awal
- gunakan route file tipis plus service file
- jika kompleksitas meningkat di phase berikutnya, baru pecah ke controller

### Shared Backend Rules

- semua route seller baru memakai `requireAuth`
- semua route seller baru membawa `:storeId` di URL
- semua query seller harus memfilter tenant lewat `storeId` atau relasi ke `storeId`
- semua write action seller nantinya wajib lewat middleware tenant access baru

## 8. Frontend Design Mapping

### Frontend Naming Convention

- layout:
  - `client/src/layouts/SellerLayout.jsx`
- route pages:
  - `client/src/pages/seller/*`
- components:
  - `client/src/components/seller/*`
- api clients:
  - `client/src/api/seller*.ts`
- guards:
  - `client/src/components/guards/SellerGuard.jsx`
  - optional `SellerStoreGuard.jsx`

### Shared Frontend Rules

- seller route tree hidup di `/seller/*`
- seller workspace tidak masuk ke `/admin/*`
- seller workspace tidak ditumpuk permanen ke `/user/*`
- seller pages harus menampilkan store context jelas dari URL `:storeId`
- phase awal read-only pages cukup untuk membuka shell yang stabil

## 9. Access / Permission Design Mapping

### Phase 1 Access Model

- auth source:
  - `requireAuth`
- tenant source:
  - `storeId` dari URL
- authority source:
  - `Store.ownerUserId === req.user.id`

### Future Access Model

- auth source:
  - tetap `requireAuth`
- tenant source:
  - tetap `storeId` dari URL
- authority source:
  - membership relation per store
  - store-role and permission mapping

### Frontend Access Model

- tambah `SellerGuard` untuk auth
- tambah `SellerStoreGuard` untuk validasi akses store
- jangan reuse `RequirePerm` admin sebagai seller permission engine

## 10. Data Ownership & Tenant Isolation Rules

- seller route baru harus selalu menerima `storeId` dari path, bukan body
- query ke order seller harus turun ke `Suborder.storeId`, bukan `Order.userId`
- query ke payment seller harus turun ke `Payment.storeId` atau `Suborder.storeId`
- query ke payment profile seller harus turun ke `StorePaymentProfile.storeId`
- product seller nantinya harus diperlakukan by `Product.storeId` sebagai tenant key utama, bukan `userId` saja
- compatibility logic owner-only boleh memakai `ownerUserId`, tetapi jangan dijadikan final permission model
- admin remains cross-tenant authority
- storefront public and account flow tidak boleh jadi tempat authority seller baru

## 11. API Namespace Rules

- final seller workspace namespace:
  - `/api/seller/stores/:storeId/...`
- compatibility path lama:
  - tetap hidup
  - tidak dioverwrite
- `/api/store/*`:
  - tetap untuk storefront and account style contract
- `/api/admin/*`:
  - tetap untuk platform management and audit
- no new seller workspace feature under `/api/store/*` in phase awal

## 12. Phase Implementation Mapping

### Phase 1

- seller workspace shell
- owner-only access bridge
- store context read
- suborder visibility read
- payment profile read

### Phase 2

- membership plus store-role foundation
- tenant access middleware
- seller permission foundation
- team member domain

### Phase 3

- store profile edit
- product management seller
- categories or collections seller
- attribute consumption seller
- media and variants strategy

### Phase 4

- coupons
- inventory
- storefront content

### Phase 5

- fulfillment actions
- payment profile write
- deeper order and payment integration after ownership and access strategy matures

## 13. Dependency & Risk Map

### Dependencies Before Write Actions

- `requireSellerStoreAccess` ready
- namespace seller route shell ready
- seller layout and route context ready
- tenant isolation rule documented and enforced
- membership evolution path documented
- product ownership strategy clarified for seller catalog write

### Risk Themes

- route collision
- owner-only dead-end risk
- product ownership ambiguity
- admin permission reuse risk
- storefront and seller boundary leakage

## 14. Implementation Readiness Checklist

- approved architecture aligned
- module boundaries classified
- seller namespace rules fixed
- backend folder strategy fixed
- frontend folder strategy fixed
- owner-only bridge defined
- future membership evolution path defined
- risky domains marked blocked until later phase
- integration notes with admin and storefront documented
- ready to proceed to DB delta mapping task

---

# Module-by-Module Technical Spec

## A. Seller Workspace Shell

1. Business requirement summary
   - seller needs a dedicated workspace area separate from admin and account.
2. Phase
   - `Phase awal`
3. Existing repo touchpoints
   - `client/src/App.jsx`
   - `client/src/components/AccountGuard.jsx`
   - `client/src/components/AdminGuard.jsx`
   - `client/src/components/layouts/AdminLayout.jsx`
4. Classification
   - `CREATE NEW`
   - `LOW RISK`
5. Proposed backend structure
   - routes:
     - `server/src/routes/seller.workspace.ts`
   - services:
     - `server/src/services/seller/workspace.service.ts`
   - models or tables:
     - none in phase 1
   - middleware dependencies:
     - `requireAuth`
     - future `requireSellerStoreAccess`
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/DashboardPage.jsx`
   - layout:
     - `client/src/layouts/SellerLayout.jsx`
   - components:
     - `client/src/components/seller/SellerSidebar.jsx`
   - hooks:
     - `client/src/hooks/useSellerStoreContext.ts`
   - api client:
     - `client/src/api/sellerWorkspace.ts`
7. Permission or access needs
   - auth required
   - store-scoped route entry
8. Integration notes
   - admin:
     - no admin reuse as final layout
   - storefront:
     - no storefront reuse as workspace shell
   - account:
     - account pages may link into seller workspace later
9. Risk notes
   - UI collision if seller shell is placed under `/admin` or `/user`
10. Recommendation notes
   - build this first as isolated route tree `/seller/*`

## B. Store Context

1. Business requirement summary
   - seller must see current store identity and basic context.
2. Phase
   - `Phase awal`
3. Existing repo touchpoints
   - `server/src/routes/stores.ts`
   - `server/src/models/Store.ts`
   - `client/src/api/storePaymentProfiles.ts`
4. Classification
   - `EXTEND EXISTING`
   - `LOW RISK`
5. Proposed backend structure
   - routes:
     - `server/src/routes/seller.store.ts`
   - services:
     - `server/src/services/seller/storeContext.service.ts`
   - models or tables:
     - reuse `Store`
   - middleware dependencies:
     - `requireAuth`
     - `requireSellerStoreAccess`
6. Proposed frontend structure
   - pages:
     - consumed by seller dashboard and seller store pages
   - components:
     - `StoreContextHeader.jsx`
   - hooks:
     - `useSellerStoreContext.ts`
   - api client:
     - `sellerStore.ts`
7. Permission or access needs
   - phase 1 owner-only bridge by `Store.ownerUserId`
8. Integration notes
   - admin:
     - same store identity must match admin payment profile views
   - storefront:
     - no public leak
   - account:
     - existing `getMyStore` can inspire payload shape but not become final seller namespace
9. Risk notes
   - future membership support must not require route rename
10. Recommendation notes
   - always shape response around `storeId` route param, not implicit current user only

## C. Store Profile

1. Business requirement summary
   - seller needs store profile viewing and later editing.
2. Phase
   - read concern piggybacks on phase 1 store context
   - write concern enters `Phase berikutnya`
3. Existing repo touchpoints
   - `server/src/models/Store.ts`
   - `server/src/routes/stores.ts`
4. Classification
   - `EXTEND EXISTING`
   - `MEDIUM RISK`
5. Proposed backend structure
   - routes:
     - `server/src/routes/seller.store.ts`
   - services:
     - `server/src/services/seller/storeProfile.service.ts`
   - models or tables:
     - reuse `Store`
   - middleware dependencies:
     - `requireSellerStoreAccess`
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/store/ProfilePage.jsx`
   - components:
     - `StoreProfileForm.jsx`
   - api client:
     - `sellerStore.ts`
7. Permission or access needs
   - owner-only in early write phase
   - membership role check later
8. Integration notes
   - admin:
     - admin remains reviewer and supervisor, not seller profile owner UI
   - storefront:
     - no direct mutation on public store contracts in early phase
   - account:
     - avoid reusing account profile page
9. Risk notes
   - `Store` currently minimal; rich seller profile fields may require new table later
10. Recommendation notes
   - keep phase 1 read-only and defer write until access layer stabilizes

## D. Team Members & Roles

1. Business requirement summary
   - seller organizations need multi-user access and per-store roles.
2. Phase
   - `phase berikutnya`
3. Existing repo touchpoints
   - no active membership domain
   - admin staff uses global user role only
4. Classification
   - `CREATE NEW`
   - `HIGH RISK`
   - `BLOCKED UNTIL LATER PHASE`
5. Proposed backend structure
   - routes:
     - `server/src/routes/seller.members.ts`
   - services:
     - `server/src/services/seller/membership.service.ts`
   - models or tables:
     - future `StoreMembership`
     - future `StoreRole`
     - future `StoreInvite` if required
   - middleware dependencies:
     - `requireSellerMembership`
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/team/*`
   - components:
     - `MemberTable.jsx`
     - `RoleBadge.jsx`
   - api client:
     - `sellerMembers.ts`
7. Permission or access needs
   - full store-role and permission matrix required
8. Integration notes
   - admin:
     - admin may audit memberships later
   - storefront:
     - none
   - account:
     - none
9. Risk notes
   - introducing this too early collides with `Store.ownerUserId` single-owner contract
10. Recommendation notes
   - do not implement before DB delta mapping and access foundation are approved

## E. Product Management

1. Business requirement summary
   - seller needs product listing, detail, and eventually create or update.
2. Phase
   - `phase berikutnya`
3. Existing repo touchpoints
   - `server/src/models/Product.ts`
   - `server/src/routes/admin.products.ts`
   - legacy unregistered `server/src/routes/sellerRoutes.ts`
4. Classification
   - `EXTEND EXISTING`
   - `HIGH RISK`
5. Proposed backend structure
   - routes:
     - `server/src/routes/seller.products.ts`
   - services:
     - `server/src/services/seller/productCatalog.service.ts`
   - models or tables:
     - reuse `Product`
   - middleware dependencies:
     - `requireSellerStoreAccess`
     - later membership permission checks
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/products/ListPage.jsx`
     - `client/src/pages/seller/products/DetailPage.jsx`
     - later `FormPage.jsx`
   - components:
     - `SellerProductTable.jsx`
   - hooks:
     - `useSellerProducts.ts`
   - api client:
     - `sellerProducts.ts`
7. Permission or access needs
   - read can arrive earlier than write
   - write blocked until ownership strategy is stable
8. Integration notes
   - admin:
     - admin product remains source of truth for full management until seller write is ready
   - storefront:
     - storefront reads published products; seller write must not break publish contract
   - account:
     - none
9. Risk notes
   - `Product.userId + storeId` is transitional and seller authority by `userId` is unsafe long term
10. Recommendation notes
   - open product list read first, delay create or update until after DB delta map

## F. Product Media

1. Business requirement summary
   - seller needs media management for products.
2. Phase
   - `phase berikutnya`
3. Existing repo touchpoints
   - `Product.promoImagePath`
   - `Product.imagePaths`
   - admin upload and product flow
4. Classification
   - `EXTEND EXISTING`
   - `HIGH RISK`
5. Proposed backend structure
   - routes:
     - under `seller.products.ts` or `seller.productMedia.ts`
   - services:
     - `seller/productMedia.service.ts`
   - models or tables:
     - phase transitional reuse of `Product.imagePaths`
   - middleware dependencies:
     - `requireSellerStoreAccess`
6. Proposed frontend structure
   - pages:
     - embedded inside product form later
   - components:
     - `SellerProductMediaUploader.jsx`
   - api client:
     - reuse or wrap upload endpoint later
7. Permission or access needs
   - seller product-level ownership validation required
8. Integration notes
   - admin:
     - keep admin upload intact
   - storefront:
     - maintain existing image field contract
   - account:
     - none
9. Risk notes
   - no separate product media model yet
10. Recommendation notes
   - keep media technical design transitional until DB delta mapping decides whether to stay JSON-backed

## G. Product Variants

1. Business requirement summary
   - seller needs variant-capable catalog later.
2. Phase
   - `ditunda`
3. Existing repo touchpoints
   - `Product.variations` JSON
   - no active `ProductVariant` model
4. Classification
   - `CREATE NEW`
   - `HIGH RISK`
   - `BLOCKED UNTIL LATER PHASE`
5. Proposed backend structure
   - routes:
     - future `seller.productVariants.ts`
   - services:
     - `seller/productVariant.service.ts`
   - models or tables:
     - future normalized variant tables or transitional JSON policy
   - middleware dependencies:
     - seller access plus product ownership
6. Proposed frontend structure
   - pages:
     - inside seller product form later
   - components:
     - `VariantMatrixEditor.jsx`
   - api client:
     - variant endpoints later
7. Permission or access needs
   - seller catalog write permission required
8. Integration notes
   - admin:
     - keep admin product compatibility first
   - storefront:
     - variant output contract must not break product detail rendering
   - account:
     - none
9. Risk notes
   - no normalized variant model exists today
10. Recommendation notes
   - only design placeholder now; do not open implementation before DB delta decisions

## H. Store Categories / Collections

1. Business requirement summary
   - seller needs organization of catalog within store.
2. Phase
   - `phase berikutnya`
3. Existing repo touchpoints
   - global `Category`
   - admin category flows
4. Classification
   - `REUSE EXISTING` for global category selection
   - `CREATE NEW` for store collections
   - `MEDIUM-HIGH RISK`
5. Proposed backend structure
   - routes:
     - `seller.collections.ts`
   - services:
     - `seller/storeCollection.service.ts`
   - models or tables:
     - future `StoreCollection`
     - optional bridge to products later
   - middleware dependencies:
     - seller store access
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/store/CollectionsPage.jsx`
   - components:
     - `CollectionList.jsx`
   - api client:
     - `sellerCollections.ts`
7. Permission or access needs
   - seller store management permission
8. Integration notes
   - admin:
     - global categories remain admin-owned
   - storefront:
     - store collections should not overwrite global category contract
   - account:
     - none
9. Risk notes
   - mixing store collections and global categories too early can confuse storefront filters
10. Recommendation notes
   - reuse global categories first, add store collections later as separate concept

## I. Store Attributes

1. Business requirement summary
   - seller needs product attribute consumption and possibly scoped attribute workflows later.
2. Phase
   - `phase berikutnya`
3. Existing repo touchpoints
   - admin attribute routes and pages
   - product attribute structures
4. Classification
   - `REUSE EXISTING`
   - `EXTEND EXISTING`
   - `MEDIUM RISK`
5. Proposed backend structure
   - routes:
     - `seller.attributes.ts`
   - services:
     - `seller/attributeCatalog.service.ts`
   - models or tables:
     - reuse existing `Attribute`
   - middleware dependencies:
     - seller store access
6. Proposed frontend structure
   - pages:
     - embedded in product management later
   - components:
     - `AttributePicker.jsx`
   - api client:
     - `sellerAttributes.ts`
7. Permission or access needs
   - read first, write later if store-scoped attributes become necessary
8. Integration notes
   - admin:
     - admin remains global attribute manager in early phases
   - storefront:
     - attribute contract must remain compatible with product rendering
   - account:
     - none
9. Risk notes
   - unclear if store-scoped attributes are required versus global reuse
10. Recommendation notes
   - keep seller attributes read-only initially through global admin-defined attributes

## J. Coupons

1. Business requirement summary
   - seller needs store-scoped coupon capabilities.
2. Phase
   - `ditunda ke phase berikutnya`
3. Existing repo touchpoints
   - `server/src/models/Coupon.ts`
   - `server/src/routes/store.coupons.ts`
   - `server/src/routes/admin.coupons.ts`
4. Classification
   - `EXTEND EXISTING`
   - `HIGH RISK`
   - `BLOCKED UNTIL LATER PHASE`
5. Proposed backend structure
   - routes:
     - `seller.coupons.ts`
   - services:
     - `seller/coupon.service.ts`
   - models or tables:
     - coupon tenancy delta required
   - middleware dependencies:
     - seller store access
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/coupons/*`
   - components:
     - `CouponTable.jsx`
   - api client:
     - `sellerCoupons.ts`
7. Permission or access needs
   - seller store management permission
8. Integration notes
   - admin:
     - admin coupon remains global until tenant model exists
   - storefront:
     - existing quote and validate flow must not break
   - account:
     - none
9. Risk notes
   - current coupon model is global-only and unsafe for seller tenancy
10. Recommendation notes
   - do not include in phase 1 or phase 2 delivery

## K. Inventory

1. Business requirement summary
   - seller needs stock visibility and eventually stock mutation.
2. Phase
   - `phase berikutnya`
3. Existing repo touchpoints
   - `Product.stock`
   - checkout stock deduction flows in `store.ts` and `checkout.ts`
4. Classification
   - `EXTEND EXISTING`
   - `HIGH RISK`
5. Proposed backend structure
   - routes:
     - `seller.inventory.ts`
   - services:
     - `seller/inventory.service.ts`
   - models or tables:
     - reuse `Product.stock`
   - middleware dependencies:
     - seller product access
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/inventory/*`
   - components:
     - `StockEditor.jsx`
   - api client:
     - `sellerInventory.ts`
7. Permission or access needs
   - seller catalog write permission
8. Integration notes
   - admin:
     - admin stock management must remain valid
   - storefront:
     - must not break cart and checkout stock checks
   - account:
     - none
9. Risk notes
   - checkout actively mutates stock; seller stock write too early can create race and authority issues
10. Recommendation notes
   - stock visibility can arrive before stock mutation

## L. Seller Suborders

1. Business requirement summary
   - seller needs order visibility scoped to their store.
2. Phase
   - `Phase awal`
3. Existing repo touchpoints
   - `server/src/routes/seller.payments.ts`
   - `server/src/models/Suborder.ts`
   - `server/src/models/SuborderItem.ts`
   - `server/src/routes/admin.payments.audit.ts`
4. Classification
   - `REUSE EXISTING`
   - `LOW RISK`
5. Proposed backend structure
   - routes:
     - `server/src/routes/seller.orders.ts`
   - services:
     - `server/src/services/seller/suborderRead.service.ts`
   - models or tables:
     - reuse `Suborder`
     - reuse `SuborderItem`
   - middleware dependencies:
     - `requireAuth`
     - `requireSellerStoreAccess`
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/orders/ListPage.jsx`
     - `client/src/pages/seller/orders/DetailPage.jsx`
   - components:
     - `SellerSuborderTable.jsx`
   - hooks:
     - `useSellerSuborders.ts`
   - api client:
     - `sellerOrders.ts`
7. Permission or access needs
   - owner-only bridge in phase 1
8. Integration notes
   - admin:
     - payload should stay aligned with admin payment audit understanding
   - storefront:
     - no impact to buyer order creation
   - account:
     - can later link seller and buyer views via common refs, not shared pages
9. Risk notes
   - none major for read-only scope
10. Recommendation notes
   - this is the safest transaction module for seller workspace phase 1

## M. Payment Profile

1. Business requirement summary
   - seller needs visibility into store payment profile and later controlled editing.
2. Phase
   - read in `Phase awal`
   - write in `phase berikutnya`
3. Existing repo touchpoints
   - `server/src/routes/stores.ts`
   - `server/src/routes/admin.storePaymentProfiles.ts`
   - `server/src/models/StorePaymentProfile.ts`
   - `client/src/pages/account/AccountStorePaymentProfilePage.jsx`
4. Classification
   - `EXTEND EXISTING`
   - `MEDIUM RISK`
5. Proposed backend structure
   - routes:
     - `server/src/routes/seller.paymentProfiles.ts`
   - services:
     - `server/src/services/seller/paymentProfile.service.ts`
   - models or tables:
     - reuse `StorePaymentProfile`
   - middleware dependencies:
     - `requireSellerStoreAccess`
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/store/PaymentProfilePage.jsx`
   - components:
     - `PaymentProfileSummary.jsx`
   - api client:
     - `sellerPaymentProfiles.ts`
7. Permission or access needs
   - read phase 1 via owner-only bridge
   - write delayed until access and audit boundary is stronger
8. Integration notes
   - admin:
     - admin review flow remains authority for activation
   - storefront:
     - payment profile read model must stay compatible with checkout payment generation
   - account:
     - existing account page can inspire UI, but seller namespace becomes primary target
9. Risk notes
   - seller write too early can interfere with admin review lifecycle
10. Recommendation notes
   - implement read in phase 1, keep write to phase 5 as approved

## N. Storefront Content

1. Business requirement summary
   - seller may need to manage store-facing content later.
2. Phase
   - `ditunda ke phase berikutnya`
3. Existing repo touchpoints
   - `server/src/routes/store.customization.ts`
   - `server/src/routes/store.settings.ts`
   - admin store customization pages
4. Classification
   - `EXTEND EXISTING`
   - `CREATE NEW`
   - `HIGH RISK`
5. Proposed backend structure
   - routes:
     - `seller.content.ts`
   - services:
     - `seller/storefrontContent.service.ts`
   - models or tables:
     - likely new seller-scoped content storage or store-scoped extension
   - middleware dependencies:
     - seller store access
6. Proposed frontend structure
   - pages:
     - `client/src/pages/seller/storefront/*`
   - components:
     - `ContentEditor.jsx`
   - api client:
     - `sellerStorefront.ts`
7. Permission or access needs
   - seller store management permission
8. Integration notes
   - admin:
     - admin customization remains platform-level today
   - storefront:
     - do not mutate public customization contracts early
   - account:
     - none
9. Risk notes
   - current customization path looks global or global-by-lang, not store-scoped
10. Recommendation notes
   - postpone until tenant-safe content boundary is designed

## O. Audit Logs

1. Business requirement summary
   - seller actions need traceability, especially around payment and future mutations.
2. Phase
   - phase 1 uses existing payment audit trail indirectly
   - extension in `phase berikutnya`
3. Existing repo touchpoints
   - `PaymentStatusLog`
   - `admin.payments.audit`
4. Classification
   - `REUSE EXISTING`
   - `EXTEND EXISTING`
   - `MEDIUM RISK`
5. Proposed backend structure
   - routes:
     - `seller.audit.ts` later if seller-visible logs are needed
   - services:
     - `seller/audit.service.ts`
   - models or tables:
     - reuse `PaymentStatusLog`
     - future generic seller audit log if needed
   - middleware dependencies:
     - seller store access
6. Proposed frontend structure
   - pages:
     - embedded in seller payment and order detail pages later
   - components:
     - `AuditTimeline.jsx`
   - api client:
     - `sellerAudit.ts`
7. Permission or access needs
   - read by seller scoped to store
8. Integration notes
   - admin:
     - admin audit remains superset
   - storefront:
     - none
   - account:
     - none
9. Risk notes
   - avoid creating duplicate audit source of truth
10. Recommendation notes
   - reuse `PaymentStatusLog` first; only add generic audit log if necessary later

## P. Membership + Store-Role Evolution Layer

1. Business requirement summary
   - final multi-vendor architecture needs membership and per-store roles.
2. Phase
   - `phase berikutnya`
3. Existing repo touchpoints
   - no active membership model
   - only owner-based store relation exists
4. Classification
   - `CREATE NEW`
   - `HIGH RISK`
5. Proposed backend structure
   - routes:
     - none public in first design step, internal foundation first
   - services:
     - `seller/membership.service.ts`
     - `seller/permission.service.ts`
   - models or tables:
     - future `StoreMembership`
     - future `StoreRole`
     - future `StoreRolePermission`
   - middleware dependencies:
     - `requireSellerMembership`
     - `requireSellerPermission`
6. Proposed frontend structure
   - pages:
     - team and role management later
   - hooks:
     - `useSellerPermissions.ts`
   - api client:
     - `sellerMembers.ts`
7. Permission or access needs
   - this module is the permission foundation
8. Integration notes
   - admin:
     - admin remains override authority
   - storefront:
     - none direct
   - account:
     - none direct
9. Risk notes
   - if delayed too long, owner-only bridge can become sticky and harder to unwind
10. Recommendation notes
   - begin with design-to-build path in phase 2, before opening many write modules

---

## Reuse / Extend / Create-New Map

### REUSE EXISTING

- `Store`
- `StorePaymentProfile`
- `Suborder`
- `SuborderItem`
- `Payment`
- `PaymentProof`
- `PaymentStatusLog`
- global `Category`
- global `Attribute`

### EXTEND EXISTING

- seller store context payload
- seller payment profile read model
- seller suborder read model
- product access by `storeId`
- inventory read model
- audit exposure

### CREATE NEW

- seller route tree and layout
- seller namespace route files
- seller middleware
- seller membership domain
- seller store-role domain
- store collections
- seller storefront content layer

## Backend Structure Recommendation

- `server/src/routes/seller.workspace.ts`
- `server/src/routes/seller.store.ts`
- `server/src/routes/seller.orders.ts`
- `server/src/routes/seller.paymentProfiles.ts`
- `server/src/routes/seller.products.ts`
- `server/src/routes/seller.inventory.ts`
- `server/src/routes/seller.members.ts`
- `server/src/routes/seller.collections.ts`
- `server/src/routes/seller.content.ts`
- `server/src/services/seller/*.service.ts`
- `server/src/middleware/requireSellerStoreAccess.ts`
- `server/src/middleware/requireSellerMembership.ts`

## Frontend Structure Recommendation

- `client/src/layouts/SellerLayout.jsx`
- `client/src/components/guards/SellerGuard.jsx`
- `client/src/components/guards/SellerStoreGuard.jsx`
- `client/src/pages/seller/DashboardPage.jsx`
- `client/src/pages/seller/orders/*`
- `client/src/pages/seller/store/*`
- `client/src/pages/seller/products/*`
- `client/src/pages/seller/team/*`
- `client/src/pages/seller/storefront/*`
- `client/src/components/seller/*`
- `client/src/api/sellerWorkspace.ts`
- `client/src/api/sellerStore.ts`
- `client/src/api/sellerOrders.ts`
- `client/src/api/sellerPaymentProfiles.ts`
- `client/src/api/sellerProducts.ts`

## Access / Permission Mapping

### Phase 1

- auth:
  - `requireAuth`
- access:
  - owner-only bridge
- tenant rule:
  - by `storeId`
- seller read modules allowed:
  - shell
  - store context
  - seller suborders
  - payment profile read

### Phase 2+

- introduce membership tables
- introduce seller permission service
- introduce seller middleware stack:
  - membership present
  - role valid
  - permission valid

## Integration Notes

### Admin

- admin remains source of truth for:
  - global management
  - payment review oversight
  - payment audit oversight
- seller workspace should align read models with admin audit outputs where practical

### Storefront / Public

- storefront routes remain under `/api/store/*`
- seller workspace must not be attached to `store.ts`
- checkout and payment generation contracts remain unchanged in phase 1

### Account Pages Existing

- existing account seller-like screens are transitional references only
- seller workspace becomes the final dedicated area
- redirects or navigation adjustments can happen later, without using account pages as permanent base

## Dependency & Risk Map

### Critical Dependencies

- seller namespace shell
- seller access middleware bridge
- store-scoped route discipline
- DB delta plan for membership
- DB delta plan for product ownership evolution

### Highest Risks

- using `/api/seller` root as workspace root and breaking compatibility
- opening seller product write before access foundation exists
- forcing team member support before membership domain exists
- moving seller behavior into `/api/store/*`

## Implementation Readiness Checklist

- [x] approved architecture aligned
- [x] phase 1 scope constrained to safe owner-only bridge
- [x] seller namespace fixed to `/api/seller/stores/:storeId/...`
- [x] module decomposition completed
- [x] repo touchpoints identified per module
- [x] reuse, extend, and create-new classification completed
- [x] backend structure recommendation completed
- [x] frontend structure recommendation completed
- [x] access and tenant isolation rules documented
- [x] risk and dependency map documented
- [x] ready to proceed to DB delta mapping for the new modules and evolution layer

---

# TECH SPEC READY FOR DB DELTA MAPPING?

`YA`

Spec ini sudah cukup matang untuk lanjut ke task `SW-03-DB-DELTA-MAP` karena:

- phase awal yang aman sudah terkunci
- modul yang reuse, extend, dan create-new sudah dipetakan
- domain berisiko tinggi sudah ditandai dan dibatasi
- namespace, folder strategy, access bridge, dan evolution path sudah jelas
- DB delta task berikutnya sekarang bisa fokus pada gap entity dan relation baru tanpa mengulang debat arsitektur dasar
