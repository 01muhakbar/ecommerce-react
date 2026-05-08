# SW-03-DB-DELTA-MAP

## CODEx REPORT

### Task

Petakan delta database schema Seller Workspace terhadap model/schema existing di repo `ecommerce-react`.

### Input Basis yang Dipakai

- task prompt ini sebagai target schema Seller Workspace
- hasil audit baseline repo
- dokumen [SW-01-RK-ARCHITECTURE](./SW-01-RK-ARCHITECTURE.md)
- dokumen [SW-02-PRD-TO-TECH-SPEC](./SW-02-PRD-TO-TECH-SPEC.md)
- model aktif di `server/src/models/*`
- route aktif dan route raw-query yang relevan di `server/src/routes/*`

### Catatan Penting

Tidak ditemukan file schema seller workspace terpisah atau migration draft final di repo. Karena itu delta map ini memakai target schema dari task prompt dan membandingkannya langsung terhadap model aktif serta table hints yang benar-benar terlihat di repo.

### Files Changed

- `CODEx_REPORTS/SW-03-DB-DELTA-MAP.md`

### Verification

- cross-check static ke model aktif `Store`, `User`, `Product`, `Coupon`, `Order`, `Suborder`, `SuborderItem`, `Payment`, `PaymentProof`, `PaymentStatusLog`, `StorePaymentProfile`, `Category`, `ProductCategory`, `Attribute`
- cross-check static ke `server/src/models/index.ts` untuk association dan backfill behavior
- cross-check static ke route aktif yang menyentuh payment profile dan raw attribute/customization tables
- verified planning-only scope: tidak ada perubahan runtime code

### Risks / Decisions Needed

- `stores` harus diperlakukan sebagai boundary sementara karena `ownerUserId` unik dan masih single-owner centric
- `products` belum aman dijadikan fondasi write-heavy seller domain karena ownership dan media/variant masih transitional
- domain attribute dan customization existing mengandung raw-query/table bootstrap yang bersifat partial; jangan dijadikan kontrak final seller schema tanpa isolasi tabel baru

---

# DB Delta Map

## 1. Executive Summary

Repo `ecommerce-react` sudah memiliki fondasi database yang kuat untuk transaksi seller-level:

- `stores`
- `suborders`
- `suborder_items`
- `payments`
- `payment_proofs`
- `payment_status_logs`
- `store_payment_profiles`

Namun repo ini belum memiliki fondasi database untuk arsitektur multi-vendor final yang membutuhkan:

- membership per store
- store-role dan permission mapping
- seller catalog domain yang benar-benar tenant-scoped
- coupon tenancy
- storefront content per seller
- audit log seller workspace

Keputusan inti untuk DB foundation:

- phase awal seller workspace tetap `owner-only bridge` dan `read-mostly`
- tabel transaksi seller-aware existing direuse
- tabel membership/role dibuat baru, tidak menimpa `stores.ownerUserId`
- domain katalog seller ditunda sampai ownership dan tenant access matang
- domain promosi, storefront content, dan audit seller dibuat sebagai tabel baru, tetapi tidak wajib dibangun semua di phase awal

## 2. Existing Schema Baseline Summary

### Core Models yang Sudah Ada

- `users`
- `stores`
- `products`
- `Categories`
- `product_categories`
- `orders`
- `OrderItems`
- `suborders`
- `suborder_items`
- `payments`
- `payment_proofs`
- `payment_status_logs`
- `coupons`
- `attributes`
- `store_payment_profiles`

### Existing Schema Facts yang Menjadi Constraint

- `stores.owner_user_id` bersifat `unique`, sehingga 1 user hanya bisa menjadi owner dari 1 store.
- `products` menyimpan `userId` dan `storeId`, lalu ada hook/backfill yang mengauto-assign store dari owner user.
- `orders` tidak punya `storeId`; seller visibility datang dari `suborders`.
- `suborders`, `suborder_items`, `payments`, dan `store_payment_profiles` sudah `storeId` aware.
- `coupons` masih global-only.
- `attributes` hanya model dasar; route admin attributes memakai raw table `attribute_values` dan `product_attribute_values` yang tidak dimodelkan resmi.
- `store_customizations` dibuat via route raw SQL dan bersifat platform/global by `lang`, bukan seller-store scoped.

