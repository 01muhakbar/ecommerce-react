# P0-ADMIN-STORE-PROFILE-UX-COMPACT-04 Report

## Ringkasan perubahan

- Mengubah `/admin/online-store/store-profile` menjadi layout decision-first: store health summary, public gate, profile completeness, shipping status, dan CTA tampil di atas.
- Menambahkan blocking issue panel dekat atas untuk missing seller profile fields, missing shipping setup fields, dan public gate issue.
- Mengubah seller-owned profile, public storefront preview, shipping origin, dan governance/contract notes menjadi compact summary dengan `<details>` untuk detail panjang.
- Mempertahankan form Admin Identity untuk Store Name, Slug, Status, dan `Save Core Identity`.
- Tidak mengubah API contract, backend, schema, auth, permission, payment, order, shipping, atau store ownership behavior.

## Before/after UX

- Before: field kosong dirender sebagai card besar, preview seller/public sangat panjang, warning tersebar, dan contract notes tampil seperti debug contract page.
- After: admin langsung melihat status publik, blocker utama, missing field checklist, CTA storefront/review, dan form identity tanpa harus membaca semua field detail.

## File diubah

- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-ux-compact-04-report.md`

## File dibaca

- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `client/src/components/admin/AdminOpsPrimitives.jsx`
- `client/src/App.jsx`
- `client/src/api/adminStoreProfile.ts`
- `server/src/routes/admin.storeProfiles.ts`
- `reports/p0-admin-store-ops-ux-sync-03-report.md`

## QA result

- `pnpm.cmd --filter client exec vite build`: PASS. Existing Vite large chunk warning remains.
- `pnpm.cmd -F server build`: PASS.
- `pnpm.cmd -F server smoke:store-readiness`: PASS.
- `pnpm.cmd -F server smoke:store-settings`: PASS.
- `pnpm.cmd -F server smoke:admin-store-application`: PASS.
- `git diff --check`: PASS.
- Browser in-app check: NOT RUN, `iab` browser was unavailable in this session.
- Playwright fallback visual smoke on `http://localhost:5173/admin/online-store/store-profile`: PASS for 1440px desktop and 768px tablet.

Playwright fallback verified:

- Route stays `/admin/online-store/store-profile`.
- No page-level horizontal overflow on desktop/tablet.
- `Store Health` command center appears in the default view.
- `Needs Attention` and `Missing profile fields` appear near the top.
- `Save Core Identity` remains present.
- `Open Storefront` remains present.
- `Show seller field details`, `Show public-safe fields`, and `Data ownership rules` are collapsed by default.

Artifacts:

- `.codex-artifacts/p0-admin-store-profile-ux-compact-04/browser-check.json`
- `.codex-artifacts/p0-admin-store-profile-ux-compact-04/store-profile-1440.png`
- `.codex-artifacts/p0-admin-store-profile-ux-compact-04/store-profile-768.png`

## Dampak Admin/Seller/Client/Backend

### Admin

- Store Profile now prioritizes operational status, blocker review, and admin-owned identity actions.
- Empty/missing fields are compacted into checklists and chips instead of default full-field cards.

### Seller

- Seller-owned fields remain read-only in Admin and editable from Seller Workspace.
- No Seller Store Profile API or route behavior changed.

### Client / Storefront

- Public preview still reads `publicIdentity` and links to the existing `/store/:slug` route.
- No storefront serialization, public gate, checkout, payment, or shipping behavior changed.

### Backend / API

- No backend files changed.
- Existing GET/PATCH `/admin/store/profiles` contract remains the source of truth.
- No schema or migration changes.

## Risiko tersisa

- Page height is still large when there are many stores because this task did not introduce pagination or filtering.
- Playwright visual smoke used fallback browser automation because the in-app browser target was unavailable.
- Existing Vite large chunk warning remains unrelated to this task.

## Next recommendation

- Add a checked-in Playwright smoke for Admin Store Profile that logs in, checks desktop/tablet overflow, confirms compact issue panel visibility, and verifies core identity controls.
