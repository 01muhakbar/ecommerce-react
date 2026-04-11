# Task Prompt 3 - Public Release Smoke Gate, start:prod Proof, dan Idempotency Edge Hardening

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Yang diaudit:
- Production startup path: `server/package.json` -> `start:prod` -> `node dist/server.js`.
- Runtime validation di `server/src/server.ts`.
- Health route `/api/health`.
- Existing release docs: `reports/final-release-checklist.md`, `reports/rc-deployment-validation.md`, `reports/production-readiness-qa-matrix.md`.
- Checkout idempotency edge di `/api/checkout/create-multi-store`.
- Client checkout error handling untuk duplicate/in-progress request.
- Smoke scripts existing untuk readiness, visibility, order/payment, dan webhook.

Yang dibuktikan:
- Built server dapat boot dari `dist/server.js` via `pnpm -F server start:prod`.
- Production-started server merespons `/api/health` dengan DB connected.
- Full public release gate dapat menjalankan production boot + smoke MVF utama.

Yang diperbaiki:
- `pnpm qa:public-release` ditambahkan sebagai smoke gate executable.
- Smoke gate melakukan build, start `server start:prod`, poll `/api/health`, lalu menjalankan smoke readiness/visibility/order-payment/stripe/frontend visibility.
- `Idempotency-Key` dan `X-Idempotency-Key` header didukung sebagai jalur non-breaking untuk API consumer non-client.
- Response `CHECKOUT_IDEMPOTENCY_IN_PROGRESS` sekarang memberi `Retry-After`, `retryable`, `retryAfterMs`, dan metadata idempotency.
- Client checkout menampilkan pesan khusus saat request duplicate masih in-progress.
- Smoke idempotency mencakup replay via body key dan header key.

## 2. Hasil Production Boot Proof

Command proof awal:
- `pnpm qa:public-release` dengan env production-like dan DB vars dari env lokal.

Hasil awal:
- Build server/client berjalan.
- `start:prod` gagal saat DB connect karena env lokal memakai kredensial MySQL yang ditolak: `ER_ACCESS_DENIED_ERROR`.
- Ini membuktikan startup tidak gagal diam-diam; proses production exit dan gate gagal.

Command proof berhasil:
- `pnpm qa:public-release` dengan:
  - `PUBLIC_RELEASE_SMOKE_PORT=3033`
  - `JWT_SECRET` kuat untuk proof lokal
  - `AUTH_COOKIE_NAME=token`
  - `COOKIE_SECURE=false`
  - `CLIENT_URL=http://localhost:5173`
  - `CORS_ORIGIN=http://localhost:5173`
  - `PUBLIC_BASE_URL=http://localhost:5173`
  - `DATABASE_URL=mysql://root@localhost:3306/ecommerce_dev`

Hasil:
- `pnpm -F server build` selesai.
- `pnpm -F client build` selesai dengan warning chunk Vite existing.
- `pnpm -F server start:prod` boot dari `server/dist/server.js`.
- `/api/health` lulus di `http://127.0.0.1:3033/api/health`.
- Gate penuh lulus.

Command proof ulang setelah header idempotency smoke ditambahkan:
- `pnpm qa:public-release` dengan `PUBLIC_RELEASE_SMOKE_SKIP_BUILD=true`, port `3034`, dan env production-like sama.

Hasil akhir:
- Production boot lulus.
- `/api/health` lulus.
- Store readiness smoke lulus.
- Product visibility smoke lulus.
- Order/payment smoke lulus, termasuk duplicate-submit replay dan header idempotency replay.
- Stripe webhook smoke lulus.
- Frontend visibility smoke lulus.

Issue yang muncul:
- Warning `COOKIE_SECURE=false` masih muncul untuk proof lokal. Ini diterima untuk local proof, tetapi public cross-origin HTTPS harus memakai `COOKIE_SECURE=true`.
- Warning `UPLOAD_DIR` tidak diset di command proof; server memakai default upload directory.
- Client build masih mengeluarkan warning chunk > 500 kB.
- Smoke visibility sengaja memicu beberapa `ADD TO CART ERROR` untuk produk tidak valid; smoke tetap lulus dan error tersebut adalah guardrail expected.

Status akhir:
- selesai - Production boot proof berhasil dengan env DB yang valid.
- selesai - Release smoke gate executable tersedia.

## 3. Perubahan yang Dilakukan

Startup/env:
- `package.json`
  - Menambahkan script `qa:public-release`.
