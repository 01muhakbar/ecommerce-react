# SELLER-S3D0 — Product Submission State Foundation

## Goal
Menambahkan source of truth submission seller yang eksplisit pada domain product tanpa membajak `status` dan `isPublished`.

## Why this task exists
- `Product.status` saat ini hanya membedakan `draft`, `active`, dan `inactive`.
- `Product.isPublished` hanya menjawab visibility publish, bukan lifecycle handoff seller.
- Menggunakan `inactive + unpublished` sebagai arti "submitted for review" akan membuat drift makna antara seller dan admin.

## Scope
- In scope:
  - menambah foundation state submission seller pada domain product
  - bridge state itu ke seller read model
  - bridge minimal ke admin read model
- Out of scope:
  - membuka submit action seller
  - moderation engine
  - publish flow seller
  - perubahan storefront/public visibility

## Perubahan inti
### 1. Product domain foundation
- Menambahkan field eksplisit pada product:
  - `sellerSubmissionStatus`
  - `sellerSubmittedAt`
  - `sellerSubmittedByUserId`
- State minimal yang dipakai untuk fase ini:
  - `none`
  - `submitted`

### 2. Seller read model bridge
- Seller serializer sekarang mengembalikan metadata `submission`.
- Governance seller sekarang mengembalikan `submissionGovernance` agar fase handoff berikutnya tidak perlu menebak state dari UI.
- Draft edit state sekarang sudah bisa dikunci oleh source of truth submission state, walau submit action belum dibuka.

### 3. Admin read model bridge
- Admin list/detail/export sekarang menerima metadata `sellerSubmission`.
- Tujuannya agar admin dapat membedakan product yang masuk submission state dari inactive biasa tanpa mengubah flow admin secara besar.

## Kenapa pendekatan ini aman
- Tidak membajak `inactive` menjadi status handoff tersembunyi.
- Tidak mengubah authority publish final.
- Tidak mengubah storefront/public visibility logic.
- Tidak memaksa redesign lifecycle product penuh.

## Risiko
- State `submitted` sudah tersedia, tetapi submit action belum dibuka. Consumer baru harus tetap membaca governance backend, bukan menganggap state itu bisa dipakai langsung dari frontend.
- Admin UI besar belum dirapikan untuk menonjolkan state ini; saat ini baru tersedia di read model.
- Phase berikutnya tetap perlu memutuskan UX lock/edit setelah submit secara eksplisit di atas foundation ini.

## Hasil verifikasi
- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus
- `pnpm qa:mvf` masih gagal pada issue pre-existing:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx:50`
  - rule `QA-MONEY` menandai literal `"$1 $2"`

## Area yang sengaja belum disentuh
- submit/handoff endpoint seller
- CTA submit di seller workspace
- workflow approval/review/revision
- admin UI besar untuk inbox/review
- storefront/public behavior
