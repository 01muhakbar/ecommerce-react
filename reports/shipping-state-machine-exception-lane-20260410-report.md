# Shipping State Machine Hardening + Exception Lane MVP

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Status: selesai untuk patch MVP lokal.

Area yang diaudit:
- Backend shipping read model, shipment mutation service, split operational truth, seller fulfillment route, dan shipment regression smoke.
- Seller Workspace order detail dan API client action typing.
- Compatibility fallback antara canonical shipment status dan legacy fulfillment status.

Yang diperbaiki:
- Canonical shipping state machine dibuat lebih tegas untuk seller mutation.
- Ambiguitas `MARK_PROCESSING` dikurangi: action code tetap kompatibel, tetapi label/action behavior seller sekarang jujur sebagai `PACKED`.
- Exception lane MVP diaktifkan untuk `FAILED_DELIVERY`, `RETURNED`, dan `CANCELLED`.
- Compatibility mapping diperkuat agar `FAILED_DELIVERY` dan `RETURNED` tetap tidak mematahkan legacy `SHIPPED`, sementara `CANCELLED` tetap `CANCELLED`.
- Smoke regression shipping diperluas untuk failed delivery, returned, dan cancel pre-dispatch.

Area yang tidak disentuh:
- Tidak ada migration schema.
- Tidak ada integrasi courier/provider baru.
- Tidak ada redesign UI Admin/Seller/Client.
- Tidak ada refactor besar order/payment architecture.

## 2. Temuan Utama

Ambiguity sebelumnya:
- `MARK_PROCESSING` pada seller sebenarnya memutasi shipment canonical ke `PACKED`, tetapi compatibility fulfillment tetap `PROCESSING`. Label seller lama masih berpotensi membuat operator mengira state canonical adalah `PROCESSING`.
- Legacy fallback `PROCESSING` sebelumnya bisa ditafsirkan sebagai canonical `PROCESSING`; ini kurang tegas karena MVP seller action menyimpan canonical `PACKED`.

Gap exception lane:
- Enum/model sudah mengenal `FAILED_DELIVERY`, `RETURNED`, dan `CANCELLED`, tetapi workflow MVP belum cukup jelas untuk seller action dan read model.
- `FAILED_DELIVERY` sebelumnya diperlakukan sebagai final-negative di split operational truth sehingga follow-up lane `RETURNED` tidak bisa dipakai secara operasional.
- Aggregate read model belum memprioritaskan exception status sebelum status sukses biasa.

Constraint:
- Legacy fulfillment status tidak memiliki representasi presisi untuk `FAILED_DELIVERY` dan `RETURNED`. Patch ini mempertahankan compatibility sebagai `SHIPPED` agar legacy consumer tidak patah, sementara canonical shipment tetap menjadi source of truth.

## 3. Perubahan yang Dilakukan

### State Machine Shipping

State final MVP:

| State | Fungsi | Actor mutation MVP | Catatan |
| --- | --- | --- | --- |
| `WAITING_PAYMENT` | Shipment belum actionable karena payment belum valid | System | Tetap payment-gated |
| `READY_TO_FULFILL` | Paid dan siap diproses seller | System | Bridge payment ke fulfillment |
| `PACKED` | Seller sudah menyiapkan paket | Seller via `MARK_PROCESSING` | Compatibility tetap `PROCESSING` |
| `SHIPPED` | Paket dikirim | Seller via `MARK_SHIPPED` | Basis untuk exception delivery |
| `IN_TRANSIT` | Paket transit | System/admin/future | Diakui read model, belum seller action MVP |
| `OUT_FOR_DELIVERY` | Paket menuju alamat buyer | System/admin/future | Diakui read model, belum seller action MVP |
| `DELIVERED` | Pengiriman selesai | Seller via `MARK_DELIVERED` | Final success |
| `FAILED_DELIVERY` | Delivery gagal, masih bisa ditindaklanjuti | Seller via `MARK_FAILED_DELIVERY` | Active exception |
| `RETURNED` | Paket diretur | Seller via `MARK_RETURNED` | Final exception |
| `CANCELLED` | Shipment dibatalkan sebelum dispatch | Seller via `CANCEL_SHIPMENT` | Final exception |

Allowed transition MVP:
- `READY_TO_FULFILL` -> `PACKED`
- `PACKED` -> `SHIPPED`
- `SHIPPED` / `IN_TRANSIT` / `OUT_FOR_DELIVERY` -> `DELIVERED`
- `SHIPPED` / `IN_TRANSIT` / `OUT_FOR_DELIVERY` -> `FAILED_DELIVERY`
- `FAILED_DELIVERY` -> `RETURNED`
- `READY_TO_FULFILL` / `PACKED` -> `CANCELLED`

### Seller Action Naming/Mapping

- `MARK_PROCESSING` dipertahankan sebagai action code compatibility.
- Label seller dirapikan menjadi `Mark packed`.
- Success text seller dirapikan menjadi `Shipment marked as packed`.
- Route response transition menambahkan `shipmentTo` agar canonical target state lebih jelas.

### Exception Lane MVP

