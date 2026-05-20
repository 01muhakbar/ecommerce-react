# P0 Seller Payment Setup Polish 05 Report

## Scope
- Target page: `/seller/stores/:storeSlug/payment-profile`
- UI file changed: `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- Backend files audited only:
  - `server/src/routes/seller.paymentProfiles.ts`
  - `server/src/routes/admin.storePaymentProfiles.ts`
- API adapter audited only:
  - `client/src/api/sellerPaymentProfile.ts`

## Amati
- Seller Payment Setup already uses the store-scoped seller payment profile contract:
  - `GET /seller/stores/:storeId/payment-profile`
  - `PUT /seller/stores/:storeId/payment-profile/request`
  - `POST /seller/stores/:storeId/payment-profile/request/submit`
  - existing `/upload` for QRIS image URL
- Existing lifecycle states are `DRAFT`, `SUBMITTED`, `NEEDS_REVISION`, active approved snapshot, and inactive/no setup.
- Admin remains final approval and promotion authority. Checkout reads only the approved active setup.
- Previous reports confirm this lane must keep draft/request/admin-review separate from checkout activation.

## Tiru
- Kept existing `SellerWorkspaceFoundation` cards, notices, badges, fields, query/mutation flow, permission guards, and upload behavior.
- Kept the current payload shape for save draft and submit.
- Kept QRIS URL as the saved field; no new upload backend or media contract was introduced.

## Modifikasi
- Reworked the status header into action-oriented seller copy:
  - `Ready for checkout`
  - `Waiting for admin review`
  - `Fix requested changes`
  - `Complete required info`
  - `Set up payment method`
- Reduced header badges to two chips.
- Updated required checklist states to `Complete`, `Missing`, `Pending`, and `Approved`.
- Made QRIS empty states clearer with `Upload QRIS` and `PNG or JPEG recommended`.
- Split editor fields into `Required info` and `Optional details`.
- Kept sticky action bar with clearer submit disabled reason.

## Sync Matrix
| Area | Contract yang dicek | Temuan | Perubahan UI | Risiko |
|---|---|---|---|---|
| Seller Payment Setup | seller payment profile API | Seller can save draft and submit request; active snapshot remains separate | Header, checklist, QRIS preview, compact form, action bar copy | Low: UI-only mapping from existing status/readModel |
| Admin Payment Review | admin store payment profile API | Admin reviews `SUBMITTED`, requests `NEEDS_REVISION`, or promotes approved snapshot | Copy says changes need admin approval | Low: no admin route or approval behavior changed |
| Checkout | approved payment setup | Checkout uses active approved payment setup, not draft/request | Copy says checkout uses approved setup | Low: no checkout destination logic changed |

## Files Changed
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`

## Validation
- `pnpm.cmd -F client build` PASS

## Notes
- No backend files changed.
- No database schema changed.
- No payment lifecycle or API contract changed.
- No permanent mock data added.
