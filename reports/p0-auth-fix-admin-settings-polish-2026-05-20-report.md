# P0 Auth Fix + Admin Settings Polish Report - 2026-05-20

## Summary

- Fixed the admin public auth QA failure by restoring the forgot-password submit button accessible name to `Send reset link`.
- Continued safe UI polish for `/admin/settings`, `/admin/store/customization`, `/admin/online-store/store-profile`, and `/admin/store/store-settings`.
- Kept the work frontend-only. No backend route, service, API contract, auth flow, payment flow, shipping flow, or database schema changed.

## Root Cause qa:admin:public-auth Failure

The QA smoke at `tools/qa/admin-public-auth-frontend-smoke.ts` locates the forgot-password button with `getByRole("button", { name: "Send reset link" })`.

`client/src/pages/admin/AdminForgotPasswordPage.jsx` had changed the visible submit label to `Recover password`, so the role/name locator could not find the expected button. The route and mocked reset-password response were still valid.

Fix: restored the visible loading/default labels to `Sending reset link...` and `Send reset link`.

## Files Changed

- `client/src/pages/admin/AdminForgotPasswordPage.jsx`
- `client/src/pages/Settings.jsx`
- `client/src/pages/admin/StoreCustomization.jsx`
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `client/src/pages/admin/StoreSettings.jsx`
- `reports/p0-auth-fix-admin-settings-polish-2026-05-20-report.md`

## Before/After Behavior

Before:
- Admin forgot password QA failed because the expected `Send reset link` button name was no longer present.
- Settings and store admin pages had long helper copy and weaker at-a-glance readiness signals.

After:
- Admin forgot password keeps the existing reset flow and exposes the expected button label again.
- Settings shows compact summary cards for brand assets, workspace brand, and SMTP readiness.
- Store Customization shows active tab, language, and load/save state before the tab list.
- Store Profile shows compact counts for active stores, public-ready stores, completeness, and shipping readiness.
- Store Settings shows checkout availability, payment toggles, public tools, and validation status before detailed fields.

## Backend Sync Confirmation

- No backend files were changed.
- Admin settings still use the existing `fetchAdminSettings`, `updateAdminSettings`, `fetchAdminStoreSettings`, and `updateAdminStoreSettings` flows.
- Store Customization still writes only the active language/tab through the existing admin customization update flow.
- Store Profile still reads and updates through the existing admin store profile API.
- Store Settings still relies on backend diagnostics for checkout-visible payment methods.

## Admin/Seller/Client Impact

- Admin: public auth QA is restored; admin settings pages are easier to scan without changing actions or payloads.
- Seller: workspace brand and store/profile state remain sourced from the same backend settings and store profile contracts.
- Client: storefront readiness and checkout payment visibility remain backend-driven; inactive stores and invalid/disabled payment methods are not promoted by these UI-only changes.

## Commands Run

- `pnpm.cmd qa:admin:public-auth` - passed.
- `pnpm.cmd --filter client build` - passed, with existing large chunk warning.
- `pnpm.cmd qa:mvf:store-readiness` - passed.
- `pnpm.cmd qa:mvf:order-payment` - passed.
- `pnpm.cmd qa:shipping:release` - first run timed out at 184s; rerun failed because port `127.0.0.1:3001` was still occupied from the interrupted run; final clean rerun passed.
- `git diff --check` - passed.

## Results

- Auth QA blocker is fixed.
- Client build is green.
- MVF readiness, order/payment sync, and shipping release QA are green on final run.
- No dummy data, routing rewrite, backend contract change, or schema change was introduced.

## Remaining Risks

- `qa:shipping:release` is long-running and can leave port contention if interrupted by a timeout. The final rerun passed after the stale listener cleared.
- The Store Customization page remains large; this task intentionally limited changes to a summary polish layer instead of refactoring the form internals.

## Recommended Next Task

Run a browser visual pass on the eight Admin Online Store pages at desktop and tablet widths, then tighten any spacing/text overflow found in real screenshots.
