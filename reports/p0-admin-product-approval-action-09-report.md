# P0-ADMIN-PRODUCT-APPROVAL-ACTION-09 Report

## Ringkasan
Admin Products sekarang memiliki action `Approve` pada row product seller yang sedang `Submitted for review`. Action ini tidak dummy: ia memakai mutation backend existing yang sudah dipakai review drawer untuk menyelesaikan review seller submission.

## Temuan Lifecycle Product Existing
- Review/approval status: `Product.sellerSubmissionStatus`.
- Nilai review: `none`, `submitted`, `needs_revision`.
- `Submitted for review` di Seller berasal dari `sellerSubmissionStatus = submitted`.
- Seller edit lock berasal dari authoring state saat submission `submitted`.
- Admin `Selling` adalah inventory/stock state, bukan approval state.
- Client visible hanya jika product `active`, `published`, review cleared `sellerSubmissionStatus = none`, store operational, dan inventory sellable.

## Field Status/Review yang Dipakai
- Review pending: `Product.sellerSubmissionStatus = "submitted"`.
- Review cleared/approved: `Product.sellerSubmissionStatus = "none"`.
- Product lifecycle setelah approve: `Product.status = "active"`.
- Publish visibility tetap terpisah: `Product.isPublished`.

## Route Approve yang Digunakan
- Reuse existing route: `PATCH /api/admin/products/:id/published` dengan `{ published: true }`.
- Untuk product `submitted`, backend guard `assertAdminPublishAllowed` mengubah action ini menjadi approval review:
  - `status = active`
  - `sellerSubmissionStatus = none`
  - `sellerSubmittedAt = null`
  - `sellerSubmittedByUserId = null`
  - `sellerRevisionRequestedAt = null`
  - `sellerRevisionRequestedByUserId = null`
  - `sellerRevisionNote = null`
  - `isPublished = false`
- Tidak ada route backend baru dan tidak ada migration.

## File Frontend yang Diubah
- `client/src/lib/adminApi.js`
- `client/src/pages/admin/Products.jsx`

## File Backend yang Diubah
- Tidak ada.

## Perubahan UI/UX
- Menambah wrapper API semantic `approveAdminProductReview`.
- Menambah action `Approve` di action menu Admin Products hanya untuk `product.sellerSubmission.status === "submitted"`.
- Urutan menu untuk product submitted: `View`, `Approve`, `Duplicate`, `Edit`, `Delete`.
- Menambah confirmation modal:
  - Title: `Approve product?`
  - Body: `This product will be accepted for selling and seller restrictions will be updated.`
  - Buttons: `Cancel`, `Approve product`
- Success feedback menampilkan notice dan refresh Admin/Seller query.
- Error feedback menampilkan notice ringkas tanpa optimistic permanent change.

## Matrix Sinkronisasi
| Area | Sebelum Approve | Setelah Approve | Field/Route | Risiko |
| --- | --- | --- | --- | --- |
| Admin Products | Review pending / `Submitted for review`; inventory bisa tetap `Selling` | Review cleared, product active, action `Approve` hilang setelah refresh | `sellerSubmissionStatus`, `PATCH /api/admin/products/:id/published` | Endpoint bernama `published`, tetapi behavior review approval sudah existing |
| Seller Products | `Submitted for review`, edit locked | `submissionStatus none`, `status active`, publish/edit mengikuti lifecycle existing | `Product.sellerSubmissionStatus`, seller list serializer | Seller masih perlu publish agar public jika lifecycle existing mengharuskan |
| Client Storefront | Hidden jika review pending | Tetap hidden sampai `isPublished true` dan gates lain terpenuhi | `buildProductVisibilitySnapshot` / public filters | Tidak ada produk dipaksa live oleh approval |
| Backend | `sellerSubmissionStatus submitted` | `sellerSubmissionStatus none`, `status active`, `published false` | `assertAdminPublishAllowed` | Route semantic masih kurang eksplisit untuk masa depan |

## Validasi Manual
- Browser manual login Admin/Seller/Client belum dijalankan dalam turn ini.
- Area yang perlu dicek manual:
  - `/admin/catalog/products`, product submitted menampilkan `Approve`.
  - Klik `Approve`, confirm, row berubah setelah refresh.
  - `/seller/stores/:storeSlug/catalog/products`, status tidak lagi `Submitted for review`.
  - Client storefront tetap tidak menampilkan produk sampai publish/visibility gates terpenuhi.

## Hasil Build dan Smoke
- `pnpm.cmd -F client build`: PASS.
- `pnpm.cmd -F server build`: PASS.
- `pnpm.cmd -F server smoke:product-visibility`: percobaan pertama gagal transient `ECONNRESET` setelah beberapa PASS; rerun PASS penuh.
- `git diff --check -- client/src/lib/adminApi.js client/src/pages/admin/Products.jsx reports/p0-admin-product-approval-action-09-rencana-kolaborasi.md`: PASS.

## Risiko Tersisa
- Route approval masih reuse endpoint `published`; wrapper frontend membuat intent UI jelas, tetapi backend route semantic `approve` bisa dipertimbangkan nanti jika product review workflow diperluas.
- Validasi browser manual dengan kredensial lokal masih perlu dilakukan untuk memastikan row action terlihat pada data nyata seperti `Lorong Keheningan Abadi`.

## Next Task yang Disarankan
- Tambahkan smoke kecil khusus Admin approve product review bila repo ingin mengunci regresi action ini secara backend/API.
