# P0 Attribute Sync Audit & Stabilization — Admin/Seller/Client/Checkout

Tanggal: 2026-05-05

## Ringkasan Audit

Audit memakai metode ACUAN terhadap route, model, API client, halaman Admin/Seller/Client, dan smoke script attribute.

Hasil utama:
- Admin attribute/value adalah governance layer melalui `attributes` dan `attribute_values`.
- Seller membaca global attribute yang `published=1` dan `status='active'`, plus attribute scope `store` milik store aktifnya.
- Client product detail memakai `Product.variations` dari public store product response untuk membangun variant selector.
- Checkout/cart memvalidasi variant berdasarkan `variantKey` atau `variantSelections` terhadap `Product.variations`.
- Perbaikan dilakukan pada guard usage attribute value agar variasi produk dicocokkan dengan pasangan `attributeId:valueId`, bukan `valueId` saja.

## Matrix Field Attribute/Value

| Field | Backend | Admin | Seller | Client Product Detail | Checkout/Cart | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `attributeId` | `attributes.id` | `id` | `id` | `variation.selectedAttributes[].id`, `selections[].attributeId` | `variantSelections[].attributeId` | OK |
| attribute slug/code | Tidak ada kolom slug/code khusus | Tidak diekspos | Tidak diekspos | Tidak dipakai | Tidak dipakai | GAP |
| `name/label` | `name`, `display_name` | `name`, `displayName` | `name`, `displayName` | `attributeName`, group label | snapshot `attributeName` | OK |
| `type` | `dropdown/radio/checkbox` | dikelola | dikelola untuk store-owned, read-only untuk global | Tidak menentukan UI type; selector memakai button options | Tidak dipakai langsung | OK/GAP |
| status/active | `status='active'|'archived'` | list/filter/delete guard | list/filter/archive guard | mengikuti `Product.variations` | mengikuti `Product.variations` | GAP tersisa |
| published/visibility | `published` | publish/unpublish | global harus published; store-owned bisa publish/unpublish | mengikuti product variation payload | mengikuti product variation payload | GAP tersisa |
| values | `attribute_values.value` | `values[]` dan values endpoint | `values[]` dan values endpoint | `selectedAttributeValues[].values[]` | `variantSelections[]` snapshot | OK |
| `valueId` | `attribute_values.id` | `id`, `attributeId`, `value` | `id`, `attributeId`, `value`, `status` | `valueId` atau fallback value text | `valueId` atau fallback value text | OK setelah fix usage guard |
| value label | `value` | `value` | `value` | `label/value` | `value` | OK |
| value slug/code | Tidak ada kolom slug/code khusus | Tidak diekspos | Tidak diekspos | Tidak dipakai | Tidak dipakai | GAP |
| sort order | Query order by `value ASC` | Alphabetical | Alphabetical | urutan dari payload variasi | urutan snapshot | GAP |
| global vs seller-owned | `scope`, `storeId`, `createdByRole` | Admin melihat global dan store; non-superadmin dibatasi untuk store scope | Seller hanya store sendiri + global published | Tidak diekspos sebagai governance metadata | Tidak diekspos sebagai governance metadata | OK |
| relation ke product variant | `Product.variations` JSON dan legacy `product_attribute_values` | delete guard membaca legacy + variation refs | delete/archive guard membaca legacy + variation refs | variant selector dari JSON | checkout/cart dari JSON | OK/GAP tersisa |

## Flow Admin/Seller/Client/Checkout

Admin:
- Membuat dan mengubah global attribute.
- Membuat dan mengubah attribute values.
- Publish/unpublish global attribute.
- Delete guard sekarang mengecek legacy relation dan variation relation dengan pasangan `attributeId:valueId`.

Seller:
- Membaca global published active attribute dan store-owned attribute.
- Membuat, update, publish/unpublish, import/export attribute scope `store`.
- Tidak bisa mengubah global attribute dari Seller route.
- Cross-store access dibatasi oleh `requireSellerStoreAccess`.

Client:
- Product detail membangun option group dari `Product.variations`.
- Option kosong/rusak difilter oleh normalizer frontend.
- Client belum melakukan validasi live ke tabel `attributes/attribute_values`; ia percaya public product payload.