## 3. Classification Legend

- `ALREADY EXISTS - REUSABLE`
- `EXISTS - NEED EXTENSION`
- `EXISTS - HIGH RISK TO MODIFY`
- `DOES NOT EXIST - CREATE NEW`
- `UNCLEAR - NEED DECISION`

## 4. Entity Delta Table

| Entity Target | Existing Match | Existing Touchpoint | Status | Gaps | Risk Level | Recommendation | Recommended Phase |
|---|---|---|---|---|---|---|---|
| `users` | `users` | `server/src/models/User.ts` | `EXISTS - HIGH RISK TO MODIFY` | tidak ada membership/store-role relation | High | pertahankan global identity; jangan overload user role | Boundary sekarang, extend later via new tables |
| `stores` | `stores` | `server/src/models/Store.ts` | `EXISTS - HIGH RISK TO MODIFY` | single-owner only, minim field profile | High | reuse as boundary, jangan redesign dulu | Phase 1 boundary |
| `store_roles` | none | n/a | `DOES NOT EXIST - CREATE NEW` | belum ada role per store | Medium | tabel baru | Phase 2 |
| `store_members` | none | n/a | `DOES NOT EXIST - CREATE NEW` | belum ada membership per store | High | tabel baru | Phase 2 |
| `permissions` | none formal | `client/src/constants/permissions.js`, `server/src/utils/rbac.ts` | `UNCLEAR - NEED DECISION` | backend permission table belum ada | Medium | tunda jika role preset cukup; buat baru bila granular policy dibutuhkan | Phase 2 or later |
| `store_role_permissions` | none | n/a | `DOES NOT EXIST - CREATE NEW` | belum ada relation role-permission | Medium | buat bila `permissions` dipilih | Phase 2 or later |
| `global_categories` | `Categories` | `server/src/models/Category.ts` | `ALREADY EXISTS - REUSABLE` | nama tabel kapital, belum jelas governance global vs seller | Medium | reuse as global taxonomy | Existing boundary |
| `store_categories` | none | n/a | `DOES NOT EXIST - CREATE NEW` | belum ada kategori tenant-scoped | Medium | tabel baru | Phase 3 |
| `products` | `products` | `server/src/models/Product.ts` | `EXISTS - HIGH RISK TO MODIFY` | owner model transitional, media/variants JSON | High | reuse read path; tunda schema mutation besar | Phase 3 carefully |
| `product_images` | none formal | `products.imagePaths` JSON | `DOES NOT EXIST - CREATE NEW` | belum ada normalized image table | High | tunda sampai catalog write foundation matang | Phase 3 or later |
| `product_variants` | none formal | `products.variations` JSON | `DOES NOT EXIST - CREATE NEW` | belum ada normalized variant table | High | tunda; jangan paksakan di phase awal | Phase 3 or later |
| `product_store_category_links` | partial via `product_categories` | `server/src/models/ProductCategory.ts` | `EXISTS - NEED EXTENSION` | existing link untuk global categories, bukan store categories | Medium-High | buat tabel baru khusus store category links | Phase 3 |
| `store_attributes` | partial via `attributes` | `server/src/models/Attribute.ts` | `DOES NOT EXIST - CREATE NEW` | existing attributes global-only | Medium | buat tabel baru tenant-scoped atau global+store hybrid nanti | Phase 3 |
| `store_attribute_options` | partial raw tables only | `admin.productAttributes.ts` | `DOES NOT EXIST - CREATE NEW` | belum ada model resmi | High | buat tabel baru resmi; jangan bergantung pada raw legacy tables | Phase 3 |
| `product_attribute_assignments` | partial raw `product_attribute_values` | `admin.productAttributes.ts` | `UNCLEAR - NEED DECISION` | tabel ada indikasi legacy tapi tidak dimodelkan | High | treat as legacy; buat model/tabel resmi baru bila dipakai seller | Phase 3 |
| `variant_attribute_values` | none | n/a | `DOES NOT EXIST - CREATE NEW` | belum ada variant layer | High | tunda bersama variant normalization | Phase 3 or later |
| `store_coupons` | `coupons` | `server/src/models/Coupon.ts` | `EXISTS - HIGH RISK TO MODIFY` | coupon existing global-only, unique code global | High | lebih aman buat tabel baru seller coupon | Phase 4 |
| `coupon_product_scopes` | none | n/a | `DOES NOT EXIST - CREATE NEW` | belum ada coupon scoping | Medium | tabel baru | Phase 4 |
| `coupon_category_scopes` | none | n/a | `DOES NOT EXIST - CREATE NEW` | belum ada coupon scoping by category | Medium | tabel baru | Phase 4 |
| `coupon_redemptions` | none formal | `orders.couponCode` only | `DOES NOT EXIST - CREATE NEW` | belum ada redemption log | Medium | tabel baru | Phase 4 |
| `orders` | `Orders` | `server/src/models/Order.ts` | `ALREADY EXISTS - REUSABLE` | tidak punya `storeId`, tapi itu by design | Medium | jangan ubah phase awal; seller pakai suborders | Boundary existing |
| `suborders` | `suborders` | `server/src/models/Suborder.ts` | `ALREADY EXISTS - REUSABLE` | belum membership-aware, tapi seller-store aware | Low | reuse as seller transaction backbone | Phase 1 |
| `suborder_items` | `suborder_items` | `server/src/models/SuborderItem.ts` | `ALREADY EXISTS - REUSABLE` | sudah snapshot store relation | Low | reuse as-is | Phase 1 |
| `store_payment_profiles` | `store_payment_profiles` | `server/src/models/StorePaymentProfile.ts` | `ALREADY EXISTS - REUSABLE` | write flow masih owner/admin oriented | Medium | reuse read-first; extend access later, bukan schema dulu | Phase 1 read, later write |
| `store_pages` | none seller-scoped | `store_customizations` raw table is global-only | `DOES NOT EXIST - CREATE NEW` | belum ada page entity per store | Medium | buat baru; jangan menimpa `store_customizations` | Phase 4 |
| `store_page_sections` | none seller-scoped | `store_customizations` JSON only | `DOES NOT EXIST - CREATE NEW` | belum ada per-page structured sections | Medium | buat baru | Phase 4 |
| `store_audit_logs` | partial via `payment_status_logs` | `server/src/models/PaymentStatusLog.ts` | `DOES NOT EXIST - CREATE NEW` | belum ada generic seller audit log | Low-Medium | buat baru, tetap reuse payment log untuk payment domain | Phase 4 or Phase 2 |

