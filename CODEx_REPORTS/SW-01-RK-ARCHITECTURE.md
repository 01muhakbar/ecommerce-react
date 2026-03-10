# SW-01-RK-ARCHITECTURE

## CODEx REPORT

### Task

Susun Rencana Kolaborasi arsitektur implementasi Multi-Vendor Seller Workspace berdasarkan hasil audit baseline repo `ecommerce-react`.

### Scope

- architecture planning only
- coexistence strategy
- namespace recommendation
- backend and frontend folder strategy
- phase plan
- evolution path owner-only to membership plus store-role
- risk register
- hard stop boundaries

### Non-Scope

- no schema migration
- no endpoint implementation
- no frontend implementation
- no refactor
- no behavior change

### Files Changed

- `CODEx_REPORTS/SW-01-RK-ARCHITECTURE.md`

### Verification

- static cross-check against audited active files in `server/src/app.ts`, `server/src/routes/*`, `server/src/models/*`, `server/src/middleware/*`, `server/src/utils/*`, `client/src/App.jsx`, `client/src/api/*`, `client/src/pages/*`, `client/src/components/*`
- checked that no runtime code was changed
- checked git worktree after document creation

### Risks / Decisions Needed

- phase awal harus diputuskan sebagai `owner-only bridge`, bukan langsung `membership plus store-role`
- namespace seller baru harus coexist dengan `/api/seller` compatibility path yang sudah aktif
- membership domain harus diperkenalkan sebagai fondasi baru, bukan menimpa `Store.ownerUserId`

---

# Rencana Kolaborasi

## 1. Judul Perubahan

Rencana Kolaborasi Implementasi Multi-Vendor Seller Workspace dengan strategi coexistence dan bridge phase owner-only.

## 2. Ringkasan Eksekutif

Repo `ecommerce-react` sudah memiliki fondasi penting untuk seller domain pada level data transaksi:

- `Store`
- `StorePaymentProfile`
- `Suborder`
- `SuborderItem`
- `Payment`
- `PaymentProof`

Namun workspace seller yang benar-benar terpisah belum ada. Seller-like flow saat ini masih menempel pada:

- compatibility path `/api/seller`
- namespace storefront `/api/store/*`
- UI `account` dan `admin/online-store`

Rekomendasi arsitektur final untuk implementasi seller workspace adalah:

- pilih `Opsi B`: owner-only bridge phase lalu evolusi ke membership plus store-role
- gunakan namespace final backend: `/api/seller/stores/:storeId/...`
- pertahankan compatibility path lama `/api/seller/*` yang sudah aktif
- buat area frontend seller baru:
  - `client/src/pages/seller/*`
  - `client/src/layouts/SellerLayout.jsx`
  - route tree `/seller/*`

Alasan utamanya adalah ini satu-satunya jalur yang:

- aman terhadap route collision
- aman terhadap model collision
- aman terhadap permission collision
- tidak memaksa rewrite checkout, order, dan payment lebih awal
- tetap memberi jalur evolusi ke arsitektur final multi-vendor

## 3. Latar Belakang

Audit baseline menunjukkan bahwa repo ini bukan greenfield. Struktur aktif sudah berjalan dengan:

- admin platform
- storefront public and account
- multi-store checkout foundation
- suborder split payment
- store payment review
- admin payment audit

Masalahnya, fondasi seller saat ini masih bersifat campuran:

- path seller aktif hanya untuk payment review compatibility
- `Store` masih single-owner centric
- `Product` masih transitional karena memakai `userId` dan `storeId`
- RBAC existing hanya global admin/staff, belum tenant-scoped
- frontend seller belum punya area kerja terpisah

Karena itu implementasi Seller Workspace harus dimulai dari boundary yang aman, bukan dari redesign total.

## 4. Problem Statement Arsitektural

Masalah arsitektural yang harus dipecahkan:

