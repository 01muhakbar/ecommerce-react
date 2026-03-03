# TASK-5 Storefront About Us (Render from Store Customization)

## Discovery (Route + Endpoint)

### Route discovery

- Store route exists:
  - `client/src/App.jsx`: `path="about-us"` -> `StoreAboutUsPage`
  - Alias route: `path="about"` -> redirect to `/about-us`
- Current About page file:
  - `client/src/pages/store/StoreAboutUsPage.jsx`
  - Current content is static/hardcoded (not bound to customization API).

### Endpoint discovery

- Admin customization endpoint exists:
  - `GET/PUT /api/admin/store/customization?lang=...`
  - Guarded by `requireAdmin` in `server/src/app.ts`.
- Public/store endpoint for customization **not found**:
  - No `/api/store/customization` route in `server/src/routes/store.ts`.
  - No equivalent customization endpoint in `server/src/routes/public.ts`.

## Candidate Files (from Step A)

1. `client/src/pages/store/StoreAboutUsPage.jsx`
2. `client/src/App.jsx` (route confirmed, likely no change needed)
3. `client/src/api/store.service.ts` (candidate if public fetch method existed)
4. `server/src/routes/store.ts` (checked for public customization endpoint)
5. `server/src/routes/public.ts` (checked for public customization endpoint)
6. `server/src/app.ts` (checked route mounting + auth guards)

## Blocking Issue (STOP Triggered)

STOP condition hit:
- `Tidak ada endpoint publik yang bisa dipakai untuk fetch customization`
- Implementasi TASK #5 sesuai scope akan membutuhkan endpoint baru atau perubahan policy auth, which is explicitly a STOP condition in prompt.

## Command Evidence

- Endpoint checks:
  - `http://localhost:3001/api/store/customization?lang=en` -> `404` with body `{"success":false,"message":"Not found"}`
  - `http://localhost:3001/api/admin/store/customization?lang=en` -> `401` with body `{"success":false,"message":"Unauthorized"}`

## File Changed List

- `CODEx_REPORTS/TASK-5.md` (this report only)

## UI Blocks Implemented Checklist

- Not implemented due STOP gate.

## Sync Test Admin -> Store

- Not executable for storefront because no public customization read endpoint exists.

## Commands Output (qa + build)

- Not run for this task because no application code change was allowed after STOP condition.

## Known Gaps + Recommendation (Task #6)

1. Public customization read endpoint does not exist.
2. Storefront cannot safely consume admin-only endpoint.
3. About page currently static and cannot sync from admin customization.

Recommendation for next task (requires explicit approval):
- Add a dedicated **public read-only endpoint** for store customization (lang-scoped, sanitized output), then wire `/about-us` to that endpoint.
