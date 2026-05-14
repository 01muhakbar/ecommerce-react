# P0.11 Checkout Order Summary by Store Render Fix

Tanggal eksekusi lokal: 2026-05-14
Nama report mengikuti task release: 2026-05-13

## Ringkasan Masalah

Checkout total dan backend preview sudah benar setelah P0.9C-FIX, tetapi section `Order Summary by Store` masih bisa terlihat kosong untuk cart valid. User hanya melihat copy single-store, sementara item Organic Banana variant Blue qty 2 sudah tampil di checkout summary kanan.

Root cause UI:

- Renderer section hanya memakai `checkoutPreviewGroups` langsung.
- Saat group item preview kosong/tidak renderable tetapi visible cart dan preview summary sudah ready, section tidak punya display fallback.
- Assertion E2E lama masih bisa lolos karena mencari product text di seluruh body, sehingga sidebar kanan menutupi fakta bahwa section store summary kosong.

## Patch

- Menambahkan normalisasi source group preview agar UI membaca `groups` sebagai field utama dan tetap toleran terhadap alias group response.
- Menambahkan `checkoutPreviewDisplayGroups` khusus render `Order Summary by Store`.
- Jika backend preview group sudah berisi item, section tetap memakai backend preview group.
- Jika preview tidak loading/error/mismatch tetapi group item kosong, section membuat display grouping aman dari visible cart untuk UI saja.
- Submit/order/coupon tetap memakai backend preview canonical dan guard existing, bukan fallback display.
- Menambahkan `data-testid="checkout-preview-groups-section"` pada section `Order Summary by Store`.
- Regression E2E sekarang assert isi section tersebut secara spesifik, bukan body global.

## File yang Diubah

- `client/src/pages/store/Checkout.jsx`
- `tools/qa/e2e-truth-smoke.ts`
- `reports/p0-11-checkout-order-summary-by-store.png`
- `reports/p0-11-checkout-order-summary-by-store-render-fix-2026-05-13-report.md`

## Dampak ke Checkout

- Cart valid single-store tetap menampilkan store card.
- Store card menampilkan store name/status jika backend preview menyediakannya.
- Item Organic Banana variant Blue qty 2 tampil di section store summary.
- Line total dan store subtotal tetap Rp50.000 untuk qty 2 x Rp25.000.
- Sync warning tetap hilang untuk preview match.
- Guard stale/mismatch tetap aktif karena fallback display hanya dipakai saat preview tidak loading/error/mismatch.

## Regression

`qa:e2e:truth` sekarang membuat fixture Organic Banana variant Blue qty 2 dan assert langsung pada `checkout-preview-groups-section`:

- `Organic Banana`
- `Variant: Blue`
- `Qty 2 x Rp 25.000`
- `Rp 50.000`
- tidak ada sync warning
- submit CTA tidak disabled karena sync blocker

## Browser Proof

Artifact:

- `reports/p0-11-checkout-order-summary-by-store.png`

Proof scenario:

- Product: Organic Banana
- Variant: Blue
- Quantity: 2
- Unit price: Rp25.000
- Expected total: Rp50.000
- Order Summary by Store: visible with item/variant/qty/line total/store total
- Sync warning: not visible

## Validasi

| Command | Hasil | Catatan |
| --- | --- | --- |
| `pnpm -F client build` | PASS | Vite build lulus; chunk-size warning tetap P1 performance. |
| `pnpm -F server build` | PASS | TypeScript server build lulus. |
| `pnpm -F server smoke:checkout-variants` | PASS | Initial parallel run sempat kena transient `ECONNRESET`; rerun berurutan PASS. |
| `pnpm -F server smoke:checkout-coupons` | PASS | Initial parallel run sempat kena transient MySQL deadlock saat add-to-cart; rerun berurutan PASS. |
| `pnpm qa:e2e:truth` | PASS | PASS setelah assertion section-specific; rerun kedua juga PASS dengan screenshot proof. |
| `pnpm qa:public-release` | PASS | Public release smoke gate lulus dengan env lokal proof. |

## Risiko Tersisa

- P1 performance: chunk-size warning masih ada dari client build.
- P2 tooling: Node `[DEP0190]` warning masih muncul dari path tooling.
- Config production: `COOKIE_SECURE=true` tetap wajib untuk HTTPS production.
- Config production: `UPLOAD_DIR` wajib diset dan writable pada target deployment.
- Worktree hygiene: `pnpm-workspace.yaml` masih dirty lama/unrelated dan tidak disentuh.

## Next Task Disarankan

- P1: pecah chunk client besar setelah release gate, terutama vendor/misc bundle.
- P1: pertimbangkan retry kecil di smoke checkout add-to-cart untuk mengurangi false negative deadlock fixture di MySQL lokal.
- P2: audit dependency/tooling yang memicu Node `[DEP0190]`.

## Status

P0.11 selesai. Section `Order Summary by Store` tidak kosong lagi untuk cart valid, dan semua gate wajib PASS.
