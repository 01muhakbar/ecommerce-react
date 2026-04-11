# Checkout / Payment Incident Runbook - Task 4B

Tanggal: 2026-04-10

## Tujuan

Runbook ini membantu operator/dev menelusuri complaint checkout multivendor tanpa dashboard baru. Sumber utama:
- log aplikasi dengan prefix `[operational-audit]`
- tabel `payment_status_logs`
- Admin payment audit page/API existing
- Seller order/payment review detail existing

## Metadata Penting

Cari metadata berikut:
- `invoiceNo`
- `orderId`
- `suborderId` / `suborderNumber`
- `paymentId`
- `idempotencyKeyFingerprint`
- `idempotencySource` (`body` atau `header`)
- `traceId` dari `X-Request-Id` / `X-Correlation-Id` bila caller mengirim

Catatan keamanan:
- Jangan cari raw `checkoutRequestKey`, token, secret, alamat, nomor telepon, atau QR payload. Log hanya memakai fingerprint aman.

## Kasus: Order Muncul Dobel / Buyer Klik Dua Kali

1. Cari log:
   - `[operational-audit] checkout.create.committed`
   - `[operational-audit] checkout.idempotency.replay`
   - `[operational-audit] checkout.idempotency.race_replay`
   - `[operational-audit] checkout.idempotency.in_progress`
2. Cocokkan `idempotencyKeyFingerprint`.
3. Jika ada satu `checkout.create.committed` dan satu/lebih `checkout.idempotency.replay`, duplicate request berhasil direplay ke order existing.
4. Jika ada `checkout.idempotency.in_progress`, request kedua tiba ketika request pertama belum bisa diload. Client aman untuk retry setelah `Retry-After`.
5. Verifikasi DB/API:
   - cari parent `Order.invoiceNo`
   - pastikan suborder dan payment hanya satu set untuk order tersebut.

## Kasus: Checkout Muter / In-Progress Berulang

1. Cari response code `CHECKOUT_IDEMPOTENCY_IN_PROGRESS`.
2. Cari log `[operational-audit] checkout.idempotency.in_progress` dengan `invoiceNo` idempotent.
3. Jika event berulang lebih lama dari beberapa detik:
   - cek apakah transaksi create order pertama gagal sebelum commit
   - cek DB lock/deadlock di log database
   - cek apakah ada process restart di sekitar timestamp tersebut
4. Buyer guidance:
   - tunggu sebentar
   - buka My Orders bila order sudah tercipta
   - retry checkout hanya dengan key yang sama dari client.

## Kasus: Buyer Bilang Sudah Bayar, Seller Masih Blocked

1. Cari `paymentId` dari buyer payment page, seller payment review, atau Admin audit.
2. Cek `payment_status_logs`:
   - `CREATED` = payment lane dibuat saat checkout
   - `PENDING_CONFIRMATION` = buyer sudah submit proof
   - `PAID` = seller approve proof
   - `REJECTED` = seller reject proof
   - `FAILED` = buyer cancel
   - `EXPIRED` = payment expiry
3. Cari log `[operational-audit] payment.status.transition` untuk payment yang sama.
4. Jika seller fulfillment tetap blocked, cari:
   - `[operational-audit] seller.fulfillment.blocked_by_payment`
   - `blockerCode=SUBORDER_PAYMENT_NOT_SETTLED`
5. Jika payment belum `PAID`, seller block adalah expected behavior.
6. Jika payment sudah `PAID` tapi seller block tetap muncul, cek `suborder.paymentStatus`, `order.paymentStatus`, dan parent aggregation.

## Kasus: Stripe/Webhook Tidak Sinkron

1. Cari log `[operational-audit] stripe.order.sync`.
2. Cocokkan:
   - `sessionId`
   - `invoiceNo`
   - `orderId`
   - `updated`
   - `alreadyFinalized`
3. Jika duplicate webhook muncul, expected result:
   - `updated=false`
   - `alreadyFinalized=true`
4. Jika webhook tidak update order:
   - cek event type didukung
   - cek invoice/order id di metadata Stripe session
   - cek `STRIPE_WEBHOOK_SIGNATURE_INVALID` atau `STRIPE_WEBHOOK_NOT_READY`.

## Query / Filter Cepat

Log text:
- `checkout.idempotency.replay`
- `checkout.idempotency.in_progress`
- `payment.status.transition`
- `seller.fulfillment.blocked_by_payment`
- `stripe.order.sync`

Admin support:
- gunakan invoice di Admin order detail / payment audit.

Seller support:
- gunakan `suborderNumber` atau `suborderId` dari Seller order detail.

Buyer support:
- gunakan invoice/ref dari payment page, account orders, success, atau tracking.

## Residual

- Belum ada dashboard/metric untuk menghitung replay rate.
- Legacy consumer tanpa idempotency key tetap tidak punya fingerprint.
- `traceId` hanya muncul bila caller/proxy mengirim `X-Request-Id` atau `X-Correlation-Id`.
