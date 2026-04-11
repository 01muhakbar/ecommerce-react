# Task Prompt 4B - Observability Ringan + Idempotency/Payment Audit Robustness

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Area yang diaudit:
- Checkout multivendor route, terutama create/replay/in-progress idempotency.
- Payment proof submit, buyer cancel, seller review approve/reject, payment expiry, dan Stripe webhook sync.
- Existing `payment_status_logs` sebagai audit trail utama.
- Seller fulfillment blocker ketika payment belum settled.
- Smoke `order-payment` dan public release gate.

Observability yang ditambahkan:
- Helper audit ringan untuk fingerprint idempotency, request trace id, note audit key=value, dan structured log prefix `[operational-audit]`.
- Log checkout high-signal:
  - `checkout.create.committed`
  - `checkout.idempotency.replay`
  - `checkout.idempotency.race_replay`
  - `checkout.idempotency.in_progress`
  - `checkout.idempotency.invalid_key`
- Log payment transition:
  - `payment.status.transition`
- Log seller support blocker:
  - `seller.fulfillment.blocked_by_payment`
- Log Stripe sync:
  - `stripe.order.sync`
- Audit note `payment_status_logs.note` diperkaya dengan source/order/split/payment metadata aman.

Scope perubahan:
- Lokal di backend service/route + smoke + report/runbook.
- Tidak ada schema migration.
- Tidak ada dashboard/monitoring vendor baru.
- Tidak ada UI redesign.

## 2. Temuan Utama

Gap observability awal:
- Checkout replay dan in-progress sudah aman secara behavior, tetapi operator belum punya fingerprint/correlation yang konsisten untuk membedakan new vs replay vs in-progress.
- `payment_status_logs` sudah ada, tetapi note beberapa transition belum menyebut source route, invoice, suborder, atau store secara eksplisit.
- Seller fulfillment blocker sudah benar, tetapi complaint “seller belum bisa proses” perlu log yang langsung menunjukkan payment blocker dan state saat itu.
- Stripe webhook smoke sudah menguji idempotency, tetapi log sync belum memberi ringkasan `updated/alreadyFinalized` untuk incident.

Area paling risk untuk incident handling:
- Buyer timeout setelah order sudah committed lalu retry.
- Payment proof sudah submit tetapi seller belum approve.
- Seller mencoba fulfillment sebelum payment `PAID`.
- Duplicate Stripe webhook yang harus terlihat sebagai idempotent, bukan error.

Kendala yang masih ada:
- Tidak ada request id otomatis global; `traceId` hanya terisi bila proxy/caller mengirim `X-Request-Id` atau `X-Correlation-Id`.
- Belum ada metric/dashboard untuk replay rate atau in-progress rate.
- Legacy checkout consumer tanpa key tidak punya `idempotencyKeyFingerprint`.

## 3. Perubahan yang Dilakukan

Checkout logging/audit:
- `server/src/services/operationalAudit.service.ts`
  - `fingerprintAuditValue`
  - `getRequestTraceId`
  - `appendAuditNote`
  - `logOperationalAuditEvent`
- `server/src/routes/checkout.ts`
  - replay existing order mencatat `checkout.idempotency.replay`.
  - race replay mencatat `checkout.idempotency.race_replay`.
  - in-progress mencatat `checkout.idempotency.in_progress` + `Retry-After`.
  - create sukses mencatat `checkout.create.committed`.
  - payment initiation log `CREATED` diberi audit note dengan source `checkout:create-multi-store`, invoice, order, suborder, store, dan idempotency fingerprint bila ada.

Idempotency logging/audit:
- Metadata aman yang dipakai:
  - `traceId`
  - `userId`
  - `orderId`
  - `invoiceNo`
  - `idempotencyKeyFingerprint`
  - `idempotencySource`
- Raw idempotency key tidak dilog.

