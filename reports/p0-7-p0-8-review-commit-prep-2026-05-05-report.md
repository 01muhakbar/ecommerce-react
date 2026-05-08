# P0.9 Review & Commit Preparation - Attribute Runtime Validation Batch

Tanggal: 2026-05-05

## Diff summary

`git diff --stat` pada full worktree saat review:

- 20 tracked files changed
- 723 insertions
- 119 deletions
- 10 untracked files/reports terdeteksi

Catatan penting:
- Full worktree tidak hanya berisi P0.7/P0.8.
- Ada perubahan P0.5/P0.6/Public Release/Coupon/Product/Attribute/MVF report yang masih ikut dirty worktree.
- Untuk commit batch Attribute Runtime Validation, staging harus dibatasi ke file P0.7/P0.8 di bawah.

## File in scope untuk batch P0.7/P0.8

P0.7 Attribute Runtime Validation:
- `server/src/services/attributeVariationRuntimeValidation.ts`
- `server/src/routes/seller.products.ts`
- `server/src/routes/store.ts`
- `server/src/controllers/cartController.ts`
- `server/src/routes/checkout.ts`
- `server/src/scripts/smokeSellerAttributesCrud.ts`
- `server/src/scripts/smokeCheckoutVariants.ts`
- `reports/attribute-runtime-validation-p0-7-2026-05-05-report.md`

P0.8 Admin guard + public detail regression:
- `server/src/routes/admin.products.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `reports/admin-product-variation-runtime-validation-p0-8-2026-05-05-report.md`

P0.9 review report:
- `reports/p0-7-p0-8-review-commit-prep-2026-05-05-report.md`

## File out of scope jika commit hanya P0.7/P0.8

File dirty yang berasal dari batch lain atau belum masuk daftar P0.7/P0.8:
- `.env.example`
- `.env.public-release.example`
- `docs/public-release-env.md`
- `client/src/api/store.types.ts`
- `client/src/utils/storefrontCatalog.ts`
- `server/package.json`
- `server/src/routes/admin.attributeValues.ts`
- `server/src/routes/admin.attributes.ts`
- `server/src/routes/public.ts`
- `server/src/routes/seller.attributes.ts`
- `server/src/routes/store.coupons.ts`
- `server/src/scripts/smokeSellerAttributes.ts`
- `server/src/scripts/smokeCouponScope.ts`
- `server/src/services/attributeValueVariationUsage.ts`
- `tools/qa/mvf-visibility-frontend.ts`
- `tools/qa/public-release-smoke.ts`
- `reports/product-sync-p0-admin-seller-client-2026-05-05-report.md`
- `reports/attribute-sync-p0-admin-seller-client-checkout-2026-05-05-report.md`
- `reports/coupon-sync-p0-admin-seller-client-checkout-2026-05-05-report.md`
- `reports/mvf-hardening-product-variant-coupon-checkout-order-2026-05-05-report.md`
- `reports/public-release-gate-env-fix-2026-05-05-report.md`

Rekomendasi:
- Jangan `git add .` untuk commit P0.7/P0.8.
- Stage file in-scope secara eksplisit.

## Review finding

Tidak ditemukan blocker untuk batch P0.7/P0.8.

Validator:
- Error codes actionable:
  - `ATTRIBUTE_VALUE_ID_REQUIRED`
  - `ATTRIBUTE_VALUE_NOT_FOUND`
  - `ATTRIBUTE_VALUE_MISMATCH`
  - `ATTRIBUTE_INACTIVE`
  - `ATTRIBUTE_VALUE_INACTIVE`
  - `ATTRIBUTE_UNPUBLISHED`
  - `ATTRIBUTE_STORE_SCOPE_MISMATCH`
  - `ATTRIBUTE_SCOPE_INVALID`
- Store context benar:
  - Seller create/update/import mengirim `storeId` dari route store.
  - Admin create memakai `storeOwnership.storeId`.
  - Admin update memakai next store jika `storeId` berubah, atau current product store jika tidak berubah.
  - Public detail/cart/checkout memakai `product.storeId`.
- Pasangan `attributeId:valueId` divalidasi terhadap tabel `attribute_values` dan `attributes`.
- Inactive/archived/unpublished ditolak di authoring path dan disaring di consumer path.
- Public sanitizer tetap terbatas pada detail/cart/checkout path dan tidak mengubah public list live sanitizer.

Routes:
- Seller save/update/import menolak variation runtime invalid sebelum product tersimpan.
- Admin create/update memakai validator existing tanpa kontrak payload baru.
- Cart mutation dan checkout men-sanitize product variations sebelum variant matching.
- Public store detail men-sanitize variations tanpa shared serializer refactor besar.

Smoke:
- Regression seller attributes CRUD jelas untuk mismatch dan archived value.
- Regression checkout variants memakai attribute/value DB nyata, bukan ID sintetis.
- Regression product visibility mengecek archived option tidak muncul di public detail.
- Cleanup smoke menghapus product, attribute values, dan attributes fixture yang dibuat.
- `smoke:coupon-scope` tetap butuh server lokal aktif di `BASE_URL`; saat review server sementara 3011 dijalankan dan dihentikan setelah smoke.

Secrets/debug/schema/UI:
- Tidak ditemukan credential/secret baru di file in-scope.
- `console.log` yang terdeteksi berada di smoke scripts atau log lama di `store.ts`, bukan debug liar baru untuk runtime validation.
- Tidak ada schema/migration change.
- Tidak ada UI change.
- Tidak ada perubahan checkout/payment/order calculation besar.
- Tidak ada Coupon Usage Ledger.
- Tidak ada public list live sanitizer baru.

## Perubahan kecil yang dirapikan

- Tidak ada patch runtime tambahan.
- Log sementara server 3011 untuk validasi (`tmp-p0-8-*`, `tmp-p0-9-*`) dibersihkan dari workspace jika ada.

## Validasi command + hasil

- `pnpm -F server build` PASS
- `pnpm -F client build` PASS
  - Catatan: Vite warning chunk > 500 kB tetap muncul, non-fatal.
- `pnpm -F server smoke:admin-attributes-domain` PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributes.ts` PASS
- `pnpm -F server exec tsx src/scripts/smokeSellerAttributesCrud.ts` PASS
- `pnpm -F server smoke:checkout-variants` PASS
- `pnpm -F server smoke:product-visibility` PASS
- `BASE_URL=http://localhost:3011 pnpm -F server smoke:coupon-scope` PASS
  - Server sementara di port 3011 dijalankan untuk command ini.
  - Server sementara sudah dihentikan setelah validasi.
