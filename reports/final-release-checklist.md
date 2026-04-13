# Final Release Checklist

## Release Decision Gate
- Do not release publicly unless every item in `Must Fix Before Public Release` is satisfied.
- If all blockers are satisfied and smoke/build checks pass, this repo is a release candidate with known residual risks listed below.

## Must Fix Before Public Release
- Confirm production server starts from built output using `pnpm -F server start:prod`.
- Set a strong `JWT_SECRET`.
- Set and verify database connectivity values: `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
- Run `pnpm qa:public-release` and confirm DB readiness preflight passes before build/boot smoke continues.
- Confirm `pnpm qa:public-release` now includes auth readiness smoke for session invalidation, rate limiting, and admin public auth before MVF payment/order gates.
- Decide deployment topology:
  - same-origin/proxy deployment, or
  - cross-origin deployment with `CLIENT_URL` or `CORS_ORIGIN` configured.
- If HTTPS cross-origin cookies are required, set `COOKIE_SECURE=true` and serve both client and server over HTTPS.
- If Stripe checkout is enabled:
  - store settings must contain valid Stripe key, secret, and webhook secret
  - public checkout base URL must be resolvable through `STORE_PUBLIC_BASE_URL`, `CLIENT_PUBLIC_BASE_URL`, or `PUBLIC_BASE_URL`
  - Stripe webhook endpoint must be reachable at `/api/store/stripe/webhook`
- Ensure writable filesystem exists for uploads under `uploads/`.
- Ensure MySQL and any production migrations/data setup are complete before traffic.

## Should Fix Soon After Release Candidate
- Audit remaining medium-size client chunks such as `vendor-ui`, `StoreCustomization`, and shared address helpers.
- Keep runtime/operator env completeness checks aligned with `pnpm qa:public-release`.
- Review remaining compatibility-only routes periodically so old paths do not accumulate unnoticed.

## Acceptable Residual Risk
- Compatibility route `POST /api/store/orders` still exists server-side but is no longer exposed by the active storefront checkout client.
- Tracking stepper remains presentational; payment finality and CTA already follow backend truth.
- Local filesystem uploads remain an operational dependency; there is no external object storage abstraction yet.

## Environment / Service Requirements
- Backend:
  - `NODE_ENV`
  - `PORT`
  - `JWT_SECRET`
  - `AUTH_COOKIE_NAME`
  - `COOKIE_SECURE`
  - `CLIENT_URL` or `CORS_ORIGIN` when cross-origin
  - database envs
- Stripe-enabled release:
  - persisted store settings with valid Stripe publishable key, secret key, and webhook secret
  - `STORE_PUBLIC_BASE_URL` or equivalent public base URL when request origin/host is not reliable enough
- Optional but operationally relevant:
  - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

## Critical Manual Checks
- Admin workspace:
  - login/logout
  - public auth create account / verify / approval / forgot-reset path
  - order list/detail badge and allowed transition states
  - product visibility/admin review metadata
  - store settings Stripe diagnostics
- Seller workspace:
  - account session still survives valid flows and expires honestly after reset/logout
  - order list/detail summary matches backend contract
  - payment review lane can approve/reject correctly
  - payment profile/media upload still works with image restrictions
- Client/storefront:
  - buyer auth login/register/forgot-reset/rate-limit/session-expiry honesty
  - published ready-store product is visible
  - not-ready store product is gated from public discovery and checkout
  - checkout preview/create reflects backend readiness and payment availability
  - account order detail/payment, success, and tracking pages show honest payment state
- Backend:
  - `/api/health`
  - `/api/diagnostics/request-context`
  - `/api/store/stripe/webhook`
  - `/api/orders/:id/checkout-payment`
  - `/api/store/orders/:ref`

## Validation Commands
- Full public-release smoke gate:
  - `pnpm qa:public-release`
  - Expected DB failure classification when env is invalid: `DB readiness failed: ... Verify DB_USER/DB_PASS or DATABASE_URL ...`
- Preferred one-shot staging smoke:
  - `pnpm qa:staging:core`
- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm -F server smoke:store-readiness`
- `pnpm -F server smoke:product-visibility`
- `pnpm -F server smoke:order-payment`
- `pnpm -F server smoke:auth-session-invalidation`
- `pnpm -F server smoke:auth-rate-limit`
- `pnpm -F server smoke:admin-public-auth`
- `pnpm -F server smoke:stripe-webhook`
- `pnpm -F server smoke:request-diagnostics`
- `pnpm qa:mvf:visibility:frontend`

## Known Warnings To Re-check During Deployment
- Cross-origin cookie session will fail if HTTPS and `COOKIE_SECURE=true` are not aligned with deployment.
- Stripe checkout will fail fast if public base URL is missing even when credentials are valid.
- Client build chunk warning was reduced in Task 4A; keep medium-size chunks on the release radar.
