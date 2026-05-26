# P0-ADMIN-STORE-PROFILE-TABLE-POLISH-08 Report

## Ringkasan Perubahan
- Memoles table-based review queue di `/admin/online-store/store-profile` agar lebih stabil untuk 55+ stores.
- Kolom Store dan Owner sekarang dibatasi, truncate, dan tetap menyediakan full value lewat native `title`.
- Kolom Actions dibuat lebih ringkas dengan `Review`, `Open`, dan tombol ellipsis untuk akses edit/detail.
- Table container memakai internal overflow, subtle border, sticky header, sticky Store column, dan sticky Actions column.
- Row hover dan expanded row diberi visual state yang lebih jelas dengan tint dan left indicator.
- Header, summary metric strip, search, sort, visible count, dan filter chips dibuat lebih slim.
- Missing fields panjang tetap hanya muncul setelah row dibuka lewat `Review`.

## Before/After UX
- Before: tabel sudah ringkas, tetapi Store/Owner/Actions masih bisa memakan lebar dan area kontrol atas masih terasa tinggi.
- After: tabel terasa lebih seperti admin review queue, dengan kolom utama terjaga, action lebih compact, dan detail row jelas terkait dengan row yang direview.
- Before: expanded detail muncul, tetapi status row aktif belum cukup kuat secara visual.
- After: row yang dibuka punya background tint dan border-left agar konteks review tidak hilang.

## File Diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-table-polish-08-report.md`

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
  - Store column readable/truncated: PASS
  - Owner column readable/truncated: PASS
  - Actions column visible and compact: PASS
  - Sticky Store and Actions columns active: PASS
  - Default table does not show long missing-field list: PASS
  - Review opens expanded detail: PASS
  - Expanded row has active visual state: PASS
  - Save Core Identity visible after Review: PASS
  - Open navigates to `/store/:slug`: PASS
  - Search/filter/sort visible: PASS
  - Online Store > Store Profile active: PASS
  - Page-level horizontal overflow: PASS
- Tablet 768px:
  - Table visible: PASS
  - Columns available through internal table scroll: PASS
  - Store and Owner columns constrained: PASS
  - Actions column sticky/visible: PASS
  - Default table does not show long missing-field list: PASS
  - Review opens expanded detail: PASS
  - Expanded row has active visual state: PASS
  - Save Core Identity visible after Review: PASS
  - Open navigates to `/store/:slug`: PASS
  - Search/filter/sort visible: PASS
  - Online Store > Store Profile active: PASS
  - Page-level horizontal overflow: PASS
- Artifacts:
  - `.codex-artifacts/p0-admin-store-profile-table-polish-08/browser-check.json`
  - `.codex-artifacts/p0-admin-store-profile-table-polish-08/store-profile-table-polish-1440.png`
  - `.codex-artifacts/p0-admin-store-profile-table-polish-08/store-profile-table-polish-768.png`

## Dampak Admin/Seller/Client/Backend
- Admin: Store Profile table queue lebih compact, readable, dan jelas saat row direview. Save Core Identity tetap memakai mutation existing.
- Seller: Tidak ada perubahan Seller Workspace, seller profile behavior, atau store ownership behavior.
- Client/storefront: `Open` tetap memakai `/store/:slug`; public storefront data dan rendering tidak diubah.
- Backend/API: Tidak ada perubahan backend, schema, endpoint, auth, permission, payment, order, shipping, atau checkout behavior.

## Risiko Tersisa
- Sticky Store/Actions column sudah lolos desktop dan tablet Playwright check, tetapi tetap perlu dijaga di dedicated regression smoke bila layout global berubah.
- Tablet/mobile memakai internal horizontal scroll, sesuai scope; belum ada responsive card fallback.
- Expanded row tetap memuat detail lengkap dan bisa panjang, tetapi hanya muncul setelah action `Review`.

## Next Recommendation
- Tambahkan dedicated Playwright smoke permanen untuk Store Profile table queue: sticky/overflow, Review expand, Open route, Save Core Identity visibility, active sidebar, dan no long missing fields before expand.
