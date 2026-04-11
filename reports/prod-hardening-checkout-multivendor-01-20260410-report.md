# Production Hardening Checkout Multivendor 01

Date: 2026-04-10

## 1. Ringkasan Eksekusi

Audit difokuskan pada flow aktif:

- Client checkout -> `/api/checkout/create-multi-store`
- parent order + seller split/suborder creation
- split payment state dan grouped payment read model
- seller suborder fulfillment gating
- admin payment audit / order aggregate visibility
- production env guard dan staging smoke command yang sudah ada

Area yang diperbaiki:

- Seller fulfillment mutation sekarang mengembalikan blocker domain payment lebih dulu untuk split unpaid, sebelum guard rollout shipment mutation.
- Smoke `order-payment` sekarang membuktikan seller fulfillment ditolak untuk split yang belum `PAID`.
- Notifikasi seller saat checkout dibuat tidak lagi menyebut unpaid split sebagai "ready"; metadata notification sekarang membawa `paymentStatus=UNPAID` dan `fulfillmentStatus=UNFULFILLED`.

Area yang tidak disentuh:

- Schema DB.
- Contract besar parent order / split payment.
- UI redesign Admin/Seller/Client.
- Payment lane baru, Stripe flow baru, analytics, atau module seller/admin baru.

## 2. Temuan Utama