- `MARK_FAILED_DELIVERY` menulis canonical `FAILED_DELIVERY`, tracking event `FAILED_DELIVERY`, dan legacy compatibility `SHIPPED`.
- `MARK_RETURNED` menulis canonical `RETURNED`, tracking event `RETURNED`, dan legacy compatibility `SHIPPED`.
- `CANCEL_SHIPMENT` menulis canonical `CANCELLED`, tracking event `CANCELLED`, dan legacy compatibility `CANCELLED`.
- Exception action membutuhkan persisted shipment agar tidak dipakai pada fallback-only legacy data.

### Compatibility Layer

Canonical -> compatibility mapping:

| Canonical shipment | Compatibility fulfillment |
| --- | --- |
| `WAITING_PAYMENT` | `UNFULFILLED` |
| `READY_TO_FULFILL` | `UNFULFILLED` |
| `PROCESSING` / `PACKED` | `PROCESSING` |
| `SHIPPED` / `IN_TRANSIT` / `OUT_FOR_DELIVERY` | `SHIPPED` |
| `FAILED_DELIVERY` / `RETURNED` | `SHIPPED` |
| `DELIVERED` | `DELIVERED` |
| `CANCELLED` | `CANCELLED` |

Area yang diperkuat:
- Fallback legacy `PROCESSING` kini dibaca sebagai canonical `PACKED`.
- `FAILED_DELIVERY` tidak lagi final-negative di split operational truth, sehingga `RETURNED` bisa menjadi follow-up state.
- Aggregate shipment read model memprioritaskan `RETURNED`, lalu `FAILED_DELIVERY`, sebelum delivered/shipped/processing.

### Read Model / UI Surface Sync

- Seller order detail kini menampilkan action exception bila backend read model mengaktifkannya.
- Seller error handling ditambah untuk invalid transition, action membutuhkan persisted shipment, dan status yang sudah sama.
- Client/Admin tidak perlu patch UI khusus karena surface existing membaca shipping read model/backend response.

### Audit/Smoke

- Seller shipment mutation menulis `seller.shipment.transition` via operational audit dengan trace/request context yang tersedia.
- Tracking events tetap append-only untuk transition canonical.
- Smoke regression shipping diperluas untuk:
  - paid order menjadi ready-to-fulfill tetap aman,
  - seller packed/shipped/delivered tetap berjalan,
  - `FAILED_DELIVERY` -> `RETURNED` bekerja,
  - `CANCEL_SHIPMENT` untuk shipment pre-dispatch bekerja,
  - compatibility fulfillment tidak rusak.

## 4. Dampak Bisnis

- Shipping truth lebih jujur karena canonical status dan compatibility status tidak lagi tercampur secara ambigu.
- Seller workflow lebih aman karena transition invalid ditolak oleh backend.
- Buyer tracking lebih jelas saat shipment masuk exception lane.
- Admin/support lebih mudah audit karena tracking event dan operational audit punya transition yang lebih eksplisit.
- Readiness production shipping meningkat tanpa schema change atau integrasi courier baru.

## 5. Known Limitations

- `IN_TRANSIT` dan `OUT_FOR_DELIVERY` diakui read model, tetapi belum diaktifkan sebagai seller action MVP.
- Legacy fulfillment status tetap tidak bisa membedakan `FAILED_DELIVERY` dan `RETURNED` secara presisi; canonical shipment harus dipakai untuk truth.
- Admin mutation lane untuk exception belum ditambah; MVP ini fokus pada seller operational lane dan read model.
- Belum ada courier/provider automation; exception masih manual melalui action existing pattern.
- Data lama fallback-only yang belum punya persisted shipment tidak bisa memakai exception action sampai shipment persisted tersedia.

Rekomendasi task berikutnya:
- Tambah Admin-only correction lane terbatas untuk shipping exception dan reconciliation report, tanpa mengubah schema besar.
- Tambah manual QA smoke untuk buyer tracking copy pada order multi-seller dengan satu shipment returned dan satu shipment delivered.

## 6. Checklist Status

- selesai: Audit state machine shipping existing.
- selesai: Tetapkan canonical state machine MVP dan allowed transition.
- selesai: Rapikan seller action naming/mapping tanpa breaking action code.
- selesai: Aktifkan exception lane MVP untuk failed delivery, returned, cancelled.
- selesai: Perkuat compatibility mapping.
- selesai: Sinkronkan Seller Workspace action surface.
- selesai: Jaga payment-to-shipping truth melalui existing readiness guard.
- selesai: Tambah tracking/audit secukupnya.
- selesai: Tambah smoke regression shipping.
- belum: Admin mutation exception lane khusus.
- belum: Courier/provider-driven `IN_TRANSIT` dan `OUT_FOR_DELIVERY`.
- [!] butuh keputusan: apakah legacy fulfillment status perlu diperluas di masa depan untuk membedakan `FAILED_DELIVERY` dan `RETURNED` tanpa bergantung pada canonical shipment read model.

## 7. Verifikasi

Hasil verifikasi:
- `pnpm -F server build`: pass.
- `pnpm -F client build`: pass.
- `pnpm -F server smoke:shipment-regression`: pass.
- `pnpm -F server smoke:order-payment`: pass.
- `pnpm qa:mvf:visibility:frontend`: pass.
- `git diff --check`: pass; hanya warning line-ending dari file yang sudah ada di worktree.

Residual:
- Worktree masih memiliki perubahan dari task-task sebelumnya yang tidak disentuh balik dalam task ini.