## 5. Entity-by-Entity Notes

### 5.1 Core Identity

#### `users`

- Existing match:
  - `users`
- Touchpoint:
  - `server/src/models/User.ts`
- Existing key fields:
  - `id`, `name`, `email`, `password`, `role`, `status`, `is_published`
- Existing association penting:
  - store owner via `Store.ownerUserId`
  - product seller via `Product.userId`
  - payment review/admin references
- Gap:
  - tidak ada `current_store`, `membership`, `role per store`, atau `invitation` relation
- Rekomendasi:
  - jangan tambahkan role seller granular ke kolom `role`
  - jadikan `users` sebagai global identity saja
- Phase:
  - boundary existing

#### `stores`

- Existing match:
  - `stores`
- Touchpoint:
  - `server/src/models/Store.ts`
  - `server/src/models/index.ts`
- Existing key fields:
  - `id`, `ownerUserId`, `name`, `slug`, `status`
- Existing association penting:
  - `hasOne StorePaymentProfile`
  - `hasMany Suborder`
  - `hasMany Payment`
  - `hasMany Product`
- Gap:
  - belum ada `store_members`, `default role`, `owner transfer`, profile metadata yang lebih lengkap
- Risk:
  - `ownerUserId` unik dan dipakai auto-store assignment
- Rekomendasi:
  - cukup treat as boundary sementara
  - boleh extend ringan nanti untuk metadata non-breaking, tetapi jangan ubah ownership rule sekarang
- Phase:
  - phase 1 boundary

#### `store_roles`

- Existing match:
  - tidak ada
