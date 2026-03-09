# TASK-1 Audit & Perfectkan MVF Store -> Checkout -> Admin Order Sync

Date: 2026-03-07 (Asia/Singapore)  
Workspace: `C:\Users\user\Documents\ecommerce-react`

## CODEx REPORT

### Ringkasan

- Audit end-to-end menunjukkan flow MVF inti sudah backend-driven dan stabil:
  - katalog store memakai endpoint backend nyata
  - checkout membuat order real di database
  - admin orders membaca order checkout yang sama
  - update status di admin tersimpan dan terbaca ulang di tracking/account
- Tidak ditemukan blocker yang membutuhkan perubahan schema DB, kontrak API breaking, atau refactor besar.
- Perbaikan kode yang dilakukan hanya satu gap kecil di area account order: link fallback login `401` diarahkan ke route store yang benar.

### Area yang diaudit

- Root:
  - `README.md`
  - `MVP_TEST_SCRIPT.md`
  - `CODEx_REPORTS/TASK-0.md`
  - `package.json`
- Client:
  - `client/src/App.jsx`
  - `client/src/storefront.jsx`
  - `client/src/hooks/useCart.ts`
  - `client/src/store/cart.store.ts`
  - `client/src/api/cartApi.ts`
  - `client/src/api/store.service.ts`
  - `client/src/pages/store/KachaBazarDemoHomePage.jsx`
  - `client/src/pages/store/StoreSearchPage.jsx`
  - `client/src/pages/store/StoreCategoryPage.jsx`
  - `client/src/pages/store/StoreProductDetailPage.jsx`
  - `client/src/pages/store/StoreCartPage.jsx`
  - `client/src/pages/store/Checkout.jsx`
  - `client/src/pages/store/StoreCheckoutSuccessPage.jsx`
  - `client/src/pages/store/StoreOrderTrackingPage.jsx`
  - `client/src/pages/account/AccountOrdersPage.jsx`
  - `client/src/pages/account/AccountOrderDetailPage.jsx`
  - `client/src/pages/admin/Orders.jsx`
  - `client/src/pages/admin/OrderDetail.jsx`
  - `client/src/lib/adminApi.js`
- Server:
  - `server/src/app.ts`
  - `server/src/routes/store.ts`
  - `server/src/routes/admin.orders.ts`
  - `server/src/routes/cartRoutes.ts`
  - `server/src/controllers/cartController.ts`
  - `server/src/routes/public.ts`

### File yang diubah

- `client/src/pages/account/AccountOrdersPage.jsx`
- `MVP_TEST_SCRIPT.md`
- `CODEx_REPORTS/TASK-1.md`

### Temuan Audit

#### A. Bug fungsional

- Tidak ditemukan bug fungsional besar pada flow utama `store -> checkout -> admin orders -> status sync`.
- Flow runtime yang diuji semuanya PASS.

#### B. Gap sinkronisasi data

- Tidak ditemukan mismatch kontrak yang memutus MVF.
- Verifikasi manual tambahan menunjukkan status hasil update admin sinkron pada tiga pembaca client:
  - `/api/store/orders/:ref`
  - `/api/store/my/orders`
  - `/api/store/orders/my/:id`

#### C. Gap kecil UX yang mengganggu MVF

- `client/src/pages/account/AccountOrdersPage.jsx`
  - Saat API mengembalikan `401`, link fallback mengarah ke `/login`.
  - Route store yang valid di repo adalah `/auth/login`.
  - Ini tidak memutus checkout/admin sync, tetapi merusak recovery path di area account orders saat sesi habis.

### Perbaikan yang dilakukan

- Mengubah link fallback login pada `AccountOrdersPage` dari `/login` menjadi `/auth/login`.
- Memperbarui `MVP_TEST_SCRIPT.md` agar checklist manual mencakup:
  - verifikasi `/user/my-orders`
  - verifikasi `/user/my-orders/:id` atau tracking setelah admin update status
  - catatan route login store yang benar

### Validasi Source of Truth

#### Sudah backend-driven

- Home:
  - kategori dari `/api/store/categories`
  - produk dari `/api/products`
  - kupon dari `/api/store/coupons`
- Search:
  - hasil dari `/api/products`
- Category:
  - kategori dari `/api/store/categories`
  - produk kategori dari `/api/store/products`
- Product detail:
  - detail dari `/api/store/products/:id-or-slug`
  - related products dari `/api/products`
- Cart auth flow:
  - baca/update cart dari `/api/cart`
- Checkout:
  - create order ke `/api/store/orders`
- Success:
  - menampilkan ref backend nyata dari response checkout
- Tracking:
  - baca order dari `/api/store/orders/:ref`
- Account orders:
  - baca list dari `/api/store/my/orders`
- Account order detail:
  - baca detail dari `/api/store/orders/my/:id`
- Admin orders:
  - list/detail/update dari `/api/admin/orders*`

#### Fallback yang masih ada tetapi tidak memutus MVF inti

- `useCart` tetap punya guest/local fallback sebelum auth remote aktif.
- Ini bukan source of truth order final; checkout tetap memakai endpoint backend terproteksi.

#### Debt yang belum disentuh karena out of scope

- `qa:mvf` saat ini belum mengotomasi verifikasi `account orders` dan `account order detail`; saya sudah verifikasi area ini manual/API.
- Beberapa dummy/config fallback di luar flow order inti masih ada di repo, tetapi tidak menjadi blocker MVF task ini.

### Verifikasi

- [x] Build
  - `pnpm --filter client exec vite build`
- [x] Smoke
  - `pnpm qa:mvf`
  - Hasil: `20/20 passed`
  - Artifact:
    - `.codex-artifacts/qa-mvf/20260307-122116/result.json`
    - `.codex-artifacts/qa-mvf/20260307-122116/summary.txt`
- [x] Manual check
  - register + login store user
  - add to cart
  - create order
  - admin update status ke `shipping`
  - re-check:
    - `/api/store/orders/:ref`
    - `/api/store/my/orders`
    - `/api/store/orders/my/:id`
  - hasil:
    - tracking status = `shipping`
    - account orders status = `shipping`
    - account detail status = `shipping`

### Hasil

`PASS`

### Catatan risiko

- Flow guest cart masih mengandalkan fallback lokal sebelum auth; ini aman untuk pre-checkout, tetapi tetap bukan source of truth final.
- `qa:mvf` belum meng-cover loop sinkronisasi balik ke account area, jadi regresi di area itu masih bergantung ke manual/API check sampai automation diperluas.

### Yang sengaja tidak disentuh

- Tidak mengubah schema database.
- Tidak mengubah kontrak request/response API.
- Tidak mengubah logic order/cart/auth lintas modul.
- Tidak menyentuh halaman admin lain, styling global besar, atau parity UI di luar flow MVF.

### Next step yang disarankan

- `TASK-2` yang aman dan bernilai tinggi:
  - perluas `qa:mvf` agar otomatis memverifikasi `account orders` dan `account order detail` setelah admin update status
  - tetap tanpa ubah kontrak API atau schema DB
