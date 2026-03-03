# TASK-15 — Public Checkout Customization API + Bind Storefront Checkout Labels/Placeholders

## File Changed List
1. `server/src/routes/store.customization.ts`
- Extend public include whitelist with `include=checkout`.
- Keep default backward behavior (`no include` => `aboutUs` only).

2. `client/src/pages/store/Checkout.jsx`
- Added non-blocking checkout customization fetch:
  - `getStoreCustomization({ lang: "en", include: "checkout" })`
- Added per-field fallback normalizer (`DEFAULT_CHECKOUT_COPY` + `normalizeCheckoutCopy`).
- Bound checkout UI text (section titles, labels, placeholders, summary labels, button labels).
- Kept checkout business logic unchanged (submit payload/totals/shipping calc/order flow).

3. `CODEx_REPORTS/TASK-15.md`
- Final report.

## API Change: include=checkout (Whitelist)
Endpoint: `GET /api/store/customization?lang=en&include=checkout`

Behavior validation:
- `GET /api/store/customization?lang=en`
  - `customization` keys => `aboutUs`
- `GET /api/store/customization?lang=en&include=checkout`
  - `customization` keys => `checkout`
- `GET /api/store/customization?lang=en&include=aboutUs,checkout`
  - `customization` keys => `aboutUs,checkout`

Example response shape (`include=checkout`):
```json
{
  "success": true,
  "lang": "en",
  "customization": {
    "checkout": {
      "personalDetails": { "sectionTitle": "Personal Details", "firstNameLabel": "First Name", "firstNamePlaceholder": "First Name" },
      "shippingDetails": { "sectionTitle": "Shipping Details", "streetAddressLabel": "Street Address", "shippingCostLabel": "Shipping Cost", "paymentMethodLabel": "Payment Method" },
      "buttons": { "continueButtonLabel": "Continue Shipping", "confirmButtonLabel": "Confirm Order" },
      "cartItemSection": { "sectionTitle": "Cart Item Section", "orderSummaryLabel": "Order Summary", "applyButtonLabel": "Apply", "subTotalLabel": "Sub Total", "discountLabel": "Discount", "totalCostLabel": "Total Cost" }
    }
  }
}
```

## Mapping Field (Source -> Target UI)
- `checkout.personalDetails.sectionTitle` -> section title "01".
- `checkout.personalDetails.firstNameLabel` -> label input first name.
- `checkout.personalDetails.firstNamePlaceholder` -> placeholder input first name.
- `checkout.personalDetails.lastNameLabel` -> label input last name.
- `checkout.personalDetails.lastNamePlaceholder` -> placeholder input last name.
- `checkout.personalDetails.emailLabel` -> label input email.
- `checkout.personalDetails.emailPlaceholder` -> placeholder input email.
- `checkout.personalDetails.phoneLabel` -> label input phone.
- `checkout.personalDetails.phonePlaceholder` -> placeholder input phone.
- `checkout.shippingDetails.sectionTitle` -> section title "02".
- `checkout.shippingDetails.streetAddressLabel` -> label input street.
- `checkout.shippingDetails.streetAddressPlaceholder` -> placeholder input street.
- `checkout.shippingDetails.cityLabel` -> label input city.
- `checkout.shippingDetails.cityPlaceholder` -> placeholder input city.
- `checkout.shippingDetails.countryLabel` -> label input country.
- `checkout.shippingDetails.countryPlaceholder` -> placeholder input country.
- `checkout.shippingDetails.zipLabel` -> label input zip.
- `checkout.shippingDetails.zipPlaceholder` -> placeholder input zip.
- `checkout.shippingDetails.shippingCostLabel` -> shipping options block label + summary shipping row label.
- `checkout.shippingDetails.shippingOneNameDefault` -> shipping option #1 title text.
- `checkout.shippingDetails.shippingOneDescriptionDefault` -> shipping option #1 description prefix text.
- `checkout.shippingDetails.shippingTwoNameDefault` -> shipping option #2 title text.
- `checkout.shippingDetails.shippingTwoDescriptionDefault` -> shipping option #2 description prefix text.
- `checkout.shippingDetails.paymentMethodLabel` -> section title "03".
- `checkout.shippingDetails.paymentMethodPlaceholder` -> payment section hint text.
- `checkout.buttons.continueButtonLabel` -> back/continue button text (left action).
- `checkout.buttons.confirmButtonLabel` -> submit button text (idle state).
- `checkout.cartItemSection.sectionTitle` -> summary block small header.
- `checkout.cartItemSection.orderSummaryLabel` -> summary heading.
- `checkout.cartItemSection.applyButtonLabel` -> coupon apply button text.
- `checkout.cartItemSection.subTotalLabel` -> subtotal row label.
- `checkout.cartItemSection.discountLabel` -> discount row label.
- `checkout.cartItemSection.totalCostLabel` -> total row label.

## Manual Verification (Before/After)
1. Admin -> update checkout fields (`sectionTitle`, `firstNamePlaceholder`, `applyButtonLabel`) via admin customization endpoint.
2. Public API read `include=checkout` reflects updated values.
3. Values restored after verification.

Result sample:
- `testTitle`: `Personal Details TASK15 20260303113308`
- `savedTitle`: `Personal Details TASK15 20260303113308`
- `savedFirstNamePlaceholder`: `First Name QA`
- `savedApplyLabel`: `Apply QA`
- `synced`: `true`
- `restored`: `true`

Route check:
- `GET http://localhost:5173/checkout` => HTTP `200`.

## Commands Output
1. `pnpm --filter client exec vite build`
- PASS (`vite v7.1.9`, `✓ built in 12.08s`)

2. `pnpm qa:mvf`
- PASS (`QA-MONEY: PASS`)
- All MVF checks PASS including checkout -> success -> tracking and admin order update.
- Artifact:
  - `RESULT_FILE=.codex-artifacts/qa-mvf/20260303-113230/result.json`
  - `SUMMARY_FILE=.codex-artifacts/qa-mvf/20260303-113230/summary.txt`

## Known Gaps
1. Language source still fixed to `en` for checkout customization fetch.
2. "Continue" label mapped to existing back action button (no new button added, by design).
3. Payment method "placeholder" mapped as section hint because payment UI uses radio options (no text input).

## Recommendation for Task #16
1. Bind checkout customization to active storefront language (not hardcoded `en`).
2. Continue with Dashboard Setting / SEO storefront binding as next parity step.
3. Add focused E2E assertion for checkout labels/placeholders from customization payload.
