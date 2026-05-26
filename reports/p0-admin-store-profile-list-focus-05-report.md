# P0-ADMIN-STORE-PROFILE-LIST-FOCUS-05 Report

## Ringkasan Perubahan
- Halaman `/admin/online-store/store-profile` diubah dari full-detail vertical feed menjadi list-first admin review surface.
- Empat metric card besar diganti menjadi compact summary toolbar: total stores, operational, profile incomplete, shipping incomplete.
- Ditambahkan search client-side untuk store name, slug, owner name, dan owner email.
- Ditambahkan filter client-side: All, Needs attention, Profile incomplete, Shipping incomplete, Public gated, Operational.
- Ditambahkan sort ringan: Priority first dan Store name.
- Store card default sekarang compact: identity, owner, slug, readiness badges, mini Store Health, maksimal dua issue line, CTA Open Storefront, dan Review details.
- Detail berat dipindahkan ke `<details>` per store: Admin-owned Identity form, Seller-owned Profile, Public Storefront Preview, Shipping Setup, dan Data ownership rules.
- Admin-owned Identity form dirapikan: desktop 2 kolom, tablet/mobile 1 kolom, input tidak dipaksa mengecil oleh tombol Save.
- Sidebar Online Store diberi active/open state eksplisit untuk route Store Profile.

## Before/After UX
- Before: halaman merender banyak detail store secara penuh, sehingga 55+ stores terasa seperti banyak detail page digabung dalam satu scroll.
- After: default view menjadi review queue yang ringkas; admin dapat mencari, memfilter, melihat issue utama, lalu membuka detail hanya untuk store yang sedang direview.
- Before: Admin-owned Identity pada store detail mudah terasa sempit di viewport tablet.
- After: Store Name, Slug, Status, dan Save Core Identity tetap usable setelah detail dibuka.

## File Diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `client/src/components/Layout/Sidebar.jsx`
- `reports/p0-admin-store-profile-list-focus-05-report.md`

## QA Result
- `pnpm.cmd --filter client exec vite build` - PASS
  - Catatan: Vite tetap menampilkan warning chunk size > 500 kB pada bundle existing.
- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F server smoke:store-readiness` - PASS
- `pnpm.cmd -F server smoke:store-settings` - PASS
- `git diff --check` - PASS

## Browser Check Result
- Tool: Playwright lokal fallback, karena Browser in-app tidak tersedia pada sesi ini.
- Route checked: `http://localhost:5173/admin/online-store/store-profile`
- Desktop 1440px:
  - Online Store group active/open: PASS
  - Store Profile item active: PASS
  - Search visible: PASS
  - Filter visible: PASS
  - Store detail collapsed by default: PASS (`0/55` review details open)
  - Open Storefront visible: PASS
  - Save Core Identity visible after expand: PASS
  - Store Name width after expand: 538px
  - Slug width after expand: 538px
  - Horizontal overflow: PASS
- Tablet 768px:
  - Online Store group active/open: PASS
  - Store Profile item active: PASS
  - Search visible: PASS
  - Filter visible: PASS
  - Store detail collapsed by default: PASS (`0/55` review details open)
  - Open Storefront visible: PASS
  - Save Core Identity visible after expand: PASS
  - Store Name width after expand: 424px
  - Slug width after expand: 424px
  - Horizontal overflow: PASS
- Artifacts:
  - `.codex-artifacts/p0-admin-store-profile-list-focus-05/browser-check.json`
  - `.codex-artifacts/p0-admin-store-profile-list-focus-05/store-profile-list-1440.png`
  - `.codex-artifacts/p0-admin-store-profile-list-focus-05/store-profile-list-768.png`

## Dampak Admin/Seller/Client/Backend
- Admin: Store Profile menjadi list-focused review queue dengan progressive disclosure. Save Core Identity tetap memakai mutation dan kontrak API existing.
- Seller: Tidak ada perubahan seller route, seller profile behavior, atau store ownership behavior.
- Client/storefront: Open Storefront tetap memakai `/store/:slug`; public-safe preview hanya diringkas di Admin UI, tidak mengubah data storefront.
- Backend/API: Tidak ada perubahan backend, schema, endpoint, auth, permission, payment, order, shipping, atau checkout behavior.

## Risiko Tersisa
- Filter/sort masih client-side berdasarkan payload admin profile existing; jika jumlah store jauh melampaui ratusan, pagination/server-side filter bisa menjadi task terpisah.
- Default page height masih mengikuti jumlah compact card yang tampil; ini sudah jauh lebih ringan dari full-detail render, tetapi belum memakai virtualization.
- Browser check memakai local Playwright fallback, bukan Browser in-app.

## Next Recommendation
- Tambahkan dedicated Playwright smoke untuk Admin Store Profile list mode: filter, search, expand first store, save button visibility, and no-horizontal-overflow assertion.
