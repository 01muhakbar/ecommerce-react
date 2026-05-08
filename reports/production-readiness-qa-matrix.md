# Production Readiness QA Matrix

Updated: 2026-04-01

## Scope

This matrix validates the minimum viable cross-app truth for:

- Admin Workspace
- Seller Workspace
- Client Storefront / Account / Tracking / Success
- Backend API / serializer / helper contract

The backend remains the source of truth for:

- store operational readiness
- storefront product visibility
- checkout eligibility
- order status
- payment status
- actionability / available actions

## Validation Sources

- `pnpm -F server smoke:product-visibility`
- `pnpm -F server smoke:store-readiness`
- `pnpm -F server smoke:order-payment`
- `pnpm qa:mvf:visibility:frontend`
- `pnpm -F client build`
- `pnpm -F server build`
- targeted code audit of Admin/Seller/Client consumers

## QA Matrix

| ID | Scenario | Preconditions | Backend truth / endpoints | Expected Admin behavior | Expected Seller behavior | Expected Client behavior | Allowed CTA | Primary badge / label | Expected helper / empty / error state | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Store active + payment profile ready + product published => public visible | `Store.status=ACTIVE`, active payment profile `READY`, `Product.status=active`, `isPublished=true`, `sellerSubmissionStatus=none` | `buildPublicStoreOperationalReadiness`, `buildProductVisibilitySnapshot`, public listing/PDP, checkout preview | Product shows as storefront-visible; preview says live | Catalog item can stay published and visible | Product appears in public list/PDP; checkout preview group is eligible | Admin publish/unpublish, customer add-to-cart, checkout continue | Product visibility: visible / ready | No storefront block helper | Smoke: visibility + store-readiness |
| 2 | Store active but payment profile not ready => internal only | `Store.status=ACTIVE`, payment profile missing/inactive/not verified | same helpers; reason code becomes `STORE_NOT_READY` | Admin badge shows store-not-ready block, not live | Seller keeps internal published state but storefront visibility remains blocked | Public discovery/PDP blocked; checkout preview blocked | Internal admin/seller actions only; no public purchase CTA | `Store not ready` / `Published but store-not-ready` | Storefront block reason shown in Admin/Seller metadata | Smoke: visibility + store-readiness |
| 3 | Add-to-cart valid product | Product passes public visibility + purchasable | cart/add gate uses backend visibility helper | No special admin effect | No special seller effect | Add-to-cart succeeds | Add to cart | Purchasable / no error badge | No cart error | Existing hardening + smoke order-payment setup path |
| 4 | Add-to-cart invalid / store not ready | Product unpublished, inactive store, or otherwise not public | cart/add and checkout eligibility reject non-public products | Internal product still inspectable | Seller still sees internal catalog row | Customer cannot proceed to checkout with invalid line | Remove invalid item / back to storefront | Invalid item reason `PRODUCT_NOT_PUBLIC` | Honest invalid-item helper text in checkout | Smoke: order-payment guardrails + visibility |
| 5 | Checkout preview/create with valid payment method | Current MVF checkout page uses QRIS split lane and ready store profile | `/api/checkout/preview`, `/api/checkout/create-multi-store` | Admin later sees created order with pending/unpaid state | Seller sees suborder created with `UNPAID` / `UNFULFILLED` | Checkout preview shows `QRIS Ready`; create succeeds | Place order | Order starts `Pending` / payment `Unpaid` | Buyer guidance says QR shown after order placement | Smoke: order-payment approve/reject/expiry setup |
| 6 | Checkout with payment method invalid / unavailable | Backend store-order lane receives unsupported or unavailable method; current MVF split checkout UI does not expose arbitrary method picker | `/api/store/orders` returns `STORE_PAYMENT_METHOD_NOT_AVAILABLE` or `STORE_PAYMENT_METHOD_NOT_READY` | No admin order should be created | No seller order should be created | Current split checkout page only surfaces ready/not-ready QRIS state and blocks submit when store payment unavailable | None | Payment unavailable / blocked | `QRIS Blocked`, `Unavailable`, store warning card | Backend code audit + checkout UI audit; not covered by current smoke |
| 7 | Order unpaid but actionable | Fresh checkout before proof submission or rejected proof returned to unpaid | Buyer/admin contract `paymentActionability=ACTION_REQUIRED`, `availableActions` includes continue payment | Admin detail shows actionability still pending; invalid fulfillment transitions stay disabled | Seller suborder remains unpaid and fulfillment mutation blocked | Account/tracking show continue-payment action only when backend says actionable | `CONTINUE_PAYMENT` or `CONTINUE_STRIPE_PAYMENT`, `TRACK_ORDER` | `Awaiting payment` / `Unpaid` | Summary explains payment still actionable | Smoke: reject scenario + code audit |
| 8 | Order pending verification | Buyer submitted proof, seller/admin review pending | payment record `PENDING_CONFIRMATION`, suborder `PENDING_CONFIRMATION`, contract under-review | Admin audit/detail show pending confirmation consistently | Seller payment review list shows pending review item | Buyer grouped payment shows proof under review; no paid claim | Review actions in seller/admin only | `Awaiting Review` / `Under review` | Proof review note / waiting-review helper | Smoke: approve pending step |
| 9 | Order paid / final operationally settled | Proof approved or Stripe verified paid | parent payment becomes `PAID`; contract `paymentActionability=PAID`; order moves to `processing` if fulfillment not final | Admin order detail/list show `Processing` summary and paid payment state | Seller suborder payment is `PAID`; fulfillment lane opens forward transitions | Tracking/success/account no longer show payment CTA; paid state shown honestly | Track order; seller fulfillment transitions if valid | `Processing` + `Paid` | No “continue payment” helper | Smoke: approve scenario |
| 10 | Order expired / failed / cancelled | Payment expired or final non-actionable lane; cancellation if present follows final state contract | contract `statusSummary` final for expired/failed/cancelled; no payment action enabled | Admin sees final non-actionable summary; transitions blocked as applicable | Seller sees split payment final / blocked, no false actionable state | Tracking/success/account must not claim paid and must not show continue payment when backend closes lane | Track order only, or none if page is informational | `Expired`, `Failed`, or `Cancelled` | Honest final-state helper text | Smoke: expiry scenario; failed/cancelled code audit, no dedicated smoke fixture yet |
| 11 | Tracking page consistency | Public order reference valid | `/api/store/orders/:ref` buyer contract + split contracts | Admin not applicable directly | Seller not applicable directly | Tracking header, CTA, and finality come from backend contract; stepper remains presentational only | `TRACK_ORDER`; continue payment only if backend action exists | `contract.statusSummary.label` | Invalid ref, not found, and server error states remain explicit | Smoke: approve/reject/expiry + code audit |
| 12 | Success page consistency | Post-checkout success or Stripe return | success page reads verified/snapshot contract; Stripe CTA only when backend action exists | Admin not applicable directly | Seller not applicable directly | Success page must not claim paid unless backend says paid; Stripe retry CTA hidden when contract absent/non-actionable | Track order, My Orders, continue payment only if backend allows | `Payment Confirmed` or backend summary label | Missing ref / verification pending / status unavailable states are explicit | Code audit + client build; patched in this task |
| 13 | Seller order list/detail consistency | Seller accesses store-scoped suborder | seller serializer returns `contract`, `readModel`, `governance`, payment summary | Admin not primary consumer | Seller list/detail prefer backend contract for seller status, split payment, parent refs; fulfillment CTA from backend governance | Client not applicable | Backend-governed fulfillment actions only | Seller summary from `contract.statusSummary` | Mutation blocked reason shown when payment not settled/final | Smoke: approve/reject/expiry + code audit |
| 14 | Admin order list/detail consistency | Admin opens list/detail by invoice | admin serializer returns shared `contract` with available actions | Admin list/detail badge, helper text, and disabled transitions follow backend contract | Seller not primary consumer | Client not primary consumer | Only backend-declared actions | Admin primary badge from `contract.statusSummary` | Invalid transition errors surfaced via UI mapping | Smoke: order-payment + code audit |

