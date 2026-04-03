# MVF-TRUTH-01 Phase 2 Report

## 1. Summary perubahan

Phase 2 melanjutkan hardening tanpa mengulang patch phase 1. Fokusnya:

- menyinkronkan stepper visual dan state utama pada `StoreOrderTrackingPage` agar membaca backend order contract lebih dulu
- mengaudit penggunaan komponen legacy `OrderDetailsModal` dan `OrderRow`

Patch aktif hanya dilakukan pada route publik tracking karena di sanalah masih ada visual utama yang membaca `order.status` mentah walau `contract.statusSummary` sudah tersedia.

## 2. Mismatch yang ditemukan

- Masalah: `client/src/pages/store/StoreOrderTrackingPage.jsx` masih menurunkan hero summary, next-step card, halted-state, dan stepper dari `order.status` mentah.
  - Source of truth seharusnya: `contract.statusSummary` dari backend tracking payload
  - Risiko production:
    - tracking bisa menampilkan progres delivery biasa padahal payment masih actionable / under review
    - status visual utama bisa berbeda dengan badge status contract pada halaman yang sama
  - Patch aman terkecil:
    - gunakan `getOrderTruthStatus(order)` lalu petakan code contract ke state visual tracking

- Masalah: komponen legacy berikut masih membaca status mentah:
  - `client/src/components/Orders/OrderDetailsModal.jsx`
  - `client/src/components/Tables/OrderRow.jsx`
  - Hasil audit pemakaian route aktif: tidak ditemukan dipakai oleh route aktif saat ini; `OrderRow` hanya dipakai `OrderTable`, dan `OrderTable` sendiri tidak ditemukan dipakai route aktif. `OrderDetailsModal` juga tidak ditemukan dipakai route aktif.
  - Keputusan: tidak dipatch pada phase 2, dicatat sebagai legacy/deferred.

## 3. Mismatch yang diperbaiki

- Diperbaiki: `StoreOrderTrackingPage` sekarang memakai `getOrderTruthStatus(order)` sebagai dasar status utama.
- Diperbaiki: stepper visual tracking sekarang dipetakan dari truth contract bila contract tersedia, bukan dari `order.status` mentah.
- Diperbaiki: hero summary dan next-step / halted-state card sekarang konsisten dengan contract status seperti `ACTION_REQUIRED`, `UNDER_REVIEW`, `FAILED`, `EXPIRED`, `CANCELLED`, `PROCESSING`, `SHIPPING`, `DELIVERED`.

## 4. File yang diubah

- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `reports/mvf-truth-01-phase-2-report.md`

## 5. Audit komponen legacy

- `client/src/components/Orders/OrderDetailsModal.jsx`
  - Tidak ditemukan dipakai route aktif berdasarkan pencarian repo.
- `client/src/components/Tables/OrderRow.jsx`
  - Dipakai oleh `client/src/components/Tables/OrderTable.jsx`
  - `OrderTable.jsx` tidak ditemukan dipakai route aktif berdasarkan pencarian repo.

Kesimpulan: keduanya legacy/deferred, tidak dipatch agar boundary tetap kecil dan aman.

## 6. Dampak lintas app

- Admin:
  - Tidak ada perubahan baru pada phase 2.
  - Truth sinkronisasi phase 1 tetap berlaku.
- Seller:
  - Tidak ada perubahan baru pada phase 2.
- Client:
  - Tracking publik kini lebih jujur terhadap lifecycle backend.
  - Visual utama tidak lagi mempromosikan progres delivery biasa saat contract menunjukkan payment masih actionable, under review, failed, expired, atau cancelled.
- Backend/API:
  - Tidak ada perubahan backend.
  - Contract backend tetap source of truth.

## 7. Verifikasi

### Build

- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:order-payment` ✅

### QA

- `pnpm qa:mvf:visibility:frontend` ✅

Catatan:

- Tidak ada smoke frontend khusus untuk tracking page di repo.
- `smoke:order-payment` dipakai sebagai smoke lifecycle paling relevan karena menyentuh order/payment truth yang menjadi sumber status tracking.

## 8. Risiko / residual issue

- Split cards di tracking page masih menampilkan fulfillment dan payment sebagai dua badge terpisah. Ini tidak melawan backend truth, tetapi belum disatukan ke presentasi contract per split.
- Komponen order legacy yang tidak aktif masih membaca status mentah. Karena tidak dipakai route aktif, ini sengaja dibiarkan sebagai deferred.
- Phase 2 tidak mengubah contract API besar, jadi coverage penuh tetap bergantung pada endpoint yang memang sudah mengirim contract.

## 9. Acceptance criteria check

- Tracking stepper publik konsisten dengan backend truth: ya
- Tidak ada status visual utama di route aktif yang masih melawan `contract.statusSummary` bila contract tersedia: ya, untuk tracking page yang dipatch dan surfaces phase 1 yang tetap berlaku
- Build dan smoke/QA relevan tetap hijau: ya
- Ada laporan hasil phase 2: ya
