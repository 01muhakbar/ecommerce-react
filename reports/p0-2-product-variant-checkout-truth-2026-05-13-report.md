# P0.2 Product Visibility & Variant Checkout Truth Report

Tanggal: 2026-05-13

## Ringkasan Masalah

Audit menemukan satu mismatch production-impact pada public storefront product detail:

- Endpoint `GET /api/store/products/:id?storeSlug=...` masih mengizinkan product dari store `ACTIVE` yang belum operational/payment-ready.
- Listing storefront dan checkout sudah memakai gate store operational/payment-ready, sehingga product not-ready bisa terbuka lewat detail microsite tetapi tidak bisa dibeli saat cart/checkout.
- Smoke product visibility sebelumnya masih menganggap detail not-ready boleh `200` dengan `purchaseState=STORE_NOT_READY`; ini tidak lagi selaras dengan Definition of Done P0.2 bahwa Client hanya menampilkan product yang benar-benar purchasable.

Untuk variant checkout, flow utama sudah kuat:

- Cart menyimpan line berbeda untuk variant berbeda.
- Checkout preview/create menghitung harga dari variant backend.
- OrderItem/SuborderItem menyimpan `variantKey`, `variantLabel`, `variantSelections`, qty, dan harga.
- Stok variant berkurang setelah checkout.

Smoke diperketat untuk memastikan public product detail mengekspos price, sale price, attribute selections, dan stock variant yang sama dengan cart/checkout/order.

## File yang Diubah

- `server/src/routes/store.ts`
  - Public product detail dengan `storeSlug` sekarang memakai `buildPublicOperationalStoreInclude(...)`, sama seperti listing public dan checkout gate.
  - Menghapus include payment profile manual yang hanya optional dan tidak memblokir store not-ready.

- `server/src/scripts/smokeProductVisibility.ts`
  - Regression smoke not-ready store diperbarui: storefront detail dengan `storeSlug` harus `404`, bukan `200 non-purchasable`.

- `server/src/scripts/smokeCheckoutVariants.ts`
  - Menambah assert public detail sebelum cart: variant price, sale price, attribute selections, stock, dan `purchaseState.isPurchasable`.
  - Menambah assert public detail setelah checkout: stock variant public detail harus mengikuti stok backend yang sudah dikurangi order.

## Dampak ke Admin/Seller/Client

- Admin Workspace:
  - Tidak ada perubahan UI/API admin.
  - Metadata visibility admin tetap source untuk melihat product blocked karena `STORE_NOT_READY`.

- Seller Workspace:
  - Tidak ada perubahan UI/API seller.
  - Seller tetap dapat melihat product miliknya dan status visibility blocked melalui endpoint seller.

- Client/Storefront:
  - Product detail microsite tidak lagi menampilkan product dari store yang belum operational/payment-ready.
  - Public list/detail/cart/checkout sekarang memakai gate readiness yang konsisten.
  - Variant yang tampil di public detail diuji agar selaras dengan cart, checkout, order snapshot, dan decrement stok.

## Validasi yang Dijalankan

- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:product-visibility`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:checkout-coupons`
- `pnpm.cmd qa:e2e:truth`

## Hasil Validasi

- PASS: `pnpm.cmd -F server build`
- PASS: `pnpm.cmd -F client build`
  - Catatan: Vite masih memberi warning chunk `vendor-misc` > 500 kB; ini warning bundling existing, bukan blocker P0.2.
- PASS: `pnpm.cmd -F server smoke:product-visibility`
- PASS: `pnpm.cmd -F server smoke:checkout-variants`
- PASS: `pnpm.cmd -F server smoke:checkout-coupons`
- BLOCKED ENV: `pnpm.cmd qa:e2e:truth`
  - Gagal karena Playwright Chromium binary belum terpasang:
    `Executable doesn't exist at ...\ms-playwright\chromium_headless_shell-1208\chrome-headless-shell-win64\chrome-headless-shell.exe`
  - Rekomendasi environment: jalankan `pnpm exec playwright install`.

## Risiko Tersisa

- Product detail not-ready sekarang `404`; bila ada desain product microsite yang sengaja ingin menampilkan detail read-only untuk store belum ready, perilaku itu perlu keputusan product eksplisit. Untuk P0.2 production checkout truth, gate ini lebih aman.
- Build client masih punya warning ukuran chunk existing.
- E2E browser belum bisa berjalan sampai Playwright browser terpasang di environment lokal.

## Next Task Disarankan

1. Jalankan `pnpm exec playwright install`, lalu ulang `pnpm.cmd qa:e2e:truth`.
2. Tambahkan coverage storefront UI untuk memastikan halaman microsite menangani `404` product not-ready dengan state kosong/error yang rapi.
3. Audit product card/list agar semua CTA variant tetap memakai `purchaseState` dari backend dan tidak fallback ke stok lokal bila backend menyatakan tidak purchasable.
