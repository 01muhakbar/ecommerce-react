# P0.8 Release Candidate Snapshot & Deployment Checklist — 2026-05-13

## Status RC
- Status: **Release Candidate PASS untuk MVF public release gate lokal/staging-proof**.
- Tidak ada app code yang diubah pada P0.8.
- Perubahan P0.8 hanya dokumentasi/checklist report ini.
- Tanggal verifikasi ulang: 2026-05-14 Asia/Makassar.

## Ringkasan Perubahan P0.1–P0.7
- P0.1 Coupon Checkout Truth
  - Coupon platform/seller diselaraskan dari display, apply, checkout, sampai order attribution.
  - Smoke checkout coupon ditambahkan untuk scope, ownership, expiry, minimum order, usage, dan discount calculation.
- P0.2 Product Visibility & Variant Checkout Truth
  - Public product visibility dikunci ke product/store yang benar-benar purchasable.
  - Variant price/stock/attribute selection diperkuat dari detail/cart/checkout/order.
- P0.3 Attribute Truth
  - Attribute/value inactive/deleted dihormati di Seller dan Client.
  - Variant attribute selection dan order snapshot divalidasi lewat smoke.
- P0.4 Playwright E2E Truth
  - Chromium Playwright tersedia.
  - `qa:e2e:truth` berhasil berjalan.
- P0.5 Production Readiness Gate
  - Route explicit `/demo/kachabazar` diproteksi dari production build.
  - Demo/fallback leak dan readiness risk diaudit.
- P0.6 Public Release Gate Verification
  - `qa:public-release` diklasifikasi: env wajib harus ada, lalu app blocker auth ditemukan.
  - Tidak ada app patch di P0.6.
- P0.7 Auth Session Invalidation Fix
  - Scoped auth session sekarang memakai validator canonical credential version.
  - Session/token lama invalid setelah password reset/change.
  - Store readiness smoke diselaraskan dengan truth P0.2: product store non-ready tidak tampil di PDP public.

## Validasi RC
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm qa:e2e:truth`: PASS
- `pnpm qa:public-release`: PASS dengan env lokal proof

Env lokal proof untuk `qa:public-release`:
- `PUBLIC_RELEASE_SMOKE_PORT=3035`
- `JWT_SECRET=local-public-release-proof-secret-2026-05-14`
- `AUTH_COOKIE_NAME=token`
- `COOKIE_SECURE=false`
- `CLIENT_URL=http://localhost:5173`
- `CORS_ORIGIN=http://localhost:5173`
- `PUBLIC_BASE_URL=http://localhost:5173`
- `DATABASE_URL=mysql://root@localhost:3306/ecommerce_dev`

Catatan hasil:
- `qa:public-release` mencapai `[public-release-smoke] OK public release smoke gate passed`.
- Warning `COOKIE_SECURE=false` muncul karena run localhost proof; production HTTPS wajib `COOKIE_SECURE=true`.
- Warning `UPLOAD_DIR` muncul karena tidak diset di env lokal proof; production wajib menyediakan directory yang writable.
- Vite chunk-size warning masih muncul dan diklasifikasikan P1.
- Node `[DEP0190]` masih muncul dari QA tooling child process dan diklasifikasikan P2/tooling.

## Env Production Wajib
- `NODE_ENV=production`
- `JWT_SECRET`: wajib kuat, bukan fallback, minimal sesuai gate production.
- `AUTH_COOKIE_NAME`: wajib eksplisit.
- `ADMIN_AUTH_COOKIE_NAME`: disarankan eksplisit agar cookie admin/storefront tetap paralel.
- `JWT_EXPIRES_IN` atau `JWT_EXPIRES`: set sesuai policy session.
- `COOKIE_SECURE=true`: wajib untuk HTTPS production.
- `CLIENT_URL`: URL client public production.
- `CORS_ORIGIN`: origin yang diizinkan, jangan wildcard untuk production.
- `PUBLIC_BASE_URL`: URL public canonical.
- Database:
  - Pilih `DATABASE_URL`, atau
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `UPLOAD_DIR`: wajib ada dan writable oleh process server.
- Payment/shipping provider env sesuai target production.
- SMTP/email env sesuai flow auth/reset/notification production.
- Stripe/webhook env jika payment Stripe diaktifkan.

