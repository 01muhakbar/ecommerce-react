# P0-SYNC-GATE-02 Report

## Ringkasan
Follow-up stabilisasi noise P0 selesai.

Noise yang ditargetkan dari `P0-SYNC-GATE-01` sudah diaudit dan dipatch minimal:
- `/uploads/products/demo.svg` sekarang ada sebagai asset fixture valid di static upload path.
- `POST /api/cart/add` sekarang punya retry bounded khusus deadlock/lock wait timeout MySQL.

Tidak ada fitur baru, redesign, schema change, route publik change, atau lifecycle checkout/order/payment/shipping change.

## Scope
- Audit referensi `demo.svg` dan static upload serving.
- Audit transaksi add-to-cart backend.
- Patch minimal untuk asset fixture dan retry deadlock add-to-cart.
- Validasi build, smoke, E2E truth, dan diff check.

## File Diubah
- `server/public/uploads/products/demo.svg`
- `server/src/controllers/cartController.ts`
- `reports/p0-sync-gate-02-2026-05-16-report.md`

Catatan worktree: perubahan dari task sebelumnya masih ada di `client/vite.config.ts`, `tools/qa/e2e-truth-smoke.ts`, dan report `p0-sync-gate-01`.

## Missing Asset Audit
- Root cause: path fixture resmi `/uploads/products/demo.svg` dipakai oleh seed/dev fixture, smoke checkout/order, QA E2E, dan fallback admin products, tetapi file fisik tidak ada di `uploads`, `public/uploads`, atau `server/public/uploads`.
- Patch: menambahkan SVG kecil valid di `server/public/uploads/products/demo.svg`. Path ini diserve oleh Express melalui `server/public/uploads` sebagai `/uploads`.
- Validasi: `pnpm qa:e2e:truth` PASS dan output tidak lagi mencetak 404 `/uploads/products/demo.svg`.

## Add-to-Cart Deadlock Audit
- Root cause/dugaan: kontensi fixture/browser dan API client dapat memicu mutasi cart berdekatan untuk user/cart yang sama. Deadlock yang terlihat sebelumnya terjadi saat `Cart.create` di dalam transaction.
- Patch: `addToCart` dibungkus helper retry bounded untuk error MySQL `1213`/`ER_LOCK_DEADLOCK` dan `1205`/`ER_LOCK_WAIT_TIMEOUT`.
- Retry behavior: maksimal 2 retry setelah attempt pertama, delay pendek bertingkat 75ms/150ms. Retry hanya untuk deadlock/lock timeout.
- Risiko double increment: rendah. Retry dijalankan di luar `sequelize.transaction`; jika deadlock terjadi, transaction attempt gagal dan rollback sebelum attempt berikutnya. Quantity hanya bertambah pada transaction yang berhasil commit.
- Validasi: smoke variant tetap membuktikan variant line tidak merge salah dan quantity mutation tetap scoped; `qa:e2e:truth` PASS tanpa log deadlock add-to-cart.

## Dampak Admin/Seller/Client
### Admin
Tidak ada perubahan route/admin UI. Admin product fallback yang mengarah ke `/uploads/products/demo.svg` sekarang mendapat asset valid.

### Seller
Tidak ada perubahan seller catalog/order/payment/fulfillment. Produk fixture seller yang memakai `demo.svg` sekarang tidak menghasilkan 404.

### Client
Storefront product/cart/checkout tidak berubah secara UI. Product image fixture valid, dan add-to-cart lebih tahan terhadap deadlock transient.

### Backend
Static upload serving tidak berubah. Cart add mutation mendapat retry bounded khusus database deadlock/lock timeout tanpa mengubah kontrak sukses.

## Validasi
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm -F server smoke:checkout-variants`: PASS
- `pnpm -F server smoke:checkout-coupons`: PASS
- `pnpm -F server smoke:order-payment`: PASS
- `pnpm qa:e2e:truth`: PASS
- `git diff --check`: PASS

## Risiko Tersisa
- Client build masih menampilkan warning Vite chunk size besar; bukan error.
- `qa:e2e:truth` masih menampilkan deprecation warning Node untuk `spawn(..., shell: true)`; bukan bagian flow checkout/cart dan command tetap PASS.
- Jika deadlock add-to-cart tetap terjadi setelah retry habis, endpoint mengembalikan `503` dengan kode `CART_MUTATION_RETRY_EXHAUSTED` agar client tidak menerima fake success.

## Next Suggested Task
Audit kecil QA/dev logging: kurangi output debug route product dan warning spawn shell di `qa:e2e:truth` tanpa mengubah behavior checkout/order/payment.
