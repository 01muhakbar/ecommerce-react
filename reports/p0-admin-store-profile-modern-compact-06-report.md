# P0-ADMIN-STORE-PROFILE-MODERN-COMPACT-06 Report

## Ringkasan Perubahan
- Header copy dibuat lebih decision-first: `Review stores before they go public.`
- Header badge dipadatkan menjadi dua sinyal: need review dan shipping incomplete.
- Summary toolbar diubah menjadi compact stat strip: Total stores, Need review, Profile incomplete, Shipping incomplete.
- Search/filter area dipadatkan: placeholder `Search store, slug, or owner`, sort select, visible count, dan chip filters.
- Default store card dipangkas agar scan-friendly:
  - Store name
  - Owner dan slug
  - Satu primary status badge
  - Maksimal dua secondary badges
  - Compact inline health row
  - Open Storefront dan Review details
- Daftar missing fields panjang tidak lagi muncul di default card.
- Missing profile/shipping details tetap tersedia setelah `Review details` dibuka.
- Badge hierarchy diperjelas: green untuk ready/operational, amber untuk incomplete, rose untuk public gated/missing.
- Card styling diperhalus dengan rounded lebih besar, border subtle, shadow ringan, dan spacing yang lebih bersih.

## Before/After UX
- Before: default card masih memuat daftar issue panjang dan empat boxed health cards, sehingga list 55+ stores tetap terasa berat.
- After: default card hanya menampilkan status utama dan health ringkas; admin dapat scan store dalam beberapa detik lalu expand hanya store yang perlu direview.
- Before: search/filter dan summary terasa seperti blok administratif kaku.
- After: summary dan filter menjadi strip/tooling compact yang lebih ringan secara visual.

## File Diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-modern-compact-06-report.md`

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
  - Online Store group active/open: PASS
  - Store Profile item active: PASS
  - Search visible: PASS
  - Sort visible: PASS
  - Filter visible: PASS
  - Open Storefront visible: PASS
  - Store detail collapsed by default: PASS (`0/55` review details open)
  - Default card does not show long missing-field list: PASS
  - Review details opens missing field details: PASS
  - Save Core Identity visible after expand: PASS
  - Horizontal overflow: PASS
- Tablet 768px:
  - Online Store group active/open: PASS
  - Store Profile item active: PASS
  - Search visible: PASS
  - Sort visible: PASS
  - Filter visible: PASS
  - Open Storefront visible: PASS
  - Store detail collapsed by default: PASS (`0/55` review details open)
  - Default card does not show long missing-field list: PASS
  - Review details opens missing field details: PASS
  - Save Core Identity visible after expand: PASS
  - Horizontal overflow: PASS
- Artifacts:
  - `.codex-artifacts/p0-admin-store-profile-modern-compact-06/browser-check.json`
  - `.codex-artifacts/p0-admin-store-profile-modern-compact-06/store-profile-modern-1440.png`
  - `.codex-artifacts/p0-admin-store-profile-modern-compact-06/store-profile-modern-768.png`

## Dampak Admin/Seller/Client/Backend
- Admin: Store Profile menjadi lebih ringkas dan scan-friendly tanpa mengubah save flow atau route canonical.
- Seller: Tidak ada perubahan Seller Workspace, seller-owned profile behavior, atau store ownership behavior.
- Client/storefront: Open Storefront tetap memakai `/store/:slug`; public-safe data hanya diringkas di Admin UI.
- Backend/API: Tidak ada perubahan backend, schema, endpoint, auth, permission, payment, order, shipping, atau checkout behavior.

## Risiko Tersisa
- Filter/search masih client-side berdasarkan payload existing; pagination/server-side filter bisa dipertimbangkan jika store count tumbuh jauh di atas 55.
- Detail expanded masih memuat field lengkap dan cukup panjang, tetapi sekarang tidak membebani default list mode.
- Browser check memakai Playwright lokal fallback karena Browser in-app tidak tersedia.

## Next Recommendation
- Tambahkan Playwright smoke permanen untuk memastikan default card tidak pernah kembali menampilkan daftar missing fields panjang di list mode.
