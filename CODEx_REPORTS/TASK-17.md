# CODEx REPORT — TASK-17

## Ringkasan hasil
TASK-17 selesai:
- Endpoint publik `GET /api/store/customization` sekarang mendukung `include=dashboardSetting` dengan whitelist ketat.
- Halaman account/dashboard storefront sudah bind label utama ke `customization.dashboardSetting` secara non-blocking dengan fallback default.
- Auth/order/profile logic tidak diubah.

## File changed list
1. `server/src/routes/store.customization.ts`
   - Tambah include parser untuk `dashboardSetting` (`dashboardsetting`, `dashboard-setting`, `dashboard_setting`).
   - Tambah whitelist return `customization.dashboardSetting` hanya jika diminta.
2. `client/src/api/store.service.ts`
   - Perluas type `StoreCustomizationResponse` agar mencakup `dashboardSetting` (dan key publik lain yang sudah dipakai).
3. `client/src/layouts/AccountLayout.jsx`
   - Fetch non-blocking `getStoreCustomization({ include: "dashboardSetting" })`.
   - Bind label sidebar: Dashboard, My Orders, Update Profile, Change Password.
4. `client/src/pages/account/AccountDashboardPage.jsx`
   - Fetch non-blocking dashboard setting.
   - Bind heading dashboard, label stat cards (total/pending/processing/complete), heading recent orders.
5. `client/src/pages/account/AccountOrdersPage.jsx`
   - Fetch non-blocking dashboard setting.
   - Bind page title My Orders.
6. `client/src/pages/account/AccountProfilePage.jsx`
   - Fetch non-blocking dashboard setting.
   - Bind heading Update Profile, label Name/Email, label submit button.
7. `CODEx_REPORTS/TASK-17.md`
   - Laporan task.

## API include=dashboardSetting
### Request
```bash
curl "http://localhost:3001/api/store/customization?lang=en&include=dashboardSetting"
```

### Response sample
```json
{
  "success": true,
  "lang": "en",
  "customization": {
    "dashboardSetting": {
      "dashboard": {
        "dashboardLabel": "Dashboard",
        "totalOrdersLabel": "Total Orders",
        "pendingOrderValue": "Pending Orders",
        "processingOrderValue": "Processing Order",
        "completeOrderValue": "Complete Orders",
        "recentOrderValue": "Recent Orders",
        "myOrderValue": "My Orders"
      },
      "updateProfile": {
        "sectionTitleValue": "Update Profile",
        "fullNameLabel": "Full Name",
        "emailAddressLabel": "Email Address",
        "updateButtonValue": "Update Profile",
        "changePasswordLabel": "Change Password"
      }
    }
  }
}
```

### Whitelist checks
- `GET /api/store/customization?lang=en` -> `default_keys=aboutUs` (tetap backward compatible)
- `GET /api/store/customization?lang=en&include=dashboardSetting` -> `include_dashboardSetting_keys=dashboardSetting`
- `GET /api/store/customization?lang=en&include=aboutUs,dashboardSetting` -> `aboutUs,dashboardSetting`

## Mapping table (source -> target UI)
- `dashboard.dashboardLabel` -> Account sidebar `Dashboard`, Dashboard page title
- `dashboard.myOrderValue` -> Account sidebar `My Orders`, Orders page title
- `dashboard.totalOrdersLabel` -> Dashboard stat card label total
- `dashboard.pendingOrderValue` -> Dashboard stat card label pending
- `dashboard.processingOrderValue` -> Dashboard stat card label processing
- `dashboard.completeOrderValue` -> Dashboard stat card label complete
- `dashboard.recentOrderValue` -> Dashboard section title recent orders
- `updateProfile.sectionTitleValue` -> Account sidebar `Update Profile`, Profile page title
- `updateProfile.fullNameLabel` -> Profile form name label
- `updateProfile.emailAddressLabel` -> Profile form email label
- `updateProfile.updateButtonValue` -> Profile submit button label
- `updateProfile.changePasswordLabel` -> Disabled sidebar item label

## Manual sync test (admin -> store)
Dijalankan via API:
1. Login admin.
2. Update admin customization `dashboardSetting` (dashboardLabel, recentOrderValue, sectionTitleValue).
3. Fetch public endpoint `include=dashboardSetting`.
4. Nilai cocok (True) lalu dikembalikan ke nilai awal.

Output:
- `sync_dashboardLabel=True`
- `sync_recentOrderValue=True`
- `sync_profileTitle=True`

## Commands output
1. `pnpm qa:mvf` -> PASS
   - artifact: `.codex-artifacts/qa-mvf/20260303-115323/result.json`
2. `pnpm --filter client exec vite build` -> PASS

## Known gaps
1. UI account saat ini tidak memiliki area invoice message / tombol print/download, jadi field tersebut belum ter-bind (sesuai aturan: tidak menambah fitur baru).
2. UI account profile belum punya field address/phone/password, jadi label-field tersebut belum terpakai.

## STOP point
Siap lanjut Task #18 (SEO settings binding meta tags).
