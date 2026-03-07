# TASK-1 Baseline Command Discipline + Dummy Fallback Audit

Date: 2026-03-06 (Asia/Singapore)  
Workspace: `C:\Users\user\Documents\ecommerce-react`

## Task ID

`TASK-1`

## Objective

Membakukan command kerja harian Codex dan memetakan fallback runtime yang masih ada di frontend, lalu mengklasifikasikan mana yang aman, mana yang berisiko ke sinkronisasi Admin ↔ Client, dan mana yang sebaiknya diprioritaskan untuk patch kecil berikutnya.

## Files Audited

- `package.json`
- `README.md`
- `DEVELOPMENT.md`
- `client/src/api/products.service.js`
- `client/src/api/orders.service.js`
- `client/src/pages/store/KachaBazarDemoHomePage.jsx`
- `client/src/hooks/useCart.ts`
- `client/src/pages/store/StoreAboutUsPage.jsx`
- `client/src/pages/store/StoreFaqPage.jsx`
- `client/src/pages/store/StoreContactUsPage.jsx`
- `client/src/pages/store/StoreOffersPage.jsx`
- `client/src/pages/store/StorePrivacyPolicyPage.jsx`
- `client/src/pages/store/StoreTermsAndConditionsPage.jsx`
- `client/src/pages/admin/StoreCustomization.jsx`
- `client/src/pages/admin/StoreSettings.jsx`
- `client/src/components/Layout/Navbar.jsx`

## Files Changed

- `CODEx_REPORTS/TASK-1.md`
- `README.md`
- `DEVELOPMENT.md`

## Baseline Command Discipline

### Command Utama

- Install dependency:
  - `pnpm install`
- Jalankan seluruh stack:
  - `pnpm dev`
- Jalankan server saja:
  - `pnpm dev:server`
- Jalankan client saja:
  - `pnpm dev:client`
- Reset DB lokal:
  - `pnpm --filter server db:reset`
- Seed demo baseline:
  - `pnpm --filter server seed:demo`
- Build client:
  - `pnpm --filter client exec vite build`
- Smoke MVF:
  - `pnpm qa:mvf`

### Command Cadangan

