# TASK-5A Public Store Customization API + Bind Storefront About Us

## Step A — Discovery

### Route storefront About Us

- Route already exists in `client/src/App.jsx`:
  - `path="about-us"` -> `StoreAboutUsPage`
  - alias `path="about"` redirects to `/about-us`
- Current page `client/src/pages/store/StoreAboutUsPage.jsx` is still static/hardcoded.

### Public endpoint availability

- Existing admin endpoint:
  - `GET /api/admin/store/customization?lang=en` (requires admin auth)
- Existing store/public routes checked:
  - `server/src/routes/store.ts`
  - `server/src/routes/public.ts`
- No public customization endpoint found.

### Routing structure found

- Router mounting in `server/src/app.ts`:
  - public: `/api/store` via `storeRouter`
  - admin customization: `/api/admin/store/customization` guarded by `requireAdmin`

### Endpoint probe (evidence)

- `GET /api/store/customization?lang=en` -> `404`
- `GET /api/admin/store/customization?lang=en` without admin auth -> `401`

## Planned Files (before coding)

1. `server/src/routes/admin.storeCustomization.ts`
   - export sanitizer utility for reuse (`sanitizeCustomization`).
2. `server/src/routes/store.customization.ts` (new)
   - public read-only endpoint `GET /api/store/customization?lang=...`
   - whitelist response only `{ customization: { aboutUs } }`.
3. `server/src/app.ts`
   - mount new public route at `/api/store/customization`.
4. `client/src/api/store.service.ts`
   - add public fetch function for store customization endpoint.
5. `client/src/pages/store/StoreAboutUsPage.jsx`
   - bind render to API response (`aboutUs`) with loading/empty/error + retry.
6. `CODEx_REPORTS/TASK-5A.md`
   - implementation report.

## File Budget

- Planned app file changes: 5 (<=10).

## File Changed List (Actual)

1. `server/src/routes/admin.storeCustomization.ts`
   - Exported `sanitizeCustomization` for safe reuse in public read-only route.
2. `server/src/routes/store.customization.ts` (new)
   - Added public endpoint `GET /api/store/customization?lang=<code>`.
   - Read-only behavior + whitelist response only `customization.aboutUs`.
3. `server/src/app.ts`
   - Mounted route: `app.use("/api/store/customization", storeCustomizationRouter)`.
4. `client/src/api/store.service.ts`
   - Added `fetchStoreCustomization(lang)` for storefront public fetch.
5. `client/src/pages/store/StoreAboutUsPage.jsx`
   - Replaced static page with dynamic render from `customization.aboutUs`.
   - Added loading, error+retry, and empty state handling.

Total app files changed: 5 (<=10).

## Endpoint Spec (Implemented)

### URL

- `GET /api/store/customization?lang=en`

### Response

```json
{
  "success": true,
  "lang": "en",
  "customization": {
    "aboutUs": {
      "...": "sanitized aboutUs fields"
    }
  }
}
```

### Security / whitelist verification

- Root keys: `success, lang, customization`
- `customization` keys: `aboutUs` only
- No admin-only fields returned.

## UI Blocks Implemented Checklist (/about-us)

- [x] Page Header (toggle-aware, bg image support, title)
- [x] Top Content Left + 3 stats boxes (toggle-aware)
- [x] Top Content Right image (toggle-aware, placeholder when empty)
- [x] Content Section with 2 paragraphs + image (toggle-aware, placeholder when empty)
- [x] Our Team title/description + 6 member cards (toggle-aware, image fallback)
- [x] Loading state (skeleton layout)
- [x] Error state (message + retry)
- [x] Empty state (`About Us content is not configured yet.`)

## Sync Test (Admin -> Store)

- Admin update via API:
  - Set `aboutUs.pageHeader.pageTitle = "About Us Public Sync"`
  - Set `aboutUs.topContentLeft.topTitle = "Public Sync Title"`
- Public read check:
  - `GET /api/store/customization?lang=en` returned:
    - `pageTitle=About Us Public Sync`
    - `topTitle=Public Sync Title`
- Route readiness:
  - `GET http://localhost:5173/about-us` -> `200`

## Commands + Results

- `pnpm --filter client exec vite build` -> **PASS**
- `pnpm qa:mvf` -> **PASS**
  - Artifact: `.codex-artifacts/qa-mvf/20260303-090503/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260303-090503/summary.txt`
- Public endpoint checks:
  - `GET /api/store/customization?lang=en` -> `200`
  - Whitelist keys check passed (`customization` contains only `aboutUs`)

## Known Gaps (max 5) + Task #6 Recommendation

1. Storefront language source currently defaults to `en` (no dedicated storefront language state wired yet).
2. About Us empty state is only hit if API returns missing `aboutUs`; sanitized backend defaults generally keep it populated.
3. Sync verification was done via API response + route availability, not visual screenshot automation.
4. Public endpoint currently returns only `aboutUs` as required; future tabs need explicit extension.

Recommended Task #6:
- Wire storefront language selector/state to pass active `lang` into `fetchStoreCustomization`, then extend public customization rendering for next sections incrementally.
