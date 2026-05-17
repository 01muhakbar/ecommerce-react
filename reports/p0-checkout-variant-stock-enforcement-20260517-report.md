# P0-CHECKOUT-VARIANT-STOCK-ENFORCEMENT-20260517 Report

## Summary
Checkout enforcement untuk variant stock sudah diperkuat tanpa schema change, payment flow change, atau lifecycle refactor besar.

Backend checkout sekarang dikunci sebagai source of truth final untuk:
- variant selection validity,
- variant stock terkini,
- product/variant price terkini,
- order creation blocking saat ada invalid cart item.

## Files Changed
- `server/src/routes/checkout.ts`
- `server/src/scripts/smokeCheckoutVariants.ts`
- `reports/p0-checkout-variant-stock-enforcement-20260517-report.md`

Catatan: worktree juga masih memuat patch task sebelumnya untuk `P0-CATALOG-VARIANT-VISIBILITY-01`.

## Bug Ditemukan
- Checkout variant stock enforcement utama sudah ada, tetapi smoke belum mengunci skenario stale cart saat variant stock berubah menjadi `0` setelah item masuk cart.
- Checkout non-variant masih bisa memakai `CartItem.unit*Snapshot` sebagai fallback harga final. Snapshot itu dibuat backend saat cart add, tetapi tetap bisa stale bila Product price berubah sebelum checkout.
- Smoke belum mengunci bahwa order tidak dibuat ketika create checkout menerima invalid variant stock.

## Bug Diperbaiki
- Checkout line non-variant sekarang memakai harga Product terkini dari DB saat preview/create, bukan snapshot cart.
- Smoke menambahkan skenario:
  - selected variant stock berubah menjadi `0` setelah masuk cart, parent stock tetap positif, preview/create ditolak;
  - checkout create gagal dengan `CHECKOUT_INVALID_ITEMS` dan tidak membuat order;
  - cart line produk varian tanpa variant snapshot ditolak;
  - variant price berubah setelah cart add, preview memakai harga variant DB terbaru;
  - product price berubah setelah cart add, preview/create/order item memakai harga Product DB terbaru.

## Backend Contract Yang Diperkuat
- Client checkout payload tetap:
  - `POST /api/checkout/preview` dengan optional `cartId`/`shippingAddressId`;
  - `POST /api/checkout/create-multi-store` dengan customer, shipping details, coupon, group coupons, optional `cartId`, dan `checkoutRequestKey`.
- Backend lookup tetap dari cart aktif milik user.
- Create checkout mengunci ulang Product row dalam transaction sebelum order dibuat.
- Variant snapshot checkout dibangun ulang dari Product `variations` terkini dan CartItem variant identity.
- Invalid cart item tetap dikembalikan sebagai `409 CHECKOUT_INVALID_ITEMS` pada create, dengan `invalidItems[]`.
- Order, Suborder, Payment, dan item snapshots tidak dibuat bila ada invalid cart item.

## Dampak Ke Client/Seller/Admin
- Client: checkout menerima error backend yang sudah ada; tidak ada UI/API contract besar yang berubah.
- Seller: tidak langsung berubah, tetapi order tidak tercipta dari variant yang tidak sellable.
- Admin: tidak langsung berubah, tetapi order/admin detail tetap hanya membaca order valid.

## Test Command Dan Hasil
- `pnpm.cmd -F server build`: PASS
- `pnpm.cmd -F client build`: PASS, warning chunk besar existing
- `pnpm.cmd -F server smoke:checkout-variants`: PASS
- `pnpm.cmd -F server smoke:order-payment`: PASS
- `pnpm.cmd -F server smoke:product-visibility`: PASS
- `git diff --check`: PASS

## Risiko Tersisa
- Kode error untuk cart line varian yang kehilangan snapshot tetap memakai contract existing `PRODUCT_VARIANT_MISSING`, bukan enum baru.
- Checkout masih memakai JSON `Product.variations`; full SQL-level stock aggregation untuk varian belum dibuat agar tidak menyentuh schema/query besar.

## Rekomendasi Task Berikutnya
P0-CHECKOUT-CANONICAL-TOTALS-REGRESSION: perluas smoke canonical totals untuk multi-store price drift, coupon quote, dan final payment amount dalam satu skenario end-to-end.
