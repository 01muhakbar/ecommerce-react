# P0-RATE-LIMIT-01 Report

## Ringkasan
Minimal rate limit hardening selesai untuk endpoint publik sensitif.

Patch memakai bucket in-memory existing dari `authRateLimit.service.ts`, tanpa dependency baru dan tanpa mengubah kontrak sukses, route publik, schema, pricing, atau lifecycle checkout/order/payment. Rate limit dipasang route-scoped, bukan global, agar Admin/Seller dashboard yang banyak fetch data tidak ikut tertahan.

Catatan validasi: limit checkout submit `10/15m` sempat membuat `smoke:order-payment` gagal di local/dev karena smoke menjalankan banyak skenario guardrail dan idempotency dengan buyer yang sama. Patch final membuat non-production lebih longgar lewat multiplier default `5x`, sementara production tetap memakai angka matrix.

## Scope
- Audit rate limit existing.
- Mapping endpoint publik sensitif cart, checkout, coupon, payment proof/cancel, public tracking, Stripe session/webhook.
- Patch middleware reusable kecil.
- Apply hanya ke route sensitif.
- Update production deployment checklist.
- Jalankan build, smoke utama, E2E truth, dan diff check.

## File Diubah
- `server/src/middleware/rateLimit.ts`
- `server/src/routes/cartRoutes.ts`
- `server/src/routes/checkout.ts`
- `server/src/routes/payments.ts`
- `server/src/routes/store.coupons.ts`
- `server/src/routes/store.stripeWebhook.ts`
- `server/src/routes/store.ts`
- `docs/production-deployment-checklist.md`
- `reports/p0-rate-limit-01-2026-05-16-report.md`

Catatan worktree: file dari task `P0-SYNC-GATE-01`, `P0-SYNC-GATE-02`, dan `P0-PROD-READINESS-01` masih ada di worktree dan tidak direvert.

## Existing Rate Limit Audit
- Library/middleware: tidak ada dependency rate-limit eksternal. Existing memakai in-memory bucket di `server/src/services/authRateLimit.service.ts`.
- Endpoint yang sudah dilindungi: auth login, client registration OTP/resend/verify, client password reset, admin public auth verify/reset/resend.
- Response 429: existing auth flow memakai `code: "RATE_LIMITED"` dan `retryAfterSeconds`.
- Env/config: sebelumnya belum ada env disable/shared route middleware. Patch menambah `RATE_LIMIT_DISABLED` dan `RATE_LIMIT_NON_PRODUCTION_MULTIPLIER`.
- Reusable atau belum: bucket function reusable (`consumeAuthRateLimit`) sudah ada, tetapi belum ada Express middleware route-scoped. Patch menambahkan `createRateLimit`.

## Sensitive Endpoint Map

| Area | Method/Route | Risk | Existing Protection | Proposed Limit | Notes |
| --- | --- | --- | --- | --- | --- |
| Cart add/update/remove | `POST /api/cart/add`, `PUT /api/cart/items...`, `DELETE /api/cart...` | spam, deadlock pressure, stock validation churn | auth cookie + cart retry for deadlock | 60 / 15m per user | Applied after `protect` |
| Checkout preview | `POST /api/checkout/preview` | quote abuse, store/payment readiness churn | auth + backend eligibility | 60 / 15m per user | Applied after `requireAuth` |
| Checkout submit | `POST /api/checkout/create-multi-store` | duplicate/order spam | auth + idempotency key/read model transaction | 10 / 15m per user in production | Non-production multiplier default 5x for smoke |
| Legacy order submit | `POST /api/store/orders` | legacy direct order spam | auth + legacy validation | 10 / 15m per user in production | Kept for compatibility, rate limited |
| Coupon quote/apply | `POST /api/store/coupons/quote`, `/validate` | coupon enumeration/quote churn | backend coupon policy | 60 / 15m per IP | Public route, IP keyed |
| Payment proof/upload | `POST /api/payments/:paymentId/proof` | upload payload abuse, payment state churn | auth + owner check + payment state guard | 10 / 15m per user in production | Payload size still controlled by app JSON limit |
| Payment cancel | `POST /api/payments/:paymentId/cancel` | payment mutation spam | auth + owner check + cancelability guard | 10 / 15m per user in production | Same lane as proof mutation |
| Public tracking | `GET /api/store/orders/:ref` | invoice enumeration/read spam | invoice ref validation | 120 / 15m per IP | Light limit only |
| Stripe return/session | `GET/POST /api/store/orders/:ref/stripe/session` | session sync/start spam | auth + order ownership + Stripe config | 30 / 15m per user | Does not change Stripe lifecycle |
| Stripe webhook | `POST /api/store/stripe/webhook` | unsigned webhook spam | signature validation + webhook secret readiness | 120 / 15m per IP | Applied before raw body parsing |

