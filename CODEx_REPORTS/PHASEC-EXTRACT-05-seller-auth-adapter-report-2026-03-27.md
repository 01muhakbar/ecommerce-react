TASK ID: PHASEC-EXTRACT-05
Status: PASS

Yang diamati

- `client/src/auth/AuthContext.jsx`
- `client/src/auth/authDomainHooks.js`
- `client/src/layouts/SellerLayout.jsx`
- `client/src/routes/ProtectedRoute.jsx`
- `client/src/routes/RoleRoute.jsx`
- tree route aktif di `client/src/App.jsx`

Boundary auth seller yang dirapikan

- `useSellerAuth()` diperluas agar lebih eksplisit:
  - `isAuthenticated`
  - `isAdminSession`
  - `isSellerSession`
  - `isStoreSession`
  - `refreshSession`
  - `logout`
- `SellerLayout.jsx` sekarang memakai `useSellerAuth()` sebagai jalur auth seller yang eksplisit.
- Seller context query di layout sekarang `enabled` hanya setelah auth shared selesai loading, sehingga boundary seller tidak lagi sepenuhnya implisit.
- Unauthorized state seller juga lebih domain-aware:
  - bila session yang aktif ternyata admin-oriented, UI seller menjelaskan bahwa seller workspace butuh storefront account dengan seller membership

Guard legacy yang diaudit

- `ProtectedRoute.jsx`
  - sebelumnya generik secara nama, tetapi perilakunya admin-oriented
  - sekarang eksplisit memakai `useAdminAuth()`
  - diberi marker komentar sebagai legacy admin guard
- `RoleRoute.jsx`
  - sebelumnya generik secara nama, tetapi redirect dan role concern-nya admin-oriented
  - sekarang eksplisit memakai `useAdminAuth()`
  - diberi marker komentar sebagai legacy admin role guard
- Hasil audit pemakaian:
  - guard ini tidak lagi dipakai di `App.jsx`
  - saat ini praktis menjadi compatibility artifact, bukan jalur guard aktif untuk seller/account

Perubahan yang dilakukan

- Memperluas adapter seller di `client/src/auth/authDomainHooks.js`
- Mengarahkan `client/src/layouts/SellerLayout.jsx` ke `useSellerAuth()`
- Menahan query seller workspace sampai auth shared selesai loading
- Menghardening unauthorized seller state untuk membedakan admin session vs storefront seller session
- Mengarahkan `client/src/routes/ProtectedRoute.jsx` dan `client/src/routes/RoleRoute.jsx` ke `useAdminAuth()`
- Menambahkan marker komentar bahwa kedua guard itu legacy admin-oriented

File yang diubah

- `client/src/auth/authDomainHooks.js`
- `client/src/layouts/SellerLayout.jsx`
- `client/src/routes/ProtectedRoute.jsx`
- `client/src/routes/RoleRoute.jsx`
- `CODEx_REPORTS/PHASEC-EXTRACT-05-guard-auth-boundary-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-05-seller-auth-adapter-report-2026-03-27.md`

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Dampak ke Admin / Seller / Client-account

- Admin
  - boundary guard admin lebih jelas
  - legacy guard lama tidak lagi tampak generik secara perilaku
- Seller
  - seller canonical workspace sekarang punya jalur auth client yang eksplisit
  - session shared tetap sama, tetapi seller unauthorized state lebih jelas
- Client-account
  - tidak ada perubahan behavior auth

Risiko / debt / follow-up

- Seller access final masih tetap ditentukan oleh seller workspace context backend; ini benar untuk sekarang, tetapi berarti `useSellerAuth()` masih adapter session, belum adapter access penuh.
- `ProtectedRoute.jsx` dan `RoleRoute.jsx` masih tersisa sebagai artifact legacy; bisa disunset di task berikutnya jika memang tidak ada consumer lagi.
- Seller pages lain belum perlu membaca `useSellerAuth()` langsung karena `SellerLayout` sudah jadi shell canonical, tetapi jika nanti ada seller-specific modal/entrypoint di luar layout, adapter seller perlu dipakai konsisten di sana juga.

Butuh keputusan user?

- Tidak