- Gap:
  - role per store belum ada sama sekali
- Rekomendasi:
  - tabel baru
  - minimal field yang aman nanti: `id`, `store_id`, `code`, `name`, `is_system`, timestamps
- Phase:
  - phase 2

#### `store_members`

- Existing match:
  - tidak ada
- Gap:
  - belum ada membership relation `user <-> store`
- Rekomendasi:
  - tabel baru
  - owner bridge nanti bisa dibackfill dari `stores.owner_user_id`, tetapi jangan mengganti source of truth lebih awal
- Phase:
  - phase 2

#### `permissions`

- Existing match:
  - tidak ada tabel
  - hanya ada global helper dan frontend constants
- Gap:
  - tidak ada permission registry backend yang bisa diquery atau diassign
- Rekomendasi:
  - optional
  - bila phase 2 cukup memakai fixed role presets, tabel ini boleh ditunda
  - bila target final perlu custom permission per role, buat tabel baru
- Phase:
  - phase 2 atau setelah role foundation stabil

#### `store_role_permissions`

- Existing match:
  - tidak ada
- Gap:
  - belum ada relation role-permission
- Rekomendasi:
  - buat hanya jika `permissions` dibangun
- Phase:
  - phase 2 atau berikutnya

### 5.2 Catalog Domain

#### `global_categories`

- Existing match:
  - `Category` model, table `Categories`
- Touchpoint:
  - `server/src/models/Category.ts`
  - `server/src/models/ProductCategory.ts`
  - `server/src/routes/admin.products.ts`
- Existing key fields:
  - `id`, `code`, `name`, `description`, `icon`, `published`, `parentId`
- Existing association penting:
  - self parent-child
  - product relation via `categoryId`, `defaultCategoryId`, `product_categories`
- Gap:
  - naming dan casing table tidak ideal
  - belum dibedakan eksplisit sebagai global taxonomy layer
- Rekomendasi:
  - reuse as global categories
  - jangan rename/drop
- Phase:
  - existing reusable

#### `store_categories`

- Existing match:
  - tidak ada
- Gap:
  - belum ada kategori tenant-scoped untuk seller collection/store nav
- Rekomendasi:
  - buat tabel baru
  - jangan overload `Categories` karena itu sudah dipakai admin/global catalog
- Phase:
  - phase 3

#### `products`

- Existing match:
  - `products`
- Touchpoint:
  - `server/src/models/Product.ts`
  - `server/src/models/index.ts`
  - `server/src/routes/admin.products.ts`
- Existing key fields:
  - `id`, `name`, `slug`, `sku`, `price`, `stock`, `userId`, `storeId`, `categoryId`, `defaultCategoryId`, `imagePaths`, `variations`, `wholesale`, `status`, `published`
- Existing association penting:
  - `belongsTo User` as seller
  - `belongsTo Store`
  - `belongsToMany Category`
- Gap:
  - ownership final masih kabur antara `userId` vs `storeId`
  - media dan variants masih JSON in-row
- Risk:
  - hook `beforeValidate` auto-creates store by owner user
- Rekomendasi:
  - phase awal seller workspace hanya read/reuse
  - perubahan struktural ditunda sampai membership dan access matang
- Phase:
  - phase 3 carefully

#### `product_images`

- Existing match:
  - tidak ada model/table resmi
  - hanya `products.imagePaths` JSON
- Gap:
  - tidak ada ordering, alt text, primary image row, per-variant binding
- Rekomendasi:
  - buat tabel baru nanti
  - jangan migrasi paksa di phase awal
- Phase:
  - phase 3 atau setelah write domain siap

#### `product_variants`

- Existing match:
  - tidak ada model/table resmi
  - hanya `products.variations` JSON
- Gap:
  - tidak ada normalized SKU variant, stock variant, price delta, media binding
- Rekomendasi:
  - tabel baru nanti
  - jangan retrofit setengah matang ke field JSON existing
- Phase:
  - phase 3 atau lebih akhir

#### `product_store_category_links`

- Existing match:
  - `product_categories` ada, tapi untuk `Category` global
- Gap:
  - target link untuk seller store categories belum ada
