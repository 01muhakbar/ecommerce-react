# TASK-8 Report — Store Customization FAQs

## Discovery
- Backend file confirmed: `server/src/routes/admin.storeCustomization.ts`
- Frontend file confirmed: `client/src/pages/admin/StoreCustomization.jsx`
- FAQs tab status before implementation: placeholder (`Coming soon`) via generic fallback branch.
- Reusable upload/toggle utilities were already available and reused (`ImageUploadField`, `SegmentedToggle`, `fileToDataUrl`, `validateCustomizationLogoFile`).

## File Changed List
1. `server/src/routes/admin.storeCustomization.ts`
- Added FAQ defaults and fixed item length (`8`).
- Added `faqs` schema inside `DEFAULT_CUSTOMIZATION`.
- Added `normalizeFaqs(root)` helper with strict shape + fallback + fixed 8 items.
- Wired `faqs` into `sanitizeCustomization()` output.

2. `client/src/pages/admin/StoreCustomization.jsx`
- Added FAQ defaults (`faqs`) in `getDefaultCustomization()`.
- Added FAQ normalization helpers: `normalizeFaqItems`, `normalizeFaqs`.
- Added state slices: `faqsState`, `faqsImageErrors`, `faqsDropActive`.
- Added FAQ handlers: block toggles, item updates, image upload/drop/remove.
- Added FAQ payload merge in `onSave` (items normalized back to fixed 8).
- Implemented full `activeTab === "faqs"` UI with 3 sections:
  - FAQs Page Header
  - FAQs Left Column
  - FAQs content items (Title/Description One..Eight)

3. `CODEx_REPORTS/TASK-8.md`
- This report.

## Final Schema `faqs`
```json
{
  "faqs": {
    "pageHeader": {
      "enabled": true,
      "backgroundImageDataUrl": "",
      "pageTitle": "FAQs"
    },
    "leftColumn": {
      "enabled": true,
      "leftImageDataUrl": ""
    },
    "content": {
      "enabled": true,
      "items": [
        { "title": "...", "description": "..." },
        { "title": "...", "description": "..." },
        { "title": "...", "description": "..." },
        { "title": "...", "description": "..." },
        { "title": "...", "description": "..." },
        { "title": "...", "description": "..." },
        { "title": "...", "description": "..." },
        { "title": "...", "description": "..." }
      ]
    }
  }
}
```

Normalization guarantees:
- `enabled` fields forced to boolean.
- string fields fallback to defaults.
- image DataURL fields fallback to `""`.
- `content.items` always fixed length `8` (pad/fill using defaults).

## UI Section Checklist
- FAQs Page Header:
  - Enable toggle: `PASS`
  - Background upload (drag-drop/input + preview + remove): `PASS`
  - Page title input: `PASS`
- FAQs Left Column:
  - Enable toggle: `PASS`
  - Left image upload (drag-drop/input + preview + remove): `PASS`
- FAQs content list:
  - Enable toggle: `PASS`
  - `Faq Title One..Eight`: `PASS`
  - `Faq Description One..Eight`: `PASS`

## Persist Test Result
### A) New language default check
- Request: `GET /api/admin/store/customization?lang=qa8`
- Result:
  - `freshLangHasFaqs=True`
  - `freshLangFaqItemsCount=8`
  - `freshLangFaqHeaderTitle=FAQs`

### B) Update + persist check (lang=en)
- Updated via admin endpoint:
  - `faqs.pageHeader.pageTitle`
  - `faqs.pageHeader.backgroundImageDataUrl`
  - `faqs.leftColumn.leftImageDataUrl`
  - `faqs.content.items[0]` title+description (partial update)
- Re-fetched from admin endpoint:
  - `persistFaqHeaderTitle=FAQs QA 20260303095529`
  - `persistFaqItemsCount=8`
  - `persistFaqItemOneTitle=Faq Title One QA 20260303095529`
  - `persistFaqBgDataUrl=True`
  - `persistFaqLeftImageDataUrl=True`

## Commands Output
1. `pnpm --filter client exec vite build`
- PASS

2. `pnpm qa:mvf`
- PASS
- Artifact: `.codex-artifacts/qa-mvf/20260303-095427/result.json`
- Summary: `.codex-artifacts/qa-mvf/20260303-095427/summary.txt`

3. `pnpm --filter server exec tsx -e "import './src/routes/admin.storeCustomization.ts'; console.log('server-route-load=PASS')"`
- PASS (`server-route-load=PASS`)

## Known Gaps
1. FAQ tab currently does not auto-select from URL query (`?tab=faqs`) because tab selection logic is still local state only.
2. FAQ item count is intentionally fixed to 8 (by requirement), no dynamic add/remove UI.
3. Storefront FAQ rendering is not included in this task (next task candidate).

## Recommended Next Task
- Implement public include whitelist + storefront `/faq` page using `customization.faqs` with loading/error/empty states and enabled block handling.
