# PREMERGE-QA-06

Tanggal: 2026-03-30
Scope: Admin / Seller / Client regression hardening sebelum merge

## Prereq

- Server dan client dev berjalan.
- Admin account tersedia.
- Untuk Stripe runtime manual test:
  - isi `Stripe Key`, `Stripe Secret`, dan `Stripe Webhook Secret` valid di `/admin/store/store-settings`
  - gunakan Stripe test mode
  - arahkan webhook atau Stripe CLI ke `POST /api/store/stripe/webhook`
- Untuk QRIS existing:
  - minimal ada satu store dengan `activeStorePaymentProfileId` valid dan snapshot `ACTIVE`
- Untuk public discovery:
  - siapkan satu store `ACTIVE + payment ready`
  - siapkan satu store `ACTIVE + payment not ready`
  - siapkan satu store `INACTIVE`

## Build & Smoke

- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm -F server smoke:store-settings`
- `pnpm -F server smoke:stripe-webhook`
- `pnpm -F server smoke:product-visibility`
- `pnpm -F server smoke:store-readiness`
- `pnpm -F server smoke:order-payment`
- `pnpm -F server smoke:admin-store-payment-profiles`

## Manual Checklist

### 1. Admin Store Settings

- Buka `/admin/store/store-settings` lalu pastikan load tidak error.
- Toggle `Cash on Delivery` on/off lalu save dan reload.
- Isi `Stripe Key`, `Stripe Secret`, `Stripe Webhook Secret` valid lalu save dan reload.
- Kosongkan field secret saat update berikutnya dan pastikan secret lama tidak hilang.
- Isi format invalid untuk Stripe key/secret/webhook secret dan pastikan tombol update tertahan atau status invalid tampil jujur.
- Isi Social Login credentials lalu pastikan status `configured` atau `missing credentials` jujur, tanpa expose secret mentah.
- Isi Google Analytics dan Tawk valid lalu save/reload.
- Pastikan payload publik tidak pernah menampilkan secret mentah.

### 2. Client Checkout

- Dengan COD enabled, buka `/checkout` single-store dan pastikan COD tampil.
- Dengan COD disabled, refresh `/checkout` dan pastikan COD hilang.
- Dengan Stripe valid + enabled, refresh `/checkout` dan pastikan Stripe tampil.
- Dengan Stripe invalid atau disabled, refresh `/checkout` dan pastikan Stripe tidak tampil.
- Submit checkout memakai COD dan pastikan order tetap normal.
- Submit checkout memakai Stripe dan pastikan browser redirect ke hosted Stripe Checkout.

### 3. Stripe Runtime

- Success flow:
  - selesaikan pembayaran Stripe test mode
  - pastikan success page menampilkan status paid
  - pastikan tracking page menampilkan `paymentStatus=PAID`
- Cancel flow:
  - cancel dari hosted Stripe
  - pastikan success page tidak claim paid
  - pastikan tombol `Continue Stripe Payment` tersedia
- Retry flow:
  - dari success cancel page, klik retry
  - pastikan redirect ke session Stripe baru atau session existing yang masih open
- Verify flow:
  - kembali ke success page dengan `session_id`
  - pastikan verify backend tidak error
- Webhook valid event:
  - kirim `checkout.session.completed`
  - pastikan order finalize walau buyer tidak kembali
- Webhook duplicate event:
  - kirim event yang sama dua kali
  - pastikan order tidak double-update
- Buyer tidak kembali:
  - selesaikan payment di Stripe
  - jangan buka success page
  - cek tracking/order detail dan pastikan webhook sudah memfinalisasi order

### 4. Public Discovery

- Pastikan produk dari store `ACTIVE + payment ready` muncul di list/search/category.
- Pastikan produk dari store `ACTIVE + payment not ready` tidak muncul di list/search/category.
- Pastikan produk dari store `INACTIVE` tidak muncul di list/search/category.
- Jika direct PDP policy existing masih membuka detail untuk store not ready, pastikan status `STORE_NOT_READY` tetap jujur dan CTA tidak misleading.

### 5. Admin / Seller Internal

- Buka `/admin/store/payment-profiles` dan pastikan tidak 500.
- Pastikan list payment profiles memuat `workspaceReadiness`.
- Pastikan admin review lane tetap bisa menampilkan active snapshot dan pending request.
- Buka seller workspace/readiness dan pastikan data internal tetap terlihat, tidak terfilter oleh public gate.

### 6. Legacy Existing

- Jalankan multi-store checkout QRIS/payment proof existing.
- Submit payment proof, lalu approve dan reject dari seller/admin lane sesuai flow existing.
- Buka buyer order tracking dan account order detail, pastikan status parent/suborder/payment tetap sinkron.
- Verifikasi COD existing tidak regress setelah perubahan Stripe/settings/discovery.

## Expected Honest States

- `Stripe enabled` tanpa credential valid tidak boleh dianggap ready.
- `Stripe cancelled` tidak boleh claim paid kecuali backend order sudah `PAID`.
- `Continue Stripe Payment` tidak boleh muncul pada order cancelled/final.
- `Admin payment profiles` harus tetap load walau ada store aktif, store gated, atau store inactive.
- `Public discovery` harus mengikuti backend operational-ready gate, bukan frontend guess.

## Belum Diautomasi

- Stripe hosted checkout full browser run dengan dashboard/CLI nyata.
- Perubahan visual/detail badge kecil di halaman admin/client lintas browser.
- Kombinasi edge case data historis lama di database produksi.