- Rekomendasi:
  - jangan pakai `product_categories` untuk dua semantic domain sekaligus
  - buat tabel baru khusus link ke `store_categories`
- Phase:
  - phase 3

### 5.3 Attributes Domain

#### `store_attributes`

- Existing match:
  - partial via `attributes`
- Touchpoint:
  - `server/src/models/Attribute.ts`
- Existing key fields:
  - `id`, `name`, `displayName`
- Gap:
  - tidak tenant-scoped
  - tidak ada status/type/store ownership
- Rekomendasi:
  - buat tabel baru seller-scoped
  - `attributes` existing bisa tetap hidup sebagai global vocab bila dibutuhkan
- Phase:
  - phase 3

#### `store_attribute_options`

- Existing match:
  - tidak ada model resmi
  - ada raw-query hint ke `attribute_values`
- Touchpoint:
  - `server/src/routes/admin.productAttributes.ts`
- Gap:
  - belum ada model, association, dan contract resmi
- Rekomendasi:
  - perlakukan raw tables sebagai legacy/partial
  - buat tabel baru resmi untuk seller phase
- Phase:
  - phase 3

#### `product_attribute_assignments`

- Existing match:
  - partial raw `product_attribute_values`
- Touchpoint:
  - `server/src/routes/admin.productAttributes.ts`
- Gap:
  - tidak ada model resmi dan tidak jelas apakah table pasti tersedia
- Rekomendasi:
  - jangan treat as stable foundation
  - putuskan nanti apakah akan formalize legacy tables atau buat naming baru yang bersih
- Phase:
  - phase 3

#### `variant_attribute_values`

- Existing match:
  - tidak ada
- Gap:
  - belum ada variant foundation
- Rekomendasi:
  - buat baru hanya setelah `product_variants` dan `store_attribute_options` matang
- Phase:
  - phase 3 atau lebih akhir

### 5.4 Promotion Domain

#### `store_coupons`

- Existing match:
  - `coupons`
- Touchpoint:
  - `server/src/models/Coupon.ts`
- Existing key fields:
  - `id`, `code`, `discountType`, `amount`, `minSpend`, `active`, `expiresAt`
- Gap:
  - tidak ada `storeId`
  - tidak ada scope ke product/category
  - tidak ada redemption log
- Risk:
  - coupon existing sudah global admin-like
- Rekomendasi:
  - lebih aman buat tabel baru seller coupon
  - jangan rombak `coupons` existing lebih awal
- Phase:
  - phase 4

#### `coupon_product_scopes`

- Existing match:
  - tidak ada
- Rekomendasi:
  - tabel baru
- Phase:
  - phase 4

#### `coupon_category_scopes`

- Existing match:
  - tidak ada
- Rekomendasi:
  - tabel baru
- Phase:
  - phase 4

#### `coupon_redemptions`

- Existing match:
  - tidak ada
  - `orders.couponCode` hanya snapshot string
- Rekomendasi:
  - tabel baru jika seller coupon write dibuka
- Phase:
  - phase 4

### 5.5 Order Domain

#### `orders`

- Existing match:
  - `Orders`
- Touchpoint:
  - `server/src/models/Order.ts`
  - `server/src/routes/orders.ts`
  - `server/src/routes/checkout.ts`
- Existing key fields:
  - `id`, `invoiceNo`, `userId`, `checkoutMode`, `paymentStatus`, `couponCode`, `totalAmount`, `status`
- Gap:
  - tidak ada `storeId`
- Risk:
  - ini memang parent order dan dipakai checkout active flow
- Rekomendasi:
  - reuse as-is
  - jangan tambah `storeId` di phase awal hanya demi seller workspace
- Phase:
  - boundary existing

#### `suborders`

- Existing match:
  - `suborders`
- Touchpoint:
  - `server/src/models/Suborder.ts`
  - `server/src/routes/seller.payments.ts`
  - `server/src/routes/admin.payments.audit.ts`
- Existing key fields:
  - `orderId`, `suborderNumber`, `storeId`, `storePaymentProfileId`, `subtotalAmount`, `paymentStatus`, `fulfillmentStatus`
