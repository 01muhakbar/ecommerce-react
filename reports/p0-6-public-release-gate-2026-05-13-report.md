# P0.6 Public Release Gate Verification — 2026-05-13

## Ringkasan
- `pnpm qa:public-release` belum PASS.
- Run pertama tanpa env lokal gagal sebagai **config blocker**: release gate menolak lanjut karena env wajib belum tersedia (`JWT_SECRET`, `AUTH_COOKIE_NAME`, dan konfigurasi DB).
- Run kedua dengan env lokal sementara untuk membedakan config vs app berhasil melewati DB preflight, server build, client build, production boot, dan health check, lalu gagal sebagai **app blocker P0** di smoke auth session invalidation.
- Tidak ada app code yang diubah pada P0.6.

## Hasil qa:public-release
### Run 1 — tanpa env release lokal
Klasifikasi: **config blocker**

Penyebab:
- Missing required env: `JWT_SECRET`, `AUTH_COOKIE_NAME`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- Warning release:
  - `COOKIE_SECURE is not true`
  - `CLIENT_URL/CORS_ORIGIN is not set`
  - no public base URL configured
  - `UPLOAD_DIR` not set

### Run 2 — env lokal sementara
Command env sementara dipakai hanya untuk validasi lokal, tanpa menulis file env:
- `PUBLIC_RELEASE_SMOKE_PORT=3035`
- `JWT_SECRET=local-public-release-proof-secret-2026-05-13`
- `AUTH_COOKIE_NAME=token`
- `COOKIE_SECURE=false`
- `CLIENT_URL=http://localhost:5173`
- `CORS_ORIGIN=http://localhost:5173`
- `PUBLIC_BASE_URL=http://localhost:5173`
- `DATABASE_URL=mysql://root@localhost:3306/ecommerce_dev`

Klasifikasi: **app blocker P0**

Gate yang sudah lolos:
- DB preflight PASS
- `pnpm -F server build` PASS
- `pnpm -F client build` PASS, dengan warning chunk size Vite existing
- production server boot PASS di `http://127.0.0.1:3035`
- health check PASS

Gate yang gagal:
- `smoke:auth-session-invalidation`

Error inti:
```text
old session after reset: expected HTTP 401, received 200
```

Dampak:
- Setelah password reset, session/cookie lama masih bisa mengakses `/api/auth/me`.
- Ini bukan blocker Product/Attribute/Coupon langsung, tetapi blocker release publik karena auth/session freshness gagal.

## Validasi Wajib
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS, warning chunk size existing
- `pnpm qa:e2e:truth`: PASS
- `pnpm qa:public-release`: FAIL, classified as config blocker first, then app blocker P0 after local env proof

## Demo Seed / Route / Runbook Leak
- Seed demo masih ada sebagai script manual:
  - root `package.json`: `seed:kachabazar`
  - `server/package.json`: `seed:kacha`, `seed:kachabazar`, `seed:demo`, `seed:categories-demo`, `seed:analytics`
- Tidak ditemukan bukti script demo seed otomatis berjalan di release gate.
- Route explicit `/demo/kachabazar` sudah tidak aktif di production build karena guard di `client/src/App.jsx` mengarahkan ke `/`.
- Risiko tersisa P1: homepage masih memakai component bernama `KachaBazarDemoHomePage`. Ini perlu audit konten/branding terpisah, tetapi bukan route demo public aktif.

## Worktree
Perubahan Codex dari task P0.1-P0.5 yang masih berada di worktree:
- `client/src/App.jsx`
- `server/package.json`
- `server/src/routes/admin.coupons.ts`
- `server/src/routes/seller.attributes.ts`
- `server/src/routes/store.coupons.ts`
- `server/src/routes/store.ts`
- `server/src/scripts/smokeCheckoutCoupons.ts`
- `server/src/scripts/smokeCheckoutVariants.ts`
- `server/src/scripts/smokeCouponScope.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `server/src/scripts/smokeSellerAttributes.ts`
- reports P0 sampai P0.6

Perubahan lama/unrelated:
- `pnpm-workspace.yaml`

Catatan: `pnpm-workspace.yaml` tidak disentuh.

## Risiko Tersisa
- **P0 app blocker:** old user session tetap valid setelah password reset.
- **P1 config readiness:** env production wajib harus disediakan di target deploy (`JWT_SECRET`, `AUTH_COOKIE_NAME`, DB config, CORS/client URL, public base URL, upload dir).
- **P1 security config:** `COOKIE_SECURE=true` wajib untuk HTTPS production; run lokal memakai `false` hanya untuk validasi localhost.
- **P1 content/branding:** homepage masih memakai component demo-named `KachaBazarDemoHomePage`.
- **P2 build hygiene:** Vite chunk-size warning masih muncul; audit saja, belum refactor.
- **P2 runtime warning:** Node warning `[DEP0190]` muncul di E2E/public-release path.

## Rencana Kolaborasi
Tujuan:
Memperbaiki auth session invalidation agar session/JWT lama tidak lagi valid setelah password reset atau password change.

Area terdampak:
- Auth login/reset password
- JWT/session claims
- Auth middleware/session resolver
- Smoke auth session invalidation
- Kemungkinan compatibility admin/customer session

File kandidat:
- `server/src/controllers/authController.ts`
- `server/src/services/authSession.service.ts`
- `server/src/middleware/authMiddleware.ts`
- `server/src/routes/auth*.ts`
- `server/src/models/User.ts`
- `server/src/scripts/smokeAuthSessionInvalidation.ts`
- `tools/qa/public-release-smoke.ts`

Risiko:
- Bisa memutus login customer/admin/seller bila token claim berubah tidak kompatibel.
- Bisa butuh perubahan DB/schema jika solusi memerlukan `sessionVersion` atau `passwordChangedAt`.
- Bisa berdampak ke cookie auth lama dan flow reset password existing.

Strategi rollback:
- Revert perubahan auth/session resolver dan reset password.
- Pertahankan smoke untuk membuktikan perilaku sebelum/sesudah.
- Jalankan ulang release gate setelah rollback bila ada regresi login.

Validasi:
- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm -F server smoke:auth-session-invalidation`
- `pnpm -F server smoke:auth-rate-limit`
- `pnpm -F server smoke:admin-public-auth`
- `pnpm qa:e2e:truth`
- `pnpm qa:public-release`

Butuh approval sebelum lanjut: YA

## Next Task Disarankan
P0.7 Auth Session Invalidation Fix dengan approval Rencana Kolaborasi di atas.
