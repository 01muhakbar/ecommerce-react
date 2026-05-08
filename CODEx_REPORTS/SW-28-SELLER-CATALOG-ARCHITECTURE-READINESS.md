# SW-28 Seller Catalog Architecture / Readiness

## 1. Executive Summary

Domain catalog seller di repo `ecommerce-react` **belum aman** untuk mutation penuh, tetapi **sudah cukup matang** untuk membuka lane read-only pertama yang tenant-scoped by `storeId`.

Keputusan arsitektur final untuk phase berikutnya:

- entry point paling aman adalah:
  - `Seller Product List Read-Only`
  - lalu `Seller Product Detail Read-Only`
- tenant boundary seller catalog phase awal harus memakai:
  - `Product.storeId`
- `Product.userId` tetap dianggap **transitional ownership field**
- hook auto-store di `Product` tidak boleh disentuh dulu
- publish/unpublish, create/edit, stock/price mutation, media, variant, category, dan attribute mutation harus ditunda sampai read model seller stabil

Read-first strategy adalah opsi paling aman karena:

- admin product contract saat ini global/admin-oriented
- storefront public contract membaca `status` + `published`
- stock dan pricing sudah langsung mempengaruhi checkout/storefront
- media dan variant masih tersimpan dalam representation yang belum seller-native

## 2. Current Catalog Baseline in ecommerce-react

### Product model

Touchpoint utama:

- `server/src/models/Product.ts`

Field penting yang relevan:

- `id`
- `name`
- `slug`
- `sku`
- `price`
- `salePrice`
- `stock`
- `userId`
- `storeId`
- `categoryId`
- `defaultCategoryId`
- `status`
- `isPublished`
- `description`
- `promoImagePath`
- `imagePaths`
- `videoPath`
- `tags`
- `variations`
- `wholesale`

Catatan penting:

- `status` = `active | inactive | draft`
- `isPublished` disimpan ke field DB `published`
- media utama masih campuran:
  - `promoImagePath`
  - `imagePaths` JSON
  - `videoPath`
- variant belum punya model terpisah:
  - `variations` JSON di `Product`

### Ownership and store relation

`Product` punya:

- `userId`
- `storeId`

Associations:

- `Product.belongsTo(User, as: "seller")`
- `Product.belongsTo(Store, as: "store")`

Risk paling penting:

- hook `beforeValidate` akan memastikan `storeId` dari `userId`
- jika `storeId` kosong, hook bisa:
  - mencari store by `ownerUserId`
  - atau membuat store baru untuk owner user

Ini artinya mutation seller/create-edit yang menyentuh `userId` atau memicu hook tanpa guardrail yang benar sangat berisiko.

### Admin products path

Touchpoint aktif:

- `server/src/routes/admin.products.ts`
- `server/src/app.ts`
- `client/src/pages/admin/Products.jsx`
- `client/src/api/adminProducts.ts`
- `client/src/api/products.service.js`

Karakteristik route admin:

- mounted di `/api/admin/products`
- global/admin-oriented
- create/update memakai kontrak admin
- create default memakai `req.user.id` untuk `userId`
- bulk publish/unpublish/delete sudah ada
- import/export juga sudah ada

Ini bukan kontrak yang aman untuk di-reuse mentah sebagai seller catalog API.

### Storefront public path

Touchpoint aktif:

- `server/src/routes/store.ts`
- `client/src/api/store.service.ts`

Storefront list:

- `/api/store/products`
- hanya membaca:
  - `status = active`
  - `published = true`

Storefront detail:

- `/api/store/products/:id`
- hanya membaca:
  - `status = active`
  - `isPublished = true`

Kesimpulan penting:

- perubahan seller terhadap `status`, `published`, `price`, `salePrice`, atau `stock` akan langsung berdampak ke storefront atau checkout jika dibuka terlalu cepat

## 3. Catalog Domain Risk Assessment

### Low-risk area

- seller list read by `storeId`
- seller detail read by `storeId`
- read-only visibility untuk:
  - current status
  - publish flag
  - stock
  - pricing
  - current media snapshot
  - current category snapshot
  - current variation snapshot

### Medium-risk area

- stock edit
- price edit
- basic metadata edit seperti `name` / `description`

Alasan:

- langsung mempengaruhi storefront, checkout, dan order expectations
- butuh publishability guardrail dan validation yang lebih matang

### High-risk area

- product create
- publish toggle
- slug mutation
- media management
- variant management
- category assignment
- attribute assignment

Alasan:

- menyentuh ownership transisional
- bisa memicu hook auto-store
- bisa mematahkan public product detail/search/category behavior
- belum ada seller-native representation untuk media/variant