| Entity | Fungsi | Status penting | Consumer |
| --- | --- | --- | --- |
| Parent order | Agregat transaksi buyer | `UNPAID`, `PARTIALLY_PAID`, `PAID`; lifecycle `pending`, `processing`, `shipping`, `delivered`, `cancelled` | Client account/tracking, Admin order list/detail |
| Split/suborder | Unit operasional seller fulfillment | `UNPAID`, `PENDING_CONFIRMATION`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`; fulfillment `UNFULFILLED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` | Seller orders, Admin payment audit, buyer split detail |
| Payment record | Bukti dan timeline settlement split | `CREATED`, `PENDING_CONFIRMATION`, `PAID`, `FAILED`, `EXPIRED`, `REJECTED` | Buyer payment lane, Seller payment review, Admin payment audit |
| `operationalTruth` | Bridge split payment -> split shipment | `paymentToShipment=BLOCKED/READY`, lane `PAYMENT/SHIPMENT`, final-negative flags | Buyer success/tracking/detail, Seller list/detail, Admin payment audit |
| Env/runtime | Production boot safety | auth secret, DB, cookie, upload dir, public checkout base URL, shipment flags | Deployment/operator |

Mismatch utama yang ditemukan:

- Seller fulfillment endpoint mengecek `SHIPMENT_MUTATION_DISABLED` sebelum mengecek split payment. Untuk unpaid split, ini menutup source of truth yang lebih penting: seller memang tidak boleh fulfill karena payment belum settled.
- Seller checkout-created notification memakai wording "ready for seller review", padahal suborder baru selalu `UNPAID` dan `UNFULFILLED`.
- Smoke coverage belum eksplisit mencoba seller fulfillment sebelum payment paid.

## 3. Perubahan yang Dilakukan

Backend:

- `server/src/routes/seller.orders.ts`
  - Urutan guard mutation diubah menjadi:
    1. validasi suborder dan action
    2. payment / parent-order transition blocker
    3. shipment mutation rollout blocker
    4. fulfillment transition status blocker
  - Dampak: unpaid split kini gagal dengan `SUBORDER_PAYMENT_NOT_SETTLED`; paid split dengan mutation-off tetap gagal dengan `SHIPMENT_MUTATION_DISABLED`.
- `server/src/routes/checkout.ts`
  - Notification title seller di checkout-created flow diubah menjadi awaiting buyer payment.
  - Notification meta ditambah `paymentStatus: "UNPAID"` dan `fulfillmentStatus: "UNFULFILLED"`.

Testing:

- `server/src/scripts/smokeOrderPayment.ts`
  - Menambah helper `expectSellerFulfillmentBlocked`.
  - Menambah assertion seller detail awal:
    - `operationalTruth.bridge.paymentToShipment === "BLOCKED"`
    - tidak ada seller fulfillment action enabled sebelum payment settled
    - PATCH fulfillment `MARK_PROCESSING` ditolak dengan `SUBORDER_PAYMENT_NOT_SETTLED`

Admin:

- Tidak ada UI/code admin baru. Audit memastikan admin tetap memakai parent aggregate dan split audit lane existing.

Seller:

- Backend seller actionability lebih jujur pada response error.
- Seller notification tidak lagi memberi sinyal "ready" untuk split yang masih unpaid.

Client:

- Tidak ada patch client. Audit menunjukkan checkout, account payment, success, tracking, dan order detail sudah membaca backend split truth dari pass sebelumnya.

Config/env/deploy:

- Tidak ada patch env baru. Audit mengonfirmasi production guard dan env example dari pass 2026-04-10 sudah mencakup auth, DB, upload dir, public checkout base URL, dan shipment flags.

Endpoint/response yang berubah:

- `PATCH /api/seller/stores/:storeId/suborders/:suborderId/fulfillment`
  - Perubahan behavior kecil: unpaid split mengembalikan `SUBORDER_PAYMENT_NOT_SETTLED` walau shipment mutation rollout sedang disabled.
- Internal seller notification payload dari checkout-created flow
  - Metadata additive: `paymentStatus`, `fulfillmentStatus`.

## 4. Dampak Bisnis

- Risiko buyer turun karena checkout-created split tetap dikomunikasikan sebagai awaiting payment, bukan siap diproses.
- Seller workflow lebih aman karena backend error reason sekarang selaras dengan payment truth untuk unpaid split.
- Admin audit tetap jelas karena parent aggregate dan split operational truth tidak diubah.
- Readiness menuju production meningkat karena smoke sekarang mengunci kasus seller pre-payment fulfillment gate.

## 5. Known Limitations

- Tidak ada idempotency key backend khusus untuk duplicate submit checkout. Frontend sudah punya submit lock, dan backend mengosongkan cart setelah order dibuat, tetapi race multi-request tingkat backend masih layak jadi follow-up bila target traffic naik.
- Parent order payment enum tetap aggregate-only (`UNPAID`, `PARTIALLY_PAID`, `PAID`). Final-negative subtype tetap dibaca dari split/suborder dan `operationalTruth`.
- Client bundle-size warning masih ada dan bukan bagian patch correctness task ini.
- `start:prod` tidak dijalankan pada pass ini; env/deploy guard diaudit dari patch existing dan build/smoke.

## 6. Checklist Status

- Selesai - Audit checkout/order/payment/seller/admin/client active surfaces.
- Selesai - Source of truth parent vs split vs payment dipetakan.
- Selesai - Seller payment gating diperkeras dan diasersi di smoke.
- Selesai - Seller notification checkout-created dibuat tidak misleading.
- Selesai - Backend contract tetap kompatibel; tidak ada schema change.
- Selesai - Build server/client lulus.
- Selesai - Smoke product visibility, store readiness, order payment, shipment regression, Stripe webhook, dan frontend MVF visibility lulus.
- Belum - Backend idempotency key untuk duplicate submit checkout.
- Belum - Bundle-size/performance pass.
- Belum - Real target deployment rehearsal dengan `start:prod`.

## Verifikasi

- `pnpm -F server build` - pass
- `pnpm -F client build` - pass, dengan warning chunk besar existing
- `pnpm -F server smoke:order-payment` - pass
- `pnpm -F server smoke:product-visibility` - pass
- `pnpm -F server smoke:store-readiness` - pass
- `pnpm -F server smoke:stripe-webhook` - pass
- `pnpm qa:mvf:visibility:frontend` - pass
- `pnpm -F server smoke:shipment-regression` - pass

## Saran Task Prompt 2

Task Prompt 2 paling logis: checkout duplicate-submit/idempotency hardening terbatas. Scope awal cukup audit dan desain patch untuk idempotency key atau server-side duplicate guard pada `/api/checkout/create-multi-store`, tanpa mengubah schema dulu kecuali ada Rencana Kolaborasi.