## Patch Minimal
- Added `server/src/middleware/rateLimit.ts`.
- Reused `consumeAuthRateLimit` from existing auth limiter.
- Added route-scoped middleware constants for cart, checkout, payment mutation, coupon quote, public tracking, Stripe session, and Stripe webhook.
- Response 429 stays JSON and generic:
  `{ success: false, code: "RATE_LIMITED", message: "Too many requests. Please try again later.", data: { retryAfterSeconds } }`
- `RATE_LIMIT_DISABLED=true` can bypass in emergency/local only.
- `RATE_LIMIT_NON_PRODUCTION_MULTIPLIER` defaults to `5` and only affects non-production; production always uses configured route limits.
- Updated deployment checklist to keep `RATE_LIMIT_DISABLED` false/unset in production.

## Rate Limit Matrix

| Endpoint Area | Limit | Window | Env Behavior | Response |
| --- | --- | --- | --- | --- |
| Auth existing | varies by auth flow, e.g. login IP 12 and email 6 | 15m | existing behavior unchanged | `429`, `RATE_LIMITED` |
| Cart mutation | 60 per user | 15m | production exact, non-production default 5x | generic JSON `429` |
| Checkout preview | 60 per user | 15m | production exact, non-production default 5x | generic JSON `429` |
| Checkout submit | 10 per user | 15m | production exact, non-production default 5x | generic JSON `429` |
| Payment proof/upload | 10 per user | 15m | production exact, non-production default 5x | generic JSON `429` |
| Public tracking | 120 per IP | 15m | production exact, non-production default 5x | generic JSON `429` |

## Dampak Admin/Seller/Client
### Admin
Tidak ada perubahan admin route/dashboard. Admin payment audit tetap PASS di E2E truth.

### Seller
Tidak ada perubahan seller order/payment/fulfillment lifecycle. Seller order browser assertions tetap PASS di E2E truth.

### Client
Client checkout/cart/payment UI tidak diubah. Jika limit tercapai, backend mengembalikan 429 JSON generik; tidak ada UI redesign.

### Backend
Endpoint publik sensitif sekarang punya guard minimal berbasis IP atau user. Tidak ada dependency baru dan tidak ada global limiter.

## Validasi
- `pnpm -F server build`: PASS via `pnpm.cmd -F server build`
- `pnpm -F client build`: PASS via `pnpm.cmd -F client build` (warning chunk size existing)
- `pnpm -F server smoke:checkout-variants`: PASS via `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm -F server smoke:checkout-coupons`: PASS via `pnpm.cmd -F server smoke:checkout-coupons`
- `pnpm -F server smoke:order-payment`: PASS via `pnpm.cmd -F server smoke:order-payment`
- `pnpm qa:e2e:truth`: PASS via `pnpm.cmd qa:e2e:truth` (warning Node `DEP0190` existing)
- `git diff --check`: PASS (Git warning LF/CRLF untuk env example dari task sebelumnya, bukan whitespace error)

## Risiko Tersisa
- In-memory limiter tidak shared antar instance; production multi-instance tetap butuh WAF/gateway/Redis limiter pada future hardening.
- Public tracking rate limit berbasis IP dapat berbagi quota untuk NAT besar; limit sengaja ringan.
- Stripe webhook IP limit cukup longgar, tetapi gateway-level allowlist/WAF tetap lebih kuat untuk production skala besar.
- `RATE_LIMIT_DISABLED=true` harus diperlakukan sebagai emergency/local-only toggle.

## Next Suggested Task
`P0-OBSERVABILITY-01`: tambahkan audit logging/metrics ringan untuk rate-limit hits, checkout/payment errors, dan production guard warnings tanpa mengubah response contract.