## 4. Product Ownership Readiness

### Boundary yang aman sekarang

Untuk seller catalog phase awal, boundary paling aman adalah:

- `Product.storeId = :storeId`

Ini cukup aman untuk read model karena:

- seller access foundation sudah tenant-scoped by `storeId`
- seller route baru bisa memakai `requireSellerStoreAccess`
- seller tidak perlu menyentuh `userId` untuk list/detail read

### Posisi `userId`

`userId` existing tetap harus dianggap:

- ownership field lama / transisional
- bukan field yang aman untuk dijadikan surface mutation seller sekarang

Risiko jika seller mutation memakai `userId` terlalu dini:

- mismatch owner vs member
- create/edit bisa mengikuti pola admin lama
- hook auto-store dapat membuat atau mengaitkan store berdasarkan owner user, bukan membership seller context

### Yang tidak boleh diubah dulu

- `Product.userId`
- hook auto-store di `Product`
- `slug` semantics global storefront
- status/published semantics existing

## 5. Capability Readiness Matrix

| Capability | Readiness | Alasan |
|---|---|---|
| Product List Read | `READY NOW` | Aman dibuat seller-scoped by `storeId` tanpa mengubah persistence. |
| Product Detail Read | `READY NOW` | Aman jika seller hanya membaca snapshot produk milik store. |
| Product Create | `NOT READY / HIGH RISK` | Hook auto-store + `userId` ownership masih transisional. |
| Product Edit | `NOT READY / HIGH RISK` | Risiko menyentuh slug/status/published dan kontrak storefront. |
| Stock Edit | `READY WITH GUARDRAILS` | Bisa nanti, tapi tidak aman dibuka sebelum read model dan mutation boundary matang. |
| Price Edit | `READY WITH GUARDRAILS` | Langsung berdampak ke storefront/checkout. |
| Publish Toggle | `NOT READY / HIGH RISK` | Menyentuh public visibility contract. |
| Media Management | `NOT READY / HIGH RISK` | Media masih JSON/path-based dan belum seller-native. |
| Variant Management | `NOT READY / HIGH RISK` | Variant masih JSON di `Product`, belum model/domain seller yang jelas. |
| Category Assignment | `NOT READY / HIGH RISK` | Admin category contract masih global dan perlu validation lebih hati-hati. |
| Attribute Assignment | `NOT READY / HIGH RISK` | Attribute domain existing belum siap dipakai seller mutation aman. |

## 6. Read Model Recommendation

Read model first adalah strategi paling aman:

### Phase terdekat

1. `Seller Product List Read-Only`
2. `Seller Product Detail Read-Only`

### Kenapa ini paling aman

- seller bisa mulai melihat katalog store sendiri
- tenant isolation by `storeId` bisa divalidasi dulu
- tidak menyentuh hook auto-store
- tidak mengubah publishability/storefront
- memberi baseline UI dan API sebelum mutation dibuka

### Data yang aman ditampilkan

- `id`
- `name`
- `slug`
- `sku`
- `status`
- `published`
- `price`
- `salePrice`
- `stock`
- `category/defaultCategory` summary
- `store` summary
- `promoImagePath` / `imagePaths` snapshot
- `variations` summary read-only
- `updatedAt`

## 7. Coexistence Strategy with Admin and Storefront

### Dengan Admin

- seller catalog harus memakai namespace baru
- jangan re-use `/api/admin/products` sebagai endpoint seller
- admin tetap menjadi global operator
- seller hanya melihat product store sendiri

Strategi coexistence:

- admin:
  - `/api/admin/products`
- seller:
  - `/api/seller/stores/:storeId/products`
- storefront:
  - `/api/store/products`

### Dengan Storefront

Storefront existing tetap source untuk public browsing.

Seller catalog read model tidak boleh:

- mengubah filter public
- mengubah shape response public
- mengubah publish/status semantics public

Seller list/detail cukup menampilkan snapshot internal seller, termasuk product yang:

- draft
- inactive
- unpublished

ini justru menjadi alasan seller butuh route read model sendiri.

## 8. Mutation Guardrail Recommendation

Sebelum mutation catalog dibuka, guardrail minimal yang dibutuhkan:

- tenant scope wajib:
  - `product.storeId === :storeId`
- seller access middleware wajib aktif
- mutation tidak boleh menyentuh `userId`
- mutation tidak boleh mengubah `slug` dulu
- mutation tidak boleh mengubah `published` dulu
- mutation tidak boleh mengubah media/variant dulu
- mutation tidak boleh mengubah category/attribute dulu

Untuk phase sesudah read-only, mutation yang mungkin paling aman dibuka lebih dulu:

