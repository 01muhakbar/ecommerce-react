# TASK-7 Report — Public Policy API + Storefront Policy Pages

## File Changed List
1. `server/src/routes/store.customization.ts`
- Added `include` CSV parsing.
- Kept default response backward-compatible (`aboutUs` only when `include` is absent).
- Added strict whitelist support for `include=policy` -> only `privacyPolicy` + `termsAndConditions`.
- Supports combined request `include=aboutUs,policy`.

2. `client/src/api/store.service.ts`
- Added `getStoreCustomization({ lang, include })` helper.
- Expanded response typing to include optional `privacyPolicy` and `termsAndConditions`.
- Kept `fetchStoreCustomization(lang)` behavior by delegating to the new helper.

3. `client/src/utils/sanitizeRichTextHtml.js` (new)
- Added minimal sanitizer:
  - removes `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`.
  - removes inline event handlers (`on*`).
  - neutralizes `javascript:` on `href`/`src`.
  - enforces anchor `target="_blank" rel="noopener noreferrer"`.

4. `client/src/pages/store/StorePrivacyPolicyPage.jsx` (new)
- Fetches `include=policy`.
- Handles loading/error/empty/disabled states.
- Renders hero header (title + optional background image).
- Renders sanitized HTML via `dangerouslySetInnerHTML`.

5. `client/src/pages/store/StoreTermsAndConditionsPage.jsx` (new)
- Same behavior as privacy page for `termsAndConditions` block.

6. `client/src/App.jsx`
- Added routes:
  - `/privacy-policy`
  - `/terms`
  - `/terms-and-conditions` (alias)

## API Changes (Final Spec)
Endpoint: `GET /api/store/customization?lang=<code>[&include=<csv>]`

Include rules:
- No `include` param: return only `aboutUs` (backward compatible).
- `include=policy`: return `privacyPolicy` and `termsAndConditions` only.
- `include=aboutUs,policy`: return `aboutUs`, `privacyPolicy`, `termsAndConditions`.
- No fields outside whitelist are returned.

### Example Requests
```bash
curl "http://localhost:3001/api/store/customization?lang=en"
curl "http://localhost:3001/api/store/customization?lang=en&include=policy"
curl "http://localhost:3001/api/store/customization?lang=en&include=aboutUs,policy"
```

### Example Response (include=policy)
```json
{
  "success": true,
  "lang": "en",
  "customization": {
    "privacyPolicy": {
      "enabled": true,
      "pageHeaderBackgroundDataUrl": "",
      "pageTitle": "Privacy Policy",
      "pageTextHtml": "<h3>...</h3>"
    },
    "termsAndConditions": {
      "enabled": true,
      "pageHeaderBackgroundDataUrl": "",
      "pageTitle": "Terms & Conditions",
      "pageTextHtml": "<h2>...</h2>"
    }
  }
}
```

## Route List Baru (Storefront)
- `/privacy-policy` -> `StorePrivacyPolicyPage`
- `/terms` -> `StoreTermsAndConditionsPage`
- `/terms-and-conditions` -> `StoreTermsAndConditionsPage`

## Manual Sync Test (Admin -> Store)
Performed via API (persist + public read):
1. Update admin customization `privacyPolicy.pageTitle/pageTextHtml`.
2. Read public endpoint `GET /api/store/customization?lang=en&include=policy`.
3. Result:
- `privacySyncTitle=Privacy Sync 20260303093842`
- `privacySyncHasStamp=True`

4. Update admin customization `termsAndConditions.pageTitle/pageTextHtml`.
5. Read public endpoint again.
6. Result:
- `termsSyncTitle=Terms Sync 20260303093842`
- `termsSyncHasStamp=True`

Route availability checks:
- `GET http://localhost:5173/privacy-policy` -> `200`
- `GET http://localhost:5173/terms` -> `200`
- `GET http://localhost:5173/terms-and-conditions` -> `200`

Whitelist checks:
- default keys: `aboutUs`
- `include=policy` keys: `privacyPolicy,termsAndConditions`
- `include=aboutUs,policy` keys: `aboutUs,privacyPolicy,termsAndConditions`

Sanitizer checks:
- `sanitizedHasScript=false`
- `sanitizedHasOnclick=false`
- `sanitizedHasJavascriptHref=false`

## Command Outputs
1. `pnpm --filter client exec vite build` -> PASS
2. `pnpm qa:mvf` -> PASS
- artifact: `.codex-artifacts/qa-mvf/20260303-093754/result.json`
- summary: `.codex-artifacts/qa-mvf/20260303-093754/summary.txt`

## Known Gaps
1. Sanitizer is regex-based minimal hardening, not a full HTML sanitizer/parser.
2. Store policy pages currently use fixed `lang='en'` fallback; not yet wired to dynamic store locale source.
3. No dedicated automated UI test for policy pages yet (only MVF + manual route/API checks).

## Recommendation Task #8
- Implement public FAQ/Contact pages bound to customization with the same include-whitelist pattern and shared sanitized rich-text renderer component.
