# Production Deployment Checklist

Use this as the final environment checklist before public deployment. Backend remains the source of truth; do not replace missing backend config with client-side fallbacks.

## Required Environment

- `NODE_ENV=production`.
- Production database is configured with either `DATABASE_URL` or all split `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
- `DB_SYNC` is not `true`.
- `JWT_SECRET` is strong, unique, at least 24 characters, and not an example/dev value.
- `AUTH_COOKIE_NAME` is explicit.
- `CLIENT_URL` or `CORS_ORIGIN` is explicit and uses the public HTTPS client origin.
- `COOKIE_SECURE` is omitted or `true` for public HTTPS. `false` is only for localhost proof runs.
- `PUBLIC_BASE_URL`, `CLIENT_PUBLIC_BASE_URL`, or `STORE_PUBLIC_BASE_URL` points to the public storefront URL for hosted checkout redirects.
- `UPLOAD_DIR` points to a writable persistent directory. The server serves it as `/uploads`.
- Client builds set `VITE_SERVER_ORIGIN` when uploads/API are served from a different origin than the client app.

## Payment And Webhook

- COD can operate without external payment secrets.
- Stripe checkout becomes available only when Admin Store Settings contain valid Stripe publishable and secret keys.
- Stripe webhook sync requires a valid Stripe webhook signing secret in Admin Store Settings before `/api/store/stripe/webhook` will process events.
- Public checkout redirect base URL must be set before enabling Stripe publicly.
- `RATE_LIMIT_DISABLED` must stay unset/false in production unless an upstream WAF or gateway already enforces equivalent limits.
- `RATE_LIMIT_NON_PRODUCTION_MULTIPLIER` is for local/test only; production always uses the configured route limits.

## Security Smoke

- Auth/login rate limit smoke remains green.
- Checkout/cart/order/payment smoke remains green.
- `pnpm qa:e2e:truth` remains green after deployment config changes.
- Public image paths under `/uploads` load from the same persistent upload directory used by admin/seller uploads.
