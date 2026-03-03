# CODEx REPORT — TASK-18

## Ringkasan hasil
TASK-18 selesai:
- Admin route baru aktif: `/admin/store/store-settings`.
- Route lama `/admin/store-settings` sekarang redirect ke route baru.
- Halaman Admin Store Settings sudah diimplementasi dengan pola parity Dashtar (toggle Yes/No, grouped sections, masked secret fields, tombol Update).
- Backend endpoint admin-only `GET/PUT /api/admin/store/settings` ditambahkan dengan default schema, sanitization, dan persist (reuse tabel `settings` via key JSON `storeSettings`).

## File changed list
1. `server/src/routes/admin.storeSettings.ts` (new)
   - Endpoint baru admin-only store settings.
   - `DEFAULT_STORE_SETTINGS` + `sanitizeStoreSettings()`.
   - Persist JSON ke tabel `settings` pada key `storeSettings`.
2. `server/src/app.ts`
   - Register router baru: `/api/admin/store/settings` (dengan `requireAdmin`).
3. `client/src/pages/admin/StoreSettings.jsx` (new)
   - UI parity Store Settings + loading/error/saving states.
   - Toggle Yes/No dan input field sesuai urutan task.
   - Secret fields dimasking (`type="password"`).
4. `client/src/lib/adminApi.js`
   - Tambah client API:
     - `fetchAdminStoreSettings()`
     - `updateAdminStoreSettings(payload)`
5. `client/src/App.jsx`
   - Route baru: `path="store/store-settings"` -> `StoreSettingsPage`.
   - Route lama: `path="store-settings"` -> redirect ke `/admin/store/store-settings`.
6. `client/src/components/Layout/Sidebar.jsx`
   - Update menu link "Store Settings" ke `/admin/store/store-settings`.
7. `CODEx_REPORTS/TASK-18.md`
   - Report task.

## API endpoints + contoh payload
### GET `/api/admin/store/settings`
Response contoh:
```json
{
  "success": true,
  "data": {
    "storeSettings": {
      "payments": {
        "cashOnDeliveryEnabled": true,
        "stripeEnabled": true,
        "stripeKey": "",
        "stripeSecret": "",
        "razorPayEnabled": false
      },
      "socialLogin": {
        "googleEnabled": true,
        "googleClientId": "",
        "googleSecretKey": "",
        "githubEnabled": true,
        "githubId": "",
        "githubSecret": "",
        "facebookEnabled": true,
        "facebookId": "",
        "facebookSecret": ""
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

### PUT `/api/admin/store/settings`
Payload contoh (partial):
```json
{
  "storeSettings": {
    "payments": {
      "stripeEnabled": false,
      "stripeKey": "pk_test_20260303"
    },
    "analytics": {
      "googleAnalyticsEnabled": true,
      "googleAnalyticKey": "GA-20260303"
    }
  }
}
```

## Route mapping lama -> baru
- Baru (aktif): `/admin/store/store-settings`
- Lama (backward-compatible): `/admin/store-settings` -> redirect ke `/admin/store/store-settings`

## Persist test hasil
### Admin auth guard
- `GET /api/admin/store/settings` tanpa auth -> `401` (OK, admin-only)

### Persist update
- Update partial settings (stripeEnabled, stripeKey, googleAnalyticKey) -> GET setelah update merefleksikan nilai baru.
- Nilai diuji dan PASS:
  - `store_settings_persist_stripe_enabled=True`
  - `store_settings_persist_stripe_key=True`
  - `store_settings_persist_ga_key=True`
- Nilai dikembalikan ke original setelah test.

## Commands output
1. `pnpm qa:mvf` -> PASS
   - Artifact: `.codex-artifacts/qa-mvf/20260303-120304/result.json`
2. `pnpm --filter client exec vite build` -> PASS

Tambahan verifikasi (non-gate):
- `pnpm --filter server build` -> FAIL karena error TypeScript pre-existing di file lain (`server/src/routes/admin.storeCustomization.ts`, implicit any), bukan area perubahan TASK-18.

## Known gaps
1. Toggle/field hanya menyimpan konfigurasi; belum mengaktifkan integrasi Stripe/RazorPay/OAuth/Analytics/Tawk runtime (sesuai out-of-scope).
2. Masking secret dilakukan di UI (`type="password"`), tanpa fitur reveal/hide khusus.
3. Route redirect diverifikasi via mapping React Router (SPA redirect), bukan HTTP 3xx server-level redirect.

## STOP point
Siap lanjut TASK-19: binding store settings ke feature flags storefront.
