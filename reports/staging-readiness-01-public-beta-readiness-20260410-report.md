# STAGING-READINESS-01 — Public Beta Readiness Pass

Date: 2026-04-10

## Summary

This pass focused on staging / public beta readiness rather than feature work.

The repo already had most MVF truth hardening in place. The main gaps for staging were:

- runtime safety that could still start too optimistically
- env/example documentation that did not fully reflect current multistore and checkout deployment assumptions
- lack of a single smoke-on-deploy command for staging operators
- rollback awareness spread across multiple reports instead of one actionable checklist

## Critical Env / Runtime Findings

### Env that is effectively required for staging / public beta

- `NODE_ENV=production`
- `PORT`
- `JWT_SECRET`
- `AUTH_COOKIE_NAME`
- `DATABASE_URL` or full `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- writable `UPLOAD_DIR` or default writable `uploads/`

### Env that should be explicit in staging / public beta

- `CLIENT_URL` and/or `CORS_ORIGIN`
- `COOKIE_SECURE=true` for cross-origin HTTPS cookie auth
- `PUBLIC_BASE_URL`, `CLIENT_PUBLIC_BASE_URL`, or `STORE_PUBLIC_BASE_URL` for checkout redirect reliability
- `ENABLE_MULTISTORE_SHIPMENT_MVP`
- `ENABLE_MULTISTORE_SHIPMENT_MUTATION`
- client-side shipment flags:
  - `VITE_ENABLE_MULTISTORE_SHIPMENT_MVP`
  - `VITE_ENABLE_MULTISTORE_SHIPMENT_MUTATION`

### Env / config that was still too implicit

- Shipment flags could previously rely on defaults instead of explicit staging/prod values.
- Checkout public base URL could still fall back to request origin / host, which is risky behind reverse proxies.
- Production startup guard had become async but was not awaited, so some checks could race behind DB startup.

## Hardening Applied

### Startup / runtime safety

- Fixed production runtime validation to be awaited before DB connect and listen.
- Added a production warning when no explicit checkout public base URL is configured.

### Env example clarity

- Root `.env.example` now documents:
  - `UPLOAD_DIR`
  - public checkout base URL vars
  - explicit multistore shipment flags
  - client-side shipment flags
- `server/.env.example` now documents:
  - `UPLOAD_DIR`
  - public checkout base URL vars
  - explicit multistore shipment flags

### Smoke-on-deploy discipline

- Added one-shot command:
  - `pnpm qa:staging:core`

This command runs the existing staging-relevant build and smoke checks in the intended order.

## Files Changed

- `server/src/server.ts`
- `package.json`
- `.env.example`
- `server/.env.example`
- `reports/final-release-checklist.md`
- `reports/staging-readiness-01-public-beta-readiness-20260410-report.md`

## Staging / Public Beta Checklist

### Before deploy

1. Confirm production env values exist:
   - auth secret
   - cookie name
   - DB connectivity
   - upload dir
   - CORS / client origin
   - public checkout base URL
   - shipment flags
2. Confirm deployment topology:
   - same-origin proxy, or
   - cross-origin with HTTPS cookie alignment
3. Confirm Stripe-enabled stores have valid persisted Stripe settings and reachable webhook path.

### Deploy

1. Build artifacts:
   - `pnpm -F server build`
   - `pnpm -F client build`
2. Boot server from built output:
   - `pnpm -F server start:prod`
3. Health check:
   - `/api/health`

### Smoke-on-deploy

Preferred one-shot smoke:

- `pnpm qa:staging:core`

If staging uses a non-local server URL, set the runtime base URL used by server smoke scripts first:

- `BASE_URL=https://your-staging-server.example`

Then run:

- `pnpm qa:staging:core`

### Manual spot checks after smoke

- Buyer:
  - checkout to payment lane
  - multistore payment split visibility
  - tracking / order detail honesty
- Seller:
  - split order list/detail
  - payment readiness
  - shipment action blocked when unpaid/final-negative
- Admin:
  - payment audit list/detail
  - parent order wording remains aggregate-only
  - split blocked/final-negative states remain honest

## Rollback Awareness

### Indicators of a bad deploy

- `start:prod` fails because auth / DB / upload path checks stop startup
- smoke product visibility or store readiness fails
- order-payment or shipment regression smoke fails
- buyer payment lane loads parent order but split truth is missing broadly
- seller shipment actions appear enabled for unpaid/final-negative splits
- admin payment audit no longer reflects split truth

### When to rollback

- Any build artifact fails
- Startup fails on production env after the intended config is applied
- `qa:staging:core` fails on functional assertions rather than transient network noise
- Buyer checkout/payment, seller split fulfillment gating, or admin audit truth becomes contradictory

### Most sensitive areas

- auth cookies / CORS / HTTPS alignment
- Stripe redirect base URL
- split payment truth
- split shipment gating
- upload writability

### First checks after rollback

1. `/api/health`
2. `pnpm -F server smoke:product-visibility`
3. `pnpm -F server smoke:store-readiness`
4. `pnpm -F server smoke:order-payment`
5. `pnpm -F server smoke:shipment-regression`

## Verification

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅

Notes:

- This pass focused on readiness guards, env clarity, and operational checklisting.
- Full smoke discipline remains available through `pnpm qa:staging:core`.

## Risks Reduced

- Production/staging startup can no longer silently skip async runtime validation.
- Operators now have a single smoke-on-deploy command instead of assembling checks manually.
- Env files reflect current multistore shipment and checkout redirect assumptions more clearly.
- Rollback decision points are now documented in one place.

## Residual Issues

- No new CI/CD automation was added in this pass.
- Bundle-size/performance warning from client build still remains outside staging-safety scope.
- Stripe redirect correctness still depends on real deployment topology and persisted store settings.

## Final Assessment

The repo is ready for staging / public beta.

There is no blocker from this pass that requires a large refactor or `Rencana Kolaborasi`.

The next production-facing work should focus on:

- deployment rehearsal on target staging infra
- bundle/performance follow-up
- broader observability after public beta traffic patterns are understood
