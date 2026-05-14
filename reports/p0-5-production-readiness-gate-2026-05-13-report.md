# P0.5 Production Readiness Gate Audit

Tanggal: 2026-05-13

## Ringkasan

Audit P0.5 mengecek readiness gate existing, truth flow P0.1-P0.4, dan public/demo exposure yang masih terlihat di production path.

Hasil:

- Tidak ada P0 blocker tersisa yang jelas pada Product/Attribute/Coupon checkout truth flow setelah patch P0.1-P0.4.
- Build, smoke backend, dan `qa:e2e:truth` PASS.
- Satu leak kecil ditemukan dan dipatch: route eksplisit `/demo/kachabazar` tidak lagi membuka halaman demo pada production build.

## Readiness Gate Existing yang Diaudit

- `tools/qa/public-release-smoke.ts`
  - Memvalidasi env produksi: `JWT_SECRET`, `AUTH_COOKIE_NAME`, DB env, warning cookie/CORS/base URL/upload.
  - Boot `pnpm -F server start:prod`, poll `/api/health`, lalu menjalankan smoke utama.
- `reports/prod-harden-01-public-production-readiness-pass-20260410-report.md`
  - Mencatat startup/env validation dan production hardening sebelumnya.
- `reports/public-release-smoke-gate-03-20260410-report.md`
  - Mencatat proof `start:prod`, env validation, idempotency edge, dan release smoke gate.
- Smoke P0 terbaru:
  - `smoke:product-visibility`
  - `smoke:checkout-variants`
  - `smoke:checkout-coupons`
  - `qa:e2e:truth`

## Masalah yang Ditemukan

### P0: Explicit Demo Route Exposed in Production

`client/src/App.jsx` masih mendefinisikan route public:

- `/demo/kachabazar`

Homepage `/` masih memakai halaman storefront existing dan tidak diubah karena itu menyentuh pengalaman utama. Patch hanya menutup route demo eksplisit agar production build tidak mempublikasikan URL demo langsung.

## File yang Diubah

- `client/src/App.jsx`
  - Menambahkan `isProductionBuild = import.meta.env.PROD`.
  - Route `/demo/kachabazar` sekarang:
    - production build: redirect ke `/`
    - non-production build: tetap membuka `KachaBazarDemoHomePage`

## Dampak ke Admin/Seller/Client

- Admin Workspace:
  - Tidak ada perubahan.

- Seller Workspace:
  - Tidak ada perubahan.

- Client/Storefront:
  - Production build tidak lagi mengekspos route demo eksplisit `/demo/kachabazar`.
  - Homepage dan storefront flow utama tetap berjalan dengan pola existing.

## Product/Attribute/Coupon Truth Gate

- Product visibility:
  - Public listing/detail sudah memakai status product, publish state, seller review state, store active, dan payment readiness gate.
  - Not-ready store product tidak muncul di discovery/detail public.

- Attribute/Variant:
  - Seller bisa membaca values dari global/admin attributes yang active/published sebagai read-only.
  - Public/cart/checkout memakai runtime sanitizer untuk inactive/archived attribute values.
  - Variant selections tersimpan sampai order snapshot.

- Coupon:
  - Public quote, checkout calculation, dan order attribution sudah diuji untuk platform coupon, seller/store coupon, wrong-store, minSpend, expired, dan multi-store group coupon.

## Auth/Session/Env Readiness

- Auth/session basics tercakup oleh existing release/staging gates dan `qa:e2e:truth`.
- Production env validation sudah ada di `tools/qa/public-release-smoke.ts` dan server startup hardening sebelumnya.
- P0.5 tidak menjalankan `pnpm qa:public-release` karena validasi wajib task ini tidak memintanya dan command tersebut membutuhkan env production-like target. Gate tersebut tetap direkomendasikan sebagai pre-deploy per environment.

## Validasi yang Dijalankan

- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:product-visibility`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:checkout-coupons`
- `pnpm.cmd qa:e2e:truth`

## Hasil Validasi

- PASS: `pnpm.cmd -F server build`
- PASS: `pnpm.cmd -F client build`
  - Catatan: Vite masih memberi warning chunk `vendor-misc` > 500 kB; ini audit item P1/P2, bukan blocker P0.
- PASS: `pnpm.cmd -F server smoke:product-visibility`
- PASS: `pnpm.cmd -F server smoke:checkout-variants`
- PASS: `pnpm.cmd -F server smoke:checkout-coupons`
- PASS: `pnpm.cmd qa:e2e:truth`
  - Suite selesai sampai `[e2e-truth] OK`.

## Risiko Tersisa

- P1: Homepage masih memakai komponen bernama `KachaBazarDemoHomePage`; ini tidak otomatis berarti data demo bocor, tetapi nama/struktur komponen masih warisan demo. Perlu product/UI decision sebelum mengganti homepage.
- P1: `pnpm qa:public-release` perlu dijalankan pada target staging/production-like env dengan env final, terutama `JWT_SECRET`, `AUTH_COOKIE_NAME`, DB env, `COOKIE_SECURE`, CORS/base URL, dan upload path.
- P1: Client build masih punya warning chunk besar; jangan refactor di P0.5, jadwalkan performance pass.
- P2: `qa:e2e:truth` masih menampilkan warning Node `[DEP0190]` dari child process dengan `shell: true`; tidak memblokir suite.
- P2: Demo seed scripts tetap tersedia sebagai manual scripts; pastikan deployment runbook tidak menjalankan `seed:demo`/`seed:kachabazar` pada production database.

## Final Assessment

Status P0.5: PASS.

Tidak ada P0 production blocker jelas yang tersisa dari audit ini setelah route demo eksplisit ditutup untuk production build. Product, Attribute, Coupon, Checkout, dan Order truth flow sudah melewati build, smoke, dan E2E truth suite.

## Next Task Disarankan

1. Jalankan `pnpm qa:public-release` dengan env production-like final sebelum deploy publik.
2. Buat P1 performance pass untuk chunk-size warning tanpa mengubah domain truth.
3. Buat P1 cleanup plan untuk mengganti naming/komposisi homepage warisan demo jika product owner ingin menghapus seluruh jejak demo dari UI source.
