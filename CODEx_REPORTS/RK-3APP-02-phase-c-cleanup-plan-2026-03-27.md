TASK ID: RK-3APP-02

Phase C Cleanup Plan

Objective

- Menyiapkan repo untuk pemisahan logical package/module 3 aplikasi tanpa split runtime sekarang.

Phase C verdict

- Mulai Phase C sekarang.
- Jangan mulai split runtime sekarang.

Urutan cleanup yang direkomendasikan

1. Backend customization boundary extraction

- Tujuan:
  - putus coupling `store.customization` dari route admin
- Area:
  - `server/src/routes/store.customization.ts`
  - `server/src/routes/admin.storeCustomization.ts`
- Target hasil:
  - sanitizer customization pindah ke service/shared module netral
  - route public dan route admin sama-sama konsumsi service itu
- Jangan disentuh:
  - payload CMS besar
  - redesign customization UI

2. Client storefront API decomposition

- Tujuan:
  - memecah `client/src/api/store.service.ts` menjadi boundary public yang lebih jelas
- Candidate split:
  - `client/src/api/storeCatalog.ts`
  - `client/src/api/storeCheckout.ts`
  - `client/src/api/storeCoupons.ts`
  - `client/src/api/storeCustomization.ts`
  - `client/src/api/storePublicIdentity.ts` dipertahankan sebagai modul public identity
- Target hasil:
  - halaman public tidak lagi bergantung ke satu service storefront monolitik
  - checkout/coupon/inventory flow tetap tidak drift

3. Contract marker hardening

- Tujuan:
  - membuat pemisahan `public-safe`, `seller-owned`, `admin-owned` lebih eksplisit di code
- Area prioritas:
  - store profile/public identity
  - payment profile
  - coupon
  - fulfillment snapshot untuk buyer/admin/seller
- Target hasil:
  - serializer/helper naming lebih tegas
  - route tidak lagi membangun payload ownership-sensitive secara ad-hoc

4. Workspace API boundary inventory

- Tujuan:
  - memastikan seller pages benar-benar memakai seller APIs dan admin pages memakai admin APIs
- Fokus:
  - seller routes yang sudah matang
  - admin governance pages yang membaca shared preview/public-safe serializer
- Target hasil:
  - daftar route FE → API ownership yang bisa dipakai untuk split package berikutnya

5. Auth blocker isolation

- Tujuan:
  - mendokumentasikan dan mengisolasi coupling auth tanpa mengubah session sekarang
- Area:
  - `client/src/auth/AuthContext.jsx`
  - route guards admin/seller/client
- Target hasil:
  - adapter boundary jelas untuk:
    - admin session consumer
    - seller workspace consumer
    - client/account consumer
- Catatan:
  - ini bukan refactor auth penuh
  - ini persiapan untuk fase runtime split berikutnya

Candidate package/module boundary

- Backend
  - `server/src/services/storefront/*`
  - `server/src/services/seller/*`
  - `server/src/services/adminGovernance/*`
  - `server/src/services/sharedContracts/*`
- Client
  - `client/src/api/public/*`
  - `client/src/api/seller/*`
  - `client/src/api/admin/*`
  - `client/src/auth/*` tetap shared sementara, tapi diberi boundary marker

Area yang jangan disentuh dulu

- auth/session implementation global
- checkout/order engine besar
- payout/settlement
- campaign/promo engine
- redesign page seller/admin/client

Success criteria Phase C

- customization sanitizer sudah netral
- `store.service.ts` sudah terpecah bertahap
- public/client pages tidak lagi menarik helper ownership-sensitive secara campur
- admin/seller/client route ownership matrix bisa diturunkan langsung ke paket logical
- repo siap untuk task berikutnya:
  - extraction task per module
  - bukan lagi audit boundary umum

Blocker split runtime setelah Phase C

- auth/session masih bersama
- router masih satu aplikasi client
- deployment/build target masih satu frontend runtime
- gateway/API composition belum dipisah
