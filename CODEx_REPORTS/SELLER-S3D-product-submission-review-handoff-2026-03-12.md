# SELLER-S3D — Seller Product Submission / Review Handoff

## Goal
Membuka handoff phase-1 agar seller bisa submit draft store-scoped ke status review tanpa membuka publish final.

## Why this task exists
- S3C sudah membuka draft-first authoring untuk seller.
- S3D0 sudah menambahkan state foundation submission yang eksplisit.
- Tanpa handoff, draft seller menjadi dead-end dan belum siap masuk governance admin.

## Scope
- In scope:
  - endpoint submit seller draft
  - governance backend untuk submit dan lock edit pasca-submit
  - CTA dan status handoff di Seller Workspace
- Out of scope:
  - publish final seller
  - moderation engine
  - rejection/revision loop
  - perubahan storefront/public visibility

## Perubahan inti
### 1. Backend handoff phase-1
- Menambahkan endpoint store-scoped:
  - `POST /api/seller/stores/:storeId/products/:productId/submit-review`
- Validasi submit:
  - product harus milik store aktif
  - product harus `draft`
  - `sellerSubmissionStatus` harus `none`
- Saat submit berhasil:
  - `sellerSubmissionStatus = submitted`
  - `sellerSubmittedAt = now`
  - `sellerSubmittedByUserId = currentUser`
- Publish authority tetap admin-owned dan storefront visibility tidak berubah.

### 2. Governance backend
- Seller detail serializer sekarang mengembalikan `submissionGovernance` yang cukup untuk UI:
  - `canSubmitWhenEnabled`
  - `canEditAfterSubmit`
  - `editLockAppliesWhenSubmitted`
  - `sellerCanPublish`
  - `reviewState`
- Default phase ini:
  - hanya `draft + submissionStatus=none` yang bisa submit
  - setelah submit, seller tidak lagi bisa edit draft

### 3. Seller-native UI
- Seller product detail sekarang menampilkan:
  - CTA `Submit for Review` saat governance mengizinkan
  - panel `Review handoff`
  - status submitted / waiting for review / not published
  - lock edit pasca-submit
- Seller catalog list sekarang menampilkan badge submission untuk row yang sudah submitted.
- Seller draft editor sekarang menampilkan alasan lock yang spesifik saat product sudah pending review.

## Kenapa pendekatan ini aman
- Menggunakan foundation state dari S3D0, bukan membajak `status` atau `isPublished`.
- Tetap store-scoped lewat route seller aktif.
- Tidak menambah schema baru lagi.
- Tidak mengubah admin publish authority.
- Tidak mengubah aturan visibility storefront.

## Risiko
- Belum ada rejection/revision loop; product yang sudah submitted saat ini memang berhenti di waiting-for-review phase.
- Submit permission masih memanfaatkan permission seller yang ada sekarang (`PRODUCT_EDIT`), belum ada key permission khusus submission.
- Admin UI besar belum ditambah workflow review; task ini hanya menyiapkan handoff seller side.

## Hasil verifikasi
- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus
- `pnpm qa:mvf` masih gagal pada issue pre-existing:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - rule `QA-MONEY` menandai literal `"$1 $2"`

## Area yang sengaja belum disentuh
- publish final oleh seller
- approval/rejection workflow admin
- revision/resubmission loop
- perubahan admin UI besar
- perubahan storefront/public behavior
