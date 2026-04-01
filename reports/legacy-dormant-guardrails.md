# Legacy / Dormant Checkout-Payment Guardrails

## Active Source Of Truth
- Storefront checkout UI: `client/src/pages/store/Checkout.jsx`
- Order lifecycle selector: `client/src/utils/orderContract.ts`
- Grouped payment selector: `client/src/utils/groupedPaymentReadModel.ts`
- Grouped payment backend read model: `server/src/services/groupedPaymentReadModel.service.ts`

## Removed Dormant Paths
- `client/src/pages/store/StoreCheckoutPage.jsx`
  - Old single-order storefront checkout page.
  - Not mounted in `client/src/App.jsx`.
- `client/src/pages/account/AccountStorePaymentProfilePage.jsx`
  - Dormant legacy account seller-payment setup page.
  - Active route already points to `AccountLegacySellerRoutePage`.
- `client/src/pages/account/AccountStorePaymentReviewPage.jsx`
  - Dormant legacy account payment-review page.
  - Active route already points to `AccountLegacySellerRoutePage`.

## Deprecated But Kept
- `POST /api/store/orders`
  - Kept for compatibility.
  - Do not use for new storefront checkout work unless there is an explicit compatibility requirement.
- `AccountLegacySellerRoutePage`
  - Kept as a sunset barrier that redirects users away from old account-based seller finance lanes.

## Frontend Truth Rules
- Do not derive order lifecycle, payment finality, or CTA validity in frontend.
- Prefer `contract.statusSummary`, `contract.availableActions`, and contract meta selectors.
- Prefer `paymentReadModel` / `readModel` for split payment state.
- Raw fields like `payment.status`, `payment.displayStatus`, and `group.paymentStatus` are compatibility fallback only.

## Guardrail Intent
- If grouped payment payload arrives without backend `paymentReadModel`, `client/src/utils/groupedPaymentReadModel.ts` emits a dev warning once.
- `client/src/api/storeOrders.ts` no longer exposes the legacy `createStoreOrder` client helper.
- Comments in active selector files and backend legacy route mark the intended source of truth for future tasks.
