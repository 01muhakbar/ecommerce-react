# P0 Seller Store Profile CTA Bugfix 04

## Root Cause
Store Readiness primary CTA label was still derived through the `readinessPrimaryAction` object and rendered through an extra child wrapper. In the affected shipping-incomplete + payment-incomplete state, the visual button could render as a dark primary control without a reliably visible text child.

## Fix
- Added explicit blocker booleans:
  - `hasShippingBlocker`
  - `hasPaymentBlocker`
- Replaced the split render path with a single hard-safe `safePrimaryCta` object.
- Added hard-safe `primaryCtaLabel` fallback:
  - Shipping incomplete: `Fix shipping`
  - Shipping ready + payment incomplete: `Payment setup`
  - Ready state: `View storefront` or `Edit profile`
- Rendered `safePrimaryCta.label` directly as the button/link text child.
- Added `aria-label` and `title` using the same visible label.
- Forced primary CTA contrast with `text-white` and inline `color: #fff` alongside the existing dark primary button class.
- Added a small `min-width` so the button cannot collapse into an unlabeled layout spacer.

## File Diubah
- `client/src/pages/seller/SellerStoreProfilePage.jsx`

## Kondisi Manual Yang Dicek
- Readiness 38%, payment belum active, shipping incomplete:
  - Primary CTA resolves to `Fix shipping`.
  - Secondary CTA remains `Payment setup`.
- Shipping ready, payment belum active:
  - Primary CTA resolves to `Payment setup`.
- All ready:
  - Primary CTA resolves to `View storefront` when route exists, otherwise `Edit profile` if editable.

## Validasi
- `pnpm.cmd -F client build`: PASS.
- Vite still reports existing large chunk warnings; no build error.
