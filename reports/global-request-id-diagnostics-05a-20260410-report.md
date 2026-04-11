# Task 5A - Global Request ID + Diagnostic Surface Ringan

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Area yang diaudit:
- Request lifecycle di `server/src/app.ts`.
- Trace helper existing di `server/src/services/operationalAudit.service.ts`.
- Checkout/payment/seller/Stripe sync path yang memakai trace/audit metadata.
- Health route existing sebagai tempat diagnostic surface ringan.

Yang ditambahkan:
- Middleware global `requestIdMiddleware`.
- Endpoint read-only `GET /api/diagnostics/request-context`.
- Smoke test `smoke:request-diagnostics`.
- Operator note untuk membaca request id dan mengaitkannya dengan log/audit.

Scope perubahan:
- Backend observability saja.
- Tidak mengubah contract bisnis checkout/order/payment.
- Tidak menambah schema, migration, dashboard, atau vendor observability eksternal.

## 2. Temuan Utama

| Area | Temuan | Dampak |
| --- | --- | --- |
| Request trace | `getRequestTraceId` sebelumnya hanya kuat jika caller/proxy mengirim `X-Request-Id` atau `X-Correlation-Id` | Request tanpa header sulit dikorelasikan |
| Stripe webhook | Webhook route dipasang sebelum `express.json` | Middleware request id harus dipasang sebelum webhook dan tidak boleh membaca/mutasi body |
| Payment transition audit | Payment transition log sudah ada, tetapi trace id belum eksplisit di semua route transition penting | Investigasi payment support butuh korelasi lebih jelas |
| Diagnostic surface | Health route sudah ada dan public | Diagnostic request-context bisa dibuat ringan tanpa DB query dan tanpa data sensitif |

Constraint:
- Type augmentation Express existing tidak cukup terbaca oleh build TypeScript, sehingga middleware dan diagnostic route memakai cast lokal agar patch tetap kecil.
- Public release boot smoke tetap bergantung pada kredensial DB production lokal.

## 3. Perubahan yang Dilakukan

### Request-ID Middleware

File: `server/src/middleware/requestId.ts`

Behavior final:
- Membaca `X-Request-Id` lebih dulu.
- Fallback ke `X-Correlation-Id`.
- Jika keduanya kosong/tidak valid, generate `req_<uuid>`.
- Menempelkan `requestId`, `correlationId`, dan `requestIdSource` ke request object.
- Menulis response header `X-Request-Id` dan `X-Correlation-Id`.
- Tidak membaca body, sehingga aman untuk Stripe raw webhook.

### Integrasi Observability Existing

Perubahan integrasi:
- `getRequestTraceId` sekarang mengambil `req.requestId`/`req.correlationId` dulu sebelum fallback ke header.
- Checkout payment creation meneruskan `traceId` ke `appendPaymentStatusLog`.
- Buyer payment proof/cancel meneruskan `traceId` ke payment transition log.
- Seller payment approve/reject meneruskan `traceId` ke payment transition log.
- Stripe return/webhook sync meneruskan `traceId` ke `stripe.order.sync`.

Yang otomatis ikut:
- `checkout.idempotency.replay`
- `checkout.idempotency.race_replay`
- `checkout.idempotency.in_progress`
- `checkout.create.committed`
- `payment.status.transition`
- `stripe.order.sync`

### Diagnostic Surface

Endpoint:
- `GET /api/diagnostics/request-context`

Output:
- `ok`
- `requestId`
- `correlationId`
- `requestIdSource`
- `responseHeaders`
- `timestamp`

Security note:
- Tidak mengekspos token, cookie, email, order detail, payment detail, payload checkout, webhook payload, atau secret env.
- Tidak query database.
- Read-only dan low-noise.

### Smoke/Verifikasi

Ditambahkan:
- `server/src/scripts/smokeRequestDiagnostics.ts`
- `server/package.json` script `smoke:request-diagnostics`

Skenario smoke:
- Request tanpa header menghasilkan `req_<uuid>`.
- Request dengan `X-Request-Id` dan `X-Correlation-Id` dihormati.
- Request hanya dengan `X-Correlation-Id` tetap bisa seed request id.

## 4. Dampak Bisnis

- Incident correlation lebih cepat karena setiap request penting punya id yang bisa dicari di log.
- Complaint buyer/seller/admin lebih mudah ditelusuri lewat `traceId`, `orderId`, `invoiceNo`, `paymentId`, dan `sessionId`.
- Operator bisa membuktikan request-id plumbing tanpa membuka dashboard atau data sensitif.
- Confidence production support meningkat tanpa menambah dependency eksternal.

## 5. Known Limitations

| Status | Item | Catatan |
| --- | --- | --- |
| selesai | Request id global | Berlaku untuk request yang melewati Express app, termasuk webhook raw body. |
| selesai | Header incoming dihormati | `X-Request-Id` dan `X-Correlation-Id` valid tetap dipakai. |
| selesai | Diagnostic surface ringan | `GET /api/diagnostics/request-context`. |
| [!] | Public release boot smoke | Gagal di environment lokal karena `SequelizeAccessDeniedError` untuk user DB `root@localhost`; bukan karena request-id patch. |
| [!] | Background/job flow | Flow yang tidak punya Express request masih tidak punya request id otomatis. |
| belum | Structured logging penuh | Masih console-based operational audit; butuh task terpisah jika ingin JSON logger/context propagation besar. |

## 6. Checklist Status

- selesai - Audit request lifecycle dan trace usage existing.
- selesai - Global request-id middleware ditambahkan.
- selesai - `X-Request-Id` / `X-Correlation-Id` dibaca dan dihormati.
- selesai - Missing header menghasilkan generated request id.
- selesai - Response header request/correlation id diset.
- selesai - Observability checkout/payment/seller/Stripe sync memakai trace global.
- selesai - Diagnostic surface read-only ditambahkan.
- selesai - Operator note dibuat.
- selesai - `pnpm -F server build` lulus.
- selesai - `pnpm -F server smoke:request-diagnostics` lulus.
- [!] butuh keputusan - Perlu atau tidak memperkenalkan structured JSON logging di task lanjutan.

## Verifikasi

Command yang dijalankan:
- `pnpm -F server build` - lulus.
- `pnpm -F server smoke:request-diagnostics` - lulus.
- `PUBLIC_RELEASE_SMOKE_SKIP_BUILD=true PUBLIC_RELEASE_SMOKE_SKIP_APP_SMOKES=true pnpm qa:public-release` - gagal karena DB credential lokal production ditolak: `Access denied for user 'root'@'localhost'`.

## Rekomendasi Task Berikutnya

Task Prompt berikutnya yang paling logis:
- Structured operational log format ringan untuk `[operational-audit]` agar mudah diparse oleh log collector.
- Task terpisah untuk memperbaiki env DB production lokal/staging agar `qa:public-release` bisa kembali menjadi gate otomatis penuh.
