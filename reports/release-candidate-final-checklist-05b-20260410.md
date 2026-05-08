# Release Candidate Final Checklist - Task 5B

Tanggal: 2026-04-10

## Release Decision

Lanjut release hanya jika:
- `pnpm qa:public-release` lulus penuh pada env staging/production candidate.
- DB preflight lulus dan tidak memakai credential lokal dummy.
- `pnpm -F server build` dan `pnpm -F client build` lulus.
- Operator sudah tahu artifact/version yang akan di-deploy dan artifact/version rollback.

Stop release jika:
- DB preflight gagal.
- `start:prod` gagal sebelum `/api/health` ready.
- Smoke checkout/order/payment, store readiness, product visibility, Stripe webhook, atau frontend visibility gagal.
- Request diagnostics tidak mengembalikan request id/correlation id.
- Ada mismatch baru pada payment/order status lintas Client/Seller/Admin.

## Env Gate

Wajib:
- `NODE_ENV=production`
- `PORT`
- `JWT_SECRET` kuat, minimal 24 karakter, bukan `dev-secret`
- `AUTH_COOKIE_NAME`
- DB via `DATABASE_URL` atau `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`

Deployment/cookie:
- `COOKIE_SECURE=true` untuk HTTPS cross-origin.
- `CLIENT_URL` atau `CORS_ORIGIN` untuk cross-origin.
- Same-origin/proxy deployment boleh tidak memakai CORS origin eksplisit jika routing proxy sudah benar.

Public checkout/payment:
- Set minimal satu dari `PUBLIC_BASE_URL`, `CLIENT_PUBLIC_BASE_URL`, atau `STORE_PUBLIC_BASE_URL` untuk hosted checkout/callback yang tidak bisa mengandalkan request host.
- Stripe-enabled release harus punya persisted store settings untuk publishable key, secret key, dan webhook secret.
- Webhook target: `/api/store/stripe/webhook`.

Runtime:
- `UPLOAD_DIR` writable pada host/container target.
- DB migrations/data seed production yang dibutuhkan sudah selesai sebelum traffic.

## Automated Gate

Jalankan:

```sh
pnpm qa:public-release
```

Gate ini mencakup:
- Env validation.
- DB readiness preflight dengan failure classification.
- Server build.
- Client build.
- `pnpm -F server start:prod` dari built artifact.
- `/api/health` dengan DB connected.
- Store readiness smoke.
- Product visibility smoke.
- Order/payment smoke.
- Stripe webhook smoke.
- Frontend visibility smoke.

Tambahan bila ingin cek cepat request diagnostics:

```sh
pnpm -F server smoke:request-diagnostics
```

## Manual Spot Check

Admin:
- Login/logout.
- Order list/detail melihat parent order, split/suborder, payment status.
- Store settings/payment diagnostics masuk akal.

Seller:
- Seller hanya melihat suborder miliknya.
- Payment review bisa approve/reject sesuai backend truth.
- Fulfillment action tetap blocked saat payment belum valid.

Client:
- Product ready-store terlihat.
- Product store-not-ready tidak bisa checkout.
- Cart -> checkout -> order success/account/tracking tidak menampilkan paid bila backend belum final.
- Duplicate checkout memakai `checkoutRequestKey` atau `Idempotency-Key`.

Operations:
- `GET /api/diagnostics/request-context` mengembalikan request id.
- Response header `X-Request-Id` tersedia untuk support case.
- Log `[operational-audit]` bisa dicari dengan `traceId`.

## Release Go / No-Go

Go:
- Semua automated gate lulus.
- Manual spot check inti lulus.
- Rollback artifact/version tersedia.
- Env dan secret dikelola di platform deploy, bukan repo.

No-Go:
- DB credential/connectivity belum valid.
- Payment webhook belum reachable.
- Cookie/CORS policy belum sesuai topology deploy.
- Checkout/order/payment smoke gagal.
- Operator tidak punya rollback target.