1. Bagaimana menambahkan Seller Workspace tanpa merusak route aktif `/api/seller`, `/api/store/*`, admin order, dan checkout multi-store.
2. Bagaimana membuat seller workspace yang sekarang masih owner-only, tetapi tidak menjadi dead-end saat nanti membership plus store-role diperkenalkan.
3. Bagaimana menjaga domain `Suborder`, `Payment`, dan `StorePaymentProfile` tetap menjadi source of truth seller transaction tanpa rewrite order/payment flow.
4. Bagaimana memisahkan UI seller dari admin/account agar boundary lebih jelas, tetapi tetap coexist dengan halaman existing.

## 5. Constraint Existing Repo

Constraint tetap dari hasil audit:

- `/api/seller` sudah aktif dan dipakai untuk seller payment and suborder review compatibility path.
- namespace seller baru paling aman adalah `/api/seller/stores/:storeId/...`.
- `Store.ownerUserId` unik dan membuat model sekarang single-owner centric.
- `Product` memakai `userId + storeId` dan punya auto-store hook dari owner.
- `Suborder`, `SuborderItem`, `Payment`, `PaymentProof`, `StorePaymentProfile` sudah seller-aware dan aman dijadikan foundation.
- RBAC existing belum punya membership, store-role, atau tenant permission middleware.
- frontend seller belum punya workspace terpisah.
- checkout multi-store sudah aktif dan tidak boleh dirombak di phase awal.
- kontrak lama harus coexist, tidak boleh di-overwrite.

## 6. Tujuan Implementasi

Tujuan implementasi seller workspace:

- membangun area kerja seller yang terpisah dari admin dan account
- tetap memakai domain transaksi aktif yang sudah seller-aware
- menjaga sinkronisasi dengan admin audit dan storefront checkout
- membuka jalur evolusi ke membership plus store-role tanpa rewrite awal
- menghindari perubahan besar pada checkout, order, dan payment existing

## 7. Prinsip Inti Arsitektur

- coexistence, not overwrite
- extend the seller-aware transaction foundation, not legacy seller files
- tenant scope by `storeId`
- owner-only bridge phase first
- membership plus store-role introduced as new domain, not as a patch over `ownerUserId`
- no write action on risky order/payment areas before access foundation is stable
- admin remains platform authority
- storefront public and account flows remain backward-compatible

## 8. Opsi Arsitektur

### Opsi A: Langsung membership plus store-role penuh

Bangun langsung domain akhir multi-vendor:

- store memberships
- store roles
- seller access middleware
- seller product and order management
- team member support

### Opsi B: Owner-only bridge phase lalu evolusi ke membership plus store-role

Bangun Seller Workspace baru dengan fondasi:

- namespace seller baru `/api/seller/stores/:storeId/...`
- access phase awal berbasis owner store
- seller layout and route tree baru
- read-first scope untuk store context, suborder visibility, payment profile visibility
- membership plus store-role diperkenalkan di phase berikutnya sebagai domain baru

### Opsi C: Seller UI ditumpuk di admin/account existing

Pertahankan pola sekarang:

- seller pages tetap reuse `account` dan `admin/online-store`
- seller backend tetap memanfaatkan path existing campuran
- tambahkan fitur seller sedikit demi sedikit tanpa area baru

## 9. Analisis Pro dan Contra Tiap Opsi

| Opsi | Pro | Contra |
|---|---|---|
| A | paling cepat menuju target akhir | bentrok keras dengan `Store.ownerUserId`, RBAC existing, dan route existing; hampir pasti memicu redesign model dan access lebih awal |
| B | paling aman untuk repo sekarang; route collision rendah; bisa reuse domain transaksi aktif; memberi jalur evolusi jelas | butuh disiplin boundary agar bridge phase tidak bocor ke dead-end owner-only |
| C | paling sedikit perubahan awal | boundary seller tetap kabur; UI collision tinggi; sulit berkembang ke workspace seller yang proper; technical debt cepat menumpuk |

## 10. Rekomendasi Opsi Terbaik

Rekomendasi final adalah `Opsi B: owner-only bridge phase lalu evolusi ke membership plus store-role`.

Alasan tegas:

- sesuai constraint repo saat ini
- tidak menabrak `/api/seller` compatibility path
- tidak memaksa rewrite `Store` dan `Product` sekarang
- bisa langsung reuse `Suborder`, `Payment`, dan `StorePaymentProfile`
- membuka area frontend seller yang jelas
- masih menyediakan jalur evolusi yang aman ke arsitektur final

