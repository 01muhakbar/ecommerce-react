# Task Prompt 2 - Checkout Idempotency & Duplicate-Submit Race Guard

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Area yang diaudit:
- `server/src/routes/checkout.ts` untuk submit checkout multivendor, parent order, split/suborder, payment record, stock/cart mutation, dan notification side effect.
- `client/src/pages/store/Checkout.jsx` dan `client/src/api/storeCheckout.ts` untuk submit lock dan payload checkout.
- `server/src/scripts/smokeOrderPayment.ts` untuk regression coverage checkout/order/payment existing.

Area yang diperbaiki:
- Menambahkan `checkoutRequestKey` opsional pada request checkout.
- Membuat `invoiceNo` deterministik berbasis `userId + checkoutRequestKey`, memanfaatkan unique index existing `Order.invoiceNo` sebagai server-side dedupe guard tanpa schema baru.
- Menambahkan replay lookup sebelum cart/stock/payment/notification disentuh.
- Menambahkan recovery path untuk race/unique conflict agar request duplicate mengembalikan order existing bila create pertama sudah menang.
- Client sekarang menyimpan request key per signature checkout di `sessionStorage` sampai submit sukses.
- Smoke `order-payment` sekarang membuktikan duplicate submit tidak membuat parent, split, payment, atau seller notification ganda.

Area yang tidak disentuh:
- Tidak ada perubahan schema database.
- Tidak ada redesign checkout UI.
- Tidak ada perubahan provider/payment lane.
- Tidak ada refactor besar order/payment service.
- Tidak ada perubahan Admin/Seller UI karena kontrak response existing tetap kompatibel.

## 2. Temuan Utama

Titik rawan duplicate:
- `/api/checkout/create-multi-store` sebelumnya hanya mengandalkan frontend submit lock.
- Retry browser/network setelah parent order dibuat tetapi response gagal dapat memicu submit baru.
- Split/suborder, payment, stock decrement, cart clear, dan seller notification berada dalam/sekitar create path yang sama, sehingga duplicate parent berisiko menggandakan side effect.
- `Suborder.suborderNumber` dan `Payment.internalReference` sudah unique karena berasal dari `invoiceNo`, tetapi `invoiceNo` sebelumnya random sehingga retry request tidak punya anchor dedupe stabil.

Akar masalah:
- Tidak ada stable request identity dari client ke backend.
- Tidak ada replay lookup sebelum create.
- Tidak ada response path khusus untuk duplicate request yang aman.

Area paling risk:
- Parent `Order.create` adalah boundary utama. Jika parent duplicate dicegah, split/payment/notification ikut terlindungi karena semuanya bergantung pada parent create path.

## 3. Source of Truth

| Entity | Fungsi | Status/kunci penting | Consumer |
| --- | --- | --- | --- |
| Parent `Order` | Agregat transaksi buyer | `invoiceNo`, `paymentStatus`, `status`, `checkoutMode` | Client order/payment page, Admin audit/order detail |
| `Suborder` | Unit operasional seller | `suborderNumber`, `storeId`, `paymentStatus`, `fulfillmentStatus` | Seller orders/payment review, Admin split breakdown, Client split tracking |
| `Payment` | Payment lane per split | `internalReference`, `status`, `expiresAt`, `paidAt` | Client payment, Seller review, Admin payment audit |
| `checkoutRequestKey` | Identitas request checkout | Optional request key, hashed into deterministic `invoiceNo` | Client checkout submit, backend checkout route |

## 4. Perubahan yang Dilakukan

Backend:
- `server/src/routes/checkout.ts`
  - Schema menerima `checkoutRequestKey` opsional dengan batas 8-120 karakter.
  - Menambahkan `buildIdempotentInvoiceNo(userId, requestKey)` dengan SHA-256.
  - Replay lookup memakai deterministic `invoiceNo` sebelum membuka transaksi checkout.
  - Create path memakai deterministic `invoiceNo` jika key tersedia; legacy no-key path tetap memakai invoice random existing.
  - Catch path untuk unique/lock race mencoba memuat order existing dan mengembalikan response replay.
  - Response replay mengandung `data.idempotency = { replayed: true, source: "CHECKOUT_REQUEST_KEY" }`.

Client:
- `client/src/api/storeCheckout.ts`
  - Payload type menambahkan `checkoutRequestKey?: string | null`.
