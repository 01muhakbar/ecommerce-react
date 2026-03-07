# TASK-0 Baseline Verification + Kontrak Eksekusi + MVF Smoke

Date: 2026-03-06 (Asia/Singapore)  
Workspace: `C:\Users\user\Documents\ecommerce-react`

## Task ID

`TASK-0`

## Objective

Memverifikasi baseline repo tanpa mengembangkan fitur baru: memastikan workspace, script, runtime client/server, DB health, dan flow MVF Storefront + Admin benar-benar hidup serta terdokumentasi untuk task berikutnya.

## Discovery Summary

### Struktur Repo

- Monorepo `pnpm` dengan workspace:
  - `client`
  - `server`
  - `packages/*`
- Frontend: React + Vite
- Backend: Node/Express + TypeScript + Sequelize
- Shared package terdeteksi di `packages/schemas`

### Port Default

- Client: `5173`
- Server: `3001`
- Catatan: Vite memakai `strictPort: false`, jadi port client bisa pindah jika `5173` sibuk.

### Script Penting

- Root:
  - `pnpm dev`
  - `pnpm dev:server`
  - `pnpm dev:client`
  - `pnpm build`
  - `pnpm db:sync`
  - `pnpm seed:super`
  - `pnpm seed:kachabazar`
  - `pnpm seed:analytics`
  - `pnpm seed:customers`
  - `pnpm qa:mvf`
  - `pnpm qa:ui`
- Server:
  - `pnpm --filter server db:reset`
  - `pnpm --filter server db:sync`
  - `pnpm --filter server seed:demo`
  - `pnpm --filter server seed:super`
  - `pnpm --filter server seed:kacha`
  - `pnpm --filter server migrate`
- Client:
  - `pnpm --filter client dev`
  - `pnpm --filter client build`
  - `pnpm --filter client exec vite build`

### Route Penting

#### Storefront

- `/`
- `/search`
- `/category`
- `/category/:slug`
- `/product/:slug`
- `/cart`
- `/checkout`
- `/checkout/success`
- `/order/:ref`
- `/auth/login`
- `/auth/register`
- `/user/dashboard`
- `/user/my-orders`
- `/user/my-orders/:id`
- `/user/notifications`
- `/user/my-reviews`
- `/user/my-account`
- `/user/shipping-address`
- `/user/update-profile`
- `/user/change-password`

#### Admin

- `/admin/login`
- `/admin`
- `/admin/dashboard`
- `/admin/products`
- `/admin/products/new`
- `/admin/products/:id`
- `/admin/orders`
- `/admin/orders/:invoiceNo`
- `/admin/customers`
- `/admin/customers/:id`
- `/admin/categories`
- `/admin/categories/:code`
- `/admin/coupons`
- `/admin/attributes`
- `/admin/staff`
- `/admin/languages`
- `/admin/currencies`
- `/admin/store/customization`
- `/admin/store-settings`
- `/admin/profile`

### Endpoint Penting

#### System / Health

- `GET /api/health`
- `GET /api/auth/health`

#### Store / Public

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/store/categories`
- `GET /api/store/products`
- `GET /api/store/products/:id-or-slug`
- `GET /api/cart`
- `POST /api/cart/add`
- `PUT /api/cart/items/:productId`
- `DELETE /api/cart/remove/:itemId`
- `POST /api/store/orders`
- `GET /api/store/orders/:ref`
- `GET /api/store/my/orders`
- `GET /api/store/customization`
- `GET /api/store/settings`

#### Admin

- `POST /api/auth/admin/login`
- `POST /api/auth/admin/logout`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`
- `GET /api/admin/products`
- `GET /api/admin/categories`
- `GET /api/admin/settings`
- `GET /api/admin/store/customization`
- `GET /api/admin/store/settings`

### Area Sinkronisasi Data

- `products`: dikelola admin, dibaca client/store.
- `categories`: dikelola admin, dipakai listing/filter/store nav.
- `orders`: dibuat client/store, dipantau dan diubah statusnya di admin.
- `settings/customization`: dikelola admin, dibaca client publik.
- `auth/session`: store customer auth dan admin auth sama-sama berbasis cookie/JWT.

## Files Changed

- `CODEx_REPORTS/TASK-0.md`

## What Changed

- Memperbarui laporan baseline sesuai hasil verifikasi aktual tanggal 2026-03-06.
- Tidak ada perubahan pada file aplikasi `client/src` atau `server/src`.
- Tidak ada perubahan contract API, schema DB, routing inti, atau dependency.

## Verification Run

1. `node -v`  
   PASS -> `v22.19.0`

2. `pnpm -v`  
   PASS -> `10.18.0`

3. `powershell -ExecutionPolicy Bypass -File .\scripts\db-health.ps1`  
   PASS -> MySQL check sukses via fallback `c:\xampp\mysql\bin\mysql.exe`

4. `pnpm install`  
   PASS -> workspace up to date

5. `pnpm --filter server db:reset`  
   PASS

6. `pnpm --filter server seed:demo`  
   PASS  
   Notes:
   - `seed:super` membuat `superadmin@local.dev / supersecure123`
   - `seed:kacha` membuat `8` categories, `16` products, `61` reviews

