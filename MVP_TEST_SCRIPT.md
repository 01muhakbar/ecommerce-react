# MVP Test Script

## Setup
1. Install deps: `pnpm install`
2. Reset DB: `pnpm --filter server db:reset`
3. Seed super admin: `pnpm --filter server seed:super`
4. Seed demo data: `pnpm --filter server seed:demo`
5. Run dev: `pnpm dev`

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
- [ ] `/order/:ref`: tracking OK

### Admin
- [ ] Login admin OK
- [ ] `/admin/orders`: search/filter OK
- [ ] Buka order detail -> update status -> status badge berubah
- [ ] Refresh page -> status tetap (persist)

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