## Mismatch Register

### Fixed Now

1. Stripe success page still showed retry CTA on verification/status error branches before backend confirmed actionability.
   - Fix: CTA now renders only when backend `availableActions` includes an enabled Stripe continue action.
   - File: `client/src/pages/store/StoreCheckoutSuccessPage.jsx`

### Deferred

1. Current MVF split checkout page exposes only the QRIS-ready lane.
   - Backend invalid/unavailable payment-method guards exist on `/api/store/orders`, but the current storefront checkout page does not expose a free-form method selector.
   - Result: scenario 6 is backend/code-audit validated, not smoke-covered through current UI.

2. Tracking stepper remains presentational.
   - Finality and CTA already follow backend contract.
   - The stepper still visualizes `order.status` progression, not a separate backend step contract.

### Needs Bigger Design / Refactor

1. Full browser-driven cross-app regression pack is still absent.
   - Existing validation is a mix of smoke API coverage, frontend guard script, build, and targeted code audit.
   - Adding full E2E coverage would require broader tooling and fixture orchestration.

## Regression Checklist

- Re-run all validation commands listed above.
- Re-check Admin product visibility badges for `STORE_NOT_READY` and `STORE_NOT_ACTIVE`.
- Re-check Seller order list/detail uses backend `contract` labels first.
- Re-check Account/Tracking/Success pages never show payment CTA without backend actionability.
- Re-check checkout preview blocks `paymentAvailable=false` groups and invalid items honestly.
