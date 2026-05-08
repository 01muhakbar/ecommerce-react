# Admin Read-only Shipping Reconciliation Report

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Status: selesai untuk MVP read-only.

Area yang diaudit:
- `orderShippingReadModel` dan signal audit shipment existing.
- Admin Order Detail dan Payment Audit surface.
- Admin route order existing.
- Shipment regression smoke yang sudah membuat exception/correction fixture.

Yang ditambahkan:
- Backend read-only reconciliation query/service.
- Admin API endpoint read-only.
- Admin page ringan `Shipping Reconciliation`.
- Sidebar link di Online Store.
- Filter `category`, `shipmentStatus`, `search`, dan `storeId`.
- Smoke coverage untuk mixed outcome, active exception, compatibility mismatch, dan seller forbidden access.
- Runbook admin/ops.

Scope perubahan:
- Backend report/query, Admin Workspace read-only surface, smoke regression, docs.
- Tidak ada mutation/action baru, schema migration, courier integration, atau perubahan Client/Seller contract.

## 2. Temuan Utama

Signal high-signal yang dipakai:
- `compatibilityMatchesStorage === false`
- canonical shipment status `FAILED_DELIVERY`
- final exception `RETURNED` / `CANCELLED`
- mixed parent outcome dari split shipment status berbeda
- `missingTrackingTimeline` / `incompleteTrackingData`
- tracking event dengan `source=ADMIN`, `actorType=ADMIN`, atau metadata correction

Constraint:
- Legacy fulfillment tetap tidak bisa mewakili `RETURNED` secara presisi, sehingga report menampilkan canonical shipment dan compatibility side-by-side.
- Report memakai scan terbatas order terbaru untuk MVP, bukan reporting warehouse besar.
- Read-only report tidak menulis audit event supaya tidak noisy.

Area yang sengaja tidak dimasukkan:
- Tidak ada mutation/correction langsung di report.
- Tidak ada data buyer PII.
- Tidak ada courier/provider integration.
- Tidak ada analytics dashboard besar.

## 3. Perubahan yang Dilakukan

### Backend Reconciliation Query/Service

File service baru:
- `server/src/services/shippingReconciliationReport.service.ts`

Endpoint:
- `GET /api/admin/orders/shipping-reconciliation/report`

Response read-only berisi:
- order id / invoice no
- suborder id / number
- store id / name / slug
- canonical shipment status + meta
- compatibility fulfillment status + meta
- stored legacy fulfillment status + meta
- reconciliation categories
- mixed outcome summary
- tracking summary
- admin correction indicator
- link target ke Order Detail existing

### Admin Read-only Surface

Page baru:
- `client/src/pages/admin/AdminShippingReconciliationPage.jsx`

Route:
- `/admin/online-store/shipping-reconciliation`

Sidebar:
- Online Store -> Shipping Reconciliation

UI minimal:
- filter row
- table/list report
- category badges
- canonical vs compatibility columns
- tracking summary
- mixed outcome summary
- read-only link `Open order`

### Filter/Sort

Filter yang ditambahkan:
- `category`
- `shipmentStatus`
- `search` untuk invoice
- `storeId`

Sort:
- backend scan order terbaru berdasarkan `updatedAt DESC`.

Hal yang sengaja tidak ditambahkan:
- saved view
- export CSV
- mutation button
- advanced date range

### Koneksi ke Detail Existing

Setiap item punya `orderDetailHref` ke Admin Order Detail. Correction tetap dilakukan dari surface existing, bukan dari report.

### Smoke/Regression

Shipment regression diperluas untuk:
- mixed returned/delivered outcome muncul di report,
- active `FAILED_DELIVERY` muncul di report,
- seller/non-admin ditolak mengakses endpoint report,
- compatibility mismatch muncul di report,
- order/payment smoke tetap lulus.

### Catatan Operasional

Runbook:
- `reports/admin-shipping-reconciliation-runbook-20260410.md`

## 4. Dampak Bisnis

- Admin lebih cepat menemukan shipment yang perlu perhatian.
- Mismatch canonical vs compatibility lebih mudah terlihat tanpa membuka banyak order.
- Mixed multivendor shipping outcome lebih mudah diawasi.
- Incident support shipping lebih siap tanpa menambah mutation baru.
- Readiness operasional shipping meningkat.

## 5. Known Limitations

- Report scan dibatasi ke order terbaru untuk MVP; belum menjadi reporting warehouse penuh.
- Tidak ada date range filter.
- Tidak ada CSV/export.
- Tracking anomaly masih berbasis signal read model existing.
- Admin correction tetap harus dilakukan dari Order Detail.

Rekomendasi task berikutnya:
- Tambahkan filter tanggal dan optional export CSV untuk report ini jika volume operasional mulai besar.

## 6. Checklist Status

- selesai: Audit data points dan read model existing.
- selesai: Tetapkan kategori rekonsiliasi.
- selesai: Backend read-only report/query.
- selesai: Admin read-only surface.
- selesai: Filter kategori/status/search/store.
- selesai: Link ke Order Detail existing.
- selesai: Jaga Seller/Client contract tidak berubah.
- selesai: Smoke/regression.
- selesai: Runbook operasional.
- belum: Date range filter.
- belum: Export CSV.
- [!] butuh keputusan: apakah report perlu retention/query model khusus bila volume order production melebihi scan MVP.

## 7. Verifikasi

Hasil verifikasi:
- `pnpm -F server build`: pass.
- `pnpm -F client build`: pass.
- `pnpm -F server smoke:shipment-regression`: pass.
- `pnpm -F server smoke:order-payment`: pass.
- `git diff --check` untuk file task ini: pass; hanya warning line-ending dari worktree Windows.

Catatan:
- Tidak ada perubahan workflow mutation shipping.
- Tidak ada perubahan API Client/Storefront atau Seller Workspace.
