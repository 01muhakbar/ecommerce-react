TASK ID: PHASEC-EXTRACT-04

Auth Cleanup Summary

Coupling yang dibersihkan

- Buyer/storefront cart-sync tidak lagi hidup langsung di `client/src/auth/AuthContext.jsx`.
- `AccountGuard` tidak lagi melakukan session probe paralel sendiri lewat localStorage hint + `/api/auth/me`.
- Jalur auth account sekarang membaca boundary yang sama dengan auth core melalui wrapper:
  - `useAccountAuth()`

Boundary setelah cleanup

- Auth core
  - `client/src/auth/AuthContext.jsx`
  - fokus ke:
    - session state
    - login/logout
    - refresh session
    - unauthorized handling
- Buyer cart session concern
  - `client/src/auth/useBuyerCartSessionSync.js`
  - fokus ke:
    - remote cart bootstrap
    - guest-to-remote sync
    - cart mode switch
    - synced user persistence
- Account session guard
  - `client/src/components/AccountGuard.jsx`
  - sekarang memakai:
    - `client/src/auth/authDomainHooks.js`

Catatan boundary

- Shared session runtime tetap sama.
- Seller tetap belum punya auth adapter client yang eksplisit, tetapi cleanup ini mengurangi coupling paling besar lebih dulu tanpa menyentuh session model.
