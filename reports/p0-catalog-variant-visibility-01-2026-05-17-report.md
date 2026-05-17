# P0-CATALOG-VARIANT-VISIBILITY-01 Report

## Ringkasan
Audit menemukan gap P0 pada public catalog visibility:

- Produk variant-only masih bisa tampil di Client jika `Product.stock > 0`, walaupun semua `variations.variants[].quantity` sudah `0`.
- Admin/Seller visibility metadata juga masih menilai produk seperti ini sebagai `STOREFRONT_VISIBLE` karena hanya membaca stok induk.

Patch minimal menambahkan satu helper inventory visibility backend dan memakainya di public Storefront, public legacy product route, Seller catalog metadata, dan Admin catalog metadata.

## Scope
- Product lifecycle visibility lintas Admin, Seller, Client.
- Public Storefront listing/detail gate.
- Public legacy `/api/products` listing/detail gate.
- Seller/Admin product visibility read model.
- Smoke product visibility fixture untuk produk dengan semua varian habis.

## File Diubah
- `server/src/services/productVisibility.ts`
- `server/src/routes/store.ts`
- `server/src/routes/public.ts`
- `server/src/routes/seller.products.ts`
- `server/src/routes/admin.products.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `reports/p0-catalog-variant-visibility-01-2026-05-17-report.md`

## Patch Minimal
- Menambahkan `hasStorefrontSellableInventory`:
  - non-varian memakai stok induk seperti sebelumnya;
  - varian memakai minimal satu varian sellable;
  - `quantity: null` tetap fallback ke stok induk, sesuai behavior cart snapshot existing.
- Public listing/detail sekarang menyembunyikan produk yang semua varian sellable-nya habis.
- Seller/Admin visibility sekarang mengembalikan `PUBLISHED_BLOCKED + OUT_OF_STOCK` untuk produk variant-only yang semua variannya habis.
- Seller summary visibility dihitung dari shared visibility snapshot agar angka `storefrontVisible` dan `publishedBlocked` ikut membaca varian.

## Dampak 3 Aplikasi
- Admin: status visibility katalog lebih jujur untuk produk varian habis.
- Seller: seller catalog tidak lagi menandai produk varian habis sebagai visible.
- Client: storefront/public product discovery dan detail tidak menampilkan produk yang tidak punya varian sellable.

## Validasi
- `pnpm.cmd -F server build`: PASS
- `pnpm.cmd -F server smoke:product-visibility`: PASS
- `pnpm.cmd -F client build`: PASS, warning chunk besar existing
- `pnpm.cmd -F server smoke:checkout-variants`: PASS
- `pnpm.cmd -F server smoke:order-payment`: PASS
- `git diff --check`: PASS

## Risiko Tersisa
- Public pagination total dikoreksi pada halaman yang sedang dibaca setelah filter varian runtime. Untuk pagination besar, perhitungan total masih bukan full-table JSON inventory count.
