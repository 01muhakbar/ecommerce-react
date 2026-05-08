# P0.7 Attribute Runtime Validation - Seller Save, Public Detail, Cart/Checkout

Tanggal: 2026-05-05

## Ringkasan Audit Runtime

Audit memakai ACUAN terhadap runtime attribute/value/variant setelah P0 Product, Attribute, Coupon, MVF, dan P0.6 env gate.

Temuan utama:
- `Attribute` sudah punya governance fields: `status`, `published`, `scope`, `storeId`.
- `attribute_values` sudah punya `status`.
- Seller product authoring sudah menormalisasi shape `variations`, tetapi belum mengecek pasangan live `attributeId:valueId` ke tabel `attributes/attribute_values`.
- Public product detail mengekspos `Product.variations` langsung dari JSON product.
- Cart dan checkout sudah memvalidasi `variantKey`/`variantSelections` terhadap `Product.variations`, tetapi sebelum patch belum menolak value yang diarsipkan setelah product/cart dibuat.

Tidak ada perubahan schema, migration, association besar, checkout calculation, order snapshot, payment flow, cart architecture, shared serializer besar, atau UI redesign.

## Guard yang Sudah Ada

| Area | Guard existing | Status sebelum patch |
|---|---|---|
| Admin attribute/value governance | `status`, `published`, `scope`, delete/archive guard | OK |
| Seller attribute list/CRUD | Seller hanya melihat global published + store-owned, cross-store ditolak | OK |
| Seller product variation shape | Wajib variants, selections, duplicate key guard, price/stock/image validation | OK |
| Product public visibility | Product harus active, published, review clear, store active/operational | OK |
| Cart variant selection | Variant harus cocok dengan `Product.variations` | OK/GAP |
| Checkout variant selection | Preview/create menolak variant missing/corrupt | OK/GAP |

GAP sebelum patch:
- Cart/checkout belum mengecek live status attribute/value setelah product variation tersimpan.
- Seller save belum menolak `valueId` yang ada tetapi milik attribute lain.
- Seller save belum menolak attribute/value inactive/archived.
- Public detail belum men-sanitize inactive/invalid option dari variation JSON.

## Gap yang Ditemukan

1. BUG/GAP: Seller save bisa menerima pasangan `attributeId:valueId` yang tidak cocok jika shape variasi valid secara sintaks.
2. BUG/GAP: Seller save bisa menerima value archived jika payload masih menyimpan ID tersebut.
3. BUG/GAP: Cart add masih percaya product variation JSON sebelum live attribute/value check.
4. BUG/GAP: Checkout preview/create masih percaya product variation JSON sebelum live attribute/value check.
5. GAP: Sanitizer public detail hanya diterapkan pada detail route, bukan refactor serializer/list global. Ini disengaja agar tidak menjadi shared public product serializer besar.

## Perubahan yang Dibuat

1. Menambahkan service runtime kecil:
   - `resolveAttributeVariationRuntimeIssues`
   - `assertSellerVariationRuntimeValid`
   - `sanitizeVariationsForRuntime`
   - `applyRuntimeVariationSanitizerToProduct`

2. Seller product save/update/import:
   - Validasi `variations` terhadap live `attributes` dan `attribute_values`.
   - Menolak value ID yang tidak ada.
   - Menolak pasangan `attributeId:valueId` yang tidak cocok.
   - Menolak attribute/value inactive/archived.
   - Menolak unpublished attribute.
   - Menolak store-scoped attribute dari store lain.
   - Error response mengembalikan `code` dan `issues` agar actionable.

3. Public product detail:
   - Men-sanitize `variations` di detail route sebelum response.
   - Variant yang memakai attribute/value invalid/inactive tidak diexpose sebagai opsi aktif.

4. Cart:
   - Product mutation snapshot men-sanitize runtime variations sebelum memilih variant.
   - Cart add/update akan menolak variant yang sudah invalid/inactive.

