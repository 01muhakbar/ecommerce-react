# TASK-9 Report — Public FAQs API + Storefront FAQ Page (Accordion)

## File Changed List
1. `server/src/routes/store.customization.ts`
- Extended include whitelist parser usage to support `include=faq` / `include=faqs`.
- Added strict response inclusion for `customization.faqs` only when FAQ include is requested.
- Preserved existing include behavior for aboutUs and policy.

2. `client/src/pages/store/StoreFaqPage.jsx` (new)
- Added storefront FAQ page.
- Fetches `getStoreCustomization({ lang: 'en', include: 'faq' })`.
- Added state UI: loading skeleton, error+retry, empty, disabled.
- Added hero header (title + optional background image).
- Added responsive 2-column layout (left image + right accordion).
- Added accordion (no new library), default first item open.

3. `client/src/App.jsx`
- Added routes:
  - `/faq`
  - `/faqs` (alias)
- Added import for `StoreFaqPage`.

4. `CODEx_REPORTS/TASK-9.md`
- This report.

## API `include=faq` Behavior
Endpoint: `GET /api/store/customization?lang=en&include=<csv>`

Whitelist keys allowed in public response:
- `aboutUs`
- `privacyPolicy`
- `termsAndConditions`
- `faqs`

Behavior checks:
- `GET /api/store/customization?lang=en`
  - keys: `aboutUs`
- `GET /api/store/customization?lang=en&include=faq`
  - keys: `faqs`
- `GET /api/store/customization?lang=en&include=aboutUs,faq`
  - keys: `aboutUs,faqs`
- `GET /api/store/customization?lang=en&include=policy,faq`
  - keys: `privacyPolicy,termsAndConditions,faqs`

No additional keys were returned.

## Route Baru
- `/faq` -> `StoreFaqPage`
- `/faqs` -> `StoreFaqPage`

## UI Checklist (Store FAQ)
- Hero header:
  - enabled-aware (`faqs.pageHeader.enabled`) -> `PASS`
  - title (`faqs.pageHeader.pageTitle`) -> `PASS`
  - background image (`faqs.pageHeader.backgroundImageDataUrl`) -> `PASS`
- Left image column:
  - enabled-aware (`faqs.leftColumn.enabled`) -> `PASS`
  - image render (`faqs.leftColumn.leftImageDataUrl`) -> `PASS`
- Accordion:
  - enabled-aware (`faqs.content.enabled`) -> `PASS`
  - renders fixed 8 normalized items -> `PASS`
  - default item #1 open -> `PASS`
  - toggle open/close per item -> `PASS`
- State UI:
  - loading skeleton -> `PASS`
  - error + retry -> `PASS`
  - empty -> `PASS`
  - disabled -> `PASS`

## Sync Test Admin -> Store
Performed via API:
1. Update admin customization (`faqs.content.items[0].title/description`) on `lang=en`.
2. Fetch public `GET /api/store/customization?lang=en&include=faq`.

Result:
- `faqSyncTitle=FAQ Sync Title 20260303101020`
- `faqSyncDescHasStamp=True`
- `faqSyncItemsCount=8`

## Commands Output
1. `pnpm --filter client exec vite build`
- PASS

2. `pnpm qa:mvf`
- PASS
- Artifact: `.codex-artifacts/qa-mvf/20260303-101001/result.json`
- Summary: `.codex-artifacts/qa-mvf/20260303-101001/summary.txt`

3. Manual HTTP checks:
- `/faq` status: `200`
- `/faqs` status: `200`

## Known Gaps
1. FAQ page currently uses fixed language fallback (`en`), not yet bound to dynamic storefront locale selector.
2. Accordion uses simple max-height transition; long content might need refined animation handling.
3. Left column currently shows disabled/empty placeholders when image block is disabled/not configured; visual behavior can be adjusted later per design preference.

## Recommendation Task #10 (Contact Us)
- Extend public include whitelist with `include=contact` and implement storefront `/contact-us` page binding to customization contact schema with map/social/contact blocks and full loading/error/empty/disabled states.