- `client/src/pages/store/Checkout.jsx`
  - Membuat request key per signature checkout.
  - Key disimpan di `sessionStorage` selama submit belum sukses; signature checkout disimpan sebagai hash lokal, bukan detail alamat/customer mentah.
  - Setelah order berhasil dibuat/replayed, key dibersihkan dan flow redirect payment tetap sama.

Side effects:
- Duplicate request dengan key yang sama kembali sebelum create path, sehingga tidak mengulang stock decrement, cart mutation, payment create, dan seller notification.
- Smoke membuktikan seller notification untuk suborder idempotent hanya dibuat satu kali.

Frontend Admin/Seller:
- Tidak diubah. Contract response existing tetap berisi order/split/payment fields yang sama.

## 5. Dampak Bisnis

- Risiko double parent order turun untuk double click, retry, refresh, timeout semu, dan reconnect yang memakai payload client baru.
- Risiko duplicate split/suborder dan duplicate payment lane turun karena duplicate request tidak masuk lagi ke create path.
- Seller/admin lebih aman dari data operasional ganda dan notifikasi seller duplicate.
- Readiness production meningkat tanpa schema migration atau perubahan arsitektur besar.

## 6. Edge Case yang Diamankan

- Submit checkout sekali: sukses `201`.
- Submit checkout kedua dengan key sama setelah order pertama sukses: replay `200`, order yang sama.
- Parent order duplicate: dicegah lewat deterministic `invoiceNo` + unique existing.
- Split/suborder duplicate: dicegah karena replay kembali sebelum split create.
- Payment initiation duplicate: dicegah karena replay kembali sebelum `Payment.create`.
- Seller notification duplicate: dicegah dan diverifikasi lewat smoke count.
- Response hilang/timeout setelah order berhasil: retry dengan key yang sama dapat mengambil order existing.
- Race saat request pertama dan kedua berdekatan: unique/lock recovery mencoba memuat order existing dan mengembalikan replay jika sudah committed.

## 7. Known Limitations

- Legacy consumer yang tidak mengirim `checkoutRequestKey` masih memakai flow random invoice existing; idempotency kuat berlaku untuk client baru dan API caller yang mengirim key.
- Tidak menambahkan unique constraint baru khusus `checkoutRequestKey` karena task dibatasi tanpa schema besar. Deterministic `invoiceNo` dipakai sebagai guard existing.
- Race yang berhenti pada lock/error sebelum order pertama committed akan mengembalikan `409 CHECKOUT_IDEMPOTENCY_IN_PROGRESS` bila order belum bisa dimuat setelah retry pendek.
- Belum menambahkan hardening khusus untuk coupon usage/reservation karena audit lokal tidak menunjukkan mutation usage counter di create path ini.

## 8. Verifikasi

Command yang dijalankan:
- `pnpm -F server build` - selesai
- `pnpm -F client build` - selesai, masih ada warning chunk Vite existing > 500 kB
- `pnpm -F server smoke:order-payment` - selesai

Smoke scenario baru:
- First checkout submit dengan `checkoutRequestKey` -> HTTP `201`.
- Replay checkout submit dengan body/key sama -> HTTP `200`.
- Replay response mengembalikan `orderId`, `invoiceNo`, `suborderId`, dan `paymentId` yang sama.
- DB assertion: satu parent order untuk invoice tersebut.
- DB assertion: satu suborder untuk parent tersebut.
- DB assertion: satu payment untuk suborder tersebut.
- Notification assertion: satu `SELLER_SUBORDER_CREATED` untuk suborder tersebut.

## 9. Checklist Status

- selesai - Audit duplicate-risk checkout/order/payment path.
- selesai - Strategi idempotency minimal tanpa schema baru.
- selesai - Parent order dedupe.
- selesai - Split/suborder dedupe via parent replay guard.
- selesai - Payment initiation dedupe via parent replay guard.
- selesai - Seller notification duplicate guard via replay-before-side-effect.
- selesai - Client request key sync minimal.
- selesai - Server/client build.
- selesai - Smoke regression order-payment.
- [!] butuh keputusan - Apakah legacy/API consumer non-client wajib dipaksa mengirim `checkoutRequestKey` di task berikutnya.

## 10. Rekomendasi Task Prompt 3

Production deployment guardrail untuk memastikan public API consumer checkout mengirim idempotency key secara konsisten, termasuk dokumentasi API, optional `Idempotency-Key` header support bila dibutuhkan, dan deploy smoke yang meniru retry lintas proses.
