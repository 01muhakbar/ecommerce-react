# P0.9 Checkout Workflow Cart State & Summary Consistency Fix

Tanggal eksekusi: 2026-05-14

## Ringkasan masalah

Audit menemukan sumber mismatch paling berisiko pada pemilihan cart backend yang tidak deterministik ketika satu user memiliki lebih dari satu cart. Beberapa flow cart memakai `Cart.findOne({ where: { userId } })` tanpa `order`, sehingga cart drawer/API cart dan checkout preview/order dapat membaca baris cart berbeda. Dampaknya cocok dengan gejala UI: cart aktif terlihat 1 product qty 2 total Rp50.000, tetapi checkout/payment/order preview dapat memakai cart stale berisi quantity besar seperti 32 item dan total lama.

Di frontend checkout, preview by-store juga bisa mulai sebelum bootstrap/refresh cart remote selesai. Ini membuka jendela pendek ketika summary checkout memakai snapshot backend lama sementara cart drawer sudah menampilkan state yang lebih baru.

## File yang diubah

- `server/src/controllers/cartController.ts`
  - Menambahkan `latestCartOrder` (`updatedAt DESC`, `id DESC`).
  - Memakai order deterministik tersebut di add/get/remove/update/set qty cart.

- `server/src/routes/checkout.ts`
  - `findCartForUser` sekarang memilih cart terbaru saat request tidak membawa `cartId` eksplisit.
  - Jika `cartId` eksplisit ada, kontrak lama tetap dihormati.

- `client/src/pages/store/Checkout.jsx`
  - Checkout page memanggil `refreshCart(false)` saat user/auth/hydration siap.
  - Checkout preview hanya enabled setelah cart bootstrap selesai, cart tidak loading, dan remote sync tidak berjalan.

- `server/src/scripts/smokeCheckoutVariants.ts`
  - Menambahkan regression skenario Organic Banana:
    - seed cart lama qty 32,
    - buat cart aktif baru,
    - add Banana qty 2 x Rp25.000,
    - assert cart API, checkout preview, checkout create, dan stored order item tetap 1 product / qty 2 / total Rp50.000.

## Dampak ke Admin/Seller/Client

- Admin: tidak ada perubahan UI/API admin.
- Seller: tidak ada perubahan UI/API seller.
- Client/Storefront:
  - Cart drawer, checkout summary, payment summary, dan order-by-store preview memakai cart backend aktif yang sama.
  - Checkout tidak menampilkan total dari preview stale saat cart remote belum selesai refresh.
  - Tidak ada fallback/demo/hardcoded total baru.

## Validasi yang dijalankan

- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:checkout-coupons`
- `pnpm.cmd qa:e2e:truth`
- `pnpm.cmd qa:public-release`

## Hasil validasi

- PASS: server build.
- PASS: client build.
- PASS: `smoke:checkout-variants`, termasuk regression stale cart 32 vs active Banana qty 2.
- PASS: `smoke:checkout-coupons`.
- PASS: `qa:e2e:truth`, termasuk client checkout browser assertions.
- PASS: `qa:public-release`.

Catatan non-blocking:
- Vite chunk-size warning masih muncul dan tetap P1 audit, bukan blocker P0.
- Node `[DEP0190]` masih muncul dari tooling QA dan tetap P2/tooling.
- `qa:public-release` lokal memperingatkan `COOKIE_SECURE=false` dan `UPLOAD_DIR` belum diset; ini acceptable untuk proof lokal, tetapi production tetap wajib `COOKIE_SECURE=true` via HTTPS dan `UPLOAD_DIR` tersedia/writable.

## Risiko tersisa

- P1: Perlu constraint/cleanup data untuk mencegah akumulasi duplicate cart historis, tetapi patch ini sudah membuat read/mutation/checkout deterministik tanpa perubahan schema.
- P1: Chunk-size warning frontend masih perlu optimasi terpisah.
- P2: Warning Node `[DEP0190]` dari command tooling QA.

## Next task disarankan

- Tambahkan migration/data maintenance terencana untuk mengarsipkan atau merge duplicate cart per user setelah ada approval schema/data plan.
- Tambahkan E2E visual spesifik cart drawer -> checkout summary jika ingin mengunci label `uniqueItemsCount` vs `totalQuantity` di level UI.
