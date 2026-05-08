TASK ID: PHASEC-EXTRACT-04
Status: PASS

Yang diamati

- `client/src/auth/AuthContext.jsx`
- `client/src/auth/authDomainHooks.js`
- `client/src/components/AccountGuard.jsx`
- consumer buyer/account:
  - store login/register
  - account layout
  - checkout
- hasil audit sebelumnya pada `PHASEC-EXTRACT-03`

Coupling auth yang dibersihkan

- cart-sync buyer/storefront yang sebelumnya bercampur langsung di `AuthContext`
- session probe paralel di `AccountGuard` yang membaca localStorage hint sendiri lalu fetch `/api/auth/me` sendiri

Perubahan yang dilakukan

- Menambahkan hook khusus buyer cart session:
  - `client/src/auth/useBuyerCartSessionSync.js`
- Memindahkan logic berikut keluar dari `AuthContext` ke hook tersebut:
  - synced user persistence
  - remote cart bootstrap
  - guest cart merge/sync saat login
  - reset cart mode saat session berubah
- Merapikan `AuthContext` agar fokus pada auth-core:
  - session state
  - login/logout
  - refresh session
  - unauthorized event handling
- Mengubah `AccountGuard` agar memakai `useAccountAuth()` dan tidak lagi punya probe paralel sendiri

File yang diubah

- `client/src/auth/useBuyerCartSessionSync.js`
- `client/src/auth/AuthContext.jsx`
- `client/src/components/AccountGuard.jsx`
- `CODEx_REPORTS/PHASEC-EXTRACT-04-auth-cleanup-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-04-auth-cleanup-report-2026-03-27.md`

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Dampak ke Admin / Seller / Client-account

- Admin
  - tidak ada perubahan behavior auth
- Seller
  - tidak ada perubahan behavior session; seller masih berbagi runtime session yang sama
- Client-account
  - account guard sekarang lebih konsisten dengan source of truth auth
  - cart-sync buyer tetap jalan, tetapi concern-nya sudah keluar dari auth core

Risiko / debt / follow-up

- `AuthContext` masih menyimpan auth session hint di localStorage; itu masih shared-safe untuk sekarang, tetapi bisa dipindah lagi ke helper auth session state jika ingin boundary lebih tajam.
- Seller canonical workspace masih belum punya adapter auth client eksplisit.
- `ProtectedRoute` dan `RoleRoute` masih legacy admin-oriented consumer yang bisa disunset atau dimigrasikan ke wrapper admin di phase berikutnya.

Butuh keputusan user?

- Tidak
