# SELLER-S1C - Seller Finance Information Architecture Baseline

Date: 2026-03-12
Scope: tidy the baseline seller finance information architecture in Seller Workspace without changing backend contracts, removing legacy lanes, or introducing new finance modules.

## Goal

Make seller finance and payment navigation feel intentional so payment review no longer appears as an isolated add-on and future seller finance work has a clearer baseline.

## Repo audit before coding

Files audited:

- `client/src/layouts/SellerLayout.jsx`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- `CODEx_REPORTS/SELLER-S1A-boundary-hardening-2026-03-12.md`
- `CODEx_REPORTS/SELLER-S1B-native-payment-review-cutover-2026-03-12.md`
- seller page and report references related to `orders`, `payment review`, `payment profile`, `finance`, `settlement`, and `payout`

## Navigation before

Seller sidebar baseline before this task:

- `Overview`
  - Overview
  - Store Profile
- `Commerce`
  - Catalog
  - Orders
  - Payment Review
  - Payment Profile
- `Workspace`
  - Team
  - Team Audit
  - Coupons

Observed issue:

- `Payment Review` and `Payment Profile` lived inside `Commerce`, which made the finance/payment domain feel mixed into product and order lanes without a clear seller-finance baseline.
- `Payment Profile` label also leaned toward older account-style wording instead of seller finance wording.

## Changes made

### Navigation grouping

- Kept the overall sidebar structure intact.
- Split `Commerce` into lighter domain groups:
  - `Commerce`
    - Catalog
  - `Operations`
    - Orders
  - `Finance`
    - Payment Review
    - Payment Setup

### Label alignment

- Sidebar label changed from `Payment Profile` to `Payment Setup`.
- Finance-related page meta and visible copy now use `Finance` / `Payment Setup` wording where it improves clarity without changing routes.

### Page-title alignment

- `Payment Review` now presents itself as a seller finance lane.
- `Payment Profile` page copy now frames the screen as seller finance setup while keeping the existing route and backend contract unchanged.

## Why this grouping

- `Orders` belongs to seller operations because it is about fulfillment and suborder handling.
- `Payment Review` belongs to finance because it is seller-side proof review and settlement oversight, not catalog or general commerce browsing.
- `Payment Setup` belongs to finance because it describes payment readiness and admin review status for the store payment destination.
- This baseline keeps room for future finance lanes like payout or settlement without adding them prematurely now.

## Files changed

- `client/src/layouts/SellerLayout.jsx`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- `CODEx_REPORTS/SELLER-S1C-finance-ia-baseline-2026-03-12.md`

## Risks

- `Payment Setup` is a better seller label, but the underlying route remains `/payment-profile`, so naming is improved at the UI layer first rather than through a route rename.
- `Workspace` still contains `Coupons` as a placeholder because broader seller IA cleanup is outside this task.

## Not touched on purpose

- No backend change
- No admin or storefront change
- No route namespace refactor
- No payout or settlement module addition
- No legacy lane removal
- No permission model change

## Verification

Planned verification for this task:

- `pnpm --filter client build`
- `pnpm qa:mvf` only to confirm whether the same unrelated pre-existing QA failure still remains
