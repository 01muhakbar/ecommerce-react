# SMOKE-ENV-RECHECK-01 Report

## Health check

- Target health endpoint: `http://localhost:3001/api/health`
- Effective `BASE_URL` for smoke scripts: `http://localhost:3001`
  - Source: smoke scripts default to `process.env.BASE_URL || "http://localhost:3001"`
  - `server/.env` does not override `BASE_URL`
- Health status before smoke: `HEALTHY`
- Health response:

```json
{"ok":true,"uptime":7,"db":"connected","timestamp":"2026-04-02T01:06:24.220Z"}
```

## Commands run

- `Invoke-WebRequest -UseBasicParsing 'http://localhost:3001/api/health'`
- `pnpm -F server smoke:order-payment`
- `pnpm -F server smoke:stripe-webhook`

## Smoke results

### 1. `pnpm -F server smoke:order-payment`

- Result: `PASSED`
- Outcome summary:
  - PASS checkout guardrail conflict coverage
  - PASS approve scenario initial state
  - PASS approve scenario pending confirmation
  - PASS approve scenario cross-lane sync
  - PASS reject scenario cross-lane sync
  - PASS expiry scenario cross-lane sync
  - Final status: `OK`
- Category: `passed`

### 2. `pnpm -F server smoke:stripe-webhook`

- Result: `PASSED`
- Outcome summary:
  - PASS stripe webhook settings persisted
  - PASS signed stripe webhook accepted
  - PASS webhook finalizes unpaid stripe order
  - PASS duplicate webhook stays idempotent
  - PASS invalid webhook signature rejected
  - Final status: `OK`
- Category: `passed`

## Final categorization

- Overall status: `passed`
- Failure category: none
- Not categorized as:
  - `environment issue`
  - `assertion failure`
  - `flaky infra`

## Conclusion

Environment blocker is no longer present for this rerun:

- Local health endpoint responds successfully
- Database is connected
- Both backend smoke suites now pass
