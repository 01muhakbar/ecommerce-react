# P0.9C-FIX Checkout Sync Warning Still Visible Report

## Ringkasan masalah
- Manual checkout masih menampilkan sync warning walau estimated total dan visible cart sudah benar.
- Root cause: frontend compare masih terlalu ketat terhadap `variantKey`. Jika visible cart dan backend preview merepresentasikan variant yang sama melalui `cartItemId`, `lineId`, atau `variantSelections`, tetapi `variantKey` berbeda format/casing, `hasCheckoutPreviewCartMismatch` tetap `true`.
- Dampak: UI jatuh ke visible-cart fallback dan tetap menampilkan:
  - `Latest checkout snapshot is refreshing...`
  - `Backend preview is still catching up...`
  - blocker submit/coupon berbasis sync.

## File yang diubah
- `client/src/pages/store/Checkout.jsx`
  - Matching preview line sekarang memakai `lineId` juga.
  - Jika `cartItemId` atau `lineId` sama, variant line dianggap identitas checkout yang sama selama qty/harga/line total cocok.
  - Jika `variantKey` berbeda tetapi `variantSelections` sama, preview tetap dianggap match.
  - Guard tetap konservatif untuk multi-line product sama jika tidak ada identitas variant yang cukup.
- `tools/qa/e2e-truth-smoke.ts`
  - Regression warning sync diperluas memakai regex:
    - `/Backend preview is still catching up/i`
    - `/Latest checkout snapshot is refreshing/i`
    - `/Checkout preview must finish syncing/i`
    - `/Order placement is paused/i`
  - Tambah skenario browser checkout variant qty 2 dengan total Rp50.000.
  - Fixture variant e2e sekarang membuat `attributes` dan `attribute_values` aktif sungguhan agar sesuai backend truth.
  - Tambah opsi screenshot manual proof via `E2E_TRUTH_CHECKOUT_SCREENSHOT_PATH`.

## Dampak ke Admin/Seller/Client
- Admin: tidak ada perubahan app behavior.
- Seller: tidak ada perubahan app behavior.
- Client/Storefront:
  - Warning sync hilang untuk cart valid ketika backend preview match.
  - Coupon Apply tidak disabled oleh false sync blocker.
  - Place an Order tidak disabled oleh false sync blocker.
  - Order Summary by Store tampil normal dengan backend preview canonical.

## Validasi yang dijalankan
- `pnpm -F client build`
- `pnpm -F server build`
- `pnpm -F server smoke:checkout-variants`
- `pnpm -F server smoke:checkout-coupons`
- `pnpm qa:e2e:truth`
- `pnpm qa:public-release`
- `E2E_TRUTH_CHECKOUT_SCREENSHOT_PATH=reports/p0-9c-fix-checkout-ready-variant-qty2.png pnpm qa:e2e:truth`

## Hasil validasi
- PASS: `pnpm -F client build`
  - Catatan: chunk-size warning tetap P1/non-blocking.
- PASS: `pnpm -F server build`
- PASS: `pnpm -F server smoke:checkout-variants`
- PASS: `pnpm -F server smoke:checkout-coupons`
- PASS: `pnpm qa:e2e:truth`
  - Regression variant qty 2 memastikan sync warning tidak muncul.
- PASS: `pnpm qa:public-release`
  - Catatan lokal: `COOKIE_SECURE=false` dan `UPLOAD_DIR` default hanya untuk local proof; production tetap wajib `COOKIE_SECURE=true` dan `UPLOAD_DIR` writable.
  - Catatan tooling: Node `[DEP0190]` tetap P2/tooling.
- PASS: screenshot browser proof dibuat di `reports/p0-9c-fix-checkout-ready-variant-qty2.png`.

## Manual/browser validation
- Screenshot Playwright browser tersimpan:
  - `reports/p0-9c-fix-checkout-ready-variant-qty2.png`
- Bukti pada screenshot:
  - Variant Blue qty 2.
  - Estimated Total Rp50.000.
  - Payment summary total Rp50.000.
  - Order Summary by Store tampil.
  - Coupon Apply enabled.
  - Place an Order enabled.
  - Tidak ada warning sync.

## Risiko tersisa
- P1: chunk-size warning Vite belum ditangani.
- P2: Node `[DEP0190]` dari tooling QA masih muncul.
- P2: Jika backend preview kehilangan semua identitas variant untuk multi-line product yang sama, guard tetap akan menahan checkout sebagai mismatch.

## Next task disarankan
- Ulang hard refresh manual di browser user pada cart Organic Banana Blue qty 2. Ekspektasi harus sama dengan screenshot proof: Rp50.000 dan tanpa sync warning.