- `tools/qa/public-release-smoke.ts`
  - Validasi env critical: `JWT_SECRET`, `AUTH_COOKIE_NAME`, dan DB env (`DATABASE_URL` atau `DB_*` lengkap).
  - Warning operator untuk `COOKIE_SECURE`, `CLIENT_URL/CORS_ORIGIN`, public base URL, dan `UPLOAD_DIR`.
  - Build server/client.
  - Start `pnpm -F server start:prod`.
  - Poll `/api/health` sampai DB connected.
  - Menjalankan smoke gate MVF utama terhadap production-started server.
  - Menghentikan process tree setelah selesai.
- `.env.example`
  - Menambahkan env opsional untuk public release smoke gate.
- `reports/final-release-checklist.md`
  - Menambahkan `pnpm qa:public-release` sebagai full public-release smoke gate.

Idempotency edge:
- `server/src/routes/checkout.ts`
  - Mendukung `Idempotency-Key` dan `X-Idempotency-Key` header.
  - Header invalid mengembalikan `400 CHECKOUT_IDEMPOTENCY_KEY_INVALID`.
  - In-progress race response sekarang mengembalikan `409 CHECKOUT_IDEMPOTENCY_IN_PROGRESS` dengan `Retry-After`, `retryable`, `retryAfterMs`, dan metadata source.

Frontend handling:
- `client/src/pages/store/Checkout.jsx`
  - Menangani `CHECKOUT_IDEMPOTENCY_IN_PROGRESS` dengan pesan buyer-facing yang tidak mengklaim order gagal.

Smoke gate:
- `server/src/scripts/smokeOrderPayment.ts`
  - Menambahkan assertion replay via `Idempotency-Key` header.

## 4. Dampak Bisnis

- Release publik lebih aman karena ada satu command gate yang membuktikan build, production boot, health, checkout/order/payment truth, visibility, readiness, dan webhook sanity.
- Risiko checkout duplicate lebih terkendali untuk client dan API consumer yang memakai body key atau header idempotency.
- Buyer tidak lagi melihat error generic saat checkout duplicate masih diproses.
- Operator/deployer mendapat fail-fast ketika env DB/JWT/auth cookie tidak lengkap atau production process mati sebelum health ready.
- Confidence deploy meningkat karena `start:prod` dibuktikan dari built artifact, bukan hanya dev server.

## 5. Known Limitations

| Severity | Residual risk | Catatan |
| --- | --- | --- |
| Sedang | Legacy/API consumer tanpa idempotency key | Masih bisa memakai path no-key; public docs/API client sebaiknya mewajibkan key. |
| Sedang | `COOKIE_SECURE=false` di proof lokal | Untuk public HTTPS cross-origin wajib `COOKIE_SECURE=true`. |
| Sedang | Local filesystem upload dependency | Belum ada object storage abstraction; target deploy harus punya writable `UPLOAD_DIR`. |
| Rendah | Vite main chunk > 500 kB | Tidak memblokir release, tetapi tetap perlu performance pass. |
| Rendah | Race sebelum first transaction commit | Server mengembalikan `CHECKOUT_IDEMPOTENCY_IN_PROGRESS` bila order belum bisa diload setelah retry pendek. |
| Rendah | Observability masih log-based | Belum ada structured metric/alert untuk idempotency replay/in-progress rate. |

Hal yang belum disentuh:
- Tidak ada schema migration untuk tabel idempotency khusus.
- Tidak ada redesign UI.
- Tidak ada perubahan provider payment/deployment stack.
- Tidak ada refactor startup/payment besar.

## 6. Checklist Status

- selesai - Audit production startup path.
- selesai - `start:prod` proof dengan built artifact.
- selesai - Env/runtime gate untuk critical variables.
- selesai - Idempotency header support.
- selesai - In-progress response lebih jujur dan retryable.
- selesai - Buyer-facing duplicate/in-progress message.
- selesai - Public-release smoke gate executable.
- selesai - Build server/client.
- selesai - Production boot + release smoke gate.
- [!] butuh keputusan - Apakah public API contract harus mewajibkan `checkoutRequestKey`/`Idempotency-Key` untuk semua external consumer.

## 7. Rekomendasi Task Prompt 4

Task Prompt 4 paling logis: API/public deployment contract hardening, yaitu mendokumentasikan idempotency sebagai requirement untuk checkout public consumer, menambahkan observability ringan untuk idempotency replay/in-progress, dan melakukan performance pass untuk warning chunk client tanpa redesign.
