# Admin Shipping Exception Correction Runbook

Tanggal: 2026-04-10

## Tujuan

Gunakan runbook ini saat admin perlu mengoreksi shipment exception yang sudah masuk lane `FAILED_DELIVERY` atau `RETURNED`.

Correction lane ini hanya untuk rekonsiliasi operasional terbatas. Jangan dipakai untuk bypass payment, mempercepat fulfillment unpaid, atau mengganti workflow seller normal.

## Kapan Boleh Dipakai

- Seller menandai `FAILED_DELIVERY`, lalu support/courier mengonfirmasi paket sebenarnya `DELIVERED`.
- Seller menandai `FAILED_DELIVERY`, lalu paket dikirim ulang dan status operasional harus kembali ke `SHIPPED`.
- Seller menandai `FAILED_DELIVERY`, lalu paket benar-benar `RETURNED`.
- Shipment sudah `RETURNED`, lalu admin perlu closure administratif sebagai `CANCELLED`.

## Kapan Jangan Dipakai

- Split payment belum `PAID`.
- Shipment belum persisted.
- Admin hanya ingin memaksa parent order terlihat selesai.
- Status `DELIVERED` ingin dikembalikan ke in-flight state.
- Target state seperti `OUT_FOR_DELIVERY` belum punya workflow yang kuat di repo.
- Alasan koreksi tidak jelas atau mengandung data sensitif yang tidak perlu.

## Allowed Transitions

| Dari | Ke | Catatan |
| --- | --- | --- |
| `FAILED_DELIVERY` | `RETURNED` | Paket kembali ke seller/warehouse. |
| `FAILED_DELIVERY` | `SHIPPED` | Re-dispatched setelah failed delivery. |
| `FAILED_DELIVERY` | `DELIVERED` | Bukti kuat menunjukkan paket diterima buyer. |
| `RETURNED` | `CANCELLED` | Closure administratif shipment return. |

Tidak diaktifkan:
- `CANCELLED` -> `RETURNED`
- `DELIVERED` -> active/in-flight state
- direct correction dari `WAITING_PAYMENT`, `READY_TO_FULFILL`, `PACKED`, `SHIPPED` non-exception
- correction ke `IN_TRANSIT` / `OUT_FOR_DELIVERY`

## Cara Memakai

1. Buka Admin Workspace -> Order Detail.
2. Pastikan shipment card menampilkan status exception yang eligible.
3. Pada bagian `Admin Exception Correction`, pilih target correction.
4. Isi reason minimal 8 karakter, singkat dan operasional.
5. Klik `Apply Correction`.
6. Reload/readback order detail dan split payment audit bila perlu.

Contoh reason yang aman:
- `courier confirmation received after failed delivery`
- `returned package confirmed by seller support`
- `admin closure after returned shipment reconciliation`

Jangan tulis token, nomor kartu, secret, atau data personal mentah yang tidak perlu.

## Cara Investigasi Setelah Correction

- Cek `tracking_events`: event baru punya `source=ADMIN`, `actorType=ADMIN`, dan metadata `correction=true`.
- Cek log `[operational-audit] admin.shipment.correction`.
- Cek field utama:
  - `orderId`
  - `invoiceNo`
  - `suborderId`
  - `suborderNumber`
  - `statusFrom`
  - `statusTo`
  - `compatibilityFrom`
  - `compatibilityTo`
  - `reasonFingerprint`
- Cek Seller Workspace dan Client tracking untuk memastikan read model canonical terbaca konsisten.

## Escalate

Escalate ke engineering/product jika:
- correction yang dibutuhkan tidak ada di allowed transition,
- shipment tidak punya persisted record,
- payment belum `PAID` tetapi tim operasi ingin melanjutkan shipping,
- ada mismatch berulang antara canonical shipment dan compatibility fulfillment,
- parent order multivendor memiliki outcome campuran yang membingungkan buyer/admin.