- Cek DB health:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\db-health.ps1`
- Sync schema tanpa reset:
  - `pnpm db:sync`
- Seed tambahan:
  - `pnpm seed:analytics`
  - `pnpm seed:customers`
- UI QA opt-in:
  - `pnpm qa:ui`

### Catatan Environment

- Port default:
  - client `5173`
  - server `3001`
- Vite bisa pindah port jika `5173` sibuk.
- `mysql` CLI tidak wajib ada di PATH karena `scripts/db-health.ps1` sudah fallback ke `c:\xampp\mysql\bin\mysql.exe`.
- Seed baseline yang paling aman untuk sesi audit/dev adalah:
  - `pnpm --filter server db:reset`
  - `pnpm --filter server seed:demo`
  - `pnpm dev`
- Artifact `qa:mvf` disimpan di `.codex-artifacts/qa-mvf/<runId>/`.

## Fallback Findings

1. `client/src/api/products.service.js`
   - Admin products service punya dummy fallback untuk list/create/update/delete.
   - Aktif hanya saat `import.meta.env.DEV` dan `VITE_ALLOW_DUMMY_PRODUCTS === "true"`.

2. `client/src/api/orders.service.js`
   - Admin orders service punya dummy fallback untuk list dan update status.
   - Aktif hanya saat `import.meta.env.DEV` dan `VITE_ALLOW_DUMMY_ORDERS === "true"`.

3. `client/src/pages/store/KachaBazarDemoHomePage.jsx`
   - Home demo memakai `dummyCoupons` bila fetch coupon publik gagal atau kosong.

4. `client/src/hooks/useCart.ts`
   - Cart punya guest-mode fallback dan `fallbackCart` berbasis store/local snapshot.
   - Dipakai saat user belum remote-auth, auth hilang, atau snapshot remote stale.

5. `client/src/pages/store/StoreAboutUsPage.jsx`
   - Ada `DEFAULT_ABOUT_US` untuk normalisasi field customization yang kosong.

6. `client/src/pages/store/StoreFaqPage.jsx`
   - Ada `DEFAULT_FAQS` untuk page header, left image, dan item list.

7. `client/src/pages/store/StoreContactUsPage.jsx`
   - Ada `DEFAULT_CONTACT_US` untuk info kontak dan deskripsi form.
   - Form submit masih local-only success simulation, bukan backend submission.

8. `client/src/pages/store/StoreOffersPage.jsx`
   - Ada `DEFAULT_OFFERS` untuk page header dan `activeCouponCode`.

9. `client/src/pages/store/StorePrivacyPolicyPage.jsx`
   - Ada `DEFAULT_POLICY`, tetapi halaman tetap empty bila payload policy tidak ada.

10. `client/src/pages/store/StoreTermsAndConditionsPage.jsx`
    - Ada `DEFAULT_TERMS`, tetapi halaman tetap empty bila payload terms tidak ada.

11. `client/src/pages/admin/StoreCustomization.jsx`
    - Admin form memakai `getDefaultCustomization()` dan sejumlah default HTML/text agar form tetap bisa dirender walau response belum lengkap.

12. `client/src/pages/admin/StoreSettings.jsx`
    - Admin settings memakai `DEFAULT_STORE_SETTINGS` untuk inisialisasi dan normalisasi.

13. `client/src/components/Layout/Navbar.jsx`
    - Language selector memakai fallback ke storage, lalu `en`, lalu language published pertama.

## Fallback Classification

### SAFE-DEMO

- `client/src/hooks/useCart.ts`
  - Guest cart fallback adalah perilaku yang memang dibutuhkan untuk flow guest user.
  - Tidak mengubah source of truth admin; lebih ke mode lokal sementara sebelum login.

- `client/src/components/Layout/Navbar.jsx`
  - Fallback language hanya untuk pengalaman admin navbar saat daftar bahasa belum termuat.
  - Tidak menulis kontrak data baru ke backend.

### RISKY-SYNC

- `client/src/api/products.service.js`
  - Jika env mengaktifkan dummy fallback, admin bisa melihat list/create/update/delete produk lokal yang tidak berasal dari backend.
  - Risiko langsung pada sinkronisasi `products` antara Admin dan Client.

- `client/src/api/orders.service.js`
  - Jika env mengaktifkan dummy fallback, admin orders bisa tampak hidup walau API gagal.
  - Ini paling berbahaya karena bisa menyamarkan bug fetch/status update dan menipu audit persist status.

- `client/src/pages/store/KachaBazarDemoHomePage.jsx`
  - `dummyCoupons` membuat homepage tetap terlihat punya promo walau coupon publik kosong/gagal dimuat.
  - Risiko pada sinkronisasi `coupons` dan `customization/home promo`.

- `client/src/pages/store/StoreContactUsPage.jsx`
  - Info konten adalah config backup, tetapi submit form masih local-only success simulation.
  - Ini bukan sync Admin ↔ Client utama, tapi bisa memberi impresi fitur contact sudah benar-benar tersambung.

### CONFIG-BACKUP

- `client/src/pages/store/StoreAboutUsPage.jsx`
- `client/src/pages/store/StoreFaqPage.jsx`
- `client/src/pages/store/StoreContactUsPage.jsx` untuk field konten
- `client/src/pages/store/StoreOffersPage.jsx`
- `client/src/pages/store/StorePrivacyPolicyPage.jsx`
- `client/src/pages/store/StoreTermsAndConditionsPage.jsx`
- `client/src/pages/admin/StoreCustomization.jsx`
- `client/src/pages/admin/StoreSettings.jsx`

Alasan:

- Fallback ini dipakai untuk menormalkan shape data ketika field konfigurasi belum lengkap.
- Mayoritas tidak menimpa payload backend; hanya mengisi default value agar UI tidak kosong/pecah.
- Masih boleh ada selama source of truth tetap backend dan kondisi empty/error tetap terlihat jelas.

### REMOVE-LATER

- `client/src/api/products.service.js`
  - Dummy mutation fallback sebaiknya dipisahkan atau dihapus pada task lanjutan kecil.

- `client/src/api/orders.service.js`
  - Dummy list/status update fallback sebaiknya diprioritaskan untuk audit/pengurangan.

- `client/src/pages/store/KachaBazarDemoHomePage.jsx`
  - `dummyCoupons` sebaiknya diganti empty/loading state yang jujur terhadap data publik.

- `client/src/pages/store/StoreContactUsPage.jsx`
  - Submit simulasi lokal sebaiknya dipindah ke task tersendiri: tetap local-only namun diberi label jelas, atau dihubungkan ke backend jika memang dibutuhkan produk.

## Cross-App Sync Risks

### Products

- Risiko tertinggi ada di `client/src/api/products.service.js`.
- Admin bisa bekerja dengan dummy product list saat API gagal, sementara client store tetap membaca data backend yang berbeda.

### Orders

- Risiko tertinggi ada di `client/src/api/orders.service.js`.
- Admin orders/status update bisa tampak sukses di dev fallback, padahal data order real di backend tidak berubah.

### Coupons

- Risiko ada di `client/src/pages/store/KachaBazarDemoHomePage.jsx`.
- Client home bisa tetap menampilkan kupon dummy saat data publik kupon kosong/gagal.

### Customization / Settings

- Mayoritas fallback di content pages dan admin customization/settings adalah config backup, bukan dummy source of truth.
- Risiko utamanya bukan mismatch data CRUD, tetapi UI bisa terlihat “cukup lengkap” walau admin belum benar-benar mengisi semua field.

### Auth / Session

- `useCart.ts` guest fallback aman untuk guest flow, tetapi tetap perlu diawasi agar tidak dianggap sebagai remote cart source.
- Baseline saat ini masih aman karena MVF checkout dan tracking sudah memakai backend real.

## Priority Tindak Lanjut

1. Audit dan kurangi dummy fallback pada admin service:
   - `client/src/api/orders.service.js`
   - `client/src/api/products.service.js`

2. Hilangkan `dummyCoupons` dari home demo dan ganti dengan state yang jujur terhadap response coupon publik.

3. Dokumentasikan dengan tegas bahwa content defaults adalah `config backup`, bukan data publik final.

4. Putuskan status form Contact Us:
   - tetap local placeholder yang dilabeli jelas, atau
   - dijadikan fitur backend-driven pada task terpisah.

## Recommended Next Task

`[TASK-2] Remove Risky Admin Dummy Fallbacks (Orders + Products Read Path Audit)`

Scope aman:

- fokus hanya audit/patch kecil pada `client/src/api/orders.service.js` dan `client/src/api/products.service.js`
- jangan sentuh contract API
- jangan ubah schema
- target utamanya membuat dev gagal dengan jujur saat API admin gagal, bukan diam-diam pindah ke dummy data

## Final Status

`PASS`
