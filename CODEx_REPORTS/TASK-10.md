# TASK-10 — Store Customization Offers

## Discovery
- Backend file confirmed: `server/src/routes/admin.storeCustomization.ts`
- Frontend file confirmed: `client/src/pages/admin/StoreCustomization.jsx`
- Coupons API status: **Available** (`GET /api/admin/coupons`) and reusable via `fetchAdminCoupons`.
- Dropdown strategy selected: **Fetch coupon list from admin API** (no new endpoint, no auth flow change).

## File Changed List
1. `server/src/routes/admin.storeCustomization.ts`
- Added `offers` default schema under `DEFAULT_CUSTOMIZATION`.
- Added `normalizeOffers(root)`.
- Wired `offers` into `sanitizeCustomization()` output.

2. `client/src/pages/admin/StoreCustomization.jsx`
- Added frontend default + normalization for `offers`.
- Added `offersState` state slice and save payload wiring (`onSave`).
- Added image upload handlers for Offers page header (drag-drop, input, preview, remove).
- Added coupons query (`fetchAdminCoupons`) for dropdown option population.
- Implemented `activeTab === "offers"` UI:
  - Section `Page Header` (Enable toggle, BG upload, Page Title)
  - Section `Super Discount Active Coupon Code` (Enable toggle, select + clear)

3. `CODEx_REPORTS/TASK-10.md`
- Task report.

## Final Schema Offers
```json
{
  "offers": {
    "pageHeader": {
      "enabled": true,
      "backgroundImageDataUrl": "",
      "pageTitle": "Mega Offer"
    },
    "superDiscount": {
      "enabled": true,
      "activeCouponCode": "ALL"
    }
  }
}
```

Normalization rules implemented:
- `enabled` => boolean
- `backgroundImageDataUrl` => string fallback `""`
- `pageTitle` => string fallback default
- `activeCouponCode` => string fallback `"ALL"`, normalized uppercase

## Persist Test Checklist
- Title update persist: **PASS**
  - `offers.pageHeader.pageTitle` updated to `Mega Offer TASK10 2026-03-03` and remains after GET refresh.
- Background image DataURL persist: **PASS**
  - `offers.pageHeader.backgroundImageDataUrl` saved and reloaded (`length=114`).
- Coupon code persist: **PASS**
  - custom `task10promo` persisted as normalized `TASK10PROMO`.
  - reset back to `ALL` persisted.

## Commands Output
1. `pnpm --filter client exec vite build`
- **PASS**
- Vite production build completed successfully.

2. `pnpm qa:mvf`
- **PASS**
- Artifact:
  - `RESULT_FILE=.codex-artifacts/qa-mvf/20260303-102418/result.json`
  - `SUMMARY_FILE=.codex-artifacts/qa-mvf/20260303-102418/summary.txt`

3. Manual API checks (admin auth + customization)
- `GET /api/admin/coupons?page=1&limit=20` reachable (**PASS**).
- `GET /api/admin/store/customization?lang=zz` returns default `offers` (**PASS**).
- `PUT /api/admin/store/customization?lang=en` partial `offers` payload persists (**PASS**).

## Known Gaps
1. Current seed has `couponCount=0`, so dropdown mostly shows `ALL` until coupons are created.
2. Offers storefront rendering is not included (out of scope task #10).
3. No additional UI for manual custom code entry when coupon list empty (not required because API exists and `ALL` is valid).

## Recommended Next Task (#11)
1. Render Storefront Offers page from customization `offers` (public read-only flow).
2. Optionally extend public customization include whitelist for `offers`.
3. Add sync smoke for Admin Offers -> Store Offers display.
