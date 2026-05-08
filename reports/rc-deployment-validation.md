# RC Deployment Validation

## Scope
- Validate the existing final release checklist against a production-like boot path.
- Patch only deployment issues that block the release candidate from starting or enforcing the intended guardrails.
- Keep business contracts and order/payment lifecycle behavior unchanged.

## Validation Snapshot
- Date: 2026-04-01
- Workspace: local production-like validation from built artifacts
- Checklist baseline: `reports/final-release-checklist.md`

## Production-Like Validation Performed
- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm -F server smoke:product-visibility`
- `pnpm -F server smoke:order-payment`
- `pnpm -F server smoke:stripe-webhook`
- `pnpm -F server start:prod`

## Environment Assumptions Used For Boot Validation
- `NODE_ENV=production`
- `PORT=3012`
- `CLIENT_URL=https://storefront.example`
- `CORS_ORIGIN=https://storefront.example`
- `COOKIE_SECURE=false`

## Validated Outcomes
- Built server boots successfully from `dist/server.js`.
- `@ecommerce/schemas` resolves from built `dist/` output at runtime.
- Health check succeeds on the production-like process.
- Credentialed CORS accepts the configured origin.
- Production CORS no longer accepts `http://localhost:5173`.
- Product visibility smoke still passes after deploy-focused patches.
- Order/payment smoke still passes after deploy-focused patches.
- Stripe webhook smoke still passes after deploy-focused patches.

## Fixed In This RC Validation Pass
- Production server boot blocker:
  - `@ecommerce/schemas` previously exported TypeScript source files instead of built `dist/` output.
  - Fixed by pointing runtime package exports to `dist/index.js` and `dist/index.d.ts`.
- Production CORS leak:
  - server CORS previously allowed `http://localhost:5173` even in production.
  - Fixed by deriving the allowlist from `CLIENT_URL` and `CORS_ORIGIN`, with localhost allowed only outside production.
- Production auth/session safety:
  - logout routes previously cleared cookies with a `secure` policy that could differ from the login route in production-like proxy setups.
  - Fixed by reusing the same cookie option resolver for login and logout.
- Production startup safety:
  - server previously still had runtime fallback JWT secrets inside auth code paths.
  - Fixed operationally by failing fast at startup when `JWT_SECRET` is missing in production.
- CORS rejection honesty:
  - disallowed origins previously surfaced through the generic Express error path.
  - Fixed to return a direct `403` JSON response.

## Blocker Before Public Release
- Real deployment values must exist for:
  - `JWT_SECRET`
  - database connectivity envs
  - `CLIENT_URL` or `CORS_ORIGIN` for cross-origin deployments
- If cross-origin cookie auth is used publicly:
  - HTTPS must be enabled
  - `COOKIE_SECURE=true`
  - client and server origins must match the intended deployment topology
- If Stripe is enabled publicly:
  - store Stripe credentials and webhook secret must be configured
  - public base URL used by checkout redirects must resolve correctly
  - `/api/store/stripe/webhook` must be reachable from Stripe
- Writable filesystem access for `uploads/` must be present on the target host.

## Patch After RC
- The client production bundle still emits a Vite oversized chunk warning.
- Startup still relies on documented env requirements instead of a dedicated production env completeness guard.

## Acceptable Residual Risk
- Compatibility route `POST /api/store/orders` still exists server-side, but it is no longer the active storefront checkout path.
- Tracking stepper remains presentational; order/payment truth still comes from backend contract and read model.
- Uploads still depend on local filesystem availability.

## Release Decision
- Release candidate support is validated locally after the deploy patches above.
- Public release should proceed only after the remaining blocker checklist items are confirmed on the target environment.
