# P0 Rerun Security Smoke After DB Recovery Report

Task ID: P0-RERUN-SECURITY-SMOKE-AFTER-DB-RECOVERY-20260517
Date: 2026-05-17

## Summary

Runtime validation was rerun after recovering the local DB/API path. XAMPP MySQL was started locally from `C:\xampp\mysql\bin\mysqld.exe`, the API was started on port 3001, and all required MVF/security smoke commands passed.

`smoke:seller-order-ownership` passed and confirmed Seller A/Seller B cannot read or mutate each other's store-owned suborders, payment review records, or fulfillment state. Admin read access and Client own-order access were also verified by that smoke.

## Penyebab Blocker Sebelumnya

Previous smoke runs were blocked because:

- No API was listening on `http://localhost:3001`.
- MySQL was not listening on `localhost:3306`.
- Server start failed with `SequelizeConnectionRefusedError` / MySQL `ECONNREFUSED`.

Recovery action used:

- Started local XAMPP MySQL with `C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini`.
- Started the server with `pnpm.cmd -F server start`.
- Confirmed `/api/health` returned ready.

## Command Yang Dijalankan

- `Test-NetConnection -ComputerName localhost -Port 3306`
- `pnpm.cmd -F server start`
- `pnpm.cmd -F server smoke:seller-order-ownership`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:order-payment`
- `pnpm.cmd -F server smoke:product-visibility`
- `pnpm.cmd -F server smoke:orders`
- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `git diff --check`

## Hasil Masing-Masing Smoke

- `pnpm.cmd -F server smoke:seller-order-ownership` PASS
  - Seller A list/detail only showed Store A suborder.
  - Seller A could not detail Store B suborder through Store A route: 404.
  - Seller A could not access Store B route: 403.
  - Seller A could not review Store B payment through scoped or legacy payment review routes.
  - Seller A could update own paid suborder fulfillment.
  - Seller A/Seller B could not mutate the other store's fulfillment.
  - Admin could read both orders.
  - Buyer A could read own order and could not read Buyer B order.

- `pnpm.cmd -F server smoke:checkout-variants` PASS
  - Variant stock enforcement, stale cart price enforcement, and post-order snapshot consistency passed.

- `pnpm.cmd -F server smoke:order-payment` PASS
  - Checkout guardrails, idempotency, payment approval/rejection, fulfillment sync, and expiry sync passed.

- `pnpm.cmd -F server smoke:product-visibility` PASS
  - Public hidden/visible scenarios, variant-only all-out-of-stock hiding, checkout eligibility, seller/admin visibility metadata, and review locks passed.

- `pnpm.cmd -F server smoke:orders` PASS
  - Admin auth bootstrapped successfully from configured/default smoke admin credentials.
  - Script listed orders and exited cleanly with "no orders found" after prior smoke cleanup.

## Build Dan Static Check

- `pnpm.cmd -F server build` PASS
- `pnpm.cmd -F client build` PASS, with existing Vite chunk size warning
- `git diff --check` PASS, with Git autocrlf warning for `server/scripts/smoke-orders-admin.mjs`

## Patch

Small smoke-script patch applied during rerun:

- `server/scripts/smoke-orders-admin.mjs`
  - Admin bootstrap now follows existing smoke convention by falling back to `SEED_SUPER_EMAIL` / `SEED_SUPER_PASS`, `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`, then local smoke defaults `superadmin@local.dev` / `supersecure123`.
  - No token or session secret was hardcoded.
  - Message now says the session was bootstrapped from configured/default smoke admin credentials.

No production ownership, auth, order, payment, fulfillment, DB schema, or migration logic was changed in this rerun.

## Bug Fixed

- P1 smoke auth bootstrap gap: `smoke:orders` no longer fails with a raw/actionless 401 when explicit `ADMIN_COOKIE` or `ADMIN_TOKEN` is absent and seeded smoke admin credentials are available.

No real seller ownership bug was found during rerun.

## Validation-Only

For seller order ownership production behavior, this rerun was validation-only. The previously audited store-scoped backend logic passed runtime isolation smoke.

## Risiko Tersisa

- `smoke:orders` can pass with no rows if previous smoke cleanup leaves no orders. That validates auth bootstrap and endpoint reachability, but does not exercise status mutation unless orders exist.
- XAMPP MySQL must be running before API-backed smoke commands.
- `git diff --check` reports only an autocrlf warning for the edited `.mjs` file; no whitespace errors.

## Rekomendasi Task Berikutnya

- Add a dedicated admin order smoke that creates its own fixture order before testing admin list/detail/status mutation, instead of depending on pre-existing DB orders.
- Add cross-store bulk-delete coverage for seller suborders if seller order deletion remains supported.
