# STAGING-REHEARSAL-01 — Real Environment Rehearsal Pass

Date: 2026-04-10

## Summary

Real staging rehearsal could not be executed from the current workspace because the target staging environment is not available here.

This is an operational blocker, not a product-domain blocker.

The repo is staging-ready from the previous pass, but this task specifically required proof on a real deployed target. That proof cannot be produced honestly without:

- an actual staging URL
- deploy access / credentials
- a known deployment path or platform
- staging env values applied on the real target

## What Was Checked

### Deployment target discovery

Audited local workspace for:

- deploy platform configuration files
- staging-specific URLs or env references
- deployment scripts
- authenticated deploy CLI presence

### Findings

- No deploy platform config was found for a real target environment.
- No staging URL was found in repo docs or env samples.
- No staging-specific env variables were present in the shell session.
- No deploy CLI was available from the current shell (`vercel`, `railway`, `fly`, `netlify`, `pm2`, `docker` not available).
- Git remote points only to the GitHub repository and does not provide a deploy target by itself.

## Real Rehearsal Status

### Deploy to staging target

- Not executed
- Blocked by missing target environment and missing deploy access

### Startup guard on real staging env

- Not executed on real target
- Only local production-like validation exists from prior passes

### `pnpm qa:staging:core` against real target

- Not executed against real target
- Still available and ready to run once `BASE_URL` and target deployment are provided

### Manual spot checks on real target

- Not executed
- Blocked because there is no reachable staging deployment in current context

## Residual Operational Blockers

- staging hostname / base URL is unknown
- deploy platform and deploy command are unknown
- runtime env source for staging is unknown
- cookie/CORS/HTTPS behavior cannot be validated without the real topology
- Stripe redirect/webhook behavior cannot be validated without the deployed target
- upload path/runtime filesystem assumptions cannot be validated without the target host/container

## Safe Next Step

To complete this rehearsal honestly, provide one of the following:

1. A reachable staging URL plus confirmation that the current code is already deployed there.
2. A deploy method available from this machine:
   - platform CLI already authenticated, or
   - SSH/server access, or
   - container/orchestration command path.
3. The real staging env values relevant to:
   - `CLIENT_URL` / `CORS_ORIGIN`
   - `COOKIE_SECURE`
   - `PUBLIC_BASE_URL` / `CLIENT_PUBLIC_BASE_URL` / `STORE_PUBLIC_BASE_URL`
   - DB connectivity
   - upload dir
   - shipment flags

Once those exist, the rehearsal steps are already prepared:

- deploy
- verify startup
- run `pnpm qa:staging:core`
- manual buyer / seller / admin spot check
- record final go / no-go

## Final Assessment

### Current decision

- Not ready to mark `STAGING-REHEARSAL-01` complete

### Reason

- Missing real staging target and deploy access

### Product readiness note

- This is not evidence of a repo defect.
- This is a deployment-context blocker.

The codebase remains ready for real staging rehearsal as soon as the target environment is provided.
