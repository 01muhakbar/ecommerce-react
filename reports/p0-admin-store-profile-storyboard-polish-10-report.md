# P0 Admin Store Profile Storyboard Polish 10 Report

## Ringkasan perubahan
- Memoles table review queue Store Profile agar kolom `Priority` dan `Actions` tidak terpotong.
- Menghapus tombol `Review` dari summary cards sehingga area atas kembali stat-only.
- Menjaga `Review Priorities` hanya tampil di layar besar agar tabel tetap menjadi area utama.
- Mengganti quick action `Contact seller` menjadi `Copy owner email` dan tetap menghindari destructive action.
- Membuat checklist missing fields lebih readable dengan label pendek seperti `Description`, `Email`, `Address`, dan `Postal code`.
- Memadatkan expanded detail serta membuat row yang sedang direview lebih jelas dengan tombol `Close`.

## Before/after UX
- Before: tabel masih terasa sempit ketika panel prioritas tampil, header `Priority` berisiko terpotong, dan action row terlalu rapat.
- After: tabel memakai min-width lebih stabil, kolom Store/Owner tetap truncate, `Priority` dan `Actions` tampil penuh, serta panel prioritas tidak menekan tabel pada desktop 1440/tablet.
- Before: summary cards punya action kecil `Review` yang bisa disalahartikan sebagai entry point utama.
- After: summary cards hanya menampilkan status/metrik.
- Before: expanded checklist memakai label panjang yang mudah berubah menjadi ellipsis ekstrem.
- After: checklist memakai label pendek manual dan dua kolom saat ruang cukup.

## File diubah
- `client/src/pages/admin/AdminStoreProfilePage.jsx`
- `reports/p0-admin-store-profile-storyboard-polish-10-report.md`

## QA result
- `pnpm.cmd --filter client exec vite build` - PASS. Ada warning existing Vite chunk `vendor-misc` > 500 kB.
- `pnpm.cmd -F server build` - PASS.
- `pnpm.cmd -F server smoke:store-readiness` - PASS.
- `pnpm.cmd -F server smoke:store-settings` - PASS.
- `git diff --check` - PASS.

## Browser check result
- Local Playwright fallback dengan mocked admin session dan 55 store profile entries - PASS.
- `/admin/online-store/store-profile` terbuka dan tabel terlihat.
- Header `Priority` tampil penuh dengan width 116px pada viewport 1440.
- Header `Actions` tampil penuh dengan width 177px pada viewport 1440.
- Summary cards tidak memiliki tombol `Review`.
- `Review Priorities` hidden pada 1440px/tablet dan tampil pada 1600px tanpa page overflow.
- `Review` membuka expanded detail dan tombol berubah menjadi `Close`.
- `Save Core Identity` terlihat setelah expand.
- Checklist missing fields memakai label readable tanpa `Store d...` atau `Origin ...`.
- More menu terbuka dan berisi `Review`, `Open`, `Copy slug`, `Copy owner email`.
- Tidak ada action `Delete` atau `Contact seller`.
- Search, filter chips, dan sort dropdown terlihat.
- Sidebar `Online Store` expanded dan item `Store Profile` aktif.
- Tablet 768px memakai internal table scroll dan tidak menimbulkan page-level horizontal overflow.
- Screenshot/artifact: `.codex-artifacts/p0-admin-store-profile-storyboard-polish-10/`

## Dampak Admin/Seller/Client/Backend
- Admin: hanya polish UI Store Profile review queue, action review/open/save tetap dipertahankan.
- Seller: tidak ada perubahan behavior Seller Workspace atau source of truth seller-owned fields.
- Client/storefront: route `/store/:slug` tetap dipakai untuk Open Storefront; tidak ada perubahan public rendering.
- Backend/API: tidak ada perubahan endpoint, payload contract, schema, permission, payment, order, atau shipping behavior.

## Risiko tersisa
- Browser check memakai mocked API payload untuk memverifikasi state UI 55 stores; kontrak backend tetap dicek lewat server build dan smoke terkait.
- `Copy owner email` memakai Clipboard API best-effort; jika browser menolak permission, menu tetap tertutup tanpa mengubah data.
- `Review Priorities` sengaja hanya aktif di layar sangat besar agar tabel tidak sempit di desktop umum/tablet.

## Next recommendation
- Jadikan pola table review queue ini sebagai baseline untuk Payment Audit, Shipping Reconciliation, dan Store Applications setelah Store Profile stabil.
