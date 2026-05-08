# MVF-TRUTH-05D — Admin Operational Truth Migration

## Ringkasan
Task ini mengeraskan surface admin aktif supaya parent order tetap terbaca sebagai agregat, sementara split payment dan split shipment dibaca sebagai truth operasional. Perubahan utama ada pada admin payment audit list/detail, ditambah wording guardrail pada admin orders/detail agar admin tidak menganggap parent raw status sebagai sumber utama operasional split.

## Halaman admin yang diaudit
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditDetailPage.jsx`
- `client/src/pages/admin/Orders.jsx`
- `client/src/pages/admin/OrderDetail.jsx`

## Mismatch nyata yang diperbaiki
- `AdminPaymentAuditPage` sebelumnya masih membaca bucket raw compatibility count saja dan sempat terpotong secara JSX. Page ini dipulihkan dan sekarang memprioritaskan `operationalCounts` bila tersedia.
- `AdminPaymentAuditPage` sekarang menampilkan helper split yang lebih jujur untuk `shipment lane` dan `final-negative` split tanpa memaksa subtype aggregate baru.
- `AdminPaymentAuditDetailPage` sebelumnya masih menampilkan split payment/shipment/status dari field lama sebagai primary truth. Sekarang split card memprioritaskan `operationalTruth.statusSummary`, `operationalTruth.payment`, `operationalTruth.shipment`, `operationalTruth.bridge`, dan `operationalTruth.finality`.
- `AdminPaymentAuditDetailPage` sekarang memberi helper text yang jujur untuk split blocked/final-negative dan tidak lagi menjatuhkan split ke narasi generic bila `operationalTruth` sudah tersedia.
- `Orders.jsx` sekarang menegaskan bahwa parent order row bersifat agregat pada `MULTI_STORE`, sehingga status row tidak menutupi split truth.
- `OrderDetail.jsx` sekarang menegaskan bahwa parent payment/shipping cards adalah aggregate/oversight surface, bukan truth operasional split.

## File yang diubah
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditDetailPage.jsx`
- `client/src/pages/admin/Orders.jsx`
- `client/src/pages/admin/OrderDetail.jsx`
- `reports/mvf-truth-05d-admin-operational-truth-migration-20260410-report.md`

## Dampak ke admin oversight
- Admin payment audit list/detail lebih konsisten membaca split payment + split shipment sebagai unit operasional.
- Parent order lanes tetap ada, tetapi wording-nya sekarang lebih jujur sebagai aggregate/oversight surface.
- Final-negative split tidak lagi terlihat seperti flow normal pada detail audit.

## Risiko / residual
- `AdminPaymentAuditPage` list tetap memakai aggregate count backend; task ini hanya memprioritaskan operational count additive yang sudah tersedia, bukan membangun analytics baru.
- `Orders.jsx` dan `OrderDetail.jsx` belum menerima payload split `operationalTruth`; karena itu patch di dua surface ini sengaja berhenti pada wording/oversight guardrail.
- Jika admin order main pages nantinya perlu split shipment + split payment cards penuh, itu lebih aman dikerjakan lewat producer/backend additive berikutnya atau `Rencana Kolaborasi` bila scope meluas.

## Temuan yang butuh Rencana Kolaborasi
- Belum ada blocker yang mengharuskan `Rencana Kolaborasi` untuk task ini.
- Jika ingin memindahkan full split operational cards ke admin order main detail/list tanpa audit lane terpisah, itu berpotensi menyentuh producer summary backend dan perlu boundary map lebih dulu.
