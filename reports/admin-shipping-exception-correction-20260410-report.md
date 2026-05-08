# Admin-only Shipping Exception Correction / Reconciliation Lane

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Status: selesai untuk MVP terbatas.

Area yang diaudit:
- `shipmentMutation.service.ts` untuk canonical shipment mutation dan tracking event.
- `admin.orders.ts` untuk admin order detail dan route admin.
- Admin Order Detail UI yang sudah menampilkan shipment audit.
- Shipment regression smoke yang sudah mencakup seller exception lane.
- Compatibility mapping antara canonical shipment dan legacy fulfillment status.

Yang ditambahkan:
- Admin-only route untuk correction shipment exception.
- Guard transition terbatas, reason wajib, payment guard, persisted shipment guard.
- Operational audit `admin.shipment.correction`.
- Tracking event `source=ADMIN` / `actorType=ADMIN`.
- Admin Order Detail surface kecil untuk menjalankan correction hanya pada status eligible.
- Smoke regression untuk valid admin correction, invalid transition, dan seller non-admin denial.

Scope perubahan:
- Backend route/service, Admin Order Detail surface, admin API helper, shipment smoke, dan runbook.
- Tidak ada schema migration, courier integration, atau refactor besar.

## 2. Temuan Utama

Gap sebelumnya:
- Exception lane seller sudah ada, tetapi admin belum punya jalur koreksi terbatas.
- Kasus `FAILED_DELIVERY` yang ternyata delivered/re-dispatched/returned belum punya admin reconciliation path.
- Audit trail seller transition sudah ada, tetapi correction admin perlu event yang dibedakan dari seller action biasa.

Transisi yang aman untuk MVP:

| Dari | Ke | Prasyarat |
| --- | --- | --- |
| `FAILED_DELIVERY` | `RETURNED` | Admin only, split `PAID`, persisted shipment, reason wajib |
| `FAILED_DELIVERY` | `SHIPPED` | Admin only, split `PAID`, persisted shipment, reason wajib |
| `FAILED_DELIVERY` | `DELIVERED` | Admin only, split `PAID`, persisted shipment, reason wajib |
| `RETURNED` | `CANCELLED` | Admin only, split `PAID`, persisted shipment, reason wajib |

Transisi yang sengaja tidak diaktifkan:
- `CANCELLED` -> `RETURNED` karena closure cancellation lebih riskan dibalik tanpa workflow produk yang jelas.
- `DELIVERED` -> active/in-flight state karena bisa merusak buyer-facing finality.
- `WAITING_PAYMENT` atau split unpaid -> shipment active karena melanggar payment truth.
- `IN_TRANSIT` / `OUT_FOR_DELIVERY` karena belum ada workflow mutation yang kuat.

