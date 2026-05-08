# SELLER-MVF-01 — Seller Payment Profile Self-Service (Write Lane) + Admin Review Sync

Tanggal: 2026-03-26

## Scope yang dikerjakan

- audit kontrak seller/admin payment profile di repo aktif
- harden seller write lane minimal untuk create/update draft request store-scoped
- tampilkan governance, readiness, dan review status yang sinkron di seller workspace
- sinkronkan admin review page agar membaca lifecycle state yang sama
- jaga authority final admin tetap utuh
- verifikasi build `server` dan `client`

## Temuan audit

- Repo aktif sudah punya fondasi write lane seller:
  - `server/src/routes/seller.paymentProfiles.ts`
  - `client/src/api/sellerPaymentProfile.ts`
  - `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- Repo aktif juga sudah punya admin review/promotion lane:
  - `server/src/routes/admin.storePaymentProfiles.ts`
  - `client/src/pages/admin/AdminStorePaymentProfilesPage.jsx`
- Model existing cukup untuk task ini:
  - `StorePaymentProfile`
  - `StorePaymentProfileRequest`
- Tidak perlu migration schema.
- Gap utama sebelum perubahan:
  - seller write lane masih bisa diubah saat request sudah `SUBMITTED`, sehingga admin bisa membaca moving target
  - seller/admin belum membaca metadata lifecycle dari serializer backend yang sama
  - governance editability di seller page masih terlalu banyak ditentukan frontend

## Perubahan utama

### 1. Shared backend state/serializer

File baru:
- `server/src/services/storePaymentProfileState.ts`

Isi utama:
- field map required vs seller-editable
- request status constants untuk seller dan admin
- readiness builder
- verification/activity meta builder
- active snapshot serializer
- pending request serializer
- seller governance builder
- helper lock: request `SUBMITTED` tidak editable saat admin review berjalan

### 2. Seller write lane hardening

File:
- `server/src/routes/seller.paymentProfiles.ts`

Perubahan:
- route seller sekarang memakai shared serializer/state helper
- response seller mengandung governance lebih eksplisit:
  - `canEdit`
  - `permissionCanEdit`
  - `isReviewLocked`
  - `lockReason`
  - `reviewStatus`
  - `submittedAt`
  - `reviewedAt`
  - `nextStep`
- `PUT /payment-profile/request` dan `POST /payment-profile/request/submit` sekarang menolak edit jika request existing sudah `SUBMITTED`
- error code baru:
  - `PAYMENT_PROFILE_REVIEW_LOCKED`

### 3. Seller client sync

Files:
- `client/src/api/sellerPaymentProfile.ts`
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`

Perubahan:
- API helper seller menormalisasi governance metadata baru
- halaman seller sekarang membaca `canEdit` dari backend, bukan hanya dari permission context
- saat request sedang `SUBMITTED`, form tetap terlihat tetapi locked/read-only
- seller mendapat messaging yang jelas untuk:
  - draft
  - pending admin review
  - needs revision
  - locked during review
- save/upload/submit actions disabled saat review lock aktif

### 4. Admin review sync

Files:
- `server/src/routes/admin.storePaymentProfiles.ts`
- `client/src/api/storePaymentProfiles.ts`
- `client/src/pages/admin/AdminStorePaymentProfilesPage.jsx`

Perubahan:
- admin route sekarang memakai shared active snapshot + pending request serializer yang sama
- admin payload sekarang menyertakan `workflow`:
  - `primaryStatus`
  - `requestState`
  - `reviewStatus`
  - `completeness`
  - `nextStep`
  - `governance`
- admin page sekarang membaca state dari `workflow`, bukan menebak dari status mentah
- tombol approve/revision/toggle activation sekarang mengikuti governance backend
- admin page menampilkan missing required fields, review note, dan next-step context dengan state yang sama seperti seller lane

## Boundary check

- Tenant boundary: tetap store-scoped via `requireSellerStoreAccess(...)`
- Auth boundary: tidak ada perubahan auth global
- Permission boundary: seller write tetap butuh `PAYMENT_PROFILE_EDIT`
- Admin final authority: tetap di admin review/promotion lane
- Storefront/client public contract: tidak diubah
- Payout/withdrawal/settlement domain: tidak disentuh

## Acceptance criteria status

- Seller bisa membuka payment profile store aktif: ✅
- Seller bisa create/update payment profile minimum yang diizinkan: ✅
- Backend menolak edit lintas store/tanpa permission: ✅ existing guard tetap aktif
- Status review tampil jelas di seller page: ✅
- Admin tetap final authority verify/approve: ✅
- Tidak ada route drift antara seller dan admin: ✅ lifecycle state kini diserializer dari helper backend bersama
- Client/storefront tidak terdampak negatif: ✅ tidak ada perubahan route/contract public
- `pnpm --filter server build`: ✅
- `pnpm --filter client build`: ✅

## Validasi

- `pnpm --filter server build`
- `pnpm --filter client build`

Hasil:
- keduanya lulus pada 2026-03-26
- build client hanya memberi warning chunk size, non-blocking

## Risiko residual kecil

- Admin page masih list-oriented, belum punya editor `adminReviewNote` inline; route sudah mendukung note tetapi UI admin saat ini masih action-first.
- Seller draft pada status `NEEDS_REVISION` tetap mempertahankan state revisi sampai resubmit; ini dipertahankan agar admin feedback tetap terlihat jelas dan tidak mengubah authority review.
