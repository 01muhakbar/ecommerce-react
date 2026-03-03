# TASK-12 — Store Customization Contact Us

## Discovery
- Backend file confirmed: `server/src/routes/admin.storeCustomization.ts`
- Frontend file confirmed: `client/src/pages/admin/StoreCustomization.jsx`
- Tab id for Contact Us: `contactUs`
- Initial state before coding: tab `contactUs` still rendered via generic placeholder branch (`Coming soon`).

## File Changed List
1. `server/src/routes/admin.storeCustomization.ts`
- Added `contactUs` to `DEFAULT_CUSTOMIZATION`.
- Added `normalizeContactUs(root)`.
- Wired `contactUs` into `sanitizeCustomization()` output.

2. `client/src/pages/admin/StoreCustomization.jsx`
- Added frontend `contactUs` defaults + `normalizeContactUs()`.
- Added `contactUsState` and image states (`contactUsImageErrors`, `contactUsDropActive`).
- Added contact us payload wiring in `onSave`.
- Added handlers for:
  - enabled toggles
  - text inputs/textarea updates
  - image upload drag-drop/input + preview + remove
- Implemented `activeTab === "contactUs"` UI with sections:
  - Page Header
  - Email Us Box
  - Call Us Box
  - Address Box
  - Middle Left Column
  - Contact Form

3. `CODEx_REPORTS/TASK-12.md`
- Task report.

## Final Schema Contact Us
```json
{
  "contactUs": {
    "pageHeader": {
      "enabled": true,
      "backgroundImageDataUrl": "",
      "pageTitle": "Contact Us"
    },
    "emailBox": {
      "enabled": true,
      "title": "Email Us",
      "email": "info@kachabazar.com",
      "text": "Interactively grow empowered for process-centric total linkage."
    },
    "callBox": {
      "enabled": true,
      "title": "Call Us",
      "phone": "029-00124667",
      "text": "Distinctively disseminate focused solutions clicks-and-mortar ministerate."
    },
    "addressBox": {
      "enabled": true,
      "title": "Location",
      "address": "Boho One, Bridge Street West, Middlesbrough, North Yorkshire, TS2 1AE."
    },
    "middleLeftColumn": {
      "enabled": true,
      "imageDataUrl": ""
    },
    "contactForm": {
      "enabled": true,
      "title": "For any support just send your query",
      "description": "Collaboratively promote client-focused convergence vis-a-vis customer-directed alignments via plagiarized strategic users and standardized infrastructures."
    }
  }
}
```

Normalization rules implemented:
- all `enabled` fields coerced to boolean
- all strings fallback to defaults
- `pageHeader.backgroundImageDataUrl` and `middleLeftColumn.imageDataUrl` fallback to `""`
- backward compatibility via merge-default sanitize flow

## UI Section Checklist
- Page Header: PASS
- Email Us Box: PASS
- Call Us Box: PASS
- Address Box: PASS
- Middle Left Column: PASS
- Contact Form: PASS

## Persist Test Results
Manual API persist checks (admin endpoint):
- `GET /api/admin/store/customization?lang=contactqa`
  - `fresh_contactUs_exists=True`
  - `fresh_page_title=Contact Us`
  - `fresh_email=info@kachabazar.com`
- `PUT /api/admin/store/customization?lang=en` with partial `contactUs` payload
- `GET /api/admin/store/customization?lang=en` after update
  - `persist_page_title=Contact Us TASK12 2026-03-03`
  - `persist_email=support.task12@kachabazar.com`
  - `persist_phone=029-12345678`
  - `persist_address=Task12 Address Line`
  - `persist_bg_len=114`
  - `persist_middle_left_len=114`

## Commands Output
1. `pnpm qa:mvf`
- PASS
- Artifacts:
  - `RESULT_FILE=.codex-artifacts/qa-mvf/20260303-110312/result.json`
  - `SUMMARY_FILE=.codex-artifacts/qa-mvf/20260303-110312/summary.txt`

2. `pnpm --filter client exec vite build`
- PASS
- Vite build completed successfully.

## Known Gaps
1. Task ini hanya admin customization; belum ada public include `contactUs` dan binding storefront `/contact-us` (sesuai out-of-scope).
2. Contact form submission backend/email sending belum diimplementasikan (sesuai out-of-scope).
3. Validasi format email/phone di level UI belum ditambah (saat ini text input bebas).

## Recommended Task #13
1. Extend public customization endpoint with `include=contactUs` whitelist.
2. Bind storefront `/contact-us` to `customization.contactUs` blocks.
3. Add loading/error/empty/disabled states on storefront contact page (pattern parity Task #1).