- stock edit
- price edit

tetapi hanya setelah:

- list/detail read stabil
- product ownership scoping tervalidasi
- guardrail validasi field matang

## 9. Publishability / Visibility Notes

Publishability seller sebaiknya **ditunda**.

Alasannya:

- storefront public membaca `status` + `published`
- publish toggle seller tanpa readiness checks bisa langsung membuka produk yang belum layak tampil

Field minimum yang semestinya valid sebelum publish nanti:

- name
- slug
- price
- stock atau availability logic yang jelas
- category/default category valid
- media minimum

Tetapi publish flow ini belum layak dibuka pada phase seller catalog pertama.

## 10. Media / Variant Readiness Notes

### Media

Current state:

- `promoImagePath`
- `imagePaths`
- `videoPath`

Readiness:

- read-only snapshot aman
- mutation media belum aman

### Variant

Current state:

- `variations` JSON di `Product`

Readiness:

- read-only snapshot aman
- mutation variant belum aman

Rekomendasi:

- tampilkan representasi read-only yang eksplisit:
  - number of images
  - available media paths
  - raw variant summary ringan
- jangan buka editor media/variant dulu

## 11. API Readiness Draft

### Ready next

- `GET /api/seller/stores/:storeId/products`
- `GET /api/seller/stores/:storeId/products/:productId`

### Draft list query yang aman

- `page`
- `limit`
- `q`
- `status`
- `published`

### Draft list response yang aman

- `items`
- `pagination`
- setiap item minimal:
  - `id`
  - `name`
  - `slug`
  - `status`
  - `published`
  - `price`
  - `salePrice`
  - `stock`
  - `imageUrl`
  - `category/defaultCategory`
  - `updatedAt`

### Draft detail response yang aman

- semua field list
- `description`
- `sku`
- `imagePaths`
- `videoPath`
- `variations` summary
- `tags`
- `store summary`

### Mutation readiness only, not for immediate implementation

- `POST /api/seller/stores/:storeId/products`
- `PATCH /api/seller/stores/:storeId/products/:productId`
- `PATCH /api/seller/stores/:storeId/products/:productId/stock`
- `PATCH /api/seller/stores/:storeId/products/:productId/price`
- `PATCH /api/seller/stores/:storeId/products/:productId/publish`

Status:

- mutation endpoints above are **not ready now**

## 12. Frontend Readiness Draft

### Seller catalog pages paling aman

- `/seller/stores/:storeId/catalog`
- `/seller/stores/:storeId/catalog/:productId`

### UI phase awal

- catalog list read-only
- status and publish badges
- stock and price snapshot
- image thumbnail
- filter ringan
- detail page read-only

### Jangan buka dulu

- create product form
- edit product form
- media uploader
- variant editor
- publish toggle

## 13. Phased Rollout Recommendation

### Phase C1

- Seller Product List Read-Only

### Phase C2

- Seller Product Detail Read-Only

### Phase C3

- Evaluate low-risk mutations:
  - stock edit
  - price edit

Hanya setelah:

- list/detail read stabil
- ownership scoping tervalidasi
- storefront regression dicek

### Phase C4

- metadata edit ringan yang tidak menyentuh publish/slug

### Phase C5

- publishability review
- media/variant/category/attribute planning lanjutan

## 14. Acceptance Criteria for Next Implementation

Task implementasi berikutnya dianggap benar jika:

- seller product list memakai seller namespace baru
- data hanya untuk `storeId` yang diakses
- seller bisa melihat produk store sendiri, termasuk non-public states
- admin/storefront contract tidak berubah
- build/typecheck lulus
- tidak ada mutation baru yang dibuka

## 15. Next Task Recommendation

Task berikutnya paling aman:

- implement `Seller Product List Read-Only`

Task setelah itu:

- implement `Seller Product Detail Read-Only`

Yang harus ditunda:

- create/edit
- publish toggle
- media management
- variant management
- category assignment
- attribute assignment

---

## SELLER CATALOG READINESS RECOMMENDATION

1. Entry point implementasi catalog paling aman:
   - `Seller Product List Read-Only`
2. Capability mana yang `READY NOW`:
   - Product List Read
   - Product Detail Read
3. Capability mana yang harus ditunda:
   - Product Create
   - Product Edit
   - Publish Toggle
   - Media Management
   - Variant Management
   - Category Assignment
   - Attribute Assignment
4. Risiko paling kritis:
   - ownership transisional `userId + storeId` dan hook auto-store pada `Product` membuat mutation seller catalog berisiko tinggi jika dibuka sebelum read model seller stabil.
5. Apakah siap lanjut ke task implementasi catalog read-only pertama:
   - `YA`
