# TASK-2 Patch Dummy Fallback Berisiko Tinggi pada Storefront MVF

Date: 2026-03-06 (Asia/Singapore)  
Workspace: `C:\Users\user\Documents\ecommerce-react`

## Task ID

`TASK-2`

## Objective

Mengurangi fallback runtime Storefront yang paling berisiko membuat Home dan Checkout tampil tidak sesuai source of truth backend/public API, dengan patch kecil tanpa refactor besar dan tanpa mengubah contract API.

## Selected Risky Fallbacks

1. `client/src/pages/store/KachaBazarDemoHomePage.jsx`
   - Home memakai `dummyCoupons` saat coupon publik kosong/gagal.
   - Risiko: homepage terlihat punya promo aktif walau backend/public API tidak memberi data itu.

2. `client/src/components/Layout/StoreLayout.jsx`
   - Public store settings memakai default permissive (`true`) untuk social login, analytics, chat, dan sebagian payment flags saat payload belum ada.
   - Risiko: Storefront bisa terlihat mengaktifkan fitur yang belum dinyalakan admin/public settings.

3. `client/src/pages/store/Checkout.jsx`
   - Checkout payment flags juga fallback ke permissive defaults.
   - Risiko: checkout bisa menampilkan opsi payment yang tidak datang dari store settings publik.

## Files Changed

- `client/src/pages/store/KachaBazarDemoHomePage.jsx`
- `client/src/components/kachabazar-demo/CouponPanel.jsx`
- `client/src/components/Layout/StoreLayout.jsx`
- `client/src/pages/store/Checkout.jsx`
- `CODEx_REPORTS/TASK-2.md`

## What Changed

### `client/src/pages/store/KachaBazarDemoHomePage.jsx`

- Menghapus `dummyCoupons` sebagai fallback runtime.
- Menambahkan `isCouponsLoading` agar panel coupon punya state loading yang jelas.
- Saat fetch coupon gagal, home sekarang menampilkan error/empty state yang jujur, bukan promo dummy.

### `client/src/components/kachabazar-demo/CouponPanel.jsx`

- Menambahkan dukungan `isLoading`.
- Saat loading: panel menampilkan `"Loading active coupons..."`.
- Saat kosong/error: panel menampilkan empty/error message langsung, tanpa inventing coupon cards.

### `client/src/components/Layout/StoreLayout.jsx`

- Mengubah default public feature flags dari permissive ke conservative:
  - payment flags default `false`
  - social login flags default `false`
  - analytics/chat default `false`
- Efeknya: Storefront tidak lagi mengaktifkan fitur publik hanya karena payload settings belum tersedia.

### `client/src/pages/store/Checkout.jsx`

- Menyelaraskan default payment flags dengan pendekatan conservative (`false`).
- Mengubah copy saat payment options kosong agar lebih jujur terhadap public settings:
  - dari fallback COD-style wording
  - menjadi pesan bahwa payment options publik belum terkonfigurasi.

## Before vs After

### Home Coupon Panel

- Sebelum:
  - Jika coupon publik kosong/gagal, home tetap menampilkan `dummyCoupons`.
  - User bisa mengira promo benar-benar berasal dari backend.
- Sesudah:
  - Home hanya menampilkan coupon dari public API.
  - Jika loading/error/kosong, panel menyatakan kondisi sebenarnya.

### Public Store Settings

- Sebelum:
  - Saat payload settings belum ada, Storefront default menganggap beberapa fitur aktif.
  - Risiko terutama ke social login dan payment visibility.
- Sesudah:
  - Saat payload settings belum ada, fitur publik optional dianggap nonaktif sampai backend/public settings benar-benar menyatakan aktif.

### Checkout Payment Options

- Sebelum:
  - Checkout bisa tetap menampilkan opsi payment dari default lokal yang permissive.
- Sesudah:
  - Checkout lebih disiplin mengikuti `storeSettings` publik.
  - Jika tidak ada opsi payment publik, UI menyatakan hal itu dengan jelas.

## Verification Run

1. `pnpm --filter client exec vite build`
   - PASS

2. `pnpm qa:mvf` run #1
   - FAIL
   - Penyebab: port/process state transient (`3001` sempat terpakai saat script mencoba start stack)

3. `powershell -ExecutionPolicy Bypass -File .\tmp_dev01_verify.ps1`
   - PASS
   - Digunakan untuk cleanup/verifikasi port + boot stack segar

4. `pnpm qa:mvf` run #2
   - PASS
   - Artifact:
     - `.codex-artifacts/qa-mvf/20260306-214038/result.json`
     - `.codex-artifacts/qa-mvf/20260306-214038/summary.txt`

5. Runtime route check tambahan
   - `GET /` -> `200`
   - `GET /checkout` -> `200`

## MVF Impact

### Terdampak langsung

- Home -> PASS
- Checkout page -> PASS

### Diverifikasi tetap aman

- Search -> PASS
- Product detail -> PASS
- Cart interaction/API -> PASS
- Checkout submit -> PASS
- Success page -> PASS
- Order tracking -> PASS
- Admin login/orders/status persist -> PASS

## Risks / Follow-up

1. Jika public store settings memang belum terisi di environment tertentu, beberapa fitur Storefront sekarang akan lebih cepat terlihat nonaktif. Ini perubahan yang disengaja agar UI jujur terhadap backend.

2. `Checkout.jsx` masih punya behavior existing bahwa order submission berjalan sebagai COD-oriented flow. Task ini tidak mengubah contract itu.

3. Dummy fallback paling berbahaya yang masih tersisa ada di sisi admin service:
   - `client/src/api/orders.service.js`
   - `client/src/api/products.service.js`

4. `StoreContactUsPage.jsx` masih memiliki submit simulasi lokal. Itu belum disentuh karena bukan MVF Store utama dan tidak perlu dicampur ke patch ini.

## Recommended Next Task

`[TASK-3] Remove Risky Admin Dummy Fallbacks (Orders + Products Service)`

Fokus aman:

- kurangi dummy fallback pada admin service
- buat error state lebih jujur saat API admin gagal
- jangan ubah contract API
- jangan refactor besar

## Final Status

`PASS`
