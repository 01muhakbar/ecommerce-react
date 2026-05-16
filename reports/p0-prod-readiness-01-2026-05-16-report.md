# P0-PROD-READINESS-01 Report

## Ringkasan
Audit production environment readiness selesai dengan patch minimal.

Patch fokus pada guard production dan dokumentasi deployment:
- production startup sekarang menolak secret contoh/dev, CORS wildcard/missing origin, `DB_SYNC=true`, public/CORS URL HTTP non-local, dan `COOKIE_SECURE=false` untuk origin publik;
- cookie auth route canonical otomatis `Secure` di production kecuali localhost proof run eksplisit;
- static `/uploads` sekarang ikut melayani `UPLOAD_DIR` yang dikonfigurasi;
- client upload asset URL tidak fallback ke `localhost` pada production build bila `VITE_SERVER_ORIGIN` belum diset;
- env example dan checklist deployment production diperjelas.

Tidak ada fitur baru, redesign, schema change, auth contract change, payment/order lifecycle change, route rename, atau storage migration.

## Scope
- Audit env backend/client.
- Audit CORS, auth cookie, JWT/session secret, upload/static path, public URL, payment/webhook config, dan rate limit.
- Patch minimal untuk hardening config production dan deployment docs.
- Validasi build, smoke checkout/order/payment, E2E truth, dan diff check.

## File Diubah
- `.env.example`
- `server/.env.example`
- `client/.env.example`
- `docs/production-deployment-checklist.md`
- `client/src/lib/assetUrl.js`
- `server/src/app.ts`
- `server/src/routes/auth.ts`
- `server/src/server.ts`
- `reports/p0-prod-readiness-01-2026-05-16-report.md`

Catatan worktree: perubahan dari `P0-SYNC-GATE-01` dan `P0-SYNC-GATE-02` masih ada di worktree dan tidak diubah ulang di task ini.

## Env Audit
### Backend Required
- `NODE_ENV=production` untuk deployment publik.
- `PORT`.
- `JWT_SECRET` kuat, unik, minimal 24 karakter, bukan nilai contoh/dev.
- `AUTH_COOKIE_NAME`.
- `DATABASE_URL` atau lengkap `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
- `CLIENT_URL` atau `CORS_ORIGIN` eksplisit.
- `UPLOAD_DIR` writable dan persistent.

### Backend Optional
- `ADMIN_AUTH_COOKIE_NAME`.
- `COOKIE_SECURE` optional; production default sekarang auto-secure, `false` hanya untuk localhost proof run.
- `PUBLIC_BASE_URL`, `CLIENT_PUBLIC_BASE_URL`, `STORE_PUBLIC_BASE_URL` untuk hosted checkout redirect.
- `ENABLE_MULTISTORE_SHIPMENT_MVP`, `ENABLE_MULTISTORE_SHIPMENT_MUTATION`.
- Email/OTP/password-reset/admin verification tuning env.
- `AUTH_DEBUG_COOKIES`.

### Client Required
- Main API client memakai same-origin `/api`; production perlu reverse proxy ke backend atau perubahan strategi API base URL pada task terpisah.
- `VITE_SERVER_ORIGIN` wajib diset bila `/uploads`/API tidak satu origin dengan client.

### Client Optional
- `VITE_API_BASE_URL` hanya untuk legacy `httpClient`.
- `VITE_PROXY_API_HOST`, `VITE_PROXY_API_PORT` untuk dev-server proxy.
- `VITE_ENABLE_MULTISTORE_SHIPMENT_MVP`, `VITE_ENABLE_MULTISTORE_SHIPMENT_MUTATION`.

### Risky Defaults
- `JWT_SECRET` fallback/contoh seperti `dev-secret`, `change_me_*`, dan `replace_with_*`.
- `CLIENT_URL`/`CORS_ORIGIN` kosong atau wildcard di production.
- `COOKIE_SECURE=false` pada origin publik.
- `DB_SYNC=true` di production.
- Public/CORS URL HTTP non-local di production.
- `UPLOAD_DIR` tidak writable/persistent.
- Client production asset origin fallback ke `localhost`.
- Stripe checkout base URL kosong saat Stripe aktif.

## CORS/Auth Cookie Audit
- CORS origin source: `CLIENT_URL` dan `CORS_ORIGIN`, comma-separated, plus localhost dev only.
- Credentials: `credentials: true`.
- Cookie secure: auth route canonical sekarang auto-secure di production kecuali `COOKIE_SECURE=false` untuk localhost proof run.
- Cookie sameSite: `none` saat secure, `lax` saat tidak secure.
- Cookie httpOnly: `true`.
- JWT/session secret: masih dibaca dari `JWT_SECRET`; production startup guard menolak missing/dev/example/terlalu pendek.
- Risk: deployment publik dengan CORS kosong/wildcard, secret contoh, atau cookie insecure bisa gagal startup, bukan silently unsafe.
- Patch minimal: guard production diperketat di `server/src/server.ts`, cookie option diperjelas di `server/src/routes/auth.ts`.

## Upload Static Audit
- Static route: `/uploads`.
- Local directory: `UPLOAD_DIR` lebih dulu, lalu legacy candidates `uploads`, `public/uploads`, `server/public/uploads`.
- Write path: upload admin/staff/product path masih mengikuti route existing; tidak ada storage strategy change.
- Required deploy note: `UPLOAD_DIR` harus writable dan persistent; object storage/CDN tetap rekomendasi future task.
- Risk: sebelum patch, custom `UPLOAD_DIR` divalidasi production guard tetapi belum otomatis diserve oleh `/uploads`.
- Patch minimal: `server/src/app.ts` menambahkan configured `UPLOAD_DIR` sebagai static serving candidate pertama.

## Payment Env Audit
- Provider env: payment runtime utama dibaca dari Admin Store Settings DB, bukan env langsung.
- Webhook env: Stripe webhook signing secret juga dari Admin Store Settings; endpoint `/api/store/stripe/webhook` mengembalikan `STRIPE_WEBHOOK_NOT_READY` jika secret belum valid.
- Callback URL: Stripe checkout memakai `PUBLIC_BASE_URL`, `CLIENT_PUBLIC_BASE_URL`, `STORE_PUBLIC_BASE_URL`, origin request, atau host/protocol fallback.
- Production risk: Stripe dapat gagal redirect dengan benar jika public base URL tidak eksplisit di reverse-proxy/hosted setup; webhook tidak memproses event jika signing secret belum dikonfigurasi.
- Patch minimal: production guard memberi warning saat public base URL kosong dan menolak public base URL HTTP non-local.

## Patch Minimal
- Perketat `assertProductionRuntimeEnv` tanpa memengaruhi dev/test build.
- Static upload serving menyertakan `UPLOAD_DIR`.
- Auth cookie canonical default secure di production.
- Client asset URL production fallback memakai browser origin, bukan `localhost`.
- Tambah `client/.env.example` dan `docs/production-deployment-checklist.md`.
- Rapikan env example root/server untuk production cookie, uploads, dan client asset origin.

## Dampak Admin/Seller/Client
### Admin
Tidak ada perubahan route/UI admin. Admin upload/static image path lebih jelas karena `UPLOAD_DIR` production diserve sebagai `/uploads`.

### Seller
Tidak ada perubahan seller workspace/order/payment/fulfillment. Seller catalog/store profile image path tetap `/uploads` atau URL absolut.

### Client
Tidak ada redesign. Production build tidak lagi memakai `http://localhost:3001` untuk asset `/uploads` ketika `VITE_SERVER_ORIGIN` kosong.

