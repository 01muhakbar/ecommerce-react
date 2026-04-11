# Task 4A - Client Bundle & Performance Hardening

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Area yang diaudit:
- Client route tree di `client/src/App.jsx`.
- Output build Vite client.
- Chunk manual vendor existing di `client/vite.config.ts`.
- Import page/layout yang masih eager di storefront, account, seller, dan admin.

Perbaikan yang dilakukan:
- Mengubah page/layout yang aman menjadi route-level lazy import di `client/src/App.jsx`.
- Mempertahankan `StoreCartPage` sebagai import eager karena modul itu sudah dipakai statically oleh `StoreLayout` dan `StoreMicrositeShell`; lazy import untuk modul ini tidak memecah chunk dan memunculkan warning Vite.
- Menggunakan Suspense fallback existing, tanpa redesign UI dan tanpa perubahan contract backend.

Scope yang tidak disentuh:
- Tidak mengubah flow checkout/order/account.
- Tidak mengubah API/backend.
- Tidak mengubah state management.
- Tidak menambah dependency atau strategi bundling baru.

## 2. Temuan Utama

Hotspot awal:

| Area | Temuan | Risiko |
| --- | --- | --- |
| Main entry chunk | `index-DXfxOyob.js` sekitar 1,302,183 bytes sebelum patch | First load storefront membawa terlalu banyak page code |
| Eager page import | Storefront, account, seller, dan beberapa admin page masih ikut di entry path | Route yang jarang dibuka membebani boot awal |
| Admin customization | `StoreCustomization` tetap besar, sekitar 213 kB final | Masih perlu refactor komponen lebih dalam bila ingin diperkecil |
| Vendor UI | `vendor-ui` sekitar 234 kB final | Masih aman dari warning, tetapi menjadi kandidat audit lanjutan |

Constraint:
- `client/vite.config.ts` sudah punya manual vendor chunking yang cukup lokal dan aman.
- Perbaikan paling aman adalah route/page lazy loading, bukan refactor bundling besar.
- `StoreCartPage` tidak efektif di-lazy-load karena masih menjadi static dependency layout/shell existing.

## 3. Perubahan yang Dilakukan

### Route/Page Lazy Loading

Di `client/src/App.jsx`, page/layout berikut dipisah menjadi lazy chunk:
- Storefront: product detail, checkout, auth store, success, tracking, search, offers, about, contact, policy, FAQ, microsite, KachaBazar demo home.
- Account: account layout, dashboard, orders, order detail/payment, profile, review, notifications, shipping address, store invitation/application.
- Seller: seller layout, workspace home, orders/detail, payment review/profile, store profile, coupons, team, catalog, product detail/authoring.
- Admin secondary: admin layout/auth pages, staff, payment/store application/profile pages, payment audit pages.

Area yang sengaja tidak dioptimalkan:
- `StoreCartPage` tetap eager karena sudah diimpor statically oleh layout/shell existing.
- Deeper component-level splitting untuk `StoreCustomization`, `vendor-ui`, dan shared address/payment helpers ditunda agar tidak memicu refactor lebih besar.

### Import Cleanup

- Import page eager diganti menjadi `lazy(() => import(...))` di route boundary.
- Static import hanya dipertahankan untuk provider/guard/bridge/layout store yang menjadi shell utama atau sudah dipakai statically oleh consumer lain.

### Loading Boundary

- Menggunakan Suspense fallback existing di `App.jsx`.
- Tidak menambahkan loading UX baru karena fallback global sudah ada dan task ini tidak menargetkan redesign.

## 4. Dampak Bisnis

- Risiko first load storefront menurun karena entry chunk utama turun dari sekitar 1.30 MB menjadi sekitar 139.70 kB.
- Warning Vite untuk chunk JavaScript di atas 500 kB hilang pada build final.
- Route checkout/order/account tetap memakai contract dan komponen existing, sehingga risiko perubahan bisnis rendah.
- Storefront lebih siap untuk traffic publik karena kode admin/seller/account yang tidak langsung dipakai tidak lagi ikut membebani entry awal.

## 5. Known Limitations

| Status | Item | Catatan |
| --- | --- | --- |
| [!] | `StoreCustomization-Cut7mcXS.js` sekitar 213,230 bytes | Masih cukup besar, tetapi sudah isolated sebagai chunk admin page. Butuh task terpisah bila ingin split editor/customization internal. |
| [!] | `vendor-ui-Cx438ilq.js` sekitar 233,988 bytes | Masih di bawah warning. Audit import icon/UI lib lebih dalam bisa jadi quick win lanjutan. |
| [!] | `userAddress-BEZCkeE_.js` sekitar 110,175 bytes | Shared account/checkout helper masih cukup besar; refactor lebih dalam perlu audit consumer. |
| selesai | Main entry chunk | Final `index-DvPEbID_.js` sekitar 139,703 bytes dan tidak memicu warning 500 kB. |
| selesai | Checkout route chunk | Final `Checkout-RZg5wrR3.js` sekitar 62,782 bytes, tetap route-level chunk. |

## 6. Checklist Status

- selesai - Audit bundle hotspot client.
- selesai - Route/page lazy loading aman diterapkan.
- selesai - Import eager yang paling membebani entry chunk dirapikan.
- selesai - Flow kritis tidak diubah secara bisnis.
- selesai - `pnpm -F client build` lulus.
- selesai - `pnpm qa:mvf:visibility:frontend` lulus.
- selesai - Vite chunk warning `> 500 kB` tidak muncul pada build final.
- belum - Deep split untuk `StoreCustomization`, `vendor-ui`, dan `userAddress`.
- [!] butuh keputusan - Apakah Task berikutnya perlu fokus pada audit import icon/UI library atau split internal admin customization.

## Verifikasi

Command yang dijalankan:
- `pnpm -F client build` - lulus.
- `pnpm qa:mvf:visibility:frontend` - lulus.
- `git diff --check` - lulus; hanya menampilkan warning line ending existing pada beberapa file.

Ukuran chunk final terbesar:
- `vendor-ui-Cx438ilq.js`: 233,988 bytes.
- `StoreCustomization-Cut7mcXS.js`: 213,230 bytes.
- `vendor-react-BfD5yToJ.js`: 194,210 bytes.
- `vendor-misc-Dsdk8u3x.js`: 177,408 bytes.
- `index-DvPEbID_.js`: 139,703 bytes.
- `userAddress-BEZCkeE_.js`: 110,175 bytes.

## Rekomendasi Task Berikutnya

Task Prompt berikutnya yang paling logis:
- Audit import `vendor-ui` dan icon usage untuk memastikan tidak ada import barrel besar yang bisa diganti dengan import lebih spesifik.
- Audit `StoreCustomization` internal split jika admin customization perlu diperkecil lebih lanjut.
- Audit shared `userAddress` helper consumer sebelum melakukan split lebih dalam di checkout/account.
