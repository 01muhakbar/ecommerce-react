# Request ID & Diagnostic Surface Operator Note - Task 5A

Tanggal: 2026-04-10

## Tujuan

Catatan ini membantu operator/dev mengaitkan complaint buyer, seller, atau admin dengan log/audit backend menggunakan request id global.

## Request ID

Server membaca header berikut:
- `X-Request-Id`
- `X-Correlation-Id`

Behavior:
- Jika `X-Request-Id` ada dan valid, nilai itu menjadi `requestId`.
- Jika `X-Request-Id` kosong tetapi `X-Correlation-Id` ada dan valid, nilai correlation menjadi `requestId`.
- Jika keduanya kosong/tidak valid, server membuat id baru dengan format `req_<uuid>`.
- Response selalu membawa `X-Request-Id` dan `X-Correlation-Id`.

Nilai valid hanya karakter huruf, angka, dot, underscore, colon, dash, panjang maksimal 120 karakter.

## Diagnostic Surface

Endpoint read-only:
- `GET /api/diagnostics/request-context`

Output aman:
- `requestId`
- `correlationId`
- `requestIdSource`
- nama response header yang dipakai
- `timestamp`

Endpoint ini tidak menampilkan token, cookie, email, payload checkout, data order, data payment, atau secret env.

## Cara Investigasi

### Complaint: checkout dobel / replay / in-progress

1. Minta `X-Request-Id` dari response bila client/operator punya akses.
2. Cari log `[operational-audit] checkout.idempotency.replay`, `checkout.idempotency.race_replay`, atau `checkout.idempotency.in_progress`.
3. Cocokkan `traceId` dengan request id.
4. Gunakan `invoiceNo`, `orderId`, dan `idempotencyKeyFingerprint` dari log untuk menelusuri parent order.

### Complaint: buyer sudah bayar tetapi seller masih blocked

1. Cari `payment.status.transition` dengan `traceId` yang sama.
2. Cocokkan `paymentId`, `oldStatus`, `newStatus`, dan `actorType`.
3. Jika flow Stripe, cari `stripe.order.sync` dengan `traceId`, `invoiceNo`, `sessionId`, dan `updated`.
4. Jika seller review manual, cari actor `SELLER` dan status `PAID` atau `REJECTED`.

### Complaint: webhook/callback Stripe terlambat

1. Gunakan `X-Request-Id` dari gateway/proxy jika tersedia.
2. Cari `stripe.order.sync`.
3. Cocokkan `source=webhook` atau `source=return`.
4. Periksa `alreadyFinalized` untuk membedakan update baru vs replay/late callback.

### Diagnostic Sanity Check

Jalankan:

```sh
pnpm -F server smoke:request-diagnostics
```

Expected:
- generated request id pass
- incoming request/correlation headers respected pass
- correlation header can seed request id pass

## Batasan

- Diagnostic endpoint hanya membuktikan request/correlation plumbing, bukan health database.
- Public release boot tetap bergantung pada env database production yang valid.
- Request id tidak menggantikan idempotency key; request id untuk tracing, idempotency key untuk dedupe checkout.
