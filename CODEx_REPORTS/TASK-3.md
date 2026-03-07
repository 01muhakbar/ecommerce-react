# TASK-3 - Patch Service Fallback Berisiko pada Products & Orders

## Task ID

`TASK-3`

## Objective

Mengurangi fallback service yang bisa menyamarkan kegagalan API pada `products.service.js` dan `orders.service.js`, supaya Admin dan Storefront lebih disiplin mengikuti source of truth backend tanpa refactor besar.

## Selected Risky Fallbacks

1. `client/src/api/products.service.js`
   - Dummy fallback pada `listProducts()`
   - Dummy fallback pada `createProduct()`
   - Dummy fallback pada `updateProduct()`
   - Dummy fallback pada `deleteProduct()`
2. `client/src/api/orders.service.js`
   - Dummy fallback pada `listOrders()`
   - Dummy fallback pada `updateOrderStatus()`

## Why These Were Prioritized

- `products.service.js` dipakai oleh halaman Store utama melalui `useProducts`, termasuk Home, Search, Product Detail related products, dan KachaBazar demo home.
- `orders.service.js` dipakai aktif oleh dashboard admin untuk recent orders dan update status cepat.
- Fallback ini dapat membuat fetch gagal tampak seperti data valid, atau membuat mutasi admin tampak sukses walau backend gagal menyimpan perubahan.

## Files Changed

- `client/src/api/products.service.js`
- `client/src/api/orders.service.js`
- `CODEx_REPORTS/TASK-3.md`

## What Changed

### `client/src/api/products.service.js`

- Menghapus import dummy products.
- Menghapus fallback dummy pada `listProducts()`.
- Menghapus fallback dummy pada `createProduct()`, `updateProduct()`, dan `deleteProduct()`.
- Menghapus helper dummy-only yang tidak lagi dipakai.

### `client/src/api/orders.service.js`

- Menghapus import dummy orders.
- Menghapus fallback dummy pada `listOrders()`.
- Menghapus fallback dummy pada `updateOrderStatus()`.
- Menghapus helper dummy-only yang tidak lagi dipakai.

## Before vs After

### Before

- Saat API products/orders gagal dan env dummy aktif, service bisa mengembalikan data lokal dummy atau mengembalikan sukses palsu.
- Home/Search/Product related products bisa tetap terlihat berisi walau fetch katalog admin gagal.
- Dashboard admin bisa tetap menampilkan recent orders atau update status seolah sukses walau API bermasalah.

### After

- Saat API gagal, service melempar error ke hook/page caller.
- Hook dan halaman existing sekarang menampilkan error/empty state yang lebih jujur.
- Tidak ada lagi mutasi products/orders yang diam-diam sukses terhadap data dummy lokal.

## Verification Run

1. `pnpm --filter client exec vite build`
   - PASS
2. `pnpm qa:mvf`
   - Run 1: FAIL karena masalah startup/proses lokal transient
   - Run 2: PASS
3. QA artifact:
   - `.codex-artifacts/qa-mvf/20260306-215708/result.json`
   - `.codex-artifacts/qa-mvf/20260306-215708/summary.txt`

## MVF Impact

- Store Home: PASS
- Store Search: PASS
- Product Detail: PASS
- Cart / Checkout / Success / Tracking: PASS
- Admin Login: PASS
- Admin Orders List: PASS
- Admin Order Detail: PASS
- Admin Update Status Persist: PASS

## Risks / Follow-up

- Environment dev yang sebelumnya mengandalkan env dummy untuk tetap terlihat "jalan" sekarang akan memunculkan error state yang lebih jujur.
- `products.service.js` masih dipakai pada jalur Store lama/hook lama, jadi task lanjutan sebaiknya audit apakah seluruh jalur read products sudah memakai contract yang sama dengan public store API.
- `Dashboard.jsx` masih memakai `orders.service.js` lama, sedangkan halaman admin orders utama memakai `lib/adminApi.js`. Ada peluang konsolidasi ringan pada task terpisah, tetapi itu di luar scope task ini.

## Recommended Next Task

`[TASK-4] Audit Contract Read Path Products (Store hooks vs public store API)`

## Final Status

`PASS`
