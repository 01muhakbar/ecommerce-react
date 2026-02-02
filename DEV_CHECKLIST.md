# Dev Checklist (Local)

## Quick start
1) Install deps
```
pnpm install
```

2) Setup env
- Copy `.env.example` to `.env` at the repo root.
- Server reads `.env` (root).
- Client uses `VITE_API_BASE=/api` from `.env` (root) when built.

3) Run dev
```
pnpm dev
```

## Database notes
- If you see: `Skipping database sync (set DB_SYNC=true to enable).`
  - This means model sync is disabled by default.
  - Enable sync by setting `DB_SYNC=true` in `.env`.
  - Risk: `syncDb()` can alter tables; only use on a dev database.

### Reset / seed (server scripts)
From repo root:
```
pnpm --filter server db:reset
pnpm --filter server seed:super
pnpm --filter server seed:dev
pnpm --filter server seed:kacha
pnpm --filter server seed:demo
```
After reset/seed:
- Clear browser localStorage cart (click "Clear cart" in UI) because cart is persisted and can contain stale productId values.

## MVP manual test (store + admin)
1) Admin login
   - Use seed creds from seed output:
     - `superadmin@local.dev`
     - `supersecure123`
2) Admin create category + product (or run `pnpm --filter server seed:demo`)
3) Store browse product on `/search`
4) Add to cart
5) Checkout → order created
6) Admin view `/admin/orders` and update status

## Troubleshooting
- **DB connect fail**: verify DB_HOST/DB_USER/DB_PASS/DB_NAME in `.env`, and MySQL is running.
- **Port conflict**: server uses `PORT` (default 3001). Client uses 5173. Stop the other process or change `PORT`.
- **Auth/Cookie issues**: ensure `/api/auth/login` sets a cookie and requests include cookies (`withCredentials` or `credentials: "include"`).
