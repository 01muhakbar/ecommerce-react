# P0 Admin Store Profile Copy Density 11 Report

## Ringkasan perubahan
- Header Store Profile dipadatkan menjadi `Review stores before publishing.`
- Summary cards dibuat benar-benar stat-only: `Total stores`, `Need review`, `Profile incomplete`, dan `Shipping incomplete`.
- Microcopy bawah summary seperti active/operational/complete/ready dihapus.
- Filter chip `Needs attention` diganti menjadi `Needs review` tanpa mengubah logic filter.
- Label detail developer-facing diganti menjadi admin-facing.
- Public Preview diringkas menjadi tiga row status rendah: `Description`, `Contact`, `Address`.
- Expanded detail dipadatkan tanpa menghapus Needs Attention, Public Gate Issue, Core Identity, Public Preview, dan Save Core Identity.

## Copy before/after
- `Review stores before they go public.` -> `Review stores before publishing.`
- `Needs attention` -> `Needs review`
- `More store data` -> `Advanced details`
- `Seller-owned field details` -> `Seller profile fields`
- `Public-safe fields` -> `Public storefront fields`
- `Data ownership rules` -> `Field ownership`
- Ownership copy:
  - `Admin: name, slug, status.`
  - `Seller: contact, media, address, shipping origin.`
  - `Storefront: public-safe fields only.`

## File diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-copy-density-11-report.md`

## QA result
- `pnpm.cmd --filter client exec vite build` - PASS. Ada warning existing Vite chunk `vendor-misc` > 500 kB.
- `pnpm.cmd -F server build` - PASS.
- `pnpm.cmd -F server smoke:store-readiness` - PASS.
- `pnpm.cmd -F server smoke:store-settings` - PASS.
- `git diff --check` - PASS.

## Browser check result
- Local Playwright fallback dengan mocked admin session dan 55 store entries - PASS.
- `/admin/online-store/store-profile` terbuka.
- Subtitle baru terlihat.
- Summary cards tidak lagi menampilkan microcopy bawah.
- Filter `Needs review` terlihat dan filter `Needs attention` tidak ada.
- Search dan sort tetap terlihat.
- `Review` membuka detail.
- `Save Core Identity` tetap terlihat setelah expand.
- Public Preview tampil compact dengan `Description`, `Contact`, `Address`.
- `Advanced details` terlihat dan tetap collapsed.
- Label lama `More store data`, `Seller-owned field details`, `Public-safe fields`, `Data ownership rules` tidak terlihat.
- More menu tetap menampilkan `Copy owner email` dan tidak menampilkan `Contact seller`.
- Desktop 1440 dan tablet 768 tidak mengalami page-level horizontal overflow.
- Artifact: `.codex-artifacts/p0-admin-store-profile-copy-density-11/`

## Dampak Admin/Seller/Client/Backend
- Admin: UI Store Profile lebih ringkas dan label lebih admin-facing; review/open/save tetap sama.
- Seller: tidak ada perubahan Seller Workspace atau seller-owned data.
- Client/storefront: tidak ada perubahan behavior storefront; Open Storefront tetap memakai route existing.
- Backend/API: tidak ada perubahan endpoint, schema, auth, permission, payment, order, atau shipping behavior.

## Risiko tersisa
- Browser check memakai mocked data UI 55 stores; kontrak readiness/settings tetap dicakup oleh smoke server.
- Frasa `public-safe fields only` tetap ada di Field ownership karena diminta secara eksplisit sebagai copy singkat.

## Next recommendation
- Pakai pola copy-density ini untuk halaman Admin Store Ops lain yang masih memiliki microcopy panjang, terutama Payment Audit dan Shipping Reconciliation.