### Backend
Startup production lebih ketat pada env berbahaya. Dev/test/smoke lokal tetap berjalan dengan `NODE_ENV` non-production.

## Production Deployment Checklist
- [ ] NODE_ENV=production
- [ ] DATABASE_URL / DB credentials production valid
- [ ] JWT/session secrets kuat dan bukan default
- [ ] CORS origin production eksplisit
- [ ] Client API base URL mengarah ke backend production
- [ ] Cookie secure aktif untuk HTTPS
- [ ] Upload directory tersedia/writable atau object storage disiapkan
- [ ] Public URL benar untuk image/static/payment callback
- [ ] Payment provider/webhook secret production diset jika payment aktif
- [ ] Rate limit aktif untuk auth/cart/checkout/payment-sensitive endpoint
- [ ] Build server/client PASS
- [ ] Smoke checkout/order/payment PASS
- [ ] QA e2e truth PASS

## Validasi
- `pnpm -F server build`: PASS via `pnpm.cmd -F server build`
- `pnpm -F client build`: PASS via `pnpm.cmd -F client build` (warning chunk besar existing)
- `pnpm -F server smoke:checkout-variants`: PASS via `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm -F server smoke:checkout-coupons`: PASS via `pnpm.cmd -F server smoke:checkout-coupons`
- `pnpm -F server smoke:order-payment`: PASS via `pnpm.cmd -F server smoke:order-payment`
- `pnpm qa:e2e:truth`: PASS via `pnpm.cmd qa:e2e:truth` (warning Node `DEP0190` existing)
- `git diff --check`: PASS (Git warning LF/CRLF untuk env example, bukan whitespace error)

## Risiko Tersisa
- Rate limit yang terbukti saat ini spesifik auth public flow; cart/checkout/payment-sensitive endpoint belum diberi shared rate-limit middleware agar tidak mengubah behavior checkout/order dalam task ini.
- Upload masih local filesystem; production host/container perlu persistent volume atau future object storage plan.
- Stripe/payment secret readiness bergantung pada Admin Store Settings DB, bukan env deploy file.
- Client API strategy masih same-origin `/api`; deployment split-origin perlu reverse proxy atau task kolaborasi API base strategy.

## Next Suggested Task
`P0-PROD-RATE-LIMIT-01`: audit dan patch minimal bounded rate limit untuk cart, checkout preview/submit, payment proof, dan Stripe return/webhook-sensitive paths tanpa mengubah kontrak checkout/order/payment.
