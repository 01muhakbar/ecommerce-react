# SELLER-F1A — Seller Finance/Payout MVP Mapping

## Goal
Map the real seller finance domain in the active repo, clarify seller/admin boundary, and decide whether payout MVP is already feasible or still needs a foundation phase.

## Repo audit before coding
- Seller routes
  - `server/src/routes/seller.payments.ts`
  - `server/src/routes/seller.paymentProfiles.ts`
  - `server/src/routes/seller.orders.ts`
  - `server/src/routes/seller.workspace.ts`
- Admin routes
  - `server/src/routes/admin.payments.audit.ts`
  - `server/src/routes/admin.storePaymentProfiles.ts`
- Seller UI/API
  - `client/src/pages/seller/SellerPaymentReviewPage.jsx`
  - `client/src/pages/seller/SellerPaymentProfilePage.jsx`
  - `client/src/layouts/SellerLayout.jsx`
  - `client/src/api/sellerPayments.ts`
  - `client/src/api/sellerOrders.ts`
  - `client/src/api/sellerPaymentProfile.ts`
- Model/domain
  - `server/src/models/Payment.ts`
  - `server/src/models/PaymentProof.ts`
  - `server/src/models/PaymentStatusLog.ts`
  - `server/src/models/Suborder.ts`
  - `server/src/models/StorePaymentProfile.ts`

## Domain map

### A. Payout / settlement data model
- No explicit `Payout`, `Settlement`, `Ledger`, `Balance`, `Withdrawal`, or `Payable` entity exists in the active model layer.
- Existing finance source-of-truth is fragmented across:
  - `StorePaymentProfile` for payment destination readiness
  - `Suborder.paymentStatus` for seller split payment state
  - `Payment` and `PaymentProof` for buyer proof and review lifecycle
  - `PaymentStatusLog` for audit trail
- This is enough for payment review and readiness visibility, but not enough for payout lifecycle.

Classification:
- payout/settlement model: `butuh foundation besar`
- payment profile readiness: `read-only foundation`
- payment review: `phase-1 usable`
- seller order finance implication: `read-only operational foundation`

### B. Seller finance visibility boundary
- Seller can currently view:
  - payment review rows per store via `/api/seller/stores/:storeId/payment-review/suborders`
  - payment setup snapshot via `/api/seller/stores/:storeId/payment-profile`
  - order/suborder payment state via seller orders pages
- These lanes are store-scoped and tenancy-aware.
- Multi-store ambiguity is handled safely in workspace routes because store context comes from the seller route.
- Legacy account payment review/profile paths still exist for compatibility, but seller-native finance entry is already in workspace.

Classification:
- payment review visibility: `sudah operasional`
- payment setup visibility: `read-only foundation`
- payout visibility: `belum ada`

### C. Seller vs admin authority boundary
- Seller active finance authority:
  - payment proof review on store payments, limited to `STORE_OWNER` / `STORE_ADMIN`
  - finance viewers and order managers can inspect, not mutate
- Seller non-authority:
  - no payout request
  - no withdrawal request
  - no settlement confirmation
  - no balance release
  - no payment profile write in seller workspace
- Admin active finance authority:
  - store payment profile verification/activation
  - payment audit list/detail
  - payment proof/admin-side review visibility

Classification:
- seller finance authority: `sempit tapi jelas`
- payout lifecycle authority: `belum dimodelkan`
- admin finance governance: `aktif untuk payment audit/profile review, bukan payout`

### D. Payment profile / readiness boundary
- Seller payment setup page is explicitly a read-only readiness snapshot.
- It depends on admin verification state and existing account/admin edit lane.
- It is useful as a future payout prerequisite gate, but it is not a payout lane by itself.
- It does not express payout eligibility, settlement cutoff, payable amount, or withdrawal readiness.

Classification:
- payment setup as payout prerequisite signal: `read-only foundation`
- payment setup as payout module: `belum siap`

### E. Payment review / order settlement relation
- Payment review currently means buyer proof review against store-scoped payment records.
- Seller orders expose payment state and fulfillment state, but there is no payable aggregation or settlement eligibility calculation.
- `PAID` on split payment is operationally useful, but there is no domain object that turns paid suborders into seller balance or payout-ready funds.

Classification:
- payment review -> order payment consistency: `phase-1 usable`
- payment review -> payout eligibility: `rawan sedang`
- settlement source of truth for payout: `belum ada`

### F. UX / IA finance boundary
- Seller Workspace finance IA is clearer than before:
  - `Payment Review`
  - `Payment Setup`
- This is enough as a finance baseline, but not enough as a payout MVP because there is no lane for:
  - balance summary
  - payout history
  - payout request
  - settlement statement
- The risk is not UI clarity anymore; the risk is missing finance domain source-of-truth.

Classification:
- seller finance IA baseline: `phase-1 usable`
- payout IA readiness: `belum siap tanpa foundation`

## Most realistic payout MVP from the current repo
- The safest conclusion is: **repo is not ready for payout request MVP yet**.
- The most realistic next MVP is not withdrawal or payout request.
- The most realistic next MVP is:
  1. seller finance readiness + settlement visibility
  2. a store-scoped payout summary snapshot derived from eligible paid suborders
  3. optional payout history only if a payout entity exists afterward

Recommended MVP shape from the current repo:
- `Payout readiness + payable summary snapshot`
- Not:
  - payout request manual
  - withdrawal workflow
  - approval/release lifecycle

Reason:
- There is still no entity or lifecycle for payout events.
- Without that, any payout request lane would only be a UI shell without a trustworthy domain source-of-truth.

## Small hardening done in this task
- Seller finance copy now explicitly states that payment setup and payment review do **not** represent payout balance or settlement statements.
- This reduces UX drift while payout domain is still absent.

## Why this stops short of payout implementation
- Opening payout MVP directly would require at least one of:
  - payout request entity
  - payable/settlement aggregation source-of-truth
  - payout status lifecycle
  - admin review/release handling for payout
- None of those exist as active domain objects today.

## Recommended next-step sequence
1. Foundation: define seller payable / settlement snapshot per store.
2. Bridge: expose seller finance summary page with read-only payout readiness and eligible amount.
3. Lifecycle: add explicit payout entity/history only after summary semantics are stable.
4. Workflow: add payout request lane after authority and admin review gates are explicit.

## Verification
- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm qa:mvf` still fails on the pre-existing `QA-MONEY` issue in `client/src/pages/seller/SellerStoreProfilePage.jsx`
