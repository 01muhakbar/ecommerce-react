# P0 Admin Online Store UI Sync Polish - 2026-05-20

## Summary

Audited the Admin Online Store surfaces, related frontend API clients, backend routes/services, and Seller/Client sync lanes. Implemented a scoped production UI polish for the four highest-impact P0 admin pages without changing routes, backend contracts, database schema, auth, checkout, payment methods, or shipping methods.

## Files Changed

- `client/src/pages/admin/AdminStorePaymentProfilesPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminStoreApplicationsPage.jsx`
- `client/src/pages/admin/AdminShippingReconciliationPage.jsx`
- `reports/p0-admin-online-store-ui-sync-polish-2026-05-20-report.md`

## Before / After Behavior

- Store Payment admin now shows compact metrics for active-ready profiles, pending seller requests, and admin action count. QRIS panels now clearly show available/missing state, and seller readiness is shown as a compact progress card.
- Payment Audit admin now has visible split metrics and a compact split-status block for paid, review, not-confirmed, and rejected counts.
- Store Applications admin now shows onboarding queue metrics, visual completeness progress, clearer step/status chips, and a stronger Review action.
- Shipping Reconciliation admin now shows scanned-order and exception metrics, top category chips, and a reassuring empty state when current filters are clean.

## Backend Sync Confirmation

- No backend files changed.
- Admin payment profile UI still reads `workflow`, `paymentProfile`, `pendingRequest`, and `workspaceReadiness` from `/admin/stores/payment-profiles`.
- Payment audit UI still reads parent state and operational split counts from `/admin/payments/audit`.
- Store applications UI still reads backend-owned status/completeness/action governance from `/admin/store-applications`.
- Shipping reconciliation UI still reads `meta.scannedOrders`, `meta.categoryCounts`, and exception rows from `/admin/orders/shipping-reconciliation/report`.

## Admin / Seller / Client Impact

- Admin: presentation is more compact; existing actions remain available.
- Seller: no seller files or seller API contracts changed. Seller still cannot self-activate payment/profile/application state.
- Client: no storefront or checkout files changed. Store readiness remains backend-gated by `Store.status = ACTIVE` plus active approved payment profile.
- Checkout payment profile pending/inactive/rejected states remain excluded by existing backend readiness/payment availability contracts.

## Commands Run

- `pnpm --filter client build`
  - Failed locally because PowerShell blocked `pnpm.ps1` execution.
- `pnpm.cmd --filter client build`
  - Passed.
- `pnpm.cmd qa:mvf:store-readiness`
  - Passed.
- `pnpm.cmd qa:mvf:order-payment`
  - Passed.
- `pnpm.cmd qa:shipping:release`
  - Passed.
- `pnpm.cmd qa:admin:public-auth`
  - Failed in existing public-auth frontend smoke at locator `getByRole('button', { name: 'Send reset link' })` after forgot-password step. This task did not touch auth pages.
- `git diff --check`
  - Passed.

## Result

Client build and the relevant MVF/store-readiness/order-payment/shipping release smoke suites pass. Admin online-store P0 pages are more scannable and remain backend-driven.

## Risks

- `qa:admin:public-auth` failure should be followed up separately because it points to an auth UI smoke locator/copy mismatch outside this task scope.
- The four secondary admin pages were audited but not modified to keep this P0 pass under the safe file-change threshold and avoid broad UI churn.

## Follow-Up Recommended

- Run a focused auth smoke fix for the `Send reset link` locator/copy mismatch.
- Do a later, separate polish pass for `/admin/settings`, `/admin/store/customization`, `/admin/online-store/store-profile`, and `/admin/store/store-settings`.