## 11. Namespace Strategy

### Keputusan Final

Namespace final yang direkomendasikan adalah:

`/api/seller/stores/:storeId/...`

### Rationale

- `/api/seller` root sudah dipakai untuk compatibility path aktif
- `storeId` harus menjadi anchor tenant scope
- struktur ini cocok untuk owner-only sekarang dan membership plus store-role nanti
- namespace ini tidak berbenturan dengan storefront `/api/store/*`

### Coexistence Namespace Rules

- pertahankan `/api/seller/suborders`
- pertahankan `/api/seller/payments/:paymentId/review`
- anggap keduanya sebagai compatibility path, bukan workspace root
- semua endpoint seller workspace baru masuk ke `/api/seller/stores/:storeId/...`
- `/api/store/*` tetap untuk storefront public and account style flows
- `/api/admin/*` tetap untuk platform authority

## 12. Backend Folder Strategy

### Target Folder

- `server/src/routes/seller.dashboard.ts`
- `server/src/routes/seller.orders.ts`
- `server/src/routes/seller.payments.workspace.ts`
- `server/src/routes/seller.products.ts`
- `server/src/routes/seller.members.ts`
- `server/src/middleware/requireSellerStoreAccess.ts`
- `server/src/middleware/requireSellerMembership.ts`
- `server/src/services/seller/*`

### Strategy

- seller workspace file baru berdampingan dengan route active yang sudah ada
- compatibility file `seller.payments.ts` tetap dipertahankan
- middleware access seller dibuat baru, tidak memodifikasi `requireAuth` atau admin RBAC existing
- service seller workspace baru harus membaca domain aktif, bukan membuat duplikasi model read layer

## 13. Frontend Folder Strategy

### Target Folder

- `client/src/layouts/SellerLayout.jsx`
- `client/src/pages/seller/DashboardPage.jsx`
- `client/src/pages/seller/orders/*`
- `client/src/pages/seller/payments/*`
- `client/src/pages/seller/store/*`
- `client/src/pages/seller/products/*`
- `client/src/api/sellerStore.ts`
- `client/src/api/sellerOrders.ts`
- `client/src/api/sellerProducts.ts`
- `client/src/components/seller/*`

### Route Tree Recommendation

- `/seller`
- `/seller/stores/:storeId`
- `/seller/stores/:storeId/orders`
- `/seller/stores/:storeId/payments`
- `/seller/stores/:storeId/store-profile`
- `/seller/stores/:storeId/products`

### Strategy

- seller area wajib menjadi area baru
- jangan menumpuk seller workspace ke `/user/*`
- jangan menumpuk seller workspace ke `/admin/*`
- halaman existing account/admin seller-like boleh di-link ke workspace baru nanti, tetapi jangan dijadikan fondasi permanen

## 14. Coexistence Strategy terhadap Existing Code

### Dengan `/api/seller` legacy compatibility path

- tetap hidup
- tidak dihapus
- tidak diubah kontraknya di phase awal
- fungsi utamanya tetap payment and suborder review compatibility

### Dengan `/api/store/*`

- tetap dianggap storefront and account domain
- jangan campurkan seller workspace write actions ke router ini
- route `store.ts` yang overloaded jangan dijadikan lokasi seller workspace baru

### Dengan admin product/order/payment flow

- admin tetap platform owner
- seller workspace read model harus sinkron dengan admin audit
- jangan ubah admin order and payment contract di phase awal
- jangan memindahkan fitur admin ke seller

### Dengan account pages existing

- account pages tetap berfungsi
- redirect existing tidak wajib diubah di phase awal
- seller workspace baru dibuka sebagai area terpisah, lalu account links dapat diadaptasi di phase lanjutan

## 15. Phase Implementation Plan

### Phase 1: Seller Workspace Shell and Owner-Only Bridge

- seller layout terpisah
- route tree `/seller/*`
- namespace backend seller baru
- owner-only access bridge by `storeId` plus `ownerUserId`
- store context read
- suborder visibility read
- payment profile read
- payment review link dapat coexist dengan compatibility path yang sudah ada

