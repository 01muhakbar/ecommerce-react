# P0.1 Coupon Checkout Truth Audit

Tanggal: 2026-05-13

## Ringkasan masalah

Audit memakai ACUAN pada flow coupon dari Client apply coupon, public Storefront coupon endpoint, backend checkout calculation, order creation, dan DTO Admin/Seller.

Temuan production-impact:
- Public coupon scope resolver hanya mengecek `Store.status = ACTIVE`.
- Product/storefront checkout sudah memakai public operational readiness, yaitu store harus `ACTIVE` dan punya active payment profile yang verified.
- Akibatnya coupon seller dari store aktif tapi belum operational bisa tampil di Client dan quote valid, walaupun checkout produk store tersebut akan diblokir readiness. Ini mismatch antara coupon yang tampil/dipakai dan order yang bisa dibuat.

Patch kecil:
- Public coupon resolver sekarang hanya menerima store operational dengan active verified payment profile, mengikuti gate product public.
- Smoke coupon scope diperluas untuk active-but-not-ready store.
- Smoke checkout coupon baru ditambahkan untuk membuktikan quote, checkout total, order discount, suborder attribution, dan payment amount konsisten.

## File yang diubah

- `server/src/routes/store.coupons.ts`
- `server/src/scripts/smokeCouponScope.ts`
- `server/src/scripts/smokeCheckoutCoupons.ts`
- `server/package.json`

Catatan dari task sebelumnya yang tetap relevan:
- `server/src/routes/admin.coupons.ts` sudah menyelaraskan Admin coupon DTO top-level `scopeType`, `storeId`, dan `store` dengan Seller/Client.

## Dampak ke Admin/Seller/Client

Admin:
- Tidak ada perubahan permission/schema.
- Admin/Seller coupon yang store-scoped tetap bisa dibuat dan dikelola.

Seller:
- Seller coupon tetap store-owned dan route seller tetap memaksa `scopeType=STORE`.
- Coupon seller baru public-usable hanya ketika store sudah operational secara buyer-facing.

Client/Storefront:
- `/api/store/coupons` tidak lagi menampilkan seller coupon dari store aktif tapi belum payment-ready.
- `/api/store/coupons/quote` dan `/validate` tidak lagi menganggap store aktif tapi not-ready sebagai scope valid untuk seller coupon.
- Platform coupon tetap valid untuk eligible storefront checkout.

Checkout/order:
- Checkout tetap quote ulang di backend sebelum order dibuat.
- Store coupon lintas store ditolak.
- Minimum spend dan expired coupon ditolak.
- `Order.discountAmount`, `Order.totalAmount`, `Suborder.appliedCoupon*`, dan `Payment.amount` divalidasi oleh smoke baru.

## Validasi yang dijalankan

- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:coupon-scope`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:checkout-coupons`
- `pnpm.cmd qa:e2e:truth`

## Hasil validasi

PASS:
- Server build lulus.
- Client build lulus, dengan warning Vite chunk size >500 kB yang non-blocking.
- `smoke:coupon-scope` lulus:
  - active operational store melihat platform + own store coupon,
  - inactive store coupon tidak public-listed,
  - active but not-ready store coupon tidak public-listed,
  - inactive/not-ready quote ditolak scope guard.
- `smoke:checkout-variants` lulus.
- `smoke:checkout-coupons` lulus:
  - public quote platform coupon menghitung 10% dari subtotal,
  - single-store platform coupon tersimpan di order/suborder/payment dengan total benar,
  - single-store seller coupon tersimpan di order/suborder/payment dengan total benar,
  - wrong-store seller coupon ditolak,
  - minimum order dan expired coupon ditolak,
  - multi-store group coupon menyimpan attribution per suborder dan total parent benar.

Environment note:
- Saat smoke checkout pertama dijalankan paralel, MySQL sempat deadlock/terputus. DB lokal dinyalakan ulang via XAMPP MySQL dan smoke diulang berurutan; hasil final PASS.
- `qa:e2e:truth` gagal sebelum skenario berjalan karena Playwright Chromium belum terpasang:
  `chromium_headless_shell-1208/chrome-headless-shell.exe` tidak ditemukan.
  Ini environment blocker, bukan app blocker.

## Risiko tersisa

- Usage limit/per-user limit/max discount/product restriction belum ada karena butuh schema dan aturan bisnis baru. Tidak dikerjakan sesuai instruksi jangan buat fitur baru.
- Public coupon resolver sekarang lebih ketat: seller coupon dari store yang belum operational tidak tampil/quote valid sampai payment profile aktif.
- Smoke checkout coupon adalah backend/API smoke, bukan browser Playwright flow.

## Next task disarankan

1. Install Playwright browsers lalu ulang `pnpm.cmd qa:e2e:truth`.
2. P1 Coupon Usage Ledger & Limits dengan Rencana Kolaborasi karena butuh schema.
3. P1 Coupon max-discount/product/category restriction hanya setelah rule bisnis disepakati.