7. `powershell -ExecutionPolicy Bypass -File .\tmp_dev01_verify.ps1`  
   PASS  
   Notes:
   - `pnpm dev` mengangkat server di `3001` dan client di `5173`
   - verifikasi tambahan menunjukkan client kedua akan fallback ke `5174` jika `5173` sibuk

8. `pnpm --filter client exec vite build`  
   PASS

9. `pnpm qa:mvf`  
   PASS  
   Artifacts:
   - `.codex-artifacts/qa-mvf/20260306-210005/result.json`
   - `.codex-artifacts/qa-mvf/20260306-210005/summary.txt`

10. Route/API smoke tambahan saat `pnpm dev` hidup  
    PASS  
    Checked:
    - `GET /api/health`
    - `GET /checkout`
    - `GET /checkout/success?ref=...`
    - `GET /admin/login`
    - `GET /admin/orders`
    - cart qty plus
    - cart qty minus
    - cart remove

## MVF Result

### Store MVF

- Home -> PASS
- Search route -> PASS
- Search results -> PASS
- Product detail -> PASS
- Add to cart -> PASS
- Cart interaction (plus/minus/remove) -> PASS
- Cart page -> PASS
- Checkout page -> PASS
- Checkout submit -> PASS
- Success page -> PASS
- Tracking page -> PASS
- Tracking API -> PASS

### Admin MVF

- Admin login page -> PASS
- Admin login API -> PASS
- Orders list -> PASS
- Order detail -> PASS
- Update status -> PASS
- Persist after refresh/fetch ulang -> PASS

## Existing Features Identified

### Storefront

- Home / landing
- Search
- Category listing
- Product detail
- Cart
- Checkout
- Checkout success
- Order tracking
- Login / register
- Account dashboard
- Account orders + detail
- Notifications
- My reviews
- My account
- Shipping address
- Update profile
- Change password
- Public content pages:
  - About Us
  - Contact Us
  - Offers
  - FAQ
  - Privacy Policy
  - Terms & Conditions

### Admin

- Admin login
- Dashboard
- Products list/form/detail
- Orders list/detail/status update
- Customers list/detail
- Categories/subcategories
- Coupons
- Attributes
- Staff
- Languages
- Currencies
- Store customization
- Store settings
- Profile
- Permission / guarded routes

### Backend

- Health
- Auth store/admin
- Public/store product/category endpoints
- Cart
- Order creation + tracking
- Admin orders/products/categories/settings
- Public store customization + store settings
- Uploads
- Analytics/stats
- User profile/address/notifications

## Gap / Risk Audit

1. `client/src/api/orders.service.js` masih punya dummy fallback yang bisa aktif di dev jika `VITE_ALLOW_DUMMY_ORDERS=true`. Baseline hari ini lolos memakai API nyata, tetapi area ini tetap kandidat audit agar task berikutnya tidak menguji data palsu tanpa sadar.

2. `client/src/api/products.service.js` masih menyimpan pola dummy products fallback. Ini bukan blocker baseline, tetapi berisiko mengaburkan gap parity bila env dev tertentu mengaktifkannya.

3. Beberapa halaman konten store masih memakai fallback default content ketika customization belum terisi:
   - About Us
   - FAQ
   - Contact Us
   - Offers
   - Privacy Policy
   - Terms & Conditions

4. `client/src/pages/store/KachaBazarDemoHomePage.jsx` masih memiliki `dummyCoupons`. Ini menunjukkan sebagian home parity masih campuran antara data konfigurasi dan data demo.

5. Dokumentasi repo belum sepenuhnya konsisten dengan baseline aktual:
   - `README.md` masih menyebut frontend memakai dummy/mock service sebagai narasi utama
   - runtime saat ini sudah cukup backend-driven untuk MVF

6. `mysql` CLI tidak ada di PATH lokal, tetapi baseline tetap aman karena `scripts/db-health.ps1` sudah punya fallback ke `c:\xampp\mysql\bin\mysql.exe`.

7. Port drift tetap perlu diperhatikan pada sesi dev berikutnya karena client memang bisa pindah dari `5173` ke `5174+`.

## Baseline Command Baku

- Install dependency:
  - `pnpm install`
- DB health:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\db-health.ps1`
- Fresh baseline seed:
  - `pnpm --filter server db:reset`
  - `pnpm --filter server seed:demo`
- Run all:
  - `pnpm dev`
- Run server only:
  - `pnpm dev:server`
- Run client only:
  - `pnpm dev:client`
- Build client:
  - `pnpm --filter client exec vite build`
- MVF smoke:
  - `pnpm qa:mvf`
- Optional UI smoke:
  - `pnpm qa:ui`

## Recommended Next Task

`[TASK-1] Baseline Command Discipline + Dummy Fallback Audit`

Fokus aman setelah TASK-0:

- rapikan dokumentasi command baseline agar satu sumber kebenaran jelas,
- audit area MVF-adjacent yang masih punya dummy fallback,
- identifikasi halaman client yang masih static/default-driven sebelum masuk polishing parity besar.

## Final Status

`PASS`

## STOP Status

- Tidak perlu `STOP`
- Tidak perlu `Rencana Kolaborasi`
- Scope tetap kecil dan aman
