# SELLER-S4A — Seller Add Product Field Expansion (Phase-2)

## Goal
Memperluas seller add/edit draft field secara aman di lane draft-first tanpa membuka publish authority atau melebar menjadi full product suite.

## Repo audit before coding
- `server/src/routes/seller.products.ts`
- `client/src/api/sellerProducts.ts`
- `client/src/pages/seller/SellerProductAuthoringPage.jsx`
- `client/src/pages/seller/SellerProductDetailPage.jsx`
- `client/src/pages/seller/SellerCatalogPage.jsx`
- `client/src/pages/admin/ProductForm.jsx`
- `server/src/routes/public.ts`

## Keputusan subset phase-2
Field yang dibuka pada phase ini:
- `categoryIds`
- `defaultCategoryId`
- `price`
- `salePrice`
- `stock`

Field yang sengaja belum dibuka:
- media/image upload
- advanced variations
- wholesale
- tags/metadata lanjutan
- status/publish
- notes/admin-owned fields

## Alasan pemilihan subset
- Category, price, salePrice, dan stock sudah punya shape domain yang jelas di model/serializer seller saat ini.
- Semua field itu sudah ada di product read model, sehingga tidak perlu schema baru.
- Media upload belum aman dibuka karena endpoint upload aktif masih staff/admin-oriented (`/api/admin/uploads`).

## ACUAN
- Amati:
  - `seller.products.ts` read model yang sudah membawa category/pricing/inventory
  - `ProductForm.jsx` admin hanya sebagai referensi UX category/pricing/inventory
  - `public.ts` categories published sebagai reference data existing
- Tiru:
  - backend-driven governance dan validasi field
  - category selection dari reference data existing, bukan create category baru
- Modifikasi:
  - extend seller draft payload minimal untuk category/pricing/stock
  - tambah reference categories di authoring meta
  - perluas seller form native tanpa meminjam mentah admin form

## Perubahan yang dilakukan
1. Backend seller draft payload sekarang menerima:
   - `categoryIds`
   - `defaultCategoryId`
   - `price`
   - `salePrice`
   - `stock`
2. Ditambah validasi backend untuk:
   - category harus published dan valid
   - default category harus bagian dari selected categories
   - price non-negative
   - salePrice non-negative dan lebih rendah dari price
   - stock integer non-negative
3. Draft create/update sekarang benar-benar menyimpan:
   - category assignments via `ProductCategory`
   - `defaultCategoryId`
   - `price`
   - `salePrice`
   - `stock`
4. Seller authoring meta sekarang membawa reference categories published untuk dipilih seller.
5. Seller authoring page sekarang menampilkan controls native untuk:
   - category tree selection
   - default category
   - base price
   - sale price
   - stock
6. Copy governance seller dirapikan agar pricing/inventory/category tidak lagi disebut sebagai deferred, sementara media upload tetap deferred.

## Governance klasifikasi field
### Seller-editable now
- `name`
- `description`
- `sku`
- `categoryIds`
- `defaultCategoryId`
- `price`
- `salePrice`
- `stock`

### Seller-read-only
- `slug`
- `promoImagePath`
- `imagePaths`
- `videoPath`
- `tags`
- `variations`
- `wholesale`
- field snapshot turunan lainnya

### Admin-owned
- `status`
- `isPublished`
- `storeId`
- `userId`
- `notes`

### Deferred / not in MVP
- media upload/image management
- video
- tags write lane
- variations
- wholesale
- dangerous/preorder/shipping fields
- barcode/gtin/condition/parentSku/youtubeLink

## Dampak sinkronisasi
- Seller Workspace:
  - add/edit draft lebih realistis
  - submit/revision/resubmit tetap memakai governance yang sama
- Admin Workspace:
  - contract product admin tidak diubah
  - admin tetap final authority publish/review
- Storefront/public:
  - tidak berubah
  - tetap hanya membaca `published + active`

## Risiko
- Category reference seller saat ini memakai kategori published existing; jika ada draft lama dengan kategori yang kini unpublished, selection list seller bisa lebih sempit dari snapshot lama.
- Price/stock sekarang seller-editable di draft lane, jadi phase berikutnya harus tetap disiplin agar tidak membuka publish/status bersama-sama.
- Media upload sengaja belum dibuka; seller draft masih belum bisa mengelola image file secara native.

## Verifikasi
- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm qa:mvf` (ekspektasi masih gagal di issue pre-existing `QA-MONEY`)

## Belum disentuh
- Tidak membuka media upload seller.
- Tidak membuka publish/status control.
- Tidak membuka advanced variations/wholesale.
- Tidak mengubah admin/storefront contract.
- Tidak menambah migration/schema baru.
