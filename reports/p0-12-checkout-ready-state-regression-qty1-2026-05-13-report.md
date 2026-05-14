# P0.12 Checkout Ready-State Regression for Qty 1

Tanggal eksekusi: 2026-05-14

## Ringkasan masalah

Checkout masih menampilkan state sync/stale untuk cart valid Organic Banana variant Blue qty 1, meskipun backend preview dan estimated total sudah benar Rp25.000. Dampaknya Coupon Apply, Place Order, dan Order Summary by Store masih membaca guard lama yang menganggap preview belum siap.

Root cause yang diperbaiki:
- Ready-state checkout tersebar di beberapa boolean lama, sehingga warning/gating bisa tetap aktif walau preview sudah match.
- Matching preview terlalu sensitif terhadap identity yang tidak stabil seperti cart item/line id setelah hard refresh.
- Summary preview dan visible cart belum dinormalisasi dari satu helper canonical untuk qty 1 dan qty 2.

## File yang diubah

- `client/src/pages/store/Checkout.jsx`
- `tools/qa/e2e-truth-smoke.ts`
- `reports/p0-12-checkout-ready-state-regression-qty1-2026-05-13-report.md`

Catatan: `pnpm-workspace.yaml` sudah dirty dari pekerjaan lama/unrelated dan tidak disentuh.

## Perubahan

- Menambahkan helper canonical `getCheckoutPreviewStatus(...)` untuk menentukan:
  - `isLoading`
  - `isReady`
  - `isMismatch`
  - `isUsingFallback`
  - `reason`
  - `visibleSubtotal`
  - `previewSubtotal`
- Menormalisasi preview summary dan visible cart summary sebelum dibandingkan.
- Mengubah line matching agar `cartItemId`/`lineId` tidak menjadi satu-satunya identity ketika product, variant, qty, unit price, dan line total sudah match.
- Mengarahkan warning sync, coupon disabled state, submit disabled state, fallback state, dan Order Summary by Store ke status canonical yang sama.
- Menambahkan DOM selector stabil untuk regression:
  - `checkout-preview-groups-section`
  - `checkout-coupon-apply-button`
- Memperluas `qa:e2e:truth` dengan dua skenario checkout:
  - Organic Banana Blue qty 1, total Rp25.000
  - Organic Banana Blue qty 2, total Rp50.000

## Dampak Admin/Seller/Client

- Admin: tidak ada perubahan.
- Seller: tidak ada perubahan.
- Client/Storefront:
  - Checkout qty 1 dan qty 2 tidak lagi false stale saat preview backend sudah match.
  - Coupon Apply tidak disabled oleh sync blocker pada cart valid.
  - Submit/Place Order tidak disabled oleh sync blocker pada cart valid.
  - Order Summary by Store tetap menampilkan store card dan item dari preview/display grouping canonical.

## Validasi yang dijalankan

- `pnpm -F client build`
- `pnpm -F server build`
- `pnpm -F server smoke:checkout-variants`
- `pnpm -F server smoke:checkout-coupons`
- `pnpm qa:e2e:truth`
- `pnpm qa:public-release`

## Hasil validasi

Semua validasi PASS.

`qa:e2e:truth` kini mengassert qty 1 dan qty 2:
- Estimated Total benar.
- Tidak ada teks sync warning:
  - "Backend preview is still catching up"
  - "Latest checkout snapshot is refreshing"
  - "Checkout preview must finish syncing"
  - "Checkout preview is refreshing"
  - "Wait for the checkout preview"
  - "Order placement is paused"
- Order Summary by Store menampilkan Organic Banana, Variant Blue, qty, unit price, dan total.
- Coupon Apply tidak disabled oleh sync blocker.

## Risiko tersisa

- P1: client build masih memiliki chunk-size warning.
- P2: Node `[DEP0190]` tooling warning masih muncul pada beberapa command.
- Production env: `COOKIE_SECURE=true` wajib untuk HTTPS production.
- Production env: `UPLOAD_DIR` wajib tersedia dan writable di target deployment.

## Next task disarankan

- Lakukan manual browser proof ulang untuk qty 1 dan qty 2 pada sesi fresh/hard refresh.
- Setelah manual proof PASS, lanjutkan final RC snapshot baru bila diminta.
