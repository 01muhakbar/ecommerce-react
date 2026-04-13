# PROD-LOCK-01 — Production Readiness Gate + Cross-App MVF Verification Lock

Tanggal: 2026-04-13

## Ringkasan masalah

Audit menunjukkan jalur aktif buyer, seller, admin, dan backend untuk store readiness, product visibility, checkout/payment truth, dan order/shipment truth sudah punya smoke yang cukup kuat dari pass sebelumnya. Namun gate rilis publik yang dipakai operator, `pnpm qa:public-release`, belum mengunci `auth readiness` sebagai bagian dari go/no-go.

Akibatnya:

- buyer auth/session bisa regress tanpa menggagalkan gate release utama,
- admin public auth bisa regress tanpa masuk smoke release utama,
- staging one-shot smoke juga belum memaksa auth readiness sebelum tanda release-ready diberikan.

Ini saya perlakukan sebagai blocker readiness nyata level gate, bukan blocker kontrak domain. Patch difokuskan ke penguncian verifikasi, bukan mengubah flow bisnis.

## Audit temuan

Surface aktif yang diaudit:

- `client/src/App.jsx`
- buyer: `client/src/pages/store/*`, `client/src/pages/account/*`
- seller: `client/src/pages/seller/*`
- admin: `client/src/pages/admin/*`
- backend runtime: `server/src/app.ts`, `server/src/server.ts`
- backend active routes: `server/src/routes/auth.ts`, `server/src/routes/store.ts`, `server/src/routes/seller.orders.ts`, `server/src/routes/admin.payments.audit.ts`
- smoke/gate: `tools/qa/public-release-smoke.ts`, `server/src/scripts/smokeAuthSessionInvalidation.ts`, `server/src/scripts/smokeAuthRateLimit.ts`, `server/src/scripts/smokeAdminPublicAuth.ts`

Temuan utama:

1. Route runtime aktif memang memakai surface modern, bukan archive/demo, untuk buyer auth/account, seller suborder ops, admin payment audit, dan public/store order tracking.
2. Flow truth payment/order/shipment lintas app tetap bersandar pada kontrak backend aktif dan split operational truth yang sudah dipasang sebelumnya.
3. Gap utama ada di release gate:
   - `qa:public-release` hanya menjalankan readiness/visibility/order-payment/stripe/frontend-visibility.
   - auth/session/admin-public-auth smoke belum menjadi bagian gate produksi.
4. `qa:staging:core` juga belum memasukkan auth smoke, jadi status staging-ready masih bisa lolos tanpa verifikasi auth yang eksplisit.

## Perubahan yang dilakukan

- Menambahkan auth smoke ke `tools/qa/public-release-smoke.ts`:
  - `smoke:auth-session-invalidation`
  - `smoke:auth-rate-limit`
  - `smoke:admin-public-auth`
- Menyelaraskan `qa:staging:core` di root `package.json` agar auth readiness ikut masuk one-shot staging core smoke.
- Memperbarui `reports/final-release-checklist.md` supaya checklist operator dan validation commands sekarang eksplisit menyebut auth readiness sebagai bagian release gate.

## File yang diubah

- `tools/qa/public-release-smoke.ts`
- `package.json`
- `reports/final-release-checklist.md`
- `reports/prod-lock-01-production-readiness-gate-auth-lock-20260413-report.md`

## Dampak lintas 3 aplikasi

- Client / Storefront:
  - login/session reset/rate-limit tidak lagi berada di luar gate release utama.
- Seller Workspace:
  - seller auth/session bergantung pada jalur auth buyer/account; gate sekarang ikut mengunci readiness tersebut.
- Admin Workspace:
  - admin public auth create-account/verify/approval/forgot-reset ikut menjadi bagian readiness gate.
- Backend:
  - tidak ada perubahan kontrak API, schema, atau domain truth payment/shipment.
  - hanya penguatan orchestration smoke/go-no-go.

## Verifikasi

Berhasil:

- `pnpm -F server smoke:auth-session-invalidation` ✅
- `pnpm -F server smoke:auth-rate-limit` ✅
- `pnpm -F server smoke:admin-public-auth` ✅

Catatan:

- `pnpm qa:public-release` penuh tidak dijalankan ulang pada environment lokal ini karena gate tersebut masih bergantung pada DB production-like env yang valid, dan issue ini sudah terdokumentasi sebagai blocker env/operator pada report readiness sebelumnya.
- Tidak ada perubahan frontend runtime atau backend contract, jadi tidak ada indikasi kebutuhan rerun seluruh smoke MVF non-auth hanya untuk patch gate ini.

## Residual issue

- Full public-release proof tetap membutuhkan credential/env DB yang valid pada environment target.
- Gate sekarang mengunci auth readiness, tetapi belum menambahkan browser live auth smoke ke `qa:public-release`; yang dikunci saat ini adalah backend auth truth yang paling kritis.
- Warning bundle/performance yang sudah tercatat di report sebelumnya tetap belum disentuh.

## Apakah perlu Rencana Kolaborasi lanjutan

Tidak perlu untuk patch ini.

Rencana Kolaborasi baru hanya diperlukan jika tim ingin:

- memasukkan browser live auth smoke ke gate publik,
- mengubah boundary producer summary/order aggregate lintas app,
- atau merombak topology deploy/auth-cookie lintas origin.
