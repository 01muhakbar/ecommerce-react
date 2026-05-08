# SELLER-S3E — Seller Product Revision / Resubmission Loop

## Goal
Membuka loop revisi phase-1 yang memungkinkan admin meminta revisi, seller memperbaiki draft lagi, lalu seller melakukan resubmit tanpa membuka publish final.

## Why this task exists
- S3D sudah membuka handoff satu arah `draft -> submitted`.
- Tanpa state revisi, seller tidak punya jalur aman untuk memperbaiki product yang diminta revisi.
- Repo belum butuh moderation engine penuh; yang dibutuhkan sekarang adalah loop minimum yang store-scoped dan backend-driven.

## Scope
- In scope:
  - perluasan minimal submission state
  - metadata revisi minimum
  - trigger admin ringan untuk request revision
  - seller edit ulang + resubmit
- Out of scope:
  - moderation engine
  - threaded review comments
  - publish final seller
  - rejection workflow kompleks
  - storefront/public visibility changes

## Perubahan inti
### 1. State minimum
- `sellerSubmissionStatus` diperluas menjadi:
  - `none`
  - `submitted`
  - `needs_revision`

### 2. Metadata revisi minimum
- Menambahkan:
  - `sellerRevisionRequestedAt`
  - `sellerRevisionRequestedByUserId`
  - `sellerRevisionNote`

### 3. Transisi yang dibuka
- Admin ringan:
  - `submitted -> needs_revision`
- Seller:
  - `draft + none -> submitted`
  - `draft + needs_revision -> submitted`

### 4. Governance seller
- Seller edit tetap terkunci saat `submitted`.
- Seller edit dibuka kembali saat `needs_revision`.
- Seller resubmit hanya tersedia saat backend governance mengizinkan.
- Publish authority tetap admin-owned.

### 5. Trigger admin ringan
- Trigger revisi ditambahkan secara minimal di admin preview drawer.
- Tidak ada refactor besar admin products UI.
- Tidak ada inbox review baru.

## Kenapa pendekatan ini aman
- Tidak membajak `Product.status` atau `isPublished`.
- Tidak menambah state machine besar.
- Tidak mengubah contract storefront/public.
- Tidak memindahkan authority publish ke seller.
- Revisi ditrigger dari admin secara ringan, tetapi source of truth tetap di domain product.

## Risiko
- Revision loop masih phase-1: belum ada rejection taxonomy, revision history, atau resubmission history yang kaya.
- Trigger revisi admin saat ini ada di preview drawer, belum menjadi workflow review admin yang lebih eksplisit.
- Permission submit/resubmit seller masih memanfaatkan permission seller yang ada sekarang, belum punya key submission/revision khusus.

## Hasil verifikasi
- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus
- `pnpm --filter server migrate` lulus
- `pnpm qa:mvf` masih gagal pada issue pre-existing:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - rule `QA-MONEY` menandai literal `"$1 $2"`

## Area yang sengaja belum disentuh
- moderation engine penuh
- threaded comments / review threads
- publish final seller
- rejection workflow multi-status
- admin inbox/review dashboard baru
- storefront/public visibility behavior