5. Checkout:
   - Checkout preview/create men-sanitize product variations pada cart products sebelum grouping.
   - Existing cart line yang memakai value archived berubah menjadi invalid item `PRODUCT_VARIANT_MISSING`, tanpa mengubah calculation.

## Smoke/Regression yang Ditambah

`server/src/scripts/smokeSellerAttributesCrud.ts`
- Seller product save menolak pasangan `attributeId:valueId` yang mismatch.
- Seller product save menolak archived attribute value.

`server/src/scripts/smokeCheckoutVariants.ts`
- Fixture variant sekarang memakai attribute/value DB nyata, bukan hardcoded synthetic IDs.
- Cart add menolak variant dengan value archived.
- Checkout preview menandai cart line lama dengan value archived sebagai invalid.
- Checkout create menolak cart line lama dengan value archived.

## File Diubah

- `server/src/services/attributeVariationRuntimeValidation.ts`
- `server/src/routes/seller.products.ts`
- `server/src/routes/store.ts`
- `server/src/controllers/cartController.ts`
- `server/src/routes/checkout.ts`
- `server/src/scripts/smokeSellerAttributesCrud.ts`
- `server/src/scripts/smokeCheckoutVariants.ts`
- `reports/attribute-runtime-validation-p0-7-2026-05-05-report.md`

## Validasi Command + Hasil

Baseline sebelum patch:
- `pnpm -F server build` - PASS
- `pnpm -F client build` - PASS, Vite chunk-size warning non-fatal
- `pnpm -F server smoke:admin-attributes-domain` - PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributes.ts` - PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributesCrud.ts` - PASS
- `pnpm -F server smoke:checkout-variants` - PASS

Setelah patch:
- `pnpm -F server build` - PASS
- `pnpm -F client build` - PASS, Vite chunk-size warning non-fatal
- `pnpm -F server smoke:admin-attributes-domain` - PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributes.ts` - PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributesCrud.ts` - PASS
- `pnpm -F server smoke:checkout-variants` - PASS
- `pnpm -F server smoke:product-visibility` - PASS
- `pnpm qa:mvf:visibility` - PASS
- `git diff --check -- server/src/services/attributeVariationRuntimeValidation.ts server/src/routes/seller.products.ts server/src/controllers/cartController.ts server/src/routes/store.ts server/src/routes/checkout.ts server/src/scripts/smokeSellerAttributesCrud.ts server/src/scripts/smokeCheckoutVariants.ts` - PASS

Catatan:
- `pnpm -F client build` tetap mengeluarkan warning Vite chunk > 500 kB. Ini non-fatal dan tidak terkait attribute runtime validation.
- `git diff --check` memberi warning line ending CRLF/LF untuk `cartController.ts` dan `store.ts`, tetapi tidak ada whitespace error.

## Risiko Tersisa

- Public list masih memakai serializer/list route existing dan tidak disanitasi live per product untuk menghindari refactor/performance impact besar.
- Product lama yang menyimpan variation JSON tanpa `valueId` akan dianggap invalid saat melewati guard cart/checkout runtime.
- Admin product save belum ditambah validasi live attribute/value di task ini; scope task fokus Seller save sebagai authoring layer.
- Runtime sanitizer menambah query attribute/value saat public detail, cart mutation, dan checkout cart preparation.

## Backlog yang Sengaja Ditunda

- Shared public product serializer besar.
- DB schema/model migration untuk attribute slug/code/sort order.
- Cart architecture refactor.
- Checkout calculation/order snapshot refactor.
- Coupon Usage Ledger & Limits.
- Public release DB credential setup.
- UI redesign Admin/Seller/Client.

## Rekomendasi Task Berikutnya

1. Tambahkan smoke public detail khusus yang membuat product variant valid, mengarsipkan value, lalu memastikan option inactive tidak muncul di `/api/store/products/:slug`.
2. Audit Admin product save untuk validasi live attribute/value jika Admin masih bisa author product variations langsung.
3. Setelah DB release/test credential tersedia, jalankan ulang `PUBLIC_RELEASE_SMOKE_ENV_FILE=.env.public-release pnpm qa:public-release`.
