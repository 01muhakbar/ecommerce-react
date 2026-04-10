# MVF-TRUTH-05A — Split Operational Truth Contract

## Goal
Menegaskan bahwa source of truth operasional checkout multivendor adalah:
- split payment
- split shipment

Parent order tetap hanya agregat global.

## Ringkasan Audit
Sebelum patch ini, backend sudah punya tiga sumber truth yang benar secara domain tetapi masih tersebar:
1. `buildGroupedPaymentReadModel`
2. `buildSuborderShippingReadModel`
3. `buildSellerSuborderContract`

Masalahnya bukan ketiadaan truth, tetapi belum ada adapter kecil yang merangkum ketiganya sebagai **1 unit operasional store split/suborder** dengan bridge rule payment -> shipment yang eksplisit dan seragam untuk buyer, seller, dan admin.

## Helper / Contract yang Dibuat atau Dirapikan
### Helper baru
- `server/src/services/splitOperationalTruth.service.ts`

### Isi helper
Helper baru `buildSplitOperationalTruth()` merangkum:
- scope operasional split
- split payment truth
- split shipment truth
- bridge payment -> shipment
- blocking/finality
- normalized actions
- status summary lane-aware

### Bridge rule yang ditegaskan
- payment `UNPAID` / `CREATED` / `REJECTED` -> shipment blocked, lane aktif masih payment
- payment `PENDING_CONFIRMATION` -> shipment blocked, lane aktif masih payment review
- payment `PAID` -> shipment lane jadi aktif / ready
- payment `FAILED` / `EXPIRED` / `CANCELLED` -> shipment blocked sebagai final-negative
- shipment final-negative (`FAILED_DELIVERY`, `RETURNED`, `CANCELLED`) -> operational summary pindah ke shipment exception/final lane

### Shape utama helper
- `scope`
- `payment`
- `shipment`
- `bridge`
- `finality`
- `actions`
- `statusSummary`

Patch ini additive dan tidak mematahkan contract lama.

## File yang Diubah
- `server/src/services/splitOperationalTruth.service.ts`
- `server/src/routes/seller.orders.ts`
- `server/src/routes/checkout.ts`
- `server/src/routes/store.ts`
- `server/src/routes/admin.payments.audit.ts`
- `reports/mvf-truth-05a-split-operational-truth-contract-20260409-report.md`

## Dampak ke Buyer / Seller / Admin Consumers
### Buyer
- Split groups dari lane checkout/payment sekarang membawa `operationalTruth`.
- Buyer consumer bisa membaca split payment + split shipment + bridge state dari satu objek additive, tanpa menebak relasi payment ke shipment sendiri.

### Seller
- Seller suborder list dan detail sekarang membawa `operationalTruth`.
- Seller consumer bisa membaca kapan lane aktif masih payment, kapan shipment sudah actionable, dan kapan split sudah final-negative, tanpa hanya mengandalkan parent/order summary.

### Admin
- Admin payment audit detail sekarang juga menerima:
  - shipment truth per split
  - `operationalTruth` per split
- Ini membuat admin punya payload yang lebih dekat ke rule “split payment + split shipment = operational truth”, walau UI belum penuh memakainya.

## Mismatch Domain yang Ditutup
1. Split payment dan split shipment sebelumnya dibaca terpisah di banyak serializer.
2. Bridge rule payment -> shipment sudah ada secara implisit, tapi belum diekspos sebagai contract kecil yang konsisten.
3. Seller dan buyer punya split truth, tetapi belum dibungkus sebagai unit operasional tunggal yang siap dipakai consumer.
4. Admin audit detail masih lebih payment-centric; sekarang split shipment truth ikut diekspos.

## Risiko / Residual
- Helper baru masih additive; consumer aktif belum semuanya bermigrasi memakai `operationalTruth`.
- Admin audit detail baru mengekspor shipment truth per split, tetapi UI admin payment audit belum di-hardening khusus untuk merender field baru itu.
- Parent aggregate producer besar belum diubah; task ini sengaja berhenti di layer contract/helper kecil.

## Perlu Rencana Kolaborasi?
Tidak untuk patch ini.

Alasannya:
- tidak ada schema DB baru
- tidak ada endpoint besar yang dirombak
- tidak ada refactor arsitektur besar
- perubahan tetap additive dan kompatibel

Rencana Kolaborasi baru perlu bila tahap berikutnya ingin:
- memigrasikan banyak consumer aktif agar sepenuhnya membaca `operationalTruth`
- atau mengubah producer aggregate parent lintas domain agar parent summary juga dibangun dari helper bersama yang baru

## Hasil Verifikasi
- `pnpm -F server build` ✅
- `pnpm -F client build` ✅
- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:shipment-regression` ✅
- `pnpm -F server smoke:product-visibility` ✅
- `pnpm -F server smoke:store-readiness` ✅
- `pnpm -F server smoke:stripe-webhook` ✅
- `pnpm qa:mvf:visibility:frontend` ✅

Catatan:
- `smoke:order-payment` sempat gagal sekali dengan `ECONNRESET` transien saat HTTP fixture berjalan, lalu lulus penuh saat rerun tanpa perubahan kode tambahan.
