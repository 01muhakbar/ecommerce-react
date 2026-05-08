TASK ID: PHASEC-EXTRACT-05

Guard/Auth Boundary Summary

Boundary auth seller yang dirapikan

- Seller sekarang punya adapter auth eksplisit yang lebih jelas di:
  - `client/src/auth/authDomainHooks.js`
  - `useSellerAuth()`
- Seller canonical workspace sekarang benar-benar membaca adapter seller itu di:
  - `client/src/layouts/SellerLayout.jsx`
- Seller context query di layout sekarang menunggu status auth shared selesai resolve lebih dulu, sehingga boundary session seller lebih eksplisit dan mengurangi probe prematur saat refresh session.

Guard legacy yang diaudit

- `client/src/routes/ProtectedRoute.jsx`
  - legacy
  - admin-oriented
  - sekarang memakai `useAdminAuth()`
- `client/src/routes/RoleRoute.jsx`
  - legacy
  - admin-oriented
  - sekarang memakai `useAdminAuth()`
- Hasil audit tree route aktif:
  - guard ini tidak lagi direferensikan oleh `client/src/App.jsx`
  - aman dipertahankan sementara untuk compatibility internal, tetapi bukan source guard seller/account

Boundary setelah cleanup

- Admin
  - `AdminGuard`
  - `RequirePerm`
  - legacy `ProtectedRoute` / `RoleRoute`
- Seller
  - `SellerLayout` + `useSellerAuth()`
  - seller workspace context API tetap jadi source access final
- Client/account
  - `AccountGuard` + `useAccountAuth()`

Catatan

- Seller auth adapter sekarang eksplisit, tetapi seller access final tetap ditentukan oleh seller workspace context backend, bukan role dari `AuthContext` saja.
- Ini sesuai boundary yang aman untuk fase sekarang: session shared tetap satu, access tenant tetap diputuskan oleh backend seller domain.
