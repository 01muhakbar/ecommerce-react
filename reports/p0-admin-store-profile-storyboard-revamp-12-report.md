# P0 Admin Store Profile Storyboard Revamp 12 Report

## Ringkasan
- Halaman `/admin/online-store/store-profile` direvamp menjadi review queue modern dengan glassmorphism halus, summary card visual, toolbar compact, table queue tetap sebagai pusat, dan `Review Priorities` berbasis data existing.
- AI pada task ini hanya UI scaffold dan presentational helper: `AI Suggest Fill`, `AI Suggest`, dan `AI Recommend Plan` tidak memanggil backend baru.
- Tidak ada perubahan backend, API contract, schema, auth, permission, payment, order, shipping, Seller Workspace, atau Client/storefront behavior.

## Mapping Storyboard
### Panel 1 — Overview & AI Priorities
- Header ringkas tetap memakai `Store Profile` dan `Review stores before publishing.`
- Badge ringkas tetap menampilkan total stores, need review, dan shipping incomplete.
- Summary cards dibuat glass-like dengan angka besar, label pendek, dan abstract stat icon.
- Search/filter/sort toolbar memakai card glass-like, active chip gelap, dan placeholder `Search store, slug, owner`.
- `Review Priorities` tampil di layar besar dengan badge `Data-based` dan suggestion berbasis data existing.
- Visual cue `Minimalis & Bersih`, `Visual seperti Kaca`, dan `Personalisasi & AI` ditampilkan sebagai label ringan.

### Panel 2 — Expanded Review Detail with AI Assist
- Expanded row memakai glass card, selected row tint, dan accent left border.
- Needs Attention tetap berisi missing profile/shipping fields, tetapi divisualkan sebagai status cards ringkas.
- AI Assist hadir sebagai presentational state: `AI Suggest Fill`, `AI Suggest`, dan panel suggestion data-derived.
- Public Gate Issue tetap satu kalimat pendek: `Storefront remains gated until blockers are fixed.`
- Core Identity tetap editable dengan Store Name, Slug, Status, dan `Save Core Identity`.
- Public Preview tetap compact dengan Description, Contact, Address, dan Open Storefront.
- Advanced details tetap collapsed by default.

### Panel 3 — Quick Decision Menu & Responsive Interaction
- Quick menu `...` dibuat glass-like dan berisi `Review`, `Open`, `Copy slug`, `Copy owner email`, `AI Recommend Plan`.
- Tidak ada `Delete` atau `Contact seller`.
- Pada mobile, menu memakai bottom-sheet style dengan visual cue `Responsif` dan `Mikro-interaksi`.
- `AI Recommend Plan` membuka expanded detail dan menampilkan AI suggestion panel tanpa backend call.

## Perubahan UI/UX
- Mengganti page header primitive dengan custom glass header di halaman Store Profile saja.
- Modernisasi metric cards, toolbar, table container, selected row, expanded detail, dan action menu.
- Menambahkan data-derived `Review Priorities` suggestion copy.
- Menambahkan AI assist UI non-destructive untuk rekomendasi langkah review.
- Menjaga missing fields panjang tetap hanya muncul setelah `Review`.
- Menjaga internal table scroll pada tablet/mobile agar tidak ada page-level horizontal overflow.

## File Diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-storyboard-revamp-12-report.md`

## File Dibaca
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `client/src/components/admin/AdminOpsPrimitives.jsx`
- `client/src/components/Layout/Sidebar.jsx`
- `client/src/App.jsx`
- `reports/p0-admin-store-profile-storyboard-redesign-09-report.md`
- `reports/p0-admin-store-profile-storyboard-polish-10-report.md`
- `reports/p0-admin-store-profile-copy-density-11-report.md`

## QA Result
- `pnpm.cmd --filter client exec vite build` - PASS. Ada warning existing Vite chunk `vendor-misc` > 500 kB.
- `pnpm.cmd -F server build` - PASS.
- `pnpm.cmd -F server smoke:store-readiness` - PASS.
- `pnpm.cmd -F server smoke:store-settings` - PASS.
- `git diff --check` - PASS.

## Browser Check
- Local Playwright fallback dengan mocked admin session dan 55 store entries - PASS.
- Desktop 1440:
  - Header ringkas, visual cues, summary, search/filter/sort, table visible.
  - `Review Priorities` hidden agar tabel tidak sempit.
  - Row `Review` membuka expanded detail.
  - `AI Suggest Fill`, `AI Suggest`, `Save Core Identity`, dan public gate copy terlihat.
  - `Advanced details` collapsed.
  - Quick menu memiliki `AI Recommend Plan`, `Copy slug`, `Copy owner email`.
  - Tidak ada `Delete` atau `Contact seller`.
  - Sidebar `Online Store > Store Profile` aktif.
  - Tidak ada page-level horizontal overflow.
- Desktop 1600:
  - `Review Priorities`, `Data-based`, dan `Suggested:` terlihat.
  - Tidak ada page-level horizontal overflow.
- Tablet 768:
  - Table visible dengan internal horizontal scroll.
  - `Review Priorities` hidden.
  - Tidak ada page-level horizontal overflow.
- Mobile 390:
  - Header dan table visible.
  - Table memakai internal horizontal scroll.
  - Quick menu tampil sebagai bottom-sheet style dengan `Responsif`, `Mikro-interaksi`, dan `AI Recommend Plan`.
  - Tidak ada page-level horizontal overflow.
- Artifact: `.codex-artifacts/p0-admin-store-profile-storyboard-revamp-12/`

## Dampak Admin/Seller/Client/Backend
- Admin: Store Profile menjadi modern review queue dengan AI-assisted visual pattern yang non-destructive.
- Seller: tidak ada perubahan Seller Workspace, seller-owned fields, store ownership, atau seller behavior.
- Client/storefront: Open Storefront tetap memakai `/store/:slug`; public storefront behavior tidak berubah.
- Backend/API: tidak ada endpoint, schema, auth, permission, payment, order, shipping, checkout, atau AI backend baru.

## Risiko Tersisa
- Browser check memakai mocked UI payload 55 stores; smoke server tetap menjaga kontrak readiness/settings.
- AI label adalah presentational/data-derived, bukan AI service nyata.
- `Review Priorities` sengaja hanya tampil pada layar besar agar tabel tetap usable pada 1440/tablet/mobile.

## Next Recommendation
- Buat Playwright smoke permanen untuk Store Profile review queue: overview, quick menu, AI scaffold, expanded detail, Save Core Identity, Open Storefront, sidebar active, dan no overflow.