- Gap:
  - tidak membership-aware, tapi itu bukan kebutuhan schema phase awal
- Rekomendasi:
  - reuse penuh sebagai backbone seller transaction
- Phase:
  - phase 1

#### `suborder_items`

- Existing match:
  - `suborder_items`
- Touchpoint:
  - `server/src/models/SuborderItem.ts`
- Existing key fields:
  - `suborderId`, `productId`, `storeId`, `productNameSnapshot`, `priceSnapshot`, `qty`
- Gap:
  - cukup untuk visibility seller
- Rekomendasi:
  - reuse as-is
- Phase:
  - phase 1

### 5.6 Payment Domain

#### `store_payment_profiles`

- Existing match:
  - `store_payment_profiles`
- Touchpoint:
  - `server/src/models/StorePaymentProfile.ts`
  - `server/src/routes/stores.ts`
  - `server/src/routes/admin.storePaymentProfiles.ts`
- Existing key fields:
  - `storeId`, `providerCode`, `paymentType`, `accountName`, `merchantName`, `qrisImageUrl`, `isActive`, `verificationStatus`
- Gap:
  - belum butuh schema delta untuk phase read
  - write access masih owner/admin oriented
- Rekomendasi:
  - reuse as-is untuk phase awal
  - access berubah nanti lewat middleware, bukan schema besar
- Phase:
  - phase 1 read, write later

### 5.7 Storefront Domain

#### `store_pages`

- Existing match:
  - tidak ada seller page entity
  - `store_customizations` hanya global by `lang`
- Touchpoint:
  - `server/src/routes/admin.storeCustomization.ts`
  - `server/src/routes/store.customization.ts`
- Gap:
  - belum ada page-per-store
- Rekomendasi:
  - buat tabel baru
  - jangan menimpa `store_customizations`
- Phase:
  - phase 4

#### `store_page_sections`

- Existing match:
  - tidak ada tabel resmi
  - existing customization berupa blob JSON per language
- Rekomendasi:
  - buat tabel baru yang terkait ke `store_pages`
- Phase:
  - phase 4

### 5.8 Audit Domain

#### `store_audit_logs`

- Existing match:
  - partial only via `payment_status_logs`
- Touchpoint:
  - `server/src/models/PaymentStatusLog.ts`
- Existing key fields partial:
  - `paymentId`, `oldStatus`, `newStatus`, `actorType`, `actorId`, `note`
- Gap:
  - tidak ada generic log untuk seller workspace actions di luar payment
- Rekomendasi:
  - buat tabel baru
  - tetap reuse `payment_status_logs` untuk payment-specific history
- Phase:
  - phase 4 atau phase 2 jika audit trail diperlukan lebih awal

## 6. Migration Order Recommendation

### Phase 1 DB Foundation for Owner-Only Bridge

Tujuan phase ini adalah membuka seller workspace read-mostly tanpa memaksa rewrite schema besar.

Bangun atau reuse:

- reuse `stores`
- reuse `suborders`
- reuse `suborder_items`
- reuse `store_payment_profiles`
- reuse `payments`, `payment_proofs`, `payment_status_logs` tanpa schema rewrite

Schema action:

- tidak wajib migration baru jika phase 1 hanya read shell
- bila perlu metadata ringan untuk seller workspace shell, itu harus non-breaking dan tidak menyentuh transaksi existing

### Phase 2 Membership + Permissions Foundation

Bangun baru:

- `store_roles`
- `store_members`
- optional `permissions`
- optional `store_role_permissions`
- optional `store_audit_logs` jika akses/action audit perlu lebih awal

Catatan:

- phase ini adalah fondasi tenant access final
- jangan pindah source of truth owner dari `stores.owner_user_id` dulu

### Phase 3 Catalog Seller Domain Support

Bangun baru atau extend hati-hati:

- `store_categories`
- `product_store_category_links`
- `store_attributes`
- `store_attribute_options`
- formalized `product_attribute_assignments`
- `product_images`
- `product_variants`
- `variant_attribute_values`

Boundary:

- `products` hanya di-extend setelah ownership strategy dan tenant middleware stabil

### Phase 4 Promotion, Storefront Content, and Audit

