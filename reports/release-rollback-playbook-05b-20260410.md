# Release Rollback Playbook - Task 5B

Tanggal: 2026-04-10

## Kapan Harus Stop Sebelum Deploy

Stop sebelum deploy jika:
- `pnpm qa:public-release` gagal.
- DB preflight gagal dengan `ER_ACCESS_DENIED_ERROR`, `ER_BAD_DB_ERROR`, `ECONNREFUSED`, `ETIMEDOUT`, atau DNS error.
- `start:prod` tidak mencapai `/api/health`.
- Smoke checkout/order/payment atau Stripe webhook gagal.
- Env cookie/CORS/public URL belum sesuai topology target.

## Gejala yang Memicu Rollback Setelah Deploy

Rollback jika terjadi salah satu:
- Buyer berhasil checkout tetapi order tidak muncul di account/admin.
- Payment sudah final tetapi seller tetap blocked secara luas.
- Duplicate order/payment meningkat setelah deploy.
- `/api/health` gagal atau DB disconnected setelah traffic masuk.
- Stripe webhook mulai mengembalikan error 4xx/5xx untuk payload valid.
- Auth cross-origin gagal massal karena cookie/CORS salah.

## Langkah Rollback Dasar

1. Pause traffic atau aktifkan maintenance pada edge/proxy bila tersedia.
2. Rollback ke artifact/container/build release terakhir yang sudah lulus smoke.
3. Pastikan env lama yang valid ikut dipakai; jangan mengganti secret saat rollback kecuali itu akar masalah.
4. Jalankan health check:

```sh
curl <BASE_URL>/api/health
```

5. Jalankan smoke minimal pada target rollback:

```sh
pnpm qa:public-release
```

Jika smoke penuh terlalu berat saat incident, jalankan minimal:

```sh
pnpm -F server smoke:store-readiness
pnpm -F server smoke:product-visibility
pnpm -F server smoke:order-payment
pnpm -F server smoke:stripe-webhook
pnpm -F server smoke:request-diagnostics
```

## Setelah Rollback

Verifikasi:
- `/api/health` ok dan `db=connected`.
- `GET /api/diagnostics/request-context` mengembalikan request id.
- Client checkout bisa membuat order test.
- Admin melihat order/payment test.
- Seller melihat suborder test yang relevan.
- Stripe webhook sanity lulus jika Stripe checkout aktif.

## Investigasi Checkout Incident

Jika buyer melapor checkout muter/dobel:
- Ambil `X-Request-Id` dari response/support log.
- Cari `[operational-audit] checkout.idempotency.replay`, `checkout.idempotency.race_replay`, atau `checkout.idempotency.in_progress`.
- Cocokkan `traceId`, `invoiceNo`, `orderId`, dan `idempotencyKeyFingerprint`.

Jika buyer sudah bayar tetapi seller blocked:
- Cari `[operational-audit] payment.status.transition`.
- Cocokkan `paymentId`, `oldStatus`, `newStatus`, `actorType`, dan `traceId`.
- Untuk Stripe, cari `stripe.order.sync` dengan `source=webhook` atau `source=return`.

## Batasan

- Playbook ini tidak menggantikan backup/restore database.
- Jika deploy melibatkan migration schema besar, rollback harus mengikuti migration-specific plan terpisah.
- Jangan menulis secret atau credential ke laporan incident.
