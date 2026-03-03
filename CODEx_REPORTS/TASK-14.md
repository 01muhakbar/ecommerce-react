# TASK-14 — Store Customization "Checkout" (Backend + Admin UI)

## File Changed List
1. `server/src/routes/admin.storeCustomization.ts`
- Added `checkout` to `DEFAULT_CUSTOMIZATION`.
- Added `normalizeCheckout(root)` for full nested fallback normalization.
- Wired `checkout` into `sanitizeCustomization()` output.

2. `client/src/pages/admin/StoreCustomization.jsx`
- Added checkout defaults to `getDefaultCustomization()`.
- Added `normalizeCheckout(source, defaults)` and integrated into `normalizeCustomizationPayload()`.
- Added `checkoutState` lifecycle wiring (`load` + `update success`).
- Added `checkout` payload mapping into `onSave` to persist fields.
- Added `onChangeCheckoutField(sectionKey, field, value)` handler.
- Implemented full UI for `activeTab === "checkout"` (replacing fallback coming soon for this tab).

3. `CODEx_REPORTS/TASK-14.md`
- Final execution report.

## Final Schema Checkout
```json
{
  "checkout": {
    "personalDetails": {
      "sectionTitle": "Personal Details",
      "firstNameLabel": "First Name",
      "lastNameLabel": "Last Name",
      "emailLabel": "Email Address",
      "phoneLabel": "Phone",
      "firstNamePlaceholder": "First Name",
      "lastNamePlaceholder": "Last Name",
      "emailPlaceholder": "Email Address",
      "phonePlaceholder": "Phone Number"
    },
    "shippingDetails": {
      "sectionTitle": "Shipping Details",
      "streetAddressLabel": "Street Address",
      "cityLabel": "City",
      "countryLabel": "Country",
      "zipLabel": "Zip / Postal",
      "streetAddressPlaceholder": "Street Address",
      "cityPlaceholder": "City",
      "countryPlaceholder": "Country",
      "zipPlaceholder": "Zip Code",
      "shippingCostLabel": "Shipping Cost",
      "shippingOneNameLabel": "Shipping One Name",
      "shippingOneNameDefault": "FedEx",
      "shippingOneDescriptionLabel": "Shipping One Description",
      "shippingOneDescriptionDefault": "Delivery: Today Cost :",
      "shippingOneCostLabel": "Shipping One Cost",
      "shippingOneCostDefault": "60",
      "shippingTwoNameLabel": "Shipping Two Name",
      "shippingTwoNameDefault": "UPS",
      "shippingTwoDescriptionLabel": "Shipping Two Description",
      "shippingTwoDescriptionDefault": "Delivery: 7 Days Cost :",
      "shippingTwoCostLabel": "Shipping Two Cost",
      "shippingTwoCostDefault": "20",
      "paymentMethodLabel": "Payment Method",
      "paymentMethodPlaceholder": "Payment Method"
    },
    "buttons": {
      "continueButtonLabel": "Continue Shipping",
      "confirmButtonLabel": "Confirm Order"
    },
    "cartItemSection": {
      "sectionTitle": "Cart Item Section",
      "orderSummaryLabel": "Order Summary",
      "applyButtonLabel": "Apply",
      "subTotalLabel": "Sub Total",
      "discountLabel": "Discount",
      "totalCostLabel": "Total Cost"
    }
  }
}
```

## UI Field Checklist (Admin Checkout Tab)
### Personal Details
- [x] Section Title
- [x] First Name Label + Placeholder
- [x] Last Name Label + Placeholder
- [x] Email Label + Placeholder
- [x] Phone Label + Placeholder

### Shipping Details
- [x] Section Title
- [x] Street Address Label + Placeholder
- [x] City Label + Placeholder
- [x] Country Label + Placeholder
- [x] Zip Label + Placeholder
- [x] Shipping Cost Label
- [x] Shipping One Name/Description/Cost (Label + Default)
- [x] Shipping Two Name/Description/Cost (Label + Default)
- [x] Payment Method Label + Placeholder

### Buttons
- [x] Continue Button Label
- [x] Confirm Button Label

### Cart Item Section
- [x] Section Title
- [x] Order Summary Label
- [x] Apply Button Label
- [x] Sub Total Label
- [x] Discount Label
- [x] Total Cost Label

## Persist Test Result
### Backend default test (new language)
- Request: `GET /api/admin/store/customization?lang=qa14`
- Result:
  - `hasCheckout = true`
  - `checkout.personalDetails.sectionTitle = "Personal Details"`
  - `checkout.shippingDetails.shippingOneNameDefault = "FedEx"`

### Save + refresh persist test (en)
- Update fields via admin API (`PUT /api/admin/store/customization?lang=en`):
  - `checkout.personalDetails.sectionTitle = "Personal Details QA 20260303112506"`
  - `checkout.shippingDetails.cityPlaceholder = "City QA Placeholder"`
  - `checkout.buttons.confirmButtonLabel = "Confirm Order QA"`
- Re-fetch and verify: persisted `true`.
- Restore original values: done (`restored = true`).

### Admin route check
- `GET http://localhost:5173/admin/store/customization?tab=checkout` -> HTTP `200`.

## Commands Output
1. `pnpm --filter client exec vite build`
- PASS
- `vite v7.1.9`
- `✓ built in 14.92s`

2. `pnpm qa:mvf`
- PASS
- `QA-MONEY: PASS`
- Store/Admin MVF checks all PASS.
- Artifacts:
  - `RESULT_FILE=.codex-artifacts/qa-mvf/20260303-112433/result.json`
  - `SUMMARY_FILE=.codex-artifacts/qa-mvf/20260303-112433/summary.txt`

## Known Gaps
1. Tab checkout saat ini baru mengatur CMS text/settings; belum dibinding ke storefront checkout page (sesuai out-of-scope task ini).
2. Tidak ada validasi format khusus untuk field biaya shipping (disimpan string by design).
3. Tidak ada preview live hasil teks checkout di sisi admin (hanya form + persist).

## Recommendation for Task #15
1. Extend public store customization endpoint with `include=checkout` whitelist.
2. Bind storefront checkout page labels/placeholders/buttons/summary texts from `customization.checkout`.
3. Add fallback behavior per-language when checkout customization missing/partial on storefront.