Checkout/Cart:
- Cart dan checkout memvalidasi variant key/selections terhadap `Product.variations`.
- Smoke checkout memastikan invalid variant selection ditolak dan corrupted cart line diblokir.
- Checkout belum mengecek ulang status live attribute/value jika variation JSON lama masih menyimpan value archived.

## Bug/Gap Ditemukan

1. BUG: Attribute value usage guard false-positive.
   - Sebelum fix, variation usage membaca `valueId` saja.
   - Jika variasi produk lama punya angka `valueId` sama tetapi attribute berbeda, delete value baru bisa salah ditolak `409`.
   - Terbukti dari `smoke:admin-attributes-domain` gagal pada bulk delete value sebelum perubahan.

2. BUG: Seller attribute direct smoke stale.
   - Route export seller sekarang hybrid (`global published + store-owned`).
   - Smoke lama masih mengharapkan scope `seller-readonly-global-published-attributes`.

3. GAP tersisa: Attribute/value slug/code dan sort order belum ada sebagai kontrak eksplisit.

4. GAP tersisa: Client dan checkout masih memakai `Product.variations` sebagai source variant runtime; validasi live ke status active/published attribute/value perlu task kecil terpisah karena menyentuh store product response, cart mutation, dan checkout.

## Perubahan yang Dibuat

- Menambahkan helper `resolveAttributeValueVariationUsage` untuk menghitung usage attribute value di product variations dengan pasangan `attributeId:valueId`.
- Mengganti usage guard Admin Attribute, Admin Attribute Values, dan Seller Attribute agar tidak false-positive pada `valueId` yang sama dari attribute berbeda.
- Menyesuaikan smoke seller attribute ke scope export aktual `seller-hybrid-attributes`.

## File Diubah

- `server/src/services/attributeValueVariationUsage.ts`
- `server/src/routes/admin.attributes.ts`
- `server/src/routes/admin.attributeValues.ts`
- `server/src/routes/seller.attributes.ts`
- `server/src/scripts/smokeSellerAttributes.ts`

## Validasi Command + Hasil

Baseline:
- `pnpm -F server build` — PASS
- `pnpm -F client build` — PASS, Vite chunk-size warning non-blocking
- `pnpm -F server smoke:admin-attributes-domain` — FAIL awal karena API lokal belum berjalan (`ECONNREFUSED`)
- `pnpm -F server smoke:seller-attributes` — command tidak tersedia di `server/package.json`
- `pnpm -F server smoke:seller-attributes-crud` — command tidak tersedia di `server/package.json`

Setelah API lokal dijalankan dan sebelum fix:
- `pnpm -F server smoke:admin-attributes-domain` — FAIL `409 Attribute value is already used by products...` pada bulk delete value
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributes.ts` — FAIL karena expected stale scope
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributesCrud.ts` — PASS

Setelah fix:
- `pnpm -F server build` — PASS
- `pnpm -F client build` — PASS, Vite chunk-size warning non-blocking
- `pnpm -F server smoke:admin-attributes-domain` — PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributes.ts` — PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributesCrud.ts` — PASS
- `pnpm -F server smoke:checkout-variants` — PASS

## Risiko Tersisa

- Tidak ada perubahan database schema, auth, permission system, checkout calculation besar, atau route refactor.
- Client dan checkout belum memfilter `Product.variations` berdasarkan status live `attributes/attribute_values`; produk lama dengan variasi yang sudah ter-archive masih perlu hardening lanjutan.
- Attribute slug/code dan sort order belum tersedia sebagai field first-class; saat ini `name/value` menjadi identitas tampilan.
- Smoke seller attribute direct file relevan, tetapi script name belum didaftarkan di `server/package.json`.

## Rekomendasi Task Berikutnya

P0 Attribute Runtime Validation:
- Tambahkan validasi kecil untuk Seller product save agar selected attribute/value wajib valid untuk store tersebut.
- Tambahkan sanitizer public product detail agar inactive/archived attribute values tidak tampil sebagai opsi aktif.
- Tambahkan validasi checkout/cart terhadap live attribute/value status sebelum menerima variant selection.
- Daftarkan `smoke:seller-attributes` dan `smoke:seller-attributes-crud` di `server/package.json` jika owner setuju.