Bangun baru:

- `store_coupons`
- `coupon_product_scopes`
- `coupon_category_scopes`
- `coupon_redemptions`
- `store_pages`
- `store_page_sections`
- `store_audit_logs` bila belum dibangun di phase 2

### Phase 5 Deeper Seller Operations Support

Pertimbangkan extension setelah fondasi aman:

- tambahan fields di `products` bila katalog write benar-benar dibuka
- extension fulfillment metadata di `suborders` hanya jika dibutuhkan
- extension operational audit atau inventory ledger jika seller fulfillment masuk lebih dalam

## 7. High Risk Notes

### `stores`

- `owner_user_id` unik adalah boundary lama yang aktif dan dipakai di banyak flow owner access.
- Jangan menghapus atau mengubah uniqueness ini sebelum membership foundation siap dan migration strategy disetujui.
- Kesimpulan:
  - `stores` cukup di-extend ringan bila perlu, tetapi untuk sekarang harus diperlakukan sebagai boundary sementara.

### `products`

- `userId + storeId` plus hook auto-store menandakan model ownership masih transisional.
- Memecah media dan variants sekarang akan memicu perubahan lintas admin, seller, checkout, dan seed/backfill logic.
- Kesimpulan:
  - `product_images` dan `product_variants` jangan dibuat sebagai migration awal wajib; tunda sampai phase katalog write.

### `coupons`

- `coupons` existing global-only dan kemungkinan dipakai admin flow langsung.
- Menambahkan `storeId` ke tabel existing akan mencampur coupon global vs coupon seller.
- Kesimpulan:
  - `store_coupons` lebih aman sebagai tabel baru.

### `orders`

- Parent `orders` memang tidak store-scoped.
- Seller visibility berasal dari `suborders`.
- Menambah `storeId` ke `orders` akan bentrok dengan checkout multi-store.
- Kesimpulan:
  - phase awal tidak perlu perubahan schema `orders/suborders`; cukup reuse `suborders`.

### Checkout-Related Implications

- `checkout.ts` dan `store.ts` active flow tidak boleh dipaksa ikut schema baru seller workspace di phase awal.
- Semua entity baru harus coexist dan tidak memaksa rewrite order/payment orchestration.

### `store_payment_profiles`

- Domain ini sudah paling siap untuk seller workspace read.
- Risiko utamanya ada di access control, bukan schema.
- Kesimpulan:
  - jangan menambah complexity tabel lebih awal; fokus middleware nanti.

### Permission Tables

- `store_members` dan `store_roles` wajib dibuat sebagai tabel baru untuk arsitektur final.
- `permissions` dan `store_role_permissions` tidak wajib di phase paling awal bila role preset cukup.
- Kesimpulan:
  - membership tables wajib
  - permission registry tables opsional bertahap

## 8. Explicit Answers to Required Questions

### 1. Apakah `stores` cukup di-extend, atau harus diperlakukan sebagai boundary sementara?

Harus diperlakukan sebagai `boundary sementara`. Extend ringan boleh nanti, tetapi ownership rule existing jangan disentuh dulu.

### 2. Apakah `store_members` dan `store_roles` wajib dibuat sebagai tabel baru?

`YA`. Keduanya wajib tabel baru karena repo existing tidak punya membership/store-role foundation sama sekali.

### 3. Apakah `permissions` dan `store_role_permissions` sebaiknya dibuat sejak awal atau ditunda?

Lebih aman `ditunda ke phase 2` dan dibuat hanya jika permission granular dibutuhkan. Untuk awal, role preset bisa cukup.

### 4. Apakah `product_images` dan `product_variants` perlu langsung dibuat sebagai tabel baru?

`TIDAK` untuk phase awal. Keduanya sebaiknya ditunda karena `Product` existing masih JSON-based dan ownership strategy belum final.

### 5. Apakah `store_coupons` lebih aman sebagai tabel baru daripada merombak `Coupon` existing?

`YA`. Ini opsi paling aman.

### 6. Apakah `store_pages`, `store_page_sections`, dan `store_audit_logs` aman dibuat baru sejak awal?

