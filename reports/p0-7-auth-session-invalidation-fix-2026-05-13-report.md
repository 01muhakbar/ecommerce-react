# P0.7 Auth Session Invalidation Fix — 2026-05-13

## Ringkasan Masalah
- `qa:public-release` sebelumnya gagal di `smoke:auth-session-invalidation`.
- Session lama masih bisa mengakses `/api/auth/me` setelah password reset.
- Penyebab: scoped auth route membaca cookie lalu `jwt.verify` langsung, sehingga melewati validator canonical `resolveAuthenticatedUserFromToken` yang sudah mengecek credential version (`pwdv`).

## Patch
- `server/src/routes/auth.ts`
  - `loadScopedUserFromCookie` sekarang memakai `resolveAuthenticatedUserFromToken`.
  - Dampak: `/api/auth/me`, `/api/auth/account/me`, dan fallback scoped auth ikut menolak token lama setelah credential mutation.
- `server/src/scripts/smokeStoreReadiness.ts`
  - Regression smoke diselaraskan dengan truth flow P0.2: product detail dari store non-ready harus 404 di public checkout surface.
  - Ini diperlukan karena setelah auth blocker lewat, `qa:public-release` lanjut dan menemukan assertion smoke lama yang masih mengharapkan PDP non-ready 200.

## Dampak ke Admin/Seller/Client
- Client/storefront: session lama invalid setelah password reset dan password change.
- Admin: `smoke:admin-public-auth` tetap PASS.
- Seller/client auth normal tetap ter-cover lewat `qa:e2e:truth` dan public release gate.
- Tidak ada UI change.
- Tidak ada auth provider/architecture redesign.
- Tidak ada DB/schema migration.

## Validasi
- `pnpm -F server smoke:auth-session-invalidation`: PASS
- `pnpm -F server smoke:user-change-password`: PASS
- `pnpm -F server smoke:admin-public-auth`: PASS
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS, dengan warning chunk size existing
- `pnpm qa:e2e:truth`: PASS
- `pnpm qa:public-release`: PASS dengan env lokal proof

Env lokal proof untuk `qa:public-release`:
- `PUBLIC_RELEASE_SMOKE_PORT=3035`
- `JWT_SECRET=local-public-release-proof-secret-2026-05-13`
- `AUTH_COOKIE_NAME=token`
- `COOKIE_SECURE=false`
- `CLIENT_URL=http://localhost:5173`
- `CORS_ORIGIN=http://localhost:5173`
- `PUBLIC_BASE_URL=http://localhost:5173`
- `DATABASE_URL=mysql://root@localhost:3306/ecommerce_dev`

Catatan:
- `COOKIE_SECURE=false` hanya untuk localhost proof; production HTTPS harus memakai `COOKIE_SECURE=true`.
- `UPLOAD_DIR` masih warning default lokal.
- Node warning `[DEP0190]` masih muncul dari child process shell args di QA tooling.
- Vite chunk-size warning masih existing dan tidak disentuh.

## Hasil Validasi
- P0 auth/session blocker tertutup.
- Old session/token setelah password reset: 401.
- Old session/token setelah password change: 401.
- Login baru setelah reset/change: 200.
- `qa:public-release` sekarang mencapai `[public-release-smoke] OK public release smoke gate passed`.

## Risiko Tersisa
- P1 config: production env final harus disediakan di deployment target.
- P1 security config: `COOKIE_SECURE=true` wajib untuk HTTPS production.
- P2 tooling: `[DEP0190]` warning di QA child process.
- P2 frontend build: chunk-size warning existing.

## Next Task Disarankan
- P0.8 final env/deployment checklist: verifikasi secret production, cookie secure, CORS/base URL, upload dir, dan run `qa:public-release` di target env/staging.