## Pre-Deploy Checklist
- Pastikan `pnpm-workspace.yaml` dirty lama/unrelated tidak ikut dipaketkan tanpa review.
- Pastikan branch/revision berisi semua patch P0.1–P0.7 dan report.
- Pastikan env production sudah lengkap dan tidak memakai local proof secret.
- Pastikan `COOKIE_SECURE=true` pada HTTPS production.
- Pastikan `UPLOAD_DIR` sudah dibuat, writable, dan backup/retention policy jelas.
- Pastikan database target sudah siap dan migration/sync policy jelas.
- Pastikan CORS hanya mengizinkan domain production yang benar.
- Pastikan domain admin/seller/client mengarah ke backend yang sama sebagai source of truth.
- Pastikan seed demo tidak dijalankan otomatis dalam deployment production.
- Jalankan:
  - `pnpm -F server build`
  - `pnpm -F client build`
  - `pnpm qa:e2e:truth`
  - `pnpm qa:public-release`

## Deploy Checklist
- Ambil snapshot/backup database sebelum deploy.
- Simpan build artifact atau image/tag release candidate.
- Deploy backend dan frontend dari revision yang sama.
- Jalankan health check `/api/health`.
- Verifikasi server boot tidak menampilkan missing required env.
- Verifikasi upload path writable.
- Verifikasi cookie auth production memiliki `Secure`.
- Monitor log error, 4xx/5xx spike, checkout failures, auth failures, dan payment webhook failures.

## Post-Deploy Smoke Checklist
- Public:
  - Home/storefront bisa dibuka.
  - Product list hanya menampilkan product purchasable.
  - Product detail ready-store bisa dibuka.
  - Product non-ready/unpublished tidak muncul atau 404 sesuai truth.
- Auth:
  - Customer login/logout.
  - Password reset membuat session lama invalid.
  - Admin login tetap berjalan.
  - Seller session tetap berjalan.
- Product/Variant:
  - Variant selector tampil sesuai active attribute/value.
  - Add to cart variant valid berhasil.
  - Variant out-of-stock atau inactive ditolak.
- Coupon:
  - Coupon platform valid bisa apply.
  - Coupon seller/store valid hanya berlaku untuk store scope-nya.
  - Expired/minimum-order/usage-limit ditolak.
- Checkout/Order:
  - Cart ke checkout memakai price/stock/variant terbaru.
  - Order snapshot menyimpan coupon, variant, dan attribute label.
  - Seller/Admin order view sinkron.
- Payment:
  - Manual payment proof flow buyer → seller/admin sinkron.
  - Stripe webhook smoke/liveness jika Stripe aktif.

## Rollback Checklist
- Stop traffic ke release baru atau switch load balancer ke previous healthy deployment.
- Restore previous backend/frontend artifact atau image.
- Jangan rollback database tanpa backup point yang jelas.
- Jika migration/schema berubah di masa depan, siapkan rollback migration terpisah sebelum deploy.
- Re-run smoke minimal setelah rollback:
  - `/api/health`
  - login customer/admin
  - product detail ready-store
  - add to cart
  - checkout preview/create order
  - coupon apply
- Catat incident window, failed endpoint, dan data yang mungkin perlu rekonsiliasi.

## Risiko Tersisa
- P1: Vite chunk-size warning masih ada; tidak menghalangi release gate, tetapi perlu performance/code-split follow-up.
- P1: Homepage masih memakai component bernama `KachaBazarDemoHomePage`; explicit `/demo/kachabazar` sudah tidak aktif di production, tetapi branding/content audit tetap disarankan.
- P1: Env production final belum dibuktikan di target deploy aktual pada report ini; local proof memakai env sementara.
- P1: `COOKIE_SECURE=true` wajib di HTTPS production.
- P1: `UPLOAD_DIR` wajib tersedia/writable di target.
- P2/tooling: Node `[DEP0190]` warning dari QA child process.

## Worktree Note
- `pnpm-workspace.yaml` masih dirty lama/unrelated dan tidak disentuh.
- P0.8 tidak mengubah app code.

## Kesimpulan
Release candidate siap untuk deployment staging/production dengan syarat env production final dipenuhi dan checklist pre/post deploy dijalankan. Risiko tersisa tidak memblokir release gate MVF, tetapi P1/P2 di atas harus masuk follow-up setelah publikasi.
