# P0 Admin Payment Readiness + Payment Audit UI/UX Sync

Date: 2026-05-25

## Summary

Patch ini fokus hanya pada:

- `/admin/store/payment-profiles`
- `/admin/online-store/payment-audit`

Perubahan utama:

- Admin Store Payment mendapat quick filter readiness: all, action needed, checkout ready, pending review, revision, incomplete.
- Payment profile summary cards dibuat lebih operasional: active ready, pending review, needs revision, incomplete.
- Payment Audit mendapat risk queue: urgent, proof review, mismatch, blocked, clear.
- Payment Audit menampilkan most urgent row dan kolom risk per order.
- Tidak ada perubahan payment lifecycle, checkout flow, DB schema, payment provider, atau route canonical.

## Files Changed

- `client/src/pages/admin/AdminStorePaymentProfilesPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `reports/p0-admin-payment-readiness-audit-ui-sync-20260525-report.md`

## Routes Checked

- `/admin/store/payment-profiles`
- `/admin/online-store/payment-audit`
- `/admin/online-store/payment-audit/:orderId`
- `/seller/stores/:storeSlug/payment-profile`
- `/seller/stores/:storeSlug/payment-review`
- Storefront checkout/cart readiness usage through backend contracts.

## Existing Features Observed

- Admin payment profiles already read `GET /api/admin/stores/payment-profiles`.
- Admin review actions already use `PATCH /api/admin/stores/:storeId/payment-profile/review`.
- Seller payment setup already separates seller request draft/submission from admin final approval.
- Seller payment review already handles buyer proof approval/rejection from the seller finance lane.
- Client cart/checkout already gates products through active store and payment profile readiness.
- Payment audit list already reads parent order state, store split state, proof review, and operational counts.

## Admin Impact

- Payment readiness is easier to scan without reading every QRIS/profile card.
- Admin can quickly isolate action-needed, pending review, revision, incomplete, and checkout-ready stores.
- Payment audit rows now show risk labels derived from existing order/suborder/payment counts.
- The audit page can highlight the most urgent visible row without changing backend status.

## Seller Impact

- No Seller Workspace code was changed.
- Seller payment profile flow remains request-based: seller prepares/submits, admin approves or asks revision.
- Seller payment review remains the proof review lane.

## Client Impact

- No Storefront or checkout code was changed.
- Checkout readiness remains backend-gated by active approved payment profile and store/product visibility.
- New Admin labels reflect existing readiness and audit state only; they do not introduce client-facing behavior.

## Backend/API Impact

- No backend file was changed in this patch.
- No API response contract was changed.
- No lifecycle/status enum was changed.
- Payment audit risk is computed in frontend from existing `operationalCounts`, `paymentStatus`, and list row data.

## Tests

Build:

- `pnpm.cmd -F client build` passed.
- `pnpm.cmd -F server build` passed.

Smoke:

- `pnpm.cmd -F server smoke:admin-store-payment-profiles` passed after starting local server.
- `pnpm.cmd -F server smoke:store-readiness` passed.
- `pnpm.cmd -F server smoke:order-payment` passed.

Notes:

- First `smoke:admin-store-payment-profiles` attempt failed with `TypeError: fetch failed` and `ECONNREFUSED` because `http://localhost:3001` was not running.
- A temporary local server was started for smoke tests and stopped after verification.
- `git diff --check` passed.

## Risks

- Payment profile quick filters are page-local/client-side because the current admin API returns the full list without backend status aggregate.
- Payment audit risk filters are page-local/client-side and operate on the currently loaded page.
- Payment Audit has no dedicated smoke script; coverage came from `smoke:order-payment` and `smoke:store-readiness`.
- Browser screenshot QA was not run in this patch.

## Next Recommended Task

Continue with `/admin/online-store/shipping-reconciliation` to align shipping risk hierarchy with the payment audit risk model, while keeping order/payment/shipping lifecycle untouched.
