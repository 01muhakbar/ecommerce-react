# TASK-13 — Public Contact Us API + Storefront Contact Us Page (/contact-us)

## File Changed List
1. `server/src/routes/store.customization.ts`
- Extend public include whitelist with `contactUs` (`contactus` / `contact-us` / `contact_us`).
- Keep default response backward compatible (no `include` => `aboutUs` only).

2. `client/src/pages/store/StoreContactUsPage.jsx`
- Replace static page with customization-driven page using `getStoreCustomization({ lang: "en", include: "contactUs" })`.
- Implement loading/error/empty/disabled states.
- Render hero, info boxes, optional middle-left image, and contact form block from customization.
- Add local-only dummy form submit (required validation + 800ms simulated submit + success message, no backend request).

3. `CODEx_REPORTS/TASK-13.md`
- This report.

## API include=contactUs (Whitelist)
Endpoint: `GET /api/store/customization?lang=en&include=contactUs`

Behavior checks:
- `GET /api/store/customization?lang=en` -> `customization` keys: `aboutUs`
- `GET /api/store/customization?lang=en&include=contactUs` -> `customization` keys: `contactUs`
- `GET /api/store/customization?lang=en&include=aboutUs,contactUs` -> `customization` keys: `aboutUs, contactUs`

Example response (contact only):
```json
{
  "success": true,
  "lang": "en",
  "customization": {
    "contactUs": {
      "pageHeader": {
        "enabled": true,
        "backgroundImageDataUrl": "",
        "pageTitle": "Contact Us"
      },
      "emailBox": { "enabled": true, "title": "Email Us", "email": "info@kachabazar.com", "text": "..." },
      "callBox": { "enabled": true, "title": "Call Us", "phone": "029-00124667", "text": "..." },
      "addressBox": { "enabled": true, "title": "Location", "address": "..." },
      "middleLeftColumn": { "enabled": true, "imageDataUrl": "" },
      "contactForm": { "enabled": true, "title": "For any support just send your query", "description": "..." }
    }
  }
}
```

## Route /contact-us
- Store route already available and kept active in `client/src/App.jsx`:
  - `/contact-us` -> `StoreContactUsPage`

Manual route status check:
- `http://localhost:5173/contact-us` -> HTTP `200`.

## Sync Test Admin -> Store
Test flow (manual API):
1. Login admin (`superadmin@local.dev`).
2. Update `contactUs.pageHeader.pageTitle` via `PUT /api/admin/store/customization?lang=en`.
3. Read from public endpoint `GET /api/store/customization?lang=en&include=contactUs`.
4. Verify title changed, then restore original value.

Result:
- `originalTitle`: `Contact Us TASK12 2026-03-03`
- `testTitle`: `Contact Us Sync Test 20260303111142`
- `publicTitleAfterUpdate`: `Contact Us Sync Test 20260303111142`
- `synced`: `true`
- `restored`: `true`

## Dummy Form Behavior Test
Implemented behavior in `StoreContactUsPage.jsx`:
- Required validation for `name`, `email`, `message`.
- Email format validation.
- Submit is local-only (`setTimeout(800ms)`), no new network request.
- Success message: `Thanks! We received your message.`
- Form reset after success.

## Commands Output
1. `pnpm --filter client exec vite build`
- PASS
- `vite v7.1.9 building for production...`
- `✓ built in 13.83s`

2. `pnpm qa:mvf`
- PASS
- `QA-MONEY: PASS`
- MVF checks all PASS (store + admin)
- Artifact:
  - `RESULT_FILE=.codex-artifacts/qa-mvf/20260303-111026/result.json`
  - `SUMMARY_FILE=.codex-artifacts/qa-mvf/20260303-111026/summary.txt`

3. Endpoint whitelist proof (manual)
- default keys: `aboutUs`
- include `contactUs` keys: `contactUs`
- include `aboutUs,contactUs` keys: `aboutUs,contactUs`

## Known Gaps
1. Language for storefront fetch is still fixed to `en` in this page (no active-lang binding yet).
2. Dummy form has no persistence/backend inbox by design (out-of-scope).
3. No E2E automation specifically for `/contact-us` form interaction yet.

## Recommendation for Task #14
1. Bind storefront customization requests to active language context instead of fixed `en`.
2. Add public include + storefront for Checkout tab / Dashboard Setting (as requested roadmap).
3. Add lightweight route-level E2E for `/contact-us` state transitions (loading/error/disabled/form success).
