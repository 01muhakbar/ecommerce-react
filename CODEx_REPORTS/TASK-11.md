# TASK-11 — Public Offers API + Storefront Offers Page (/offers)

## File Changed List
1. `server/src/routes/store.customization.ts`
- Added `include=offers` support.
- Extended strict whitelist response builder to optionally return only `offers` block.

2. `client/src/pages/store/StoreOffersPage.jsx`
- Replaced static demo offers with public customization fetch (`include=offers`).
- Implemented full state contract:
  - loading skeleton
  - error + retry
  - empty
  - disabled (`pageHeader.enabled === false` and `superDiscount.enabled === false`)
- Implemented offers render:
  - hero header using `pageHeader.backgroundImageDataUrl` + `pageTitle`
  - active coupon highlight card
  - `ALL` => `All items are selected.`
  - specific code => `Active coupon: CODE`
  - optional `Copy code` button (UI-only)

3. `client/src/App.jsx`
- No change required in this task because route `/offers` was already present and active.

4. `CODEx_REPORTS/TASK-11.md`
- Task report.

## API include=offers (Whitelist)
Endpoint:
- `GET /api/store/customization?lang=en&include=offers`

Behavior checks:
1. Default (no include)
- Request: `GET /api/store/customization?lang=en`
- Keys returned: `aboutUs`

2. Offers only
- Request: `GET /api/store/customization?lang=en&include=offers`
- Keys returned: `offers`

3. Combined include
- Request: `GET /api/store/customization?lang=en&include=aboutUs,offers`
- Keys returned: `aboutUs, offers`

Sample response (`include=offers`):
```json
{
  "success": true,
  "lang": "en",
  "customization": {
    "offers": {
      "pageHeader": {
        "enabled": true,
        "backgroundImageDataUrl": "data:image/png;base64,...",
        "pageTitle": "Mega Offer TASK11 2026-03-03"
      },
      "superDiscount": {
        "enabled": true,
        "activeCouponCode": "ALL"
      }
    }
  }
}
```

## Route
- Store route: `/offers`
- Route health check:
  - `offers_route_status=200`

## Sync Test (Admin -> Store)
Admin update via existing endpoint:
- `PUT /api/admin/store/customization?lang=en` with:
  - `offers.pageHeader.pageTitle = Mega Offer TASK11 Sync 2026-03-03`
  - `offers.superDiscount.activeCouponCode = TASK11SYNC`

Public read verification:
- `GET /api/store/customization?lang=en&include=offers`
- Result:
  - `sync_store_title=Mega Offer TASK11 Sync 2026-03-03`
  - `sync_store_coupon=TASK11SYNC`

Reset verification:
- Set `activeCouponCode=ALL`
- Result:
  - `sync_store_coupon_after_reset=ALL`

## Commands Output
1. `pnpm qa:mvf`
- PASS
- Artifact:
  - `RESULT_FILE=.codex-artifacts/qa-mvf/20260303-103936/result.json`
  - `SUMMARY_FILE=.codex-artifacts/qa-mvf/20260303-103936/summary.txt`

2. `pnpm --filter client exec vite build`
- PASS
- Vite build completed successfully.

## Known Gaps
1. `/offers` currently focuses on header + active coupon highlight only; no public coupon/product list is rendered.
2. Copy button uses browser clipboard API; in unsupported environments button does nothing.
3. Language selection is still fixed to `en` in this page (same pattern as other store policy pages).

## Recommended Task #12
1. Implement Store Customization `Contact Us` public endpoint include + storefront page binding.
2. Continue Checkout tab customization parity and storefront bind.
3. Add store language source wiring (dynamic lang in customization fetch).
