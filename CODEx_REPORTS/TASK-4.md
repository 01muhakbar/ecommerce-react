# TASK-4 Store Customization About Us (Backend + Admin UI Parity Dashtar)

## Discovery

### Confirmed main files

- Backend: `server/src/routes/admin.storeCustomization.ts`
- Frontend Admin: `client/src/pages/admin/StoreCustomization.jsx`

### Existing pattern findings

- Backend sudah memakai `DEFAULT_CUSTOMIZATION` + `sanitizeCustomization()` dengan normalizer per-domain (`normalizeHome`, `normalizeProductSlugPage`, `normalizeSeoSettings`).
- Frontend admin memakai satu file monolitik `StoreCustomization.jsx` dengan:
  - `getDefaultCustomization()`
  - `normalizeCustomizationPayload()`
  - state slice per tab (`homeState`, `productSlugPageState`, `seoSettingsState`)
  - pola upload image reusable (validate + fileToDataUrl + drop active + preview + remove).
- Tab `aboutUs` sudah ada di daftar tab, tetapi masih masuk fallback `Coming soon`.

## Planned Files (before coding)

1. `server/src/routes/admin.storeCustomization.ts`
   - Tambah schema default `aboutUs`, normalizer `normalizeAboutUs`, dan wiring ke `sanitizeCustomization`.
2. `client/src/pages/admin/StoreCustomization.jsx`
   - Tambah default + normalize payload untuk `aboutUs`.
   - Tambah state + handlers + UI tab `aboutUs` (enable toggles, text fields, upload/preview/remove, team member tabs 1..6).
3. `CODEx_REPORTS/TASK-4.md`
   - Laporan task.

## File Budget

- Planned app files changed: **2** (<= 12).
- Planned docs changed: **1**.

## File Changed List (Actual)

1. `server/src/routes/admin.storeCustomization.ts`
   - Added `aboutUs` default schema.
   - Added `normalizeAboutUs(root)` for backward-compatible sanitization.
   - Wired `aboutUs` into `sanitizeCustomization()` output.
2. `client/src/pages/admin/StoreCustomization.jsx`
   - Added frontend default + normalization for `aboutUs`.
   - Added About Us state slice + save payload merge.
   - Implemented full About Us admin tab UI (sections, toggles, dropzones, previews, remove, member tabs 1..6).
3. `CODEx_REPORTS/TASK-4.md`
   - Discovery, implementation notes, and QA outputs.

## Backend Notes (Schema + Normalization)

### Final `aboutUs` shape in backend default

- `aboutUs.pageHeader`: `enabled`, `backgroundImageDataUrl`, `pageTitle`
- `aboutUs.topContentLeft`: `enabled`, `topTitle`, `topDescription`, `boxOne|boxTwo|boxThree` (`title`, `subtitle`, `description`)
- `aboutUs.topContentRight`: `enabled`, `imageDataUrl`
- `aboutUs.contentSection`: `enabled`, `firstParagraph`, `secondParagraph`, `contentImageDataUrl`
- `aboutUs.ourTeam`: `enabled`, `title`, `description`, `members[6]` with `imageDataUrl`, `title`, `subTitle`

### Sanitization behavior

- Handles legacy/partial payload safely:
  - all text fields normalized to string via `toText`
  - all `enabled` normalized via `toBool`
  - member alias support (`subtitle` -> `subTitle`, `image` -> `imageDataUrl`)
- `ourTeam.members` always normalized to exactly 6 items (pads missing items from default).
- Existing old records without `aboutUs` now receive full defaults on sanitize/GET.

## Frontend About Us Checklist

- [x] Page Header
  - [x] Enable toggle
  - [x] Background upload (drag-drop + input + preview + remove)
  - [x] Page title input
- [x] About Page Top Content Left
  - [x] Enable toggle
  - [x] Top title + top description
  - [x] Box One/Two/Three: title + subtitle + description
- [x] Page Top Content Right
  - [x] Enable toggle
  - [x] Image upload (drag-drop + preview + remove)
- [x] Content Section
  - [x] Enable toggle
  - [x] First paragraph + second paragraph
  - [x] Content image upload (drag-drop + preview + remove)
- [x] Our Team
  - [x] Enable toggle
  - [x] Team title + description
  - [x] Tabs Member 1..6
  - [x] Per-member image upload + title + sub title
- [x] Update button persists to backend (`updateAdminStoreCustomization` flow existing)
- [x] Existing tab flow (`home`, `productSlugPage`, `seoSettings`) preserved

## Commands + Results

- `pnpm --filter client exec vite build` -> **PASS**
- Admin route readiness check (dev stack active):
  - `http://localhost:5173/admin/store/customization` -> `200`
  - `http://localhost:5173/admin/store/customization?tab=aboutUs` -> `200`
- Admin API persistence check -> **PASS**
  - login admin ok (`superadmin@local.dev`)
  - GET existing lang contains `aboutUs`
  - PUT partial `aboutUs` update succeeds
  - GET after refresh returns updated values and `members` tetap `6`
- Fresh language default check -> **PASS**
  - `lang=qaaboutusnew` returns `aboutUs` default
  - `pageHeader.pageTitle=About Us`
  - `ourTeam.members` count = `6`
- `pnpm qa:mvf` -> **PASS**
  - Artifact: `.codex-artifacts/qa-mvf/20260303-084504/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260303-084504/summary.txt`

## Known Gaps (max 5)

1. UI parity mengikuti pola Dashtar secara struktur/interaksi, belum pixel-perfect screenshot-by-screenshot.
2. About Us tab masih berada dalam file monolitik `StoreCustomization.jsx` (sesuai scope, tanpa refactor besar).
3. Verifikasi interaksi UI dilakukan via route readiness + API persistence (bukan screenshot visual otomatis).
4. Image storage tetap DataURL inline (sesuai batasan task, belum upload storage server).
5. Query param `?tab=aboutUs` belum mengubah active tab secara otomatis (route tetap terbuka, tab dipilih via UI).

## Next Recommendation

- Task berikutnya: implement render storefront public About Us page memakai schema `aboutUs` yang sudah tersimpan, termasuk language-aware content retrieval.