- `pnpm qa:mvf:visibility` PASS
- `git diff --check` PASS
  - Catatan: hanya warning line ending CRLF/LF pada beberapa file, tidak ada whitespace error.

## Risiko tersisa

- Full worktree masih mengandung perubahan luar P0.7/P0.8; risiko utama commit preparation adalah staging terlalu luas.
- Product lama dengan variation JSON tanpa `valueId` akan diperlakukan invalid oleh runtime guard ketika melewati cart/checkout path.
- Public list live sanitizer tetap ditunda; public detail/cart/checkout sudah dijaga.
- Runtime sanitizer menambah query attribute/value pada public detail, cart mutation, dan checkout cart preparation.
- `qa:public-release` full assertions masih menunggu DB release/test credential valid.

## Suggested commit message

```text
Guard product variations against inactive attributes

- add runtime validation/sanitization for attribute/value backed variations
- reject invalid seller and admin variation saves
- sanitize public detail, cart, and checkout variation payloads
- add seller, checkout, and public detail regression smokes
- document P0.7/P0.8 attribute runtime validation review
```

Suggested explicit staging set:

```bash
git add \
  server/src/services/attributeVariationRuntimeValidation.ts \
  server/src/routes/seller.products.ts \
  server/src/routes/admin.products.ts \
  server/src/routes/store.ts \
  server/src/controllers/cartController.ts \
  server/src/routes/checkout.ts \
  server/src/scripts/smokeSellerAttributesCrud.ts \
  server/src/scripts/smokeCheckoutVariants.ts \
  server/src/scripts/smokeProductVisibility.ts \
  reports/attribute-runtime-validation-p0-7-2026-05-05-report.md \
  reports/admin-product-variation-runtime-validation-p0-8-2026-05-05-report.md \
  reports/p0-7-p0-8-review-commit-prep-2026-05-05-report.md
```
