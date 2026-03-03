# TASK-6 Report — Privacy Policy and T&C

## Discovery
- Backend file used: `server/src/routes/admin.storeCustomization.ts`
- Frontend file used: `client/src/pages/admin/StoreCustomization.jsx`
- Existing tab `privacyPolicyTerms` was still placeholder (`Coming soon`).
- Rich text editor discovery:
  - No existing editor library/component found in repo (`react-quill`, `tiptap`, `draft-js`, `slate`, `tinymce`, `ckeditor` not present).
  - No rich text editor dependency available in `client/package.json`.
  - Implemented minimal in-file rich text editor using native `contentEditable` + toolbar (no new dependency install).

## File Changed List
1. `server/src/routes/admin.storeCustomization.ts`
- Added default HTML constants for policy pages.
- Added `privacyPolicy` + `termsAndConditions` in `DEFAULT_CUSTOMIZATION`.
- Added `normalizePolicyPage()` helper.
- Wired both new sections into `sanitizeCustomization()`.

2. `client/src/pages/admin/StoreCustomization.jsx`
- Added default schema + HTML for `privacyPolicy` and `termsAndConditions`.
- Added normalization for both sections in `normalizeCustomizationPayload()`.
- Added state slices, image upload/drop/remove handlers, enable toggles, and field handlers.
- Added save payload merge for both sections.
- Added `RichTextEditor` component (`contentEditable` + toolbar: bold, italic, underline, lists, H2/H3, font size, link, image, undo/redo).
- Replaced placeholder for `privacyPolicyTerms` tab with 2 full sections:
  - Privacy Policy
  - Terms & Conditions

3. `CODEx_REPORTS/TASK-6.md`
- This report.

## Final Schema (Backend)
```json
{
  "privacyPolicy": {
    "enabled": true,
    "pageHeaderBackgroundDataUrl": "",
    "pageTitle": "Privacy Policy",
    "pageTextHtml": "<h3>..."
  },
  "termsAndConditions": {
    "enabled": true,
    "pageHeaderBackgroundDataUrl": "",
    "pageTitle": "Terms & Conditions",
    "pageTextHtml": "<h2>..."
  }
}
```

Normalization guarantees:
- `enabled` always boolean.
- `pageTitle` always string fallback to defaults.
- `pageTextHtml` always HTML string fallback to defaults.
- `pageHeaderBackgroundDataUrl` always string (`""` fallback).
- Backward-compatible for old rows without these keys.

## Default Page Text Confirmation
- `privacyPolicy.pageTextHtml` default includes headings (`<h3>`) and ordered list (`<ol><li>...</li></ol>` with 7 items).
- `termsAndConditions.pageTextHtml` default includes `<h2>Welcome to KachaBazar!</h2>`, multiple `<h3>` sections, and ordered list.

## Persist Test (API-level)
Using admin session (`superadmin@local.dev`), updated `lang=en` customization via `PUT /api/admin/store/customization` with:
- `privacyPolicy.enabled=false`
- `privacyPolicy.pageHeaderBackgroundDataUrl=<data:image/png;base64,...>`
- `privacyPolicy.pageTitle` + `privacyPolicy.pageTextHtml`
- `termsAndConditions.enabled=true`
- `termsAndConditions.pageHeaderBackgroundDataUrl=<data:image/png;base64,...>`
- `termsAndConditions.pageTitle` + `termsAndConditions.pageTextHtml`

Verification via `GET /api/admin/store/customization?lang=en`:
- `privacyEnabled=False`
- `privacyBgHasDataUrl=True`
- `privacyHtmlHasOl=True`
- `termsEnabled=True`
- `termsBgHasDataUrl=True`
- `termsHtmlHasH2=True`

## Commands Output
1. `pnpm qa:mvf`
- PASS
- Artifact: `.codex-artifacts/qa-mvf/20260303-091453/result.json`
- Summary: `.codex-artifacts/qa-mvf/20260303-091453/summary.txt`

2. `pnpm --filter client exec vite build`
- PASS

3. `pnpm --filter server exec tsx -e "import './src/routes/admin.storeCustomization.ts'; console.log('server-route-load=PASS')"`
- PASS (`server-route-load=PASS`)

4. `pnpm --filter server exec tsc --noEmit`
- FAIL (pre-existing strict typing issue in existing code path: implicit `any` in `admin.storeCustomization.ts` around existing member map callback). Not part of requested QA gate.

## Known Gaps (max 5)
1. Rich text editor is minimal native `contentEditable`; toolbar is functional but not as advanced/stable as dedicated editors.
2. `document.execCommand` is deprecated API (still works in major browsers, but long-term migration may be needed).
3. No dedicated sanitization/HTML allowlist at frontend (backend currently stores HTML string as provided).
4. UI test was validated via API persistence and existing MVF smoke; no dedicated automated UI interaction test for the new tab yet.

## Recommended Next Task
- Task #7: Render storefront public pages (`/privacy-policy`, `/terms-and-conditions`) from customization with safe HTML rendering and block-level `enabled` toggles.
