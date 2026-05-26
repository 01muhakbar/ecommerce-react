# P0 Admin Store Customizations Modern Storyboard 01 Report

## Ringkasan

- Redesign `/admin/store/customization?storeTab=home-settings` menjadi review workspace yang lebih ringkas, modern, dan glass-like.
- Menambahkan overview Home Page section cards, `Optimization Suggestions`, expanded `Main Slider Detail`, dan quick action menu non-destruktif.
- Memindahkan form panjang Home Page existing ke `Advanced section editor` yang collapsed by default.
- Tidak mengubah backend, API contract, schema, auth/permission, payment/order/shipping, Seller Workspace, atau Client/storefront behavior.

## Mapping Storyboard

### Panel 1 — Tampilan Utama / Keadaan Default

- Header tetap ringkas: `Store Customizations` dan `Customize storefront sections, labels, and SEO.`
- Summary cards dibuat stat-only: Home Page, Language, Sections, State.
- Tabs dipolish menjadi chip modern yang wrap aman.
- Home Page default sekarang menampilkan section overview cards dan `Optimization Suggestions` berbasis data existing.
- Visual cue storyboard dipakai sebagai label kecil: `Minimalis & Bersih`, `Visual seperti Kaca`, `Personalisasi & AI`.

### Panel 2 — Tampilan Tinjauan yang Diperluas

- Tombol `Review` pada `Main Slider` membuka `Main Slider Detail`.
- Detail berisi upload area ringkas, preview, fields utama, `Generate with AI`, dan `Save Section`.
- AI helper hanya presentational/local hint, tidak memanggil backend baru dan tidak autosave.
- Advanced full editor tetap tersedia melalui accordion/collapsible.

### Panel 3 — Menu Tindakan / Keputusan Cepat

- Tombol `...` pada section card membuka dropdown glass-like.
- Action aman: `Review`, `Open preview`, `Generate plan`, `Copy section key`.
- Tidak ada `Delete` dan tidak ada workflow contact/email palsu.
- Mobile menggunakan dropdown yang tetap stack aman dan tidak menyebabkan page-level overflow.

## Perubahan UI/UX

- Summary metric lama yang banyak helper text diganti dengan cards pendek dan glass-like.
- Default Home Page tidak lagi langsung membuka seluruh form panjang.
- Section cards menyediakan signal pendek, status badge, Review, dan quick actions.
- `Advanced section editor` tidak merender form panjang saat collapsed, sehingga mobile/tablet lebih stabil.
- Header actions, badges, dan card actions dibuat wrap-safe untuk viewport sempit.

## File Diubah

- `client/src/pages/admin/StoreCustomization.jsx`
- `reports/p0-admin-store-customizations-modern-storyboard-01-report.md`

## File Dibaca

- `client/src/pages/admin/StoreCustomization.jsx`
- `client/src/components/admin/AdminOpsPrimitives.jsx`
- `client/src/components/Layout/Sidebar.jsx`
- `client/src/App.jsx`
- `client/src/lib/adminApi.js`
- `server/src/routes/admin.storeCustomization.ts` (inspected via route/API search)
- `server/src/routes/store.customization.ts` (inspected via route/API search)
- `reports/p0-admin-store-ops-ux-sync-03-report.md`
- `reports/p0-store-ops-smoke-sync-02-report.md` (referenced via prior Store Ops context)

## QA Result

- `pnpm.cmd --filter client exec vite build`: PASS. Existing large chunk warning remains.
- `pnpm.cmd -F server build`: PASS.
- `pnpm.cmd -F server smoke:store-readiness`: PASS.
- `pnpm.cmd -F server smoke:store-settings`: PASS.
- `pnpm.cmd -F server smoke:store-customization`: NOT RUN. No aggregate `smoke:store-customization` script exists; available scripts are section-specific customization smokes.
- `git diff --check`: PASS.

## Browser Check

- In-app Browser connection was unavailable for `iab`, so Playwright was used against local `http://localhost:5173` with API mocks for admin auth, languages, and store customization.
- Checked `/admin/store/customization?storeTab=home-settings` at:
  - desktop 1440px: PASS
  - tablet 768px: PASS
  - mobile 390px: PASS
- Validated header, update button, summary cards, tabs, `Optimization Suggestions`, quick menu, Review expanded detail, `Generate with AI`, `Save Section`, no `Delete`, and no page-level horizontal overflow.
- Artifact: `.codex-artifacts/p0-admin-store-customizations-modern-storyboard-01/browser-check.json`

## Dampak Admin/Seller/Client/Backend

### Admin

- Store Customizations Home Page now opens as a compact review workspace.
- Existing language selector, add language, Update, and active tab routing are preserved.
- Full field editor remains available in `Advanced section editor`.

### Seller

- No Seller Workspace route, API, ownership, permission, or behavior changed.

### Client / Storefront

- No public storefront rendering contract changed.
- Store customization payload still comes from the existing admin API and public storefront still reads existing sanitized backend data.

### Backend / API

- No backend file changed.
- No schema, migration, API contract, auth, permission, payment, order, or shipping behavior changed.

## Risiko Tersisa

- StoreCustomization remains a large page/chunk; this task intentionally avoided splitting the internal editor.
- AI-related controls are presentational/local only; they do not generate backend content.
- Browser check used mocked API responses to validate UI behavior and responsiveness, not a live customization persistence write.

## Next Recommendation

- Add a dedicated aggregate `smoke:store-customization` script or a UI smoke for Store Customizations home-settings.
- Apply the same overview + collapsed advanced editor pattern to Payment Audit, Shipping Reconciliation, and Store Applications only after this page is accepted.
