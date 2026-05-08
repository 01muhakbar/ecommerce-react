# P0.8 Admin Product Variation Runtime Validation Audit + Public Detail Regression

Tanggal: 2026-05-05

## Ringkasan audit Admin product variation

Admin product authoring/edit diaudit terhadap runtime validation attribute/value/variant yang sudah ada dari P0.7.

Hasil audit:
- Admin ProductForm mengirim `variations` dalam payload product create/update.
- Backend Admin product route menerima dan menyimpan `variations` langsung melalui:
  - `POST /api/admin/products`
  - `PATCH /api/admin/products/:id`
- Guard Admin existing sudah melakukan sanitasi struktur variation, unknown attribute/value, pasangan `attributeId:valueId`, duplicate selection, selected values, variant combination, price, dan stock.
- Gap yang ditemukan: jalur Admin belum memakai runtime guard P0.7 untuk status live attribute/value seperti inactive, archived, unpublished, dan store-scoped attribute ownership.

## Apakah Admin bisa save variations langsung

Ya.

Flow yang ditemukan:
- Frontend: `client/src/pages/admin/ProductForm.jsx`
- Backend: `server/src/routes/admin.products.ts`
- Operation:
  - Admin create product dapat menyertakan `variations`.
  - Admin update product dapat menyertakan `variations`.

Karena jalur ini tidak selalu melewati Seller product save/update, perlu guard runtime setara Seller pada Admin route.

## Guard existing yang ditemukan

Existing Admin guard:
- `sanitizeAdminProductVariations` di `server/src/routes/admin.products.ts`
- Memvalidasi:
  - payload object dan `hasVariants`
  - selected attributes dan selected values
  - attribute ID ada di database
  - value ID ada di database
  - value sesuai dengan attribute
  - duplicate attribute/value
  - variant combination/combinationKey
  - variant price, salePrice, quantity, image

Existing runtime guard P0.7:
- `server/src/services/attributeVariationRuntimeValidation.ts`
- Sudah dipakai oleh Seller, public product detail sanitizer, cart, dan checkout.
- Memvalidasi live runtime status attribute/value dan store-scoped attribute context.

## Perubahan yang dibuat

1. Menambahkan runtime validation pada Admin product create.
   - Setelah `sanitizeAdminProductVariations`, Admin create memanggil runtime validator existing.
   - Store context memakai `storeOwnership.storeId` jika product dibuat untuk store tertentu.

2. Menambahkan runtime validation pada Admin product update.
   - Product existing dibaca lebih dulu agar update variation tanpa perubahan `storeId` tetap punya store context.
   - Jika payload mengubah `storeId`, validator memakai next store context.
   - Jika payload tidak mengubah `storeId`, validator memakai `storeId` product existing.

3. Menjaga response error tetap kecil dan actionable.
   - Error 400 Admin create/update kini ikut mengembalikan `code` dan `issues` jika diberikan oleh runtime validator.

4. Menambahkan regression smoke public product detail.
   - Smoke membuat product visible dengan variant berbasis attribute/value nyata.
   - Salah satu value kemudian diubah menjadi `archived`.
   - `/api/store/products/:slug` diverifikasi tidak menampilkan archived option di:
     - `variations.variants`
     - `variations.selectedAttributeValues`
     - variant combination label

## Regression public detail yang ditambah

Command yang mencakup regression:

```bash
pnpm -F server smoke:product-visibility
pnpm qa:mvf:visibility
```

Assertion baru:
- `[mvf-visibility] checking public detail sanitizer hides archived variation option`
- `[mvf-visibility] PASS public detail variation sanitizer hides archived option`

## File diubah

- `server/src/routes/admin.products.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `reports/admin-product-variation-runtime-validation-p0-8-2026-05-05-report.md`

## Validasi command + hasil

- `pnpm -F server build` PASS
- `pnpm -F server smoke:admin-product-variation-validation` PASS
- `pnpm -F client build` PASS
  - Catatan: Vite tetap memberi warning chunk size > 500 kB, non-fatal.
- `pnpm -F server smoke:admin-attributes-domain` PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributes.ts` PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributesCrud.ts` PASS
- `pnpm -F server smoke:checkout-variants` PASS
- `pnpm -F server smoke:product-visibility` PASS
- `BASE_URL=http://localhost:3011 pnpm -F server smoke:coupon-scope` PASS
  - Percobaan awal gagal karena tidak ada API listening di `http://localhost:3011`.
  - Setelah server sementara dijalankan di port 3011, smoke PASS.
  - Server sementara sudah dihentikan setelah validasi.
- `pnpm qa:mvf:visibility` PASS

## Risiko tersisa

- Public list live sanitizer tetap belum dikerjakan sesuai batas backlog, sehingga regression ini fokus pada public detail canonical.
- Shared public product serializer belum disatukan; ini tetap maintenance improvement terpisah, bukan blocker P0.8.
- Runtime guard Admin memakai service existing dari P0.7. Jika nanti ada perubahan kontrak besar variation, guard Admin/Seller harus diaudit bersama.
- Worktree masih berisi perubahan P0 sebelumnya yang belum dicommit; P0.8 hanya menambah guard Admin route dan regression public detail.

## Backlog yang sengaja ditunda

1. Public list live sanitizer
   - Status: tunda.
   - Alasan: berpotensi menjadi performance/shared serializer refactor.

2. Shared public product serializer
   - Status: tunda.
   - Alasan: maintenance improvement, bukan blocker P0.

3. Coupon Usage Ledger & Limits
   - Status: STOP.
   - Alasan: butuh approval schema/model.

4. `qa:public-release` full assertions
   - Status: menunggu DB release/test credential valid.

## Rekomendasi task berikutnya

- Commit batch P0.7/P0.8 setelah owner review agar guard runtime attribute variation punya baseline git yang bersih.
- Siapkan DB release/test credential valid untuk menjalankan `pnpm qa:public-release` sampai assertion penuh.
- Setelah release gate stabil, audit public list sanitizer sebagai task terpisah dengan batas performance yang jelas.
