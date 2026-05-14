# P0.9C Checkout Preview Ready-State Fix Report

## Ringkasan masalah
- Backend checkout preview sudah canonical setelah P0.9B, tetapi frontend checkout masih bisa menganggap preview stale karena guard membandingkan signature mentah.
- Perbedaan aman seperti `variantKey` casing/format, `null` vs kosong, atau field variant selection yang datang dalam format berbeda dapat membuat `hasCheckoutPreviewCartMismatch` true.
- Dampaknya checkout terkunci walau total backend benar: sync warning tampil, coupon apply disabled, Place an Order disabled, dan Order Summary by Store tidak menampilkan group normal.

## File yang diubah
- `client/src/pages/store/Checkout.jsx`
  - Menambahkan normalisasi compare untuk line checkout: `productId`, `cartItemId`, `variantKey`, `variantSelections`, quantity, unit price, dan line total.
  - Mengganti signature string mentah dengan matching line ter-normalisasi dan toleransi nominal kecil.
  - Guard tetap ada: preview tetap dianggap stale jika jumlah line, product, qty, harga, subtotal, atau line total tidak cocok.
- `tools/qa/e2e-truth-smoke.ts`
  - Menambahkan regression browser assertion bahwa checkout normal tidak menampilkan sync warning ketika preview backend cocok dengan cart visible.
  - Menegaskan `checkout-submit-cta` tidak disabled karena preview matching.

## Dampak ke Admin/Seller/Client
- Admin: tidak ada perubahan.
- Seller: tidak ada perubahan.
- Client/Storefront:
  - Checkout akan ready ketika backend preview canonical sudah match dengan cart visible.
  - Coupon apply dan Place an Order tidak lagi terkunci oleh false mismatch.
  - Order Summary by Store kembali memakai group backend normal pada jalur preview valid.

## Validasi yang dijalankan
- `pnpm -F client build`
- `pnpm -F server build`
- `pnpm -F server smoke:checkout-variants`
- `pnpm -F server smoke:checkout-coupons`
- `pnpm qa:e2e:truth`
- `pnpm qa:public-release`

## Hasil validasi
- PASS: `pnpm -F client build`
  - Catatan: chunk-size warning masih muncul dan tetap P1/non-blocking.
- PASS: `pnpm -F server build`
- PASS: `pnpm -F server smoke:checkout-variants`
  - Catatan: percobaan awal paralel dengan smoke coupon sempat `ECONNRESET`; rerun sequential PASS.
- PASS: `pnpm -F server smoke:checkout-coupons`
  - Catatan: percobaan awal paralel dengan smoke variant sempat `ECONNRESET`; rerun sequential PASS.
- PASS: `pnpm qa:e2e:truth`
  - Regression baru memverifikasi checkout normal tidak stuck di warning sync.
- PASS: `pnpm qa:public-release`
  - Catatan lokal: `COOKIE_SECURE=false` dan `UPLOAD_DIR` default hanya acceptable untuk local proof; production tetap wajib `COOKIE_SECURE=true` di HTTPS dan `UPLOAD_DIR` writable.
  - Catatan tooling: Node `[DEP0190]` tetap P2/tooling.

## Manual/browser validation
- Browser validation dilakukan via `qa:e2e:truth` Playwright suite.
- Skenario manual terpisah di browser lokal tidak dijalankan sebagai human step; automated browser gate sudah memuat checkout normal, sync warning absence, Order Summary by Store, dan submit CTA readiness.

## Risiko tersisa
- P1: chunk-size warning dari Vite masih ada, tidak terkait bug checkout ini.
- P2: Node `[DEP0190]` dari child process tooling masih muncul pada QA scripts.
- P2: Jika backend suatu hari mengirim beberapa variant line untuk product sama tanpa `variantKey` dan tanpa `variantSelections`, guard tetap sengaja konservatif dan akan menahan checkout.

## Next task disarankan
- Jalankan quick manual smoke pada browser aktif user untuk cart Organic Banana qty 1: checkout harus menampilkan Rp25.000, tanpa sync warning, Order Summary by Store tampil, coupon apply enabled, dan Place an Order enabled setelah field wajib diisi.