Constraint:
- Legacy fulfillment hanya punya `UNFULFILLED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, sehingga `RETURNED` tetap disimpan compatibility sebagai `SHIPPED`.

## 3. Perubahan yang Dilakukan

### Admin-only Correction Lane

- Menambahkan endpoint:
  - `PATCH /api/admin/orders/:id/suborders/:suborderId/shipment-correction`
- Endpoint memakai `requireAdmin`, bukan `requireStaffOrAdmin`.
- Payload:
  - `targetStatus`
  - `reason`
- `reason` wajib dan disimpan terbatas di tracking metadata.

### Guard dan Validation

Guard backend:
- Order dan suborder harus valid dan saling terkait.
- Shipment harus persisted.
- Split payment harus `PAID`.
- Shipment mutation flag harus aktif.
- Transition harus masuk allowed transition table.
- Status yang sudah sama ditolak.
- Invalid transition ditolak dengan code `INVALID_ADMIN_SHIPMENT_CORRECTION_TRANSITION`.

### Compatibility Reconciliation

Mapping correction:
- `FAILED_DELIVERY` -> `RETURNED`: compatibility tetap `SHIPPED`.
- `FAILED_DELIVERY` -> `SHIPPED`: compatibility `SHIPPED`.
- `FAILED_DELIVERY` -> `DELIVERED`: compatibility `DELIVERED`.
- `RETURNED` -> `CANCELLED`: compatibility `CANCELLED`.

Canonical shipment tetap truth utama. Legacy compatibility hanya disinkronkan agar consumer lama tidak patah.

### Read Model / UI Sync

- Admin Order Detail menampilkan panel `Admin Exception Correction` hanya untuk shipment yang eligible:
  - `FAILED_DELIVERY`
  - `RETURNED`
- Seller dan Client tidak mendapat mutation privilege baru.
- Seller/Client tetap membaca canonical read model yang sudah ada.

### Audit Trail / Smoke

Audit yang dicatat:
- `traceId`
- `actorUserId`
- `orderId`
- `invoiceNo`
- `suborderId`
- `suborderNumber`
- `statusFrom`
- `statusTo`
- `compatibilityFrom`
- `compatibilityTo`
- `reasonFingerprint`
- `reasonLength`

Tracking event:
- `source=ADMIN`
- `actorType=ADMIN`
- metadata `correction=true`
- metadata reason internal untuk audit DB

Smoke yang ditambahkan:
- Admin correction `FAILED_DELIVERY` -> `DELIVERED` berhasil.
- Seller client ditolak mengakses route admin correction.
- Admin invalid rollback `DELIVERED` -> `RETURNED` ditolak.
- Read model dan compatibility fulfillment tetap konsisten setelah correction.

## 4. Dampak Bisnis

- Admin bisa menangani shipping exception nyata tanpa mutasi liar.
- Buyer/seller/admin mendapat shipping truth yang lebih konsisten setelah rekonsiliasi.
- Incident handling lebih realistis karena correction mencatat actor, transition, dan reason fingerprint.
- Production readiness shipping meningkat tanpa melemahkan payment guard dan seller guard.

## 5. Known Limitations

- Admin correction belum tersedia di Payment Audit Detail page; surface MVP ada di Admin Order Detail shipment audit.
- `CANCELLED` -> `RETURNED` belum diaktifkan karena butuh keputusan produk.
- Correction ke `IN_TRANSIT` / `OUT_FOR_DELIVERY` belum diaktifkan karena belum ada courier/workflow mutation yang kuat.
- Reason tersimpan di tracking metadata DB, tetapi operational log hanya mencatat fingerprint/length agar tidak noisy dan mengurangi risiko data sensitif di log.
- Legacy compatibility tetap tidak bisa membedakan `RETURNED` secara presisi.

Rekomendasi task berikutnya:
- Tambahkan admin read-only reconciliation report untuk daftar shipment dengan compatibility mismatch atau final-negative mixed outcome.

## 6. Checklist Status

- selesai: Audit admin shipping surface dan exception flow.
- selesai: Tetapkan allowed admin-only transitions.
- selesai: Implementasikan backend correction lane.
- selesai: Guard admin role, payment truth, persisted shipment, dan reason wajib.
- selesai: Compatibility reconciliation.
- selesai: Admin Order Detail surface kecil.
- selesai: Audit trail dan tracking event.
- selesai: Smoke regression untuk valid/invalid/non-admin path.
- selesai: Catatan operasional admin.
- belum: Payment Audit Detail mutation surface.
- belum: Reconciliation report listing.
- [!] butuh keputusan: apakah `CANCELLED` -> `RETURNED` boleh diaktifkan di task lanjutan.

## 7. Verifikasi

Hasil verifikasi:
- `pnpm -F server build`: pass.
- `pnpm -F client build`: pass.
- `pnpm -F server smoke:shipment-regression`: pass.
- `pnpm -F server smoke:order-payment`: pass.
- `git diff --check` untuk file task ini: pass; hanya warning line-ending dari worktree Windows.

Catatan:
- `smoke:shipment-regression` sengaja menjalankan invalid correction setelah delivered dan menerima warning terstruktur `INVALID_ADMIN_SHIPMENT_CORRECTION_TRANSITION`.
