TASK ID: PHASEC-EXTRACT-03

Auth Boundary Summary

Consumer auth per domain

- Admin
  - direct `useAuth` / auth wrapper consumers:
    - `client/src/components/AdminGuard.jsx`
    - `client/src/pages/admin/AdminLoginPage.jsx`
    - `client/src/components/Layout/Sidebar.jsx`
    - `client/src/components/admin/AdminProfileMenu.jsx`
    - `client/src/components/guards/RequirePerm.jsx`
    - `client/src/pages/admin/Staff.jsx`
    - legacy/admin-oriented:
      - `client/src/routes/ProtectedRoute.jsx`
      - `client/src/routes/RoleRoute.jsx`
      - `client/src/pages/Dashboard.jsx`
      - `client/src/pages/Login.jsx`
- Seller
  - tidak ada consumer `useAuth` langsung di seller workspace canonical
  - seller bergantung tidak langsung pada session storefront/account yang sama:
    - seller workspace route dijaga oleh seller context API, bukan `AuthContext`
    - login dan session tetap memakai cookie/session umum yang sama dengan client/account
    - seller access recovery masih lewat account/store login lane
- Client / account
  - direct `useAuth` / auth wrapper consumers:
    - `client/src/layouts/AccountLayout.jsx`
    - `client/src/pages/account/AccountChangePasswordPage.jsx`
    - `client/src/pages/store/StoreLoginPage.jsx`
    - `client/src/pages/store/StoreRegisterPage.jsx`
    - `client/src/pages/store/Checkout.jsx`
    - `client/src/components/kachabazar-demo/TopInfoBar.jsx`
    - `client/src/components/kachabazar-demo/StoreHeaderKacha.jsx`
  - indirect session path:
    - `client/src/components/AccountGuard.jsx` tidak memakai `AuthContext`, tetapi membaca hint session yang sama dan memanggil `/api/auth/me`

Shared-safe concerns

- `user`
- `role`
- `isAuthenticated`
- `isLoading`
- `logout`
- `refreshSession`
- unauthorized event clearing session

Domain-specific concerns

- Admin-specific
  - redirect ke `/admin/login`
  - admin role validation
  - permission gating (`RequirePerm`)
  - query `["admin", "me"]` dan probe tambahan ke `/api/auth/me`
- Seller-specific
  - canonical seller workspace tidak mengonsumsi `AuthContext` langsung
  - seller bergantung pada shared cookie/session dan seller workspace API context
  - ini tanda bahwa auth boundary seller belum eksplisit di layer client
- Client/account-specific
  - cart sync logic di `AuthContext`
  - local/session storage hint:
    - `authSessionHint`
    - `cartSync:lastSyncedUserId`
  - store/account login/register memakai session umum
  - checkout memakai `user.email` untuk autofill buyer flow

Coupling auth yang masih tersisa

- `AuthContext` masih mencampur:
  - session auth umum
  - buyer/storefront cart sync
- `AccountGuard` tidak memakai `AuthContext`, sehingga account boundary punya source session probe yang berbeda dari context utama
- `AdminGuard` memakai `AuthContext` hanya sebagai probe awal, lalu tetap fetch `/api/auth/me` sendiri
- Seller canonical workspace tidak memakai wrapper auth eksplisit, jadi seller masih bergantung pada shared session secara implisit

Split-prep verdict

- Auth boundary sudah cukup bisa dipetakan
- Belum siap di-split
- Siap untuk fase split-prep berikutnya:
  - pisahkan shared session shell dari buyer cart-sync concern
  - tambahkan wrapper/provider adapter per domain
  - satukan strategi probe session antara `AuthContext`, `AccountGuard`, dan `AdminGuard`
