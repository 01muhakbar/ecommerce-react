# SELLER-S3F — Admin Review Inbox / Minimal Review Action

## Goal
Membuat lane review admin yang lebih jelas dan usable untuk seller product submission/revision tanpa mengubah domain authority admin atau melebar menjadi moderation engine.

## Repo audit before coding
- `client/src/pages/admin/Products.jsx`
- `client/src/pages/admin/ProductPreviewDrawer.jsx`
- `client/src/lib/adminApi.js`
- `server/src/routes/admin.products.ts`
- `server/src/routes/seller.products.ts`
- `CODEx_REPORTS/SELLER-S3E-product-revision-resubmission-loop-2026-03-12.md`

## Temuan utama
- Backend admin read model sebenarnya sudah membawa `sellerSubmission`, tetapi list admin products belum memberi filter atau queue yang jelas untuk state `submitted` dan `needs_revision`.
- Review action minimal sudah ada di preview drawer (`request revision`), tetapi entry lane admin masih terlalu tipis karena list page belum membantu admin menemukan item review secara cepat.
- Contract seller/admin/storefront tidak perlu diubah besar; gap utamanya ada di surface UI admin dan list filter.

## ACUAN
- Amati:
  - `Products.jsx` sebagai lane operasional admin yang paling stabil untuk filtering dan quick actions.
  - `ProductPreviewDrawer.jsx` sebagai action surface review minimal yang sudah aktif.
  - `admin.products.ts` serializer `sellerSubmission` yang sudah menjadi source of truth review state.
- Tiru:
  - pola dashboard/filter card ringan yang sudah dipakai di admin workspace.
  - pola backend-driven status badge, bukan inferensi status dari frontend.
- Modifikasi:
  - tambah filter query `sellerSubmissionStatus` yang kecil dan backward-safe.
  - tambah queue cards ringan + status column review di products table.
  - tidak membangun inbox/reviewer assignment/workflow engine baru.

## Perubahan yang dilakukan
1. Menambah filter backend `sellerSubmissionStatus` untuk:
   - `submitted`
   - `needs_revision`
   - `review_queue`
2. Menambah `meta.reviewQueue` pada list response admin products agar UI bisa menampilkan submitted vs needs revision dengan jelas.
3. Menambah dukungan export untuk filter review state yang sama.
4. Menambah review inbox minimal di `Products.jsx`:
   - queue cards `All products`, `Review queue`, `Submitted`, `Needs revision`
   - filter dropdown `Review state`
   - status kolom `Seller Review` di tabel
5. Menjaga preview drawer tetap menjadi action surface minimal untuk `Request Revision`, tanpa menambah moderation workflow baru.

## Dampak sinkronisasi
- Admin Workspace:
  - lebih mudah menemukan seller products yang `submitted` atau `needs_revision`
  - action `request revision` tetap memakai flow yang sudah ada
- Seller Workspace:
  - tetap sinkron karena admin bekerja di atas state domain yang sama (`sellerSubmissionStatus`)
- Client/storefront:
  - tidak berubah
- Query/filter:
  - list admin products sekarang mendukung filter review state secara resmi

## Risiko
- Review inbox masih phase-1 dan tetap hidup di page products, belum menjadi modul review terpisah.
- Tidak ada assignment/history/SLA review; itu sengaja ditahan agar task tidak melebar.
- Queue counts mengikuti scope filter pencarian/category saat ini, bukan analytics global terpisah.

## Verifikasi
- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm qa:mvf` (ekspektasi masih gagal di issue pre-existing `QA-MONEY`)

## Belum disentuh
- Tidak membangun moderation engine besar.
- Tidak membangun reviewer assignment atau threaded comments.
- Tidak mengubah storefront/public visibility.
- Tidak mengubah seller authority.
- Tidak mengubah admin publish contract besar-besaran.
