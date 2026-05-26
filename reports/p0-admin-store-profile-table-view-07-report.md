# P0-ADMIN-STORE-PROFILE-TABLE-VIEW-07 Report

## Ringkasan Perubahan
- Halaman `/admin/online-store/store-profile` diubah dari compact card list menjadi table-based review queue.
- Header compact, summary metric strip, search, filter chips, sort, dan visible count tetap dipertahankan.
- Tabel baru memiliki kolom: Store, Owner, Public, Profile, Shipping, Priority, Actions.
- Setiap row menampilkan status ringkas tanpa daftar missing fields panjang.
- Actions per row:
  - `Review` membuka expanded detail row.
  - `Open` membuka `/store/:slug`.
  - `Edit` membuka detail row yang sama untuk akses Admin-owned Identity.
- Detail existing dipindahkan ke expanded table row:
  - Admin-owned Identity form
  - Seller-owned Profile details
  - Public Storefront Preview
  - Shipping Setup details
  - Data ownership rules
- Tabel memakai internal `overflow-x-auto` agar tablet/mobile tidak membuat page-level horizontal overflow.

## Before/After UX
- Before: 55+ stores masih memakai card list sehingga tinggi halaman cepat panjang.
- After: admin melihat store sebagai review queue tabel, dapat scan status public/profile/shipping/priority per row, lalu klik Review untuk detail.
- Before: detail tersedia lewat card-level expanded section.
- After: detail tetap tersedia, tetapi sebagai expanded row di bawah store yang dipilih.

## File Diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-table-view-07-report.md`

## QA Result
- `pnpm.cmd --filter client exec vite build` - PASS
  - Catatan: Vite masih menampilkan warning chunk size > 500 kB pada bundle existing.
- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F server smoke:store-readiness` - PASS
- `pnpm.cmd -F server smoke:store-settings` - PASS
- `git diff --check` - PASS

## Browser Check Result
- Browser in-app tidak tersedia pada sesi ini (`iab` unavailable), jadi QA browser memakai Playwright lokal fallback.
- Route checked: `http://localhost:5173/admin/online-store/store-profile`
- Desktop 1440px:
  - Table visible: PASS
  - Columns Store, Owner, Public, Profile, Shipping, Priority, Actions visible: PASS
  - Default table does not show long missing-field list: PASS
  - Review buttons visible: PASS (`55`)
  - Open links visible: PASS (`55`)
  - Open navigates to `/store/:slug`: PASS
  - Review opens expanded detail: PASS
  - Save Core Identity visible after Review: PASS
  - Search/filter/sort visible: PASS
  - Online Store > Store Profile active: PASS
  - Page-level horizontal overflow: PASS
- Tablet 768px:
  - Table visible: PASS
  - Columns visible through internal table scroll: PASS
  - Default table does not show long missing-field list: PASS
  - Review opens expanded detail: PASS
  - Save Core Identity visible after Review: PASS
  - Open navigates to `/store/:slug`: PASS
  - Search/filter/sort visible: PASS
  - Online Store > Store Profile active: PASS
  - Page-level horizontal overflow: PASS
- Artifacts:
  - `.codex-artifacts/p0-admin-store-profile-table-view-07/browser-check.json`
  - `.codex-artifacts/p0-admin-store-profile-table-view-07/store-profile-table-1440.png`
  - `.codex-artifacts/p0-admin-store-profile-table-view-07/store-profile-table-768.png`

## Dampak Admin/Seller/Client/Backend
- Admin: Store Profile menjadi table review queue yang lebih ringkas untuk 55+ stores. Save Core Identity tetap memakai mutation existing.
- Seller: Tidak ada perubahan Seller Workspace, seller profile behavior, atau store ownership behavior.
- Client/storefront: `Open` tetap memakai `/store/:slug`; public storefront data dan rendering tidak diubah.
- Backend/API: Tidak ada perubahan backend, schema, endpoint, auth, permission, payment, order, shipping, atau checkout behavior.

## Risiko Tersisa
- Tabel memakai internal horizontal scroll pada tablet/mobile, sesuai scope task; belum ada responsive card fallback.
- Expanded row masih memuat detail lengkap dan panjang, tetapi hanya tampil setelah action Review/Edit.
- Filter/search/sort masih client-side berdasarkan payload existing.

## Next Recommendation
- Tambahkan dedicated Playwright smoke untuk table queue: columns, Review expand, Open route, Save Core Identity visibility, no long missing-field list before expand, and no page-level horizontal overflow.
