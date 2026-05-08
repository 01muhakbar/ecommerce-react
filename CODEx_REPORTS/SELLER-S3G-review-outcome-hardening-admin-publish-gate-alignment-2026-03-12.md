# SELLER-S3G — Review Outcome Hardening / Admin Publish Gate Alignment

## Goal
Menyelaraskan admin publish gate dengan seller submission state agar product seller tidak dipublish secara ambigu saat masih berada di review loop.

## Repo audit before coding
- `server/src/routes/admin.products.ts`
- `server/src/routes/seller.products.ts`
- `client/src/pages/admin/Products.jsx`
- `client/src/pages/admin/ProductPreviewDrawer.jsx`
- `client/src/lib/adminApi.js`
- `CODEx_REPORTS/SELLER-S3F-admin-review-inbox-minimal-review-action-2026-03-12.md`

## Temuan utama
- Action admin yang aktif untuk outcome/publish saat ini adalah:
  - `PATCH /api/admin/products/:id`
  - `PATCH /api/admin/products/:id/published`
  - `POST /api/admin/products/bulk` dengan `publish`
- Sebelum hardening, action itu tidak memperhitungkan `sellerSubmissionStatus`, sehingga:
  - product `submitted` bisa dipublish tanpa menyelesaikan state review seller
  - product `needs_revision` bisa ikut jalur publish yang seharusnya belum boleh
  - publish toggle admin bisa menjadi ambigu karena storefront butuh `isPublished === true` dan `status === active`

## ACUAN
- Amati:
  - `admin.products.ts` sebagai source of truth publish/status admin
  - `ProductPreviewDrawer.jsx` sebagai surface review admin yang sudah dipakai untuk request revision
  - `seller.products.ts` visibility note bahwa storefront visibility membutuhkan `isPublished && status === active`
- Tiru:
  - guardrail backend-driven, bukan inferensi UI
  - perubahan kecil pada lane admin existing, bukan workflow baru
- Modifikasi:
  - tambah `publishGate` metadata di admin read model
  - blok bulk publish untuk review-bound seller products
  - final publish individual pada product `submitted` sekarang menyelesaikan review outcome dengan clear submission state

## Perubahan yang dilakukan
1. Menambah `publishGate` pada `sellerSubmission` admin read model:
   - apakah list toggle boleh dipakai
   - apakah final publish boleh dilakukan dari review drawer
   - hint alasan gate
2. Menambah guardrail backend:
   - `needs_revision` tidak boleh dipublish
   - bulk publish tidak boleh dipakai untuk product seller yang masih berada di review loop
   - final publish individual untuk product `submitted`:
     - mengaktifkan `status = active`
     - membersihkan submission state seller
3. Menonaktifkan publish toggle di admin products list untuk item review-bound dan mengarahkan admin ke preview drawer.
4. Menambah action publish final yang eksplisit di `ProductPreviewDrawer.jsx` untuk seller product `submitted`.

## Keputusan alignment
- Product seller dengan `sellerSubmissionStatus=submitted`:
  - tidak boleh dipublish secara ambigu lewat list toggle/bulk publish
  - boleh dipublish sebagai final admin outcome dari review drawer
  - saat dipublish final, submission state seller di-reset ke `none`
- Product seller dengan `sellerSubmissionStatus=needs_revision`:
  - tidak boleh dipublish
  - harus menunggu seller revise + resubmit
- Storefront/public:
  - tetap hanya berubah lewat admin final publish yang sah
  - alignment publish final menormalkan `status=active` agar gate public tetap jelas

## Risiko
- Final publish untuk seller submission sekarang menormalkan `status` menjadi `active`; itu sengaja untuk menghindari publish outcome yang tetap non-public secara ambigu.
- Bulk publish menjadi lebih ketat untuk item seller review-bound; admin harus menyelesaikan review individual dulu.
- History final outcome belum disimpan sebagai audit trail terpisah; phase ini hanya menjaga alignment state yang aktif.

## Verifikasi
- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm qa:mvf` (ekspektasi masih gagal di issue pre-existing `QA-MONEY`)

## Belum disentuh
- Tidak membangun moderation engine atau approval workflow baru.
- Tidak menambah state machine baru.
- Tidak mengubah storefront/public contract.
- Tidak mengubah seller authority.
- Tidak merombak besar admin products UI.
