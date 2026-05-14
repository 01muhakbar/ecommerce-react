# P0 MVF Sync Audit & Fix - Products, Attributes, Coupons

Tanggal: 2026-05-13

## Ringkasan masalah

Audit memakai ACUAN terhadap API client, route backend, dan report P0 sebelumnya untuk Products, Attributes, Coupons, serta dampaknya ke checkout.

Temuan utama:
- Product visibility, variant runtime sanitizer, cart variant snapshot, dan checkout variant validation sudah punya smoke coverage aktif dan lulus.
- Attribute runtime validation sudah aktif pada public product detail, cart, dan checkout; seller attribute smoke lulus.
- Coupon scope public sudah memblokir coupon store nonaktif dan smoke scope lulus.
- Gap kecil tersisa ditemukan di Admin coupon DTO: `scopeType`, `storeId`, dan `store` hanya tersedia di `governance`, sementara Seller coupon dan Storefront coupon sudah menyediakan attribution tersebut sebagai field top-level. Ini membuat consumer Admin lama masih harus membaca fallback/governance, dan tidak konsisten dengan kontrak Seller/Client.

## File yang diubah

- `server/src/routes/admin.coupons.ts`
  - `serializeAdminCoupon` sekarang memakai satu hasil `serializeAdminCouponGovernance`.
  - Menambahkan field top-level `scopeType`, `storeId`, dan `store` ke response Admin coupon list/create/update/export.
  - `governance` tetap dikirim, jadi tidak ada breaking change untuk UI Admin yang sudah membaca governance.

## Dampak ke Admin/Seller/Client

Admin:
- Coupon Admin sekarang menerima attribution coupon yang sama-sama mudah dibaca di top-level dan governance.
- Store-scoped coupon lebih konsisten untuk table/export/edit drawer tanpa fallback tambahan.

Seller:
- Tidak ada perubahan route Seller. Seller coupon tetap store-scoped dari route `seller/stores/:storeId/coupons`.

Client/Storefront:
- Tidak ada perubahan route Storefront. Public coupon list/quote/validate tetap source of truth untuk checkout.

Checkout/order:
- Tidak ada perubahan kalkulasi checkout, variant stock, atau coupon quote. Patch hanya menyelaraskan DTO Admin.

## Validasi yang dijalankan

- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:product-visibility`
- `pnpm.cmd -F server smoke:coupon-scope`
- `pnpm.cmd -F server smoke:checkout-variants`
- `cmd /c "cd server && pnpm.cmd exec tsx src/scripts/smokeSellerAttributes.ts"`
- `pnpm.cmd qa:e2e:truth`

## Hasil validasi

PASS:
- Server build lulus.
- Client build lulus, dengan warning Vite chunk size >500 kB yang non-blocking.
- Product visibility smoke lulus.
- Coupon scope smoke lulus.
- Checkout variants smoke lulus.
- Seller attributes smoke lulus via `cmd /c`.

Catatan:
- Percobaan awal `pnpm.cmd -F server exec tsx src/scripts/smokeSellerAttributes.ts` menjalankan semua assertion dan mencetak PASS, tetapi proses PowerShell/pnpm wrapper keluar dengan native Node/libuv assertion setelah selesai. Ulangan via `cmd /c` lulus exit code 0.
- `qa:e2e:truth` gagal sebelum skenario berjalan karena browser Playwright belum terpasang:
  `Executable doesn't exist ... chromium_headless_shell...`

## Risiko tersisa

- Tidak ada schema, auth, permission, routing utama, atau checkout calculation yang diubah.
- Coupon advanced governance masih backlog: usage limit, per-user limit, max discount, product/category restriction, dan redemption ledger belum ada karena butuh perubahan schema/aturan bisnis.
- Playwright browser perlu dipasang sebelum `qa:e2e:truth` bisa menjadi gate validasi penuh di mesin ini.
- `pnpm-workspace.yaml` sudah dirty sebelum task ini dan tidak disentuh.

## Next task disarankan

1. P1 Coupon Usage Ledger & Limits setelah approval schema.
2. P1 Shared coupon serializer consolidation lintas Admin/Seller/Storefront bila owner menyetujui refactor kecil terarah.
3. Install Playwright browser dependency lalu ulang `qa:e2e:truth` untuk gate browser-level.
