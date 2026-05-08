# MVP Test Script

## Setup
1. Install deps: `pnpm install`
2. Reset DB: `pnpm --filter server db:reset`
3. Seed demo data: `pnpm --filter server seed:demo`
4. Run dev: `pnpm dev`

## Akun Seed (Super Admin)
- Email: `superadmin@local.dev`
- Password: `supersecure123`

## Test Flow (Checklist)
### Storefront
- [ ] Buka `/` (home) OK
- [ ] `/search?q=apple`: results OK
- [ ] `/search?q=zzzzzz`: empty state OK
- [ ] Klik product -> add to cart -> cart page OK
- [ ] Checkout -> success -> dapat ref
- [ ] `/order/:ref`: tracking OK dan membaca status terbaru setelah admin update
- [ ] `/user/my-orders`: order baru tampil dari backend dan status ikut sinkron
- [ ] `/user/my-orders/:id`: detail order membaca status terbaru dan item tetap benar

### Admin
- [ ] Login admin OK
- [ ] `/admin/orders`: search/filter OK
- [ ] Buka order detail -> update status -> status badge berubah
- [ ] Refresh page -> status tetap (persist)
- [ ] Cek kembali `/order/:ref`, `/user/my-orders`, dan `/user/my-orders/:id` -> status sinkron

## Automation Coverage (`pnpm qa:mvf`)
- [x] Store home/search/product route
- [x] Register + login user store
- [x] Add to cart + cart fetch
- [x] Checkout create order real
- [x] Tracking API + route
- [x] Admin login
- [x] Admin orders list + search/filter + detail
- [x] Admin update status + persist
- [x] Account orders status sync
- [x] Account order detail status sync
- [x] Tracking status sync after admin update

## Coverage yang Masih Manual
- [ ] Visual check halaman `/user/my-orders` di browser
- [ ] Visual check halaman `/user/my-orders/:id` di browser
- [ ] UI badge/state account area setelah session expired

## Troubleshooting
- Port:
  - Server `http://localhost:3001`
  - Client `http://localhost:5173`
- Env:
  - Pastikan `.env` sudah dibuat dari `.env.example`
  - `VITE_API_BASE=/api`
  - DB credentials benar (DB_HOST/DB_USER/DB_PASS)
- DB:
  - Jika seed gagal, cek koneksi MySQL dan database `ecommerce_dev`
- Cookies/Auth:
  - Jika admin login loop, hapus cookies `localhost` dan coba login ulang
  - Jika account order kena `401`, gunakan route login store: `/auth/login`