### Phase 2: Access Foundation for Membership plus Store-Role

- introduce membership domain baru
- seller access middleware baru
- permission foundation seller per store
- team member domain design
- compatibility bridge owner-only tetap berjalan

### Phase 3: Seller Store and Catalog Management

- store profile edit
- seller product catalog list and detail
- seller product create and update boundary
- categories and attributes read bridge
- media and variants plan, tanpa mengubah kontrak produk existing secara destruktif

### Phase 4: Commercial and Store Operations

- coupons seller domain jika sudah ada tenant model yang aman
- inventory operations
- storefront content management per store bila boundary store customization sudah aman

### Phase 5: Fulfillment and Deeper Transaction Writes

- fulfillment actions
- seller order write actions yang aman
- deeper payment and order integration hanya setelah access foundation matang

## 16. Jalur Evolusi Arsitektur

### Bridge Phase Tidak Boleh Menjadi Dead-End

Owner-only phase harus diperlakukan sebagai bridge, bukan final state.

Prinsipnya:

- route baru sejak awal selalu membawa `storeId`
- middleware seller nanti tinggal mengganti rule access, bukan mengganti namespace
- frontend route seller sejak awal juga membawa context store
- domain transaksi tetap membaca `storeId` dari model aktif

### Evolution Path

1. phase awal memakai `store owner access`
2. introduce domain membership baru yang menghubungkan `user`, `store`, dan `role`
3. middleware access seller baru membaca membership bila tersedia
4. fallback owner-only tetap dipakai selama transisi
5. ketika membership stabil, owner menjadi salah satu role tertinggi, bukan satu-satunya sumber authority

### Dependency yang Harus Disiapkan

- seller access middleware baru
- store membership model baru
- store role enum or permission map
- audit trail untuk action seller write
- migration strategy untuk product ownership bila nanti `userId` perlu dipisah dari seller authority

## 17. Risk Register

| Risk | Level | Dampak | Mitigasi |
|---|---|---|---|
| route collision dengan `/api/seller` existing | high | contract lama rusak | gunakan coexistence path `/api/seller/stores/:storeId/...` |
| model collision dengan `Store.ownerUserId` unik | high | seller team model buntu | treat owner-only as bridge and introduce membership as new domain |
| product ownership ambiguity antara `userId` dan `storeId` | high | seller catalog write bisa salah authority | jangan buka product write lebih awal sebelum access foundation siap |
| permission collision karena RBAC existing global-only | high | tenant leak antar store | buat middleware seller access baru, jangan reuse admin role checks |
| UI collision dengan admin/account pages | medium-high | navigasi dan boundary seller kabur | buat `/seller/*` dan `SellerLayout` baru |
| regression pada checkout/order/payment | high | transaksi existing rusak | phase awal read-first, jangan sentuh checkout multi-store and legacy submit flow |
| coupon tenant scope belum ada | medium | seller coupon bisa bocor global | tunda coupon seller ke phase lebih akhir |
| store customization masih global-ish | medium | seller content bisa bentrok | tunda storefront content seller sampai store boundary aman |

## 18. Hard Stop Boundaries

Berhenti dan keluarkan Rencana Kolaborasi lanjutan bila salah satu terjadi:

- perlu mengubah kontrak `/api/seller/suborders` atau `/api/seller/payments/:paymentId/review`
- perlu mengubah struktur `Store.ownerUserId` sebelum membership domain siap
- perlu mengubah checkout multi-store aktif
- perlu memindahkan seller behavior ke `/api/store/*`
- perlu membuka seller product write tanpa middleware tenant access
- perlu menyatukan seller UI ke admin/account lagi karena route baru belum siap

## 19. Acceptance Criteria Phase Awal

Phase awal dianggap benar bila:

- seller workspace punya area frontend baru `/seller/*`
- seller workspace punya layout terpisah
- backend seller workspace memakai namespace `/api/seller/stores/:storeId/...`
- access phase awal owner-only dan tenant-scoped by `storeId`
- store context read berhasil reuse model aktif
- suborder and payment visibility read berhasil reuse domain aktif
- compatibility path lama tetap hidup
- admin and storefront existing tidak berubah behavior-nya

