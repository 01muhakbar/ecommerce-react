# MVF-LOCK-02 Report

## Yang diamati

- Payload checkout preview aktif berasal dari `POST /api/checkout/preview` di `server/src/routes/checkout.ts`.
- Consumer route aktif untuk contract preview ini hanya `client/src/pages/store/Checkout.jsx`.
- Sebelum patch, frontend checkout masih melakukan interpretasi lokal untuk:
  - label snapshot payment profile
  - label badge payment readiness
  - blocked reason / helper text untuk store yang tidak bisa checkout
- Backend preview sudah memiliki truth dasar `paymentAvailable`, `paymentProfileStatus`, dan `warning`, tetapi belum mengirim meta additive yang cukup agar client berhenti menerjemahkan status sendiri.

## Gap utama

- `paymentProfileStatus` masih dikonsumsi sebagai kode mentah lalu dilabeli di frontend.
- `paymentAvailable` masih dipakai bersama formatter lokal untuk membangun badge dan helper text readiness.
- `warning` masih terlalu tipis untuk menjadi satu-satunya source of truth presentasional di checkout.

## Patch yang dipilih dan kenapa paling kecil dan aman

- Backend:
  - menambahkan field additive kecil pada group preview:
    - `paymentProfileStatusMeta`
    - `paymentAvailabilityMeta`
  - mempertahankan field lama:
    - `paymentAvailable`
    - `paymentProfileStatus`
    - `warning`
  - tidak mengubah struktur response besar atau flow checkout
- Client:
  - checkout sekarang memprioritaskan meta backend untuk label snapshot, badge readiness, dan blocked reason
  - formatter lokal label status dihapus; fallback tinggal minimal ke field lama bila meta belum ada

## File yang diubah

- `server/src/routes/checkout.ts`
- `client/src/api/store.types.ts`
- `client/src/pages/store/Checkout.jsx`
- `reports/mvf-lock-02-report.md`

## Dampak ke Admin

- Tidak ada perubahan flow atau consumer admin.
- Smoke visibility/order-payment tetap hijau, jadi contract additive preview tidak mengganggu surface admin.

## Dampak ke Seller

- Tidak ada perubahan flow atau consumer seller.
- Smoke readiness/visibility tetap hijau, jadi truth seller tidak terdampak.

## Dampak ke Client

- Checkout preview sekarang membaca label snapshot payment profile dari backend meta, bukan formatter lokal.
- Badge readiness/payment availability sekarang memprioritaskan meta backend.
- Blocker/notice untuk store yang tidak siap checkout menjadi lebih deterministik karena reason datang dari backend serializer.
- CTA checkout tetap tidak misleading karena gate utama masih bertumpu pada `paymentAvailable` dan invalid item guard existing.

## Hasil verifikasi

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅
- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:store-readiness` ✅
- `pnpm -F server smoke:product-visibility` ✅
- `pnpm qa:mvf:visibility:frontend` ✅

## Residual risk

- Checkout masih menyimpan fallback minimal ke field lama untuk kompatibilitas bila ada payload lama/cache lama.
- Meta baru saat ini khusus untuk checkout preview group; belum diekstrak menjadi helper lintas route, sengaja agar tidak melebar ke refactor contract besar.
- Field `warning` tetap dipertahankan untuk compatibility, sehingga source of truth presentasional masih additive, bukan cutover penuh.

## Next task paling logis

- Audit response conflict `create-multi-store` dan lane buyer payment/order summary lain untuk memastikan meta readiness additive yang sama dipakai konsisten bila group checkout dibaca di surface lain.
- Jika ingin hardening kecil berikutnya, tambahkan smoke/frontend assertion khusus checkout blocker copy agar regressions pada helper text lebih cepat tertangkap.
