# P0-STORE-CUSTOMIZATION-STORYBOARD-UX-02 Report

## Ringkasan

Redesign UI/UX halaman `/admin/store/customization?storeTab=home-settings` diterapkan di sisi Admin dengan pendekatan glassmorphism, overview cards, Main Slider Review Detail, Quick Edit popover, dan AI Suggestions yang hanya presentational/local. Editor existing tetap dipertahankan dan dibuat tetap collapsed melalui area advanced editor.

Tidak ada perubahan schema database, auth/session/permission, payment/order/shipping, endpoint backend, atau payload API.

## ACUAN

### AMATI

File yang dibaca:

- `client/src/pages/admin/StoreCustomization.jsx`
- `client/src/lib/adminApi.js`
- `server/src/routes/admin.storeCustomization.ts`
- `server/src/routes/store.customization.ts`
- `client/src/pages/store/StoreHomePage.jsx`
- `client/src/components/Layout/StoreLayout.jsx`
- `client/src/components/AdminGuard.jsx`
- `client/src/auth/AuthContext.jsx`
- `client/src/components/layouts/AdminLayout.jsx`
- `client/src/components/guards/RequirePerm.jsx`
- `client/src/constants/permissions.js`
- `reports/p0-admin-store-customizations-modern-storyboard-01-report.md`

Fitur yang sudah ada:

- Store Customization Admin sudah memakai React Query untuk fetch/mutation.
- API service sudah tersedia melalui `fetchAdminStoreCustomization` dan `updateAdminStoreCustomization`.
- Public customization API sudah tersedia untuk storefront.
- Storefront membaca customization melalui route publik dan render section home yang ada.
- UI existing sudah punya section cards, review state, quick action state, advanced editor, language selector, canonical `storeTab`, loading/error/update flow, dan save/update existing.

Gap yang ditemukan:

- Default page masih terasa seperti form/settings page dan belum cukup review-first.
- Main Slider belum punya detail review yang terasa sebagai fokus utama storyboard.
- Quick Edit belum menjadi popover ringkas untuk editing slider.
- AI Suggestions perlu hadir sebagai UI lokal/presentational tanpa endpoint AI.
- Mobile perlu dijaga agar tidak ada horizontal overflow dari komponen baru.

Risiko perubahan:

- UI Store Customization cukup besar dan punya banyak state lokal.
- Main Slider terhubung ke payload customization yang dipakai storefront, sehingga field existing harus dipertahankan.
- Admin shell/sidebar punya perilaku responsive sendiri, sehingga verifikasi mobile perlu dilakukan dengan sidebar collapsed sesuai pola admin mobile.

### TIRU

Pola existing repo yang ditiru:

- React Query fetch/mutation existing di `StoreCustomization.jsx`.
- Service layer existing di `client/src/lib/adminApi.js`.
- Existing admin layout dan `AdminOpsPageHeader`.
- Existing loading, error, empty, status badge, dirty state, dan update button.
- Existing state handlers untuk review, quick action, AI suggestion, Main Slider tabs, image upload, dan save.
- Existing canonical `storeTab` dan language selector.

API/service/component/hook yang dipakai ulang:

- `fetchAdminStoreCustomization`
- `updateAdminStoreCustomization`
- `AdminOpsPageHeader`
- `AdminOpsStatusBadge`
- `useQuery`
- `useMutation`
- Existing `onSave`, `onReviewSection`, `onQuickAction`, `onShowAiSuggestion`
- Existing Main Slider field handlers

### MODIFIKASI

File yang diubah:

- `client/src/pages/admin/StoreCustomization.jsx`
- `reports/P0-STORE-CUSTOMIZATION-STORYBOARD-UX-02-report.md`

File yang tidak disentuh:

- Database schema dan migration
- Auth/session/permission files
- Payment/order/shipping files
- Backend route payload contract
- Public storefront rendering files
- Seller workspace files

QA yang dijalankan:

- Client build
- Server build
- Relevant store readiness smoke
- Relevant store settings smoke
- Responsive verification via Playwright fallback

## Perubahan UI/UX

### Admin

- Default home-settings sekarang menjadi overview modern dengan glass overview cards.
- Main Slider mendapatkan Review Detail yang lebih jelas, fokus ke slider image, title, description, CTA, readiness, dan local AI suggestion panel.
- Quick Edit popover tersedia untuk Main Slider:
  - Update title
  - Upload image memakai handler existing
  - Refine with AI button hanya membuka suggestion lokal
  - Save memakai update flow existing
- AI Suggestions dibuat local/presentational-only, tanpa endpoint dan tanpa payload baru.
- Advanced section editor tetap ada dan collapsed.
- Layout dibuat responsive dengan button stack dan popover mobile inline untuk menghindari overflow.
- Language selector dan canonical `storeTab` tetap dipertahankan.

### Seller

- Tidak ada perubahan.

### Client/Storefront

- Tidak ada perubahan kode.
- Public storefront tetap membaca customization dari route publik existing.
- Payload customization tidak diubah.

### Backend

- Tidak ada perubahan route, controller, schema, auth, atau payload API.

## QA Result

### Build

- `pnpm.cmd --filter client exec vite build`: PASS
- `pnpm.cmd -F server build`: PASS

Catatan: Vite tetap menampilkan warning chunk size `vendor-misc` lebih dari 500 kB. Ini warning existing dan bukan akibat perubahan kontrak.

### Smoke

- `pnpm.cmd -F server smoke:store-readiness`: PASS
- `pnpm.cmd -F server smoke:store-settings`: PASS

### Static Check

- `git diff --check`: PASS

### Browser/Responsive Verification

In-app Browser plugin tidak tersedia pada sesi ini (`Browser is not available: iab`), jadi verifikasi dilakukan dengan Playwright fallback terhadap local app.

Artifacts:

- `.codex-artifacts/P0-STORE-CUSTOMIZATION-STORYBOARD-UX-02/desktop-store-customization.png`
- `.codex-artifacts/P0-STORE-CUSTOMIZATION-STORYBOARD-UX-02/mobile-store-customization.png`
- `.codex-artifacts/P0-STORE-CUSTOMIZATION-STORYBOARD-UX-02/browser-check.json`

Hasil final dengan admin sidebar collapsed untuk mobile:

- Desktop overview visible: PASS
- Desktop Main Slider Review Detail visible: PASS
- Desktop Quick Edit visible: PASS
- Desktop no horizontal overflow: PASS
- Mobile overview visible: PASS
- Mobile Main Slider Review Detail visible: PASS
- Mobile Quick Edit visible: PASS
- Mobile no horizontal overflow: PASS

## Risiko Tersisa

- Admin shell/sidebar non-collapsed pada viewport sangat kecil masih dapat membuat body lebih lebar dari viewport. Pada pola mobile admin dengan sidebar collapsed, halaman Store Customization sudah PASS tanpa horizontal overflow.
- AI Suggestions masih local/presentational sesuai acceptance. Konten suggestion belum personalized oleh backend atau model AI.
- Vite chunk-size warning masih ada dan perlu task terpisah jika ingin optimasi bundle.

## Next Recommendation

- Tambahkan smoke atau Playwright E2E khusus admin Store Customization untuk membuka Review Detail, Quick Edit, upload image mock, dan save.
- Lanjutkan polish responsive admin shell/sidebar sebagai task terpisah jika ingin menjamin no-overflow ketika sidebar dipaksa terbuka di mobile.
- Pertahankan payload customization existing sampai ada task khusus contract/API.
