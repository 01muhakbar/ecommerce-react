# TASK-19 — Public Store Settings + Storefront Feature Flags

## Discovery
- Persist backend store settings sudah ada di tabel `settings` lewat key `storeSettings` (`server/src/routes/admin.storeSettings.ts`).
- Root layout storefront untuk fetch sekali + script injection: `client/src/components/Layout/StoreLayout.jsx`.
- Auth pages ditemukan:
  - `client/src/pages/store/StoreLoginPage.jsx`
  - `client/src/pages/store/StoreRegisterPage.jsx`
  - Saat ini belum ada tombol social login (Google/Github/Facebook), jadi perlu UI-only buttons agar bisa di-toggle.
- Checkout page ditemukan: `client/src/pages/store/Checkout.jsx`
  - Ada payment option cards (`cash`, `card`, `razorpay`) yang bisa di-toggle berdasarkan flags.

## Planned file changes (pre-coding)
1. `server/src/routes/store.settings.ts` (new)
2. `server/src/app.ts`
3. `client/src/api/store.service.ts`
4. `client/src/components/Layout/StoreLayout.jsx`
5. `client/src/pages/store/StoreLoginPage.jsx`
6. `client/src/pages/store/StoreRegisterPage.jsx`
7. `client/src/pages/store/Checkout.jsx`
8. `CODEx_REPORTS/TASK-19.md`

## File changed list
1. `server/src/routes/store.settings.ts` (new)
   - Tambah endpoint publik read-only `GET /api/store/settings`.
   - Sanitasi settings + whitelist safe subset (tanpa secret).
2. `server/src/app.ts`
   - Register route publik `/api/store/settings`.
3. `client/src/api/store.service.ts`
   - Tambah helper `getStoreSettings()` + tipe response publik.
4. `client/src/components/Layout/StoreLayout.jsx`
   - Fetch settings publik sekali di root store layout.
   - Inject/remove Google Analytics script berdasar flag + key.
   - Inject/remove Tawk script berdasar flag + ids.
   - Pass `storeSettings` ke child route via `Outlet context`.
5. `client/src/pages/store/StoreLoginPage.jsx`
   - Show/hide social login buttons (Google/Github/Facebook) berdasar flags.
6. `client/src/pages/store/StoreRegisterPage.jsx`
   - Show/hide social login buttons (Google/Github/Facebook) berdasar flags.
7. `client/src/pages/store/Checkout.jsx`
   - Filter payment options UI (`cash`, `card`, `razorpay`) berdasar flags.
   - Jaga selected payment option tetap valid ketika flags berubah.
8. `CODEx_REPORTS/TASK-19.md`
   - Dokumentasi hasil task.

## API response example (redacted) + secrets not present proof
Endpoint:
- `GET /api/store/settings`

Sample response:
```json
{
  "success": true,
  "data": {
    "storeSettings": {
      "payments": {
        "cashOnDeliveryEnabled": true,
        "stripeEnabled": true,
        "razorPayEnabled": false,
        "stripeKey": ""
      },
      "socialLogin": {
        "googleEnabled": true,
        "githubEnabled": true,
        "facebookEnabled": true,
        "googleClientId": "",
        "githubId": "",
        "facebookId": ""
      },
      "analytics": {
        "googleAnalyticsEnabled": true,
        "googleAnalyticKey": ""
      },
      "chat": {
        "tawkEnabled": true,
        "tawkPropertyId": "",
        "tawkWidgetId": ""
      }
    }
  }
}
```

Secret leakage check (string search on live response):
- `stripeSecret`: `False`
- `googleSecretKey`: `False`
- `githubSecret`: `False`
- `facebookSecret`: `False`

## Binding checklist (social / GA / tawk / COD)
- Social login buttons (store auth pages):
  - [x] Google button only when `socialLogin.googleEnabled === true`
  - [x] Github button only when `socialLogin.githubEnabled === true`
  - [x] Facebook button only when `socialLogin.facebookEnabled === true`
- Checkout payment UI:
  - [x] COD option hidden when `payments.cashOnDeliveryEnabled === false`
  - [x] Card option hidden when `payments.stripeEnabled === false`
  - [x] RazorPay option hidden when `payments.razorPayEnabled === false`
  - [x] Selected option auto-fallback ke opsi yang masih tersedia
- Google Analytics:
  - [x] Inject script hanya jika `analytics.googleAnalyticsEnabled === true` dan key terisi
  - [x] Tidak double inject (script id + key check)
  - [x] Remove script saat disabled
- Tawk Chat:
  - [x] Inject script hanya jika `chat.tawkEnabled === true` dan `propertyId/widgetId` terisi
  - [x] Tidak double inject (script id + src check)
  - [x] Remove script saat disabled
- QA guard:
  - [x] Skip script injection pada mode test / `window.__QA_MVF__`

## Commands output (qa + build)
1. `pnpm qa:mvf`
   - Result: `PASS`
   - Artifact: `.codex-artifacts/qa-mvf/20260303-121151/result.json`
   - Summary: `.codex-artifacts/qa-mvf/20260303-121151/summary.txt`
2. `pnpm --filter client exec vite build`
   - Result: `PASS`
   - Vite build sukses (`✓ built in 11.28s`)

## Known gaps
1. Social login buttons saat ini UI-only (belum terhubung OAuth flow), sesuai scope.
2. Checkout masih memproses order sebagai COD di backend flow existing; card/razorpay hanya flag tampilan.
3. Belum ada unit/integration test khusus untuk script injection idempotency.
4. `storeSettings` fetch saat ini default `retry: 1`; belum ada persistence/caching lintas reload selain react-query runtime cache.
5. Belum ada binding store settings ke SEO/meta behavior (next task candidate).

## Next recommended task (#20)
- Binding SEO settings ke meta tags storefront (title/description/og tags) via safe public settings/customization endpoint.
