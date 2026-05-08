# Admin Shipping Reconciliation Report Runbook

Tanggal: 2026-04-10

## Tujuan

Gunakan report ini untuk menemukan shipment yang perlu perhatian operasional tanpa membuka order satu per satu.

Report ini read-only. Correction tetap dilakukan dari Order Detail dengan correction lane yang sudah ada.

## Lokasi

- Admin Workspace -> Online Store -> Shipping Reconciliation
- Route: `/admin/online-store/shipping-reconciliation`
- API: `GET /api/admin/orders/shipping-reconciliation/report`

## Arti Kategori

| Kategori | Arti | Tindak lanjut |
| --- | --- | --- |
| Active shipping exception | Shipment `FAILED_DELIVERY` dan belum direkonsiliasi | Buka Order Detail, cek timeline, hubungi seller/courier bila perlu |
| Final shipping exception | Shipment `RETURNED` atau `CANCELLED` | Pantau closure dan pastikan buyer-facing state masuk akal |
| Compatibility mismatch | Canonical shipment tidak selaras dengan legacy fulfillment storage | Buka Order Detail dan cek canonical vs compatibility |
| Mixed shipment outcome | Parent multivendor punya split outcome berbeda | Cek per split sebelum menyimpulkan status parent |
| Tracking data incomplete | Timeline/courier/tracking belum lengkap untuk status operasional | Minta seller melengkapi data atau investigasi tracking |
| Admin corrected | Timeline punya correction event admin | Pantau efek correction di buyer/seller/admin read model |

## Kapan Cukup Dipantau

- Final exception sudah konsisten dan buyer/seller tidak komplain.
- Mixed outcome memang valid untuk order multivendor.
- Admin correction baru saja dilakukan dan read model sudah sinkron.

## Kapan Buka Order Detail

- Ada `FAILED_DELIVERY`.
- Ada compatibility mismatch.
- Mixed outcome membuat parent status tampak membingungkan.
- Tracking event kosong atau courier/tracking number belum lengkap.
- Ada complaint buyer/seller/admin.

## Kapan Pakai Correction Lane

Gunakan correction lane hanya setelah bukti operasional cukup, misalnya:
- courier mengonfirmasi delivery sukses setelah `FAILED_DELIVERY`,
- seller mengonfirmasi paket returned,
- support perlu closure administratif dari `RETURNED` ke `CANCELLED`.

Jangan memakai correction untuk bypass split payment atau mengubah shipment unpaid menjadi active.

## Escalate

Escalate ke engineering/product jika:
- category muncul berulang untuk order baru,
- mismatch berasal dari data lama yang tidak punya persisted shipment,
- outcome yang dibutuhkan tidak ada di correction lane,
- report terlalu noisy untuk kategori tertentu,
- parent order multivendor butuh kebijakan status buyer-facing baru.
