# P0 Admin Store Profile Storyboard Redesign 09 Report

## Ringkasan
- Halaman `/admin/online-store/store-profile` dipoles mengikuti storyboard sebagai table-based review queue untuk 55+ stores.
- Tabel tetap menjadi pusat halaman, dengan summary cards, search/filter/sort compact, quick action menu, expanded review panel, dan panel `Review Priorities` berbasis data existing.
- Tidak ada backend, schema, API contract, auth, permission, payment, order, shipping, Seller Workspace, atau Client/storefront behavior yang diubah.

## Perubahan UI/UX
- Header tetap ringkas dengan title, subtitle pendek, dan badge total/need review/shipping incomplete.
- Summary metric strip diubah menjadi 4 small cards modern: Total Stores, Needs Review, Profile Incomplete, Shipping Incomplete.
- Default table tetap minim teks dan tidak menampilkan daftar missing fields panjang.
- Action row menjadi `Review`, `Open`, dan quick action menu `...`.
- Quick action menu berisi `Review`, `Open`, `Copy slug`, dan `Contact seller` bila email owner tersedia; tidak ada Delete action.
- Expanded review dibuat ringkas: Needs Attention checklist, Public Gate Issue, Core Identity, Public Preview, dan `More store data` collapsible.
- Missing profile/shipping fields tampil sebagai checklist compact hanya setelah `Review`.
- `Copy slug` menutup menu walau clipboard permission tidak tersedia di browser smoke.

## Mapping ke Storyboard
- Overview / Default State: header, summary cards, search/filter/sort, table queue, dan `Review Priorities` panel di desktop large.
- Review Expanded: expanded row menampilkan Needs Attention, Public Gate Issue, Core Identity, Public Preview, dan detail panjang tersembunyi di collapsible.
- Quick Decisions: tombol `...` membuka menu Review/Open/Copy slug/Contact seller, tanpa Delete destructive action.
- Responsive: tablet memakai internal table scroll, priority panel disembunyikan, dan page-level horizontal overflow tidak muncul.

## File Diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-storyboard-redesign-09-report.md`

## QA Result
- `pnpm.cmd --filter client exec vite build` - PASS
  - Catatan: Vite masih menampilkan warning existing chunk size > 500 kB.
- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F server smoke:store-readiness` - PASS
- `pnpm.cmd -F server smoke:store-settings` - PASS
- `git diff --check` - PASS

## Browser Check
- Browser in-app tidak tersedia pada sesi ini, jadi check memakai Playwright lokal fallback dengan mock admin auth/profile payload untuk memvalidasi state UI.
- Route checked: `http://localhost:5173/admin/online-store/store-profile`
- Desktop 1440px:
  - Table/search/filter/sort visible: PASS
  - Review/Open/More visible: PASS
  - More menu opens: PASS
  - More menu has Review/Open/Copy slug/Contact seller: PASS
  - Delete action absent: PASS
  - Copy slug closes menu: PASS
  - Open navigates to `/store/:slug`: PASS
  - Review expands detail: PASS
  - Save Core Identity visible after Review: PASS
  - Long missing fields absent before Review: PASS
  - Review Priorities panel visible: PASS
  - Sidebar Online Store > Store Profile active: PASS
  - Page-level horizontal overflow: PASS
- Tablet 768px:
  - Table/search/filter/sort visible: PASS
  - Review/Open/More visible: PASS
  - More menu opens and closes after Copy slug: PASS
  - Open navigates to `/store/:slug`: PASS
  - Review expands detail: PASS
  - Save Core Identity visible after Review: PASS
  - Long missing fields absent before Review: PASS
  - Review Priorities hidden to preserve table space: PASS
  - Sidebar Online Store > Store Profile active: PASS
  - Page-level horizontal overflow: PASS
- Artifacts:
  - `.codex-artifacts/p0-admin-store-profile-storyboard-redesign-09/browser-check.json`
  - `.codex-artifacts/p0-admin-store-profile-storyboard-redesign-09/store-profile-storyboard-1440.png`
  - `.codex-artifacts/p0-admin-store-profile-storyboard-redesign-09/store-profile-storyboard-768.png`

## Dampak Admin/Seller/Client/Backend
- Admin: Store Profile menjadi review queue yang lebih modern, compact, dan action-oriented.
- Seller: Tidak ada perubahan Seller Workspace, seller profile ownership, atau seller payment/shipping behavior.
- Client/storefront: `Open` tetap memakai `/store/:slug`; data public storefront dan rendering client tidak diubah.
- Backend/API: Tidak ada perubahan endpoint, schema, auth, permission, payment, order, shipping, atau checkout behavior.

## Risiko Tersisa
- Browser check memakai mocked frontend API payload untuk UI state; backend contract tetap dijaga lewat server build dan smoke terkait.
- `Review Priorities` hanya panel data-based di desktop large, bukan AI feature.
- Tablet tetap memakai internal horizontal table scroll sesuai scope.

## Next Recommendation
- Jadikan Playwright Store Profile queue smoke sebagai script permanen: table visible, More menu, Review expand, Save Core Identity, Open route, sidebar active, no long missing fields before Review, dan no page-level overflow.
