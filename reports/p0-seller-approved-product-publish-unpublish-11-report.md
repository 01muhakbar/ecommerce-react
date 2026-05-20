# P0 Seller Approved Product Publish/Unpublish Report

## Ringkasan
Memperbaiki publish control Seller agar produk yang sudah admin-approved dan berstatus `active` otomatis bisa dipublish oleh Seller. Seller juga tetap bisa melakukan unpublish mandiri pada produk yang sudah published selama produk tidak berada di review lane.

## File Diubah
- `server/src/routes/seller.products.ts`
- `server/src/scripts/smokeProductVisibility.ts`

## Perubahan
- `publishing.canPublish` sekarang mengikuti lifecycle utama:
  - seller punya permission `PRODUCT_PUBLISH`
  - product belum published
  - `Product.status = active`
  - `Product.sellerSubmissionStatus = none`
- Route Seller publish tidak lagi memblokir active-approved product dengan readiness tambahan dari `resolveSellerPublishReadiness`.
- Unpublish tetap mandiri untuk product published yang tidak sedang `submitted` atau `needs_revision`.
- Client visibility tetap mengikuti rule existing setelah publish.

## Smoke Coverage
`smoke:product-visibility` sekarang memastikan:
- Setelah admin approve, seller list menampilkan `publishing.canPublish = true`.
- Seller bisa publish product approved.
- Setelah publish, seller list menampilkan `publishing.canUnpublish = true`.
- Seller bisa unpublish product approved secara mandiri.
- Client storefront hidden kembali setelah seller unpublish.

## Validasi
- `pnpm.cmd -F server build`: PASS.
- `pnpm.cmd -F server smoke:product-visibility`: percobaan pertama gagal transient `ECONNRESET`; rerun PASS penuh.
- `git diff --check -- server/src/routes/seller.products.ts server/src/scripts/smokeProductVisibility.ts`: PASS.

## Risiko Tersisa
- Publish control sekarang lebih longgar terhadap readiness field non-lifecycle. Product yang active-approved bisa dipublish; apakah ia tampil di Client tetap ditentukan oleh public visibility gates existing.
