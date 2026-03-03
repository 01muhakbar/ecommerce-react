# TASK-0 Baseline Verification + MVF Smoke

Date: 2026-03-03 (Asia/Singapore)  
Workspace: `C:\Users\user\Documents\ecommerce-react`

## Environment

- OS: Windows 11 Pro
- Shell: PowerShell 7.5.4
- Node.js: v22.19.0
- pnpm: 10.18.0
- DB engine: MySQL (XAMPP `mysqld.exe`)
- DB host/port: `localhost:3306` (LISTENING)

## Commands Executed

1. `node -v` -> PASS (`v22.19.0`)
2. `pnpm -v` -> PASS (`10.18.0`)
3. `$PSVersionTable.PSVersion.ToString()` -> PASS (`7.5.4`)
4. `(Get-CimInstance Win32_OperatingSystem).Caption` -> PASS (`Microsoft Windows 11 Pro`)
5. `pnpm install` -> PASS  
   - Warning: deprecated subdependencies (`glob@10.4.5`, `glob@7.2.3`, `inflight@1.0.6`, `tar@7.5.1`)
6. `pnpm --filter server db:reset` -> PASS
7. `pnpm --filter server seed:super` -> PASS  
   - Output: super admin ready `superadmin@local.dev`
8. `pnpm --filter server seed:demo` -> PASS  
   - Output: categories/products/reviews seeded
9. `pnpm dev` (smoke runtime check via background job) -> PASS  
   - Client up on `http://localhost:5173`
   - Server up on `http://localhost:3001`
10. Manual MVF smoke script (HTTP + route checks) -> PASS (`26/26`)
11. `pnpm qa:mvf` -> PASS  
    - `QA-MONEY: PASS`
    - MVF QA checks all PASS
    - Artifacts:
      - `.codex-artifacts/qa-mvf/20260303-002635/result.json`
      - `.codex-artifacts/qa-mvf/20260303-002635/summary.txt`

## Services

- Client URL: `http://localhost:5173`
- Server URL: `http://localhost:3001`
- Health endpoint: `http://localhost:3001/api/health` -> PASS (`ok: true`, `db: connected`)

## MVF Smoke Result

### Store MVF

- Home `/` -> PASS
- Search route `/search?q=apple` -> PASS
- Search results (`apple`) -> PASS (`items=1`)
- Empty state search (`zzzzzzzz`) -> PASS (`items=0`)
- Product detail route `/product/:slug` -> PASS (`/product/organic-banana`)
- Add to cart -> PASS
- Cart qty plus -> PASS (`qty=2`)
- Cart qty minus -> PASS (`qty=1`)
- Remove from cart -> PASS
- Cart route `/cart` -> PASS
- Checkout route `/checkout` -> PASS
- Checkout submit (POST `/api/store/orders`) -> PASS  
  - Order ref generated: `STORE-1772468783886-825`
- Success route `/checkout/success?ref=...` -> PASS
- Tracking route `/order/:ref` -> PASS
- Tracking API `/api/store/orders/:ref` -> PASS (resolved ref match)

### Admin MVF

- Admin login route `/admin/login` -> PASS
- Admin login API (`/api/auth/admin/login`) -> PASS  
  - Credential used: `superadmin@local.dev / supersecure123`
- Orders list `/api/admin/orders` -> PASS (`items=2`)
- Order detail `/api/admin/orders/:ref` -> PASS
- Update status `PATCH /api/admin/orders/:ref/status` -> PASS (`pending -> processing`)
- Refresh/persist check `/api/admin/orders/:ref` -> PASS (`processing` persisted)
- Admin orders route `/admin/orders` -> PASS

## Blocking Issues

- None blocking after fresh baseline run.
- Note (resolved during verification): an early smoke attempt failed due transient runtime context; rerun on clean `pnpm dev` session passed fully.

## Suspected Root Causes (Hypothesis, No Fix Applied)

- Early transient failure likely from mixed runtime/process state across prior dev sessions, not from reproducible code defect.
- Baseline behavior is stable when DB reset/seed is executed first, then a fresh dev stack is started.

## Next Recommended Task

1. Add deterministic baseline command wrapper (single script) for `install -> db reset/seed -> dev health -> mvf smoke` to avoid process-state drift.
2. Freeze and document seeded test accounts/data in one canonical location (`README`/`DEVELOPMENT`) to standardize QA runs.
3. Add lightweight preflight check for busy ports (`3001/5173`) before smoke execution to reduce false negatives.

## STOP

- Task #0 completed.
- No code/app file changes performed.
- Ready for next Task Prompt.
