TASK ID: PHASEC-EXTRACT-03
Status: PASS

Yang diamati

- `client/src/auth/AuthContext.jsx`
- `client/src/auth/useAuth.js`
- seluruh consumer `useAuth()` aktif di `client/src`
- guard yang terkait session:
  - `client/src/components/AdminGuard.jsx`
  - `client/src/components/AccountGuard.jsx`
  - `client/src/routes/ProtectedRoute.jsx`
  - `client/src/routes/RoleRoute.jsx`
- consumer auth utama di:
  - admin
  - client/account
  - storefront login/register/checkout

Consumer auth per domain

- Admin
  - `client/src/components/AdminGuard.jsx`
  - `client/src/pages/admin/AdminLoginPage.jsx`
  - `client/src/components/Layout/Sidebar.jsx`
  - `client/src/components/admin/AdminProfileMenu.jsx`
  - `client/src/components/guards/RequirePerm.jsx`
  - `client/src/pages/admin/Staff.jsx`
  - legacy/admin routes:
    - `client/src/routes/ProtectedRoute.jsx`
    - `client/src/routes/RoleRoute.jsx`
    - `client/src/pages/Dashboard.jsx`
    - `client/src/pages/Login.jsx`
- Seller
  - tidak ada consumer `useAuth()` langsung di seller workspace canonical
  - seller bergantung pada shared session/cookie yang sama melalui lane account/storefront dan seller workspace API context
- Client/account
  - `client/src/layouts/AccountLayout.jsx`
  - `client/src/pages/account/AccountChangePasswordPage.jsx`
  - `client/src/pages/store/StoreLoginPage.jsx`
  - `client/src/pages/store/StoreRegisterPage.jsx`
  - `client/src/pages/store/Checkout.jsx`
  - `client/src/components/kachabazar-demo/TopInfoBar.jsx`
  - `client/src/components/kachabazar-demo/StoreHeaderKacha.jsx`
  - `client/src/components/AccountGuard.jsx` sebagai session probe paralel

Shared-safe concerns

- auth user snapshot
- auth role snapshot
- `isAuthenticated`
- `isLoading`
- `logout`
- `refreshSession`
- unauthorized-session clearing

Domain-specific concerns

- Admin-specific
  - admin login redirect
  - admin role validation
  - admin permission gating
  - admin `me` probe query
- Seller-specific
  - seller canonical workspace belum punya adapter auth client sendiri
  - seller boundary masih implisit melalui shared session dan seller workspace API
- Client/account-specific
  - cart sync bootstrap/sync logic
  - session hint persistence
  - buyer checkout autofill concern
  - storefront login/register concern

Coupling utama yang ditemukan

- `AuthContext` mencampur auth concern umum dan buyer/storefront cart concern.
- `AccountGuard` tidak memakai `AuthContext`, tetapi mengulang probe session sendiri.
- `AdminGuard` masih perlu fetch `["admin","me"]` terpisah karena `AuthContext` belum cukup tegas sebagai admin boundary.
- Seller canonical workspace tidak memakai consumer auth eksplisit, jadi boundary seller di layer client masih belum terlihat sebagai domain auth yang berdiri sendiri.

Hardening kecil yang dilakukan

- Menambahkan wrapper hook split-prep:
  - `client/src/auth/authDomainHooks.js`
    - `useAdminAuth()`
    - `useSellerAuth()`
    - `useAccountAuth()`
- Memindahkan consumer utama berikut ke wrapper domain:
  - `client/src/components/AdminGuard.jsx`
  - `client/src/pages/admin/AdminLoginPage.jsx`
  - `client/src/layouts/AccountLayout.jsx`
  - `client/src/pages/store/StoreLoginPage.jsx`
  - `client/src/pages/store/StoreRegisterPage.jsx`
  - `client/src/pages/account/AccountChangePasswordPage.jsx`

File yang diubah

- `client/src/auth/authDomainHooks.js`
- `client/src/components/AdminGuard.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`
- `client/src/layouts/AccountLayout.jsx`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/store/StoreRegisterPage.jsx`
- `client/src/pages/account/AccountChangePasswordPage.jsx`
- `CODEx_REPORTS/PHASEC-EXTRACT-03-auth-boundary-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-03-auth-boundary-report-2026-03-27.md`

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Butuh keputusan user?

- Tidak