Payment transition audit:
- `server/src/services/paymentStatusLog.service.ts`
  - setiap status log sekarang juga mencatat structured event `payment.status.transition`.
  - log dieksekusi setelah transaction commit bila transaction mendukung `afterCommit`, supaya tidak membuat false-positive saat rollback.
- `server/src/routes/payments.ts`
  - proof submit dan buyer cancel note diberi metadata source/order/split/store.
- `server/src/routes/seller.payments.ts`
  - approve/reject note diberi metadata source/order/split/store.
- `server/src/services/paymentExpiry.service.ts`
  - expiry note diberi source/payment/order/suborder.
- `server/src/services/stripeOrderSync.ts`
  - Stripe sync mencatat `stripe.order.sync` dengan `updated` dan `alreadyFinalized`.

Support/investigation helper:
- `server/src/routes/seller.orders.ts`
  - seller fulfillment yang blocked karena payment mencatat `seller.fulfillment.blocked_by_payment` dengan blocker code dan state saat itu.
- `reports/checkout-payment-incident-runbook-04b-20260410.md`
  - runbook investigasi duplicate checkout, in-progress, buyer-paid seller-blocked, dan Stripe/webhook sync.

Smoke/regression:
- `server/src/scripts/smokeOrderPayment.ts`
  - menambahkan assertion bahwa payment creation audit log memuat `source=checkout:create-multi-store` dan `invoiceNo`.

## 4. Dampak Bisnis

- Incident duplicate checkout lebih cepat ditangani karena operator dapat membedakan order baru, replay, race replay, dan in-progress retry.
- Complaint buyer/seller/admin lebih mudah ditelusuri lewat invoice/order/suborder/payment metadata yang konsisten.
- Seller fulfillment blocked karena payment sekarang meninggalkan event high-signal dengan blocker code.
- Payment transition penting dapat dilihat di DB audit log dan structured app log.
- Confidence production support meningkat tanpa biaya dashboard/vendor baru.

## 5. Known Limitations

| Severity | Limitasi | Catatan |
| --- | --- | --- |
| Sedang | Belum ada metric/dashboard | Masih berbasis log + DB audit. |
| Sedang | Legacy consumer tanpa idempotency key | Tidak punya fingerprint idempotency. |
| Rendah | `traceId` tidak dibuat otomatis | Mengikuti header dari proxy/caller. |
| Rendah | Stripe order sync masih parent-order legacy path | Tidak diubah karena task melarang refactor payment architecture. |
| Rendah | Note audit masih TEXT | Sengaja tidak membuat schema JSON/event baru. |

Hal yang cocok jadi task berikutnya:
- Task Prompt 5: observability metrics ringan berbasis log aggregation atau admin-only diagnostic endpoint read-only, jika diputuskan perlu.
- Alternatif Task Prompt 4A: public API contract docs yang mewajibkan idempotency key untuk external consumer.

## 6. Checklist Status

- selesai - Audit observability existing.
- selesai - Correlation metadata minimum.
- selesai - Idempotency audit trail.
- selesai - Payment transition audit trail.
- selesai - Seller/admin support-case investigability.
- selesai - Smoke/regression.
- selesai - Runbook singkat.
- [!] butuh keputusan - Apakah perlu global request id middleware agar `traceId` selalu ada walau proxy/caller tidak mengirim header.

## 7. Verifikasi

Command yang dijalankan:
- `pnpm -F server build` - selesai.
- `pnpm -F server smoke:order-payment` - selesai.
- `pnpm -F client build` - selesai, masih ada warning Vite chunk > 500 kB.
- `pnpm qa:public-release` dengan `PUBLIC_RELEASE_SMOKE_SKIP_BUILD=true` dan production-like env lokal - selesai.

Catatan verifikasi:
- Output public-release gate menunjukkan event `[operational-audit]` untuk checkout commit/replay, seller fulfillment blocked, payment status transition, dan Stripe order sync.
- Smoke visibility tetap memunculkan beberapa `ADD TO CART ERROR` expected untuk produk yang memang tidak available; gate tetap lulus.
