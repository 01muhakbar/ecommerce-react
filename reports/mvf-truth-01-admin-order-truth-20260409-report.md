# MVF-TRUTH-01 Admin Order Truth Report

Date: 2026-04-09

## Summary perubahan

Patch kecil difokuskan pada surface Admin order yang masih bisa drift dari backend truth:

- menutup fallback dropdown action lokal pada Admin orders list dan Admin order detail
- menyinkronkan Admin order timeline agar membaca `contract.statusSummary` lebih dulu

Tidak ada perubahan backend, schema database, atau contract API.

## Mismatch yang diperbaiki

1. `client/src/pages/admin/Orders.jsx`
   - Sebelumnya dropdown action bisa menyintesis opsi lokal saat `contract.availableActions` tidak tersedia.
   - Risiko: CTA frontend tetap tampil walau backend actionability tidak ada.
   - Perbaikan: dropdown sekarang hanya aktif bila backend benar-benar mengirim `availableActions`; jika tidak, UI menahan action dengan helper jujur.

2. `client/src/pages/admin/OrderDetail.jsx`
   - Sebelumnya panel action punya fallback lokal yang sama.
   - Risiko: operator bisa melihat action palsu yang tidak datang dari backend contract.
   - Perbaikan: panel action sekarang ditahan saat backend actionability tidak tersedia.

3. `client/src/components/admin/OrderStatusTimeline.jsx`
   - Sebelumnya timeline membaca `order.status` mentah saja.
   - Risiko: state `FAILED`, `EXPIRED`, atau `CANCELLED` bisa tetap terlihat seperti flow fulfillment normal.
   - Perbaikan: timeline sekarang memprioritaskan `contract.statusSummary` dan menampilkan halted/final step yang jujur untuk state final-negatif.

## File yang diubah

- `client/src/pages/admin/Orders.jsx`
- `client/src/pages/admin/OrderDetail.jsx`
- `client/src/components/admin/OrderStatusTimeline.jsx`
- `reports/mvf-truth-01-hardening-report.md`
- `reports/mvf-truth-01-admin-order-truth-20260409-report.md`

## Dampak lintas app

- Admin impact:
  - Admin orders list/detail tidak lagi menampilkan fallback action lokal saat contract backend tidak tersedia.
  - Timeline admin order detail kini lebih jujur terhadap final state backend.
- Seller impact:
  - Tidak ada perubahan seller consumer atau governance.
- Client impact:
  - Tidak ada perubahan route buyer/storefront.
- Backend/API impact:
  - Tidak ada perubahan endpoint atau serializer.
  - Contract backend tetap menjadi source of truth.

## Hasil verifikasi

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅
- `pnpm -F server smoke:product-visibility` ✅
- `pnpm -F server smoke:store-readiness` ✅
- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:stripe-webhook` ✅
- `pnpm qa:mvf:visibility:frontend` ✅

## Risiko / residual issue

- Admin order action dropdown masih bergantung pada kehadiran `contract.availableActions` dari serializer list/detail. Itu memang source of truth yang benar, tetapi route lama tanpa contract akan menjadi read-only di frontend.
- Timeline admin tetap presentasional; patch ini hanya memastikan final-negative state tidak menyesatkan.
- Surface non-aktif/legacy di luar route admin aktif belum diaudit ulang pada patch ini.

## Saran task berikutnya

- Audit surface admin lain yang masih menurunkan state dari field raw bila `contract.statusSummary` sudah tersedia.
- Lanjutkan audit legacy order table/modal non-aktif untuk memastikan tidak ada consumer tersembunyi yang masih memunculkan status atau action palsu.