## 20. Recommended Next Tasks

Urutan task setelah dokumen ini:

1. Seller workspace route and layout shell audit-confirmed scaffolding
2. seller access bridge middleware design document
3. seller workspace read-only store context
4. seller workspace read-only orders and suborders index
5. seller workspace payment profile read and payment review entrypoint alignment
6. membership and store-role domain design task

---

## Existing Constraints Summary

- use audited active files as source of truth
- do not reuse unregistered legacy route files as implementation base
- do not touch checkout multi-store write flow early
- do not treat admin RBAC as seller permission system
- do not keep seller UI inside admin/account as final architecture

## Architecture Options Comparison

| Item | Opsi A | Opsi B | Opsi C |
|---|---|---|---|
| safety vs repo existing | low | high | low-medium |
| route collision risk | high | low | medium-high |
| model collision risk | high | medium | medium |
| speed to first safe delivery | low | high | medium |
| long-term scalability | high | high | low |
| recommended | no | yes | no |

## Final Recommended Architecture

- pilih `Opsi B`
- owner-only bridge phase sekarang
- membership plus store-role sebagai architecture target
- namespace final `/api/seller/stores/:storeId/...`
- frontend seller baru di `/seller/*`

## Namespace and Folder Strategy

### Backend

- namespace final: `/api/seller/stores/:storeId/...`
- compatibility path lama tetap hidup
- target folder:
  - `server/src/routes/seller.*.ts`
  - `server/src/middleware/requireSellerStoreAccess.ts`
  - `server/src/services/seller/*`

### Frontend

- route tree final: `/seller/*`
- target folder:
  - `client/src/layouts/SellerLayout.jsx`
  - `client/src/pages/seller/*`
  - `client/src/api/seller*.ts`
  - `client/src/components/seller/*`

## Next Task Recommendation

Task paling aman berikutnya adalah:

- bangun shell Seller Workspace read-only
- tanpa write action
- tanpa membership schema
- tanpa perubahan checkout
- dengan store context owner-only by `storeId`

---

# ARSITEKTUR YANG DIREKOMENDASIKAN UNTUK IMPLEMENTASI SELLER WORKSPACE

1. Opsi final yang dipilih:
   - `Opsi B`, yaitu owner-only bridge phase lalu evolusi ke membership plus store-role.

2. Namespace backend final:
   - `/api/seller/stores/:storeId/...`

3. Folder backend target:
   - `server/src/routes/seller.*.ts`
   - `server/src/middleware/requireSellerStoreAccess.ts`
   - `server/src/services/seller/*`

4. Folder frontend target:
   - `client/src/layouts/SellerLayout.jsx`
   - `client/src/pages/seller/*`
   - `client/src/api/seller*.ts`
   - `client/src/components/seller/*`

5. Coexistence strategy final:
   - compatibility path lama `/api/seller/*` tetap dipertahankan
   - storefront tetap di `/api/store/*`
   - admin tetap di `/api/admin/*`
   - seller workspace baru hidup berdampingan, tidak overwrite kontrak lama

6. Phase awal paling aman:
   - seller workspace shell
   - owner-only access bridge
   - store context read
   - suborder visibility read
   - payment profile read
   - seller layout terpisah

7. Jalur evolusi ke membership plus store-role:
   - phase awal tetap memakai `storeId`
   - introduce membership domain baru
   - ganti rule access dari owner-only ke membership-aware
   - pertahankan namespace dan route tree yang sama

8. Area existing yang jangan disentuh dulu:
   - checkout multi-store active flow
   - legacy submit flow di `store.ts`
   - compatibility path `/api/seller/suborders`
   - compatibility path `/api/seller/payments/:paymentId/review`
   - `Store.ownerUserId` contract
   - auto-store hook di `Product`
   - admin order and payment contracts

9. Warning teknis paling kritis:
   - jangan membuka seller write action pada product, order, atau payment sebelum middleware tenant access seller siap, karena RBAC existing masih global-only dan model ownership produk masih transitional.
