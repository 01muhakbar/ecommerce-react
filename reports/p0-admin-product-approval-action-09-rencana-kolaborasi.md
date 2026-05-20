# Rencana Kolaborasi

## Tujuan
Menambahkan action `Approve` di action menu Admin Products untuk produk seller yang sedang `Submitted for review`. Perubahan harus memakai lifecycle existing: approval menyelesaikan review submission, bukan sekadar menyalakan published/selling visibility. Admin, Seller, Client, dan Backend tetap membaca field status yang sama setelah action berjalan.

## Temuan Lifecycle Product Existing
- Field review/approval seller product memakai `Product.sellerSubmissionStatus` dengan nilai `none`, `submitted`, dan `needs_revision`.
- Label Seller `Submitted for review` berasal dari `sellerSubmissionStatus = submitted`, diserialisasi sebagai `submission.status = "submitted"` dan `submission.label = "Submitted for review"`.
- Seller edit lock berasal dari `buildProductAuthoringState`: jika `sellerSubmissionStatus === "submitted"`, `canEditDraft = false` dan `editBlockedReason = "SELLER_PRODUCT_SUBMISSION_LOCKED"`.
- Status visual Admin `Selling` adalah inventory/stock state dari `Product.stock > 0`, bukan review approval status.
- Public Client visibility memakai kombinasi `Product.status === "active"`, `Product.isPublished === true`, `Product.sellerSubmissionStatus === "none"`, store operational, dan inventory sellable.
- Existing report `reports/p0-product-publish-sync-01-2026-05-16-report.md` sudah memisahkan:
  - Review approval = `status active + sellerSubmissionStatus none + published false`
  - Publish status = `isPublished true`, dilakukan setelah approval
  - Client visible = active + published + review-cleared + store operational + stock

## Jawaban Pertanyaan Sebelum Coding
1. Field yang menandai `Submitted for review` adalah `Product.sellerSubmissionStatus = "submitted"`.
2. Field yang membuat produk tampil `Selling` di Admin adalah inventory state dari `stock > 0`, bukan field approval.
3. `Selling` tidak sama dengan approved. `Selling` di Admin saat ini berarti stok tersedia; review state tetap bisa `submitted`.
4. Route backend approval existing sudah ada secara behavior melalui `PATCH /api/admin/products/:id/published` dengan `{ published: true }` untuk produk `submitted`. Guard `assertAdminPublishAllowed` mengubahnya menjadi approval review: `status = active`, `sellerSubmissionStatus = none`, dan `isPublished = false`.
5. Setelah approve, status Seller harus menjadi approved/readable existing: `submission.status = none`, `status = active`, `published = false`. Seller tidak lagi melihat `Submitted for review`; seller dapat publish sesuai rules existing.
6. Produk tidak langsung tampil di Client setelah approve karena `isPublished` tetap false. Produk tampil setelah seller/admin publish sesuai lifecycle existing dan visibility gates terpenuhi.

## Area Terdampak
- Frontend:
  - Admin Products action menu mendapat action `Approve` hanya untuk `sellerSubmission.status === "submitted"`.
  - Admin Products memakai mutation existing approval behavior dan refresh list setelah sukses.
- Backend:
  - Tidak perlu route backend baru karena approval behavior sudah ada dan dipakai `ProductPreviewDrawer`.
- Database:
  - Tidak ada migration atau perubahan schema.
- Shared schema:
  - Tidak ada perubahan.
- QA/smoke test:
  - Build client wajib.
  - Server build tetap dijalankan karena task menyentuh lifecycle audit dan untuk menjaga confidence.
  - Smoke product visibility dijalankan jika tersedia.

## File yang Akan Diubah
- `client/src/lib/adminApi.js`
- `client/src/pages/admin/Products.jsx`
- `reports/p0-admin-product-approval-action-09-rencana-kolaborasi.md`
- `reports/p0-admin-product-approval-action-09-report.md`

## Risiko
- Nama endpoint existing masih `published`, walaupun behavior untuk `submitted` adalah approval review. Risiko dikurangi dengan wrapper frontend bernama `approveAdminProductReview`.
- Approval dari list tidak membuka preview detail; admin harus yakin dari row action. Risiko dikurangi dengan modal confirm sebelum mutation.
- Produk approved tidak langsung public karena published tetap false. Ini sesuai lifecycle existing, tetapi bisa terasa berbeda dari kata "Selling" di Admin.

## Strategi Aman
- Reuse route existing yang sudah dipakai preview drawer untuk approval review.
- Tampilkan `Approve` hanya saat `product.sellerSubmission.status === "submitted"`.
- Gunakan confirmation modal existing style, bukan dependency baru.
- Setelah sukses invalidate `admin-products`, `admin-product`, `admin-product-preview`, dan seller products query family.
- Jangan ubah Seller lock logic kecuali terbukti mapping bug.

## Kriteria Selesai
- [ ] Produk submitted menampilkan action `Approve`.
- [ ] Produk approved/live tidak menampilkan action `Approve`.
- [ ] Produk draft biasa tidak menampilkan action `Approve`.
- [ ] Klik `Approve` membuka konfirmasi.
- [ ] Confirm memanggil mutation backend existing dan refresh list.
- [ ] Seller setelah refresh tidak lagi melihat `Submitted for review`.
- [ ] Client storefront visibility tidak dipaksa berubah oleh approval.
- [ ] Build/lint/smoke relevan dijalankan.

## Acceptance Criteria
- Admin Products action menu untuk product `sellerSubmission.status = submitted` menjadi `View`, `Approve`, `Duplicate`, `Edit`, `Delete`.
- Action `Approve` memanggil backend route yang benar dan mengubah `sellerSubmissionStatus` menjadi `none`.
- Admin list dan Seller list sinkron setelah refresh.
- Produk belum approved tetap tidak dipaksa tampil di Client.

## Butuh Persetujuan?
Tidak, karena lifecycle sudah jelas, tidak perlu migration/backend route baru, dan perubahan bisa dilakukan kecil serta terarah memakai route existing.