Secara coexistence `aman dibuat baru`, tetapi tidak perlu diprioritaskan di phase awal. `store_pages` dan `store_page_sections` sebaiknya phase 4. `store_audit_logs` bisa phase 2 atau 4.

### 7. Apakah `orders/suborders` perlu perubahan schema di phase awal, atau cukup reuse dulu?

Cukup `reuse dulu`. Jangan ubah schema order domain di phase awal.

### 8. Entity apa yang paling aman menjadi fondasi DB phase awal seller workspace?

Yang paling aman:

- `stores` sebagai boundary owner-only
- `suborders`
- `suborder_items`
- `store_payment_profiles`
- `payments`
- `payment_proofs`
- `payment_status_logs`

## 9. Final DB Foundation Decision

### Tabel yang Dibangun Dulu

Untuk phase implementasi foundation setelah task ini, yang paling layak dibangun lebih dulu adalah:

- `store_roles`
- `store_members`

Opsional awal jika ingin audit-ready sejak foundation:

- `store_audit_logs`

### Tabel yang Di-Extend Dulu

- tidak ada extension besar yang wajib di phase 1
- extension future yang paling hati-hati:
  - `stores` hanya metadata ringan non-breaking
  - `products` hanya setelah phase katalog siap

### Tabel yang Ditunda

- `permissions`
- `store_role_permissions`
- `store_categories`
- `product_store_category_links`
- `store_attributes`
- `store_attribute_options`
- `product_attribute_assignments`
- `product_images`
- `product_variants`
- `variant_attribute_values`
- `store_coupons`
- `coupon_product_scopes`
- `coupon_category_scopes`
- `coupon_redemptions`
- `store_pages`
- `store_page_sections`

### Tabel / Entity High-Risk yang Jangan Disentuh Dulu

- `stores.owner_user_id`
- `products.userId`
- `products.storeId` ownership semantics
- `products.imagePaths`
- `products.variations`
- `orders`
- checkout-related schema path
- `coupons`
- raw legacy attribute tables tanpa formalisasi desain
- `store_customizations` global table

## 10. Implementation Readiness Verdict

DB delta map ini sudah cukup untuk memulai task implementasi foundation dengan syarat:

- implementasi awal tetap fokus ke membership foundation non-breaking
- tidak ada rewrite di `orders`, `checkout`, dan `products`
- semua entity baru lahir dengan tenant scope by `store_id`

---

# DB FOUNDATION RECOMMENDATION FOR NEXT IMPLEMENTATION TASK

1. Tabel/entity yang dibangun dulu:
   - `store_roles`
   - `store_members`
   - optional `store_audit_logs`

2. Tabel/entity yang di-extend dulu:
   - tidak ada extension besar yang wajib di phase awal
   - `stores` hanya boleh extension metadata ringan non-breaking jika benar-benar diperlukan

3. Tabel/entity yang ditunda:
   - `permissions`
   - `store_role_permissions`
   - `store_categories`
   - `product_store_category_links`
   - `store_attributes`
   - `store_attribute_options`
   - `product_attribute_assignments`
   - `product_images`
   - `product_variants`
   - `variant_attribute_values`
   - `store_coupons`
   - `coupon_product_scopes`
   - `coupon_category_scopes`
   - `coupon_redemptions`
   - `store_pages`
   - `store_page_sections`

4. Entity high-risk yang jangan disentuh dulu:
   - `stores.owner_user_id`
   - ownership semantics di `products`
   - JSON media/variant di `products`
   - `orders`
   - checkout multi-store flow
   - `coupons`
   - raw legacy attribute tables
   - `store_customizations`

5. Warning teknis paling kritis:
   - jangan mencoba memperkenalkan membership dengan menimpa `stores.owner_user_id` atau memindahkan ownership product lebih awal, karena itu akan menabrak access lama, auto-store hook, dan kontrak transaksi existing sekaligus.

6. Apakah siap lanjut ke task implementasi DB foundation:
   - `YA`

Alasannya singkat:

- entity fondasi yang aman sudah jelas
- boundary high-risk sudah dipisahkan
- urutan migration aman sudah ditetapkan
- phase awal tidak menuntut rewrite schema transaksi existing
