# MVF-TRUTH-04 — Multivendor Checkout E2E Hardening Report

## Goal
Harden end-to-end workflow checkout multivendor existing agar source of truth untuk parent order, seller store splits/suborders, payment progression, success state, tracking state, dan actionability tetap konsisten lintas Admin, Seller, dan Client tanpa refactor besar.

## Flow End-to-End yang Diaudit
1. Storefront checkout preview dan order creation flow:
   - `client/src/pages/store/Checkout.jsx`
   - `client/src/api/public/storeCheckout.ts`
   - `client/src/api/storeCheckout.ts`
2. Buyer post-checkout payment lane:
   - `client/src/pages/account/AccountOrderPaymentPage.jsx`
   - `client/src/api/orderPayments.ts`
   - `client/src/utils/groupedPaymentReadModel.ts`
3. Buyer success / tracking / account detail surfaces yang sudah di-hardening pada task sebelumnya:
   - `client/src/pages/store/StoreCheckoutSuccessPage.jsx`
   - `client/src/pages/store/StoreOrderTrackingPage.jsx`
   - `client/src/pages/account/AccountOrderDetailPage.jsx`
4. Seller split visibility / actionability yang sudah di-hardening pada task sebelumnya:
   - `client/src/pages/seller/SellerOrdersPage.jsx`
   - `client/src/pages/seller/SellerOrderDetailPage.jsx`
5. Admin oversight untuk parent-vs-split payment truth:
   - `client/src/pages/admin/AdminPaymentAuditPage.jsx`
   - `client/src/pages/admin/AdminPaymentAuditDetailPage.jsx`

## Source of Truth yang Dipakai
- Buyer per-store payment continuation dan proof actionability tetap mengikuti grouped payment read model backend:
  - `paymentReadModel`
  - `proofActionability`
  - `cancelability`
- Parent order payment badge tetap mengikuti parent payment meta backend.
- Admin split oversight tetap read-only dan tidak mengubah contract producer besar.

## Mismatch Nyata yang Ditemukan
1. Buyer payment header masih memakai deadline dari group pertama sebagai summary utama, padahal checkout multistore bisa punya beberapa split dengan state berbeda.
2. Buyer payment group card masih memakai label `Store Total`, padahal panel ini seller/store-split scoped.
3. Buyer payment group card sudah punya final-negative step copy untuk `FAILED`, tetapi helper box di bawah masih jatuh ke pesan generic `proof submission is locked`.
4. Admin payment audit list/detail masih memakai bucket label `Pending / Unpaid / Rejected` yang bisa menyamarkan split `FAILED / EXPIRED / CANCELLED` sebagai sekadar unpaid biasa.
5. Admin payment audit detail menulis `Paid -` pada suborder yang belum pernah paid, sehingga parent-vs-split payment reading bisa misleading.
6. Admin payment audit detail belum memberi empty helper saat store split belum punya payment record sama sekali.

## Patch yang Dilakukan
### Client / Buyer
- `AccountOrderPaymentPage.jsx`
  - Menambahkan aggregate summary kecil untuk grouped payment lane:
    - `open`
    - `under review`
    - `confirmed`
    - `closed`
    - `unavailable`
  - Header deadline sekarang memakai earliest open split deadline, bukan lagi group pertama.
  - Bila tidak ada split payment yang masih open, header menampilkan helper jujur bahwa semua split sudah closed / confirmed / waiting review.
  - Label `Store Total` di panel payment split diubah menjadi `Store Split Total`.
  - Menambahkan helper final-negative khusus untuk status `FAILED`, supaya tidak jatuh ke narasi generic.

### Admin
- `AdminPaymentAuditPage.jsx`
  - Menjelaskan bahwa bucket `Not Confirmed` mencakup unpaid, expired, failed, dan cancelled store splits.
  - Mengubah wording count column agar tidak overclaim:
    - `Pending` -> `Under Review`
    - `Unpaid` -> `Not Confirmed`
    - `Rejected` -> `Rejected Proofs`
  - Memperjelas wording `suborder` menjadi `store split` pada deskripsi page.
- `AdminPaymentAuditDetailPage.jsx`
  - Menyamakan wording summary cards dengan audit list.
  - Menambahkan helper bahwa parent badges tetap aggregate, sedangkan store split cards adalah operational truth.
  - Mengubah summary line suborder dari `Paid -` menjadi payment summary yang mengikuti status split.
  - Mengubah `Store Total` menjadi `Store Split Total`.
  - Menambahkan empty state saat store split belum punya payment records.

## Temuan yang Tidak Perlu Diubah di Task Ini
- Buyer success, tracking, dan account detail tetap konsisten dengan patch MVF-TRUTH-02; tidak ada mismatch baru yang perlu diubah pada pass ini.
- Seller order list/detail tetap seller-scoped dan actionability masih backend-driven dari hardening sebelumnya; tidak ada drift baru yang mengharuskan patch tambahan pada pass ini.
- Checkout producer backend dan order split serializer tidak perlu diubah; mismatch yang ditemukan masih bisa diamankan di consumer.

## Temuan yang Akan Butuh Rencana Kolaborasi Bila Dikerjakan
- Bila admin ingin bucket count yang benar-benar memisahkan `open`, `review`, `expired`, `failed`, `cancelled`, dan `unavailable` di semua summary producer, itu sudah masuk perubahan producer aggregate backend dan perlu boundary map terpisah.
- Bila dashboard aggregate buyer/seller/admin ingin konsisten penuh terhadap grouped payment read model di semua snapshot analytics, itu juga akan menyentuh producer summary lintas route dan lebih aman lewat Rencana Kolaborasi.

## File yang Diubah
- `client/src/pages/account/AccountOrderPaymentPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditPage.jsx`
- `client/src/pages/admin/AdminPaymentAuditDetailPage.jsx`
- `reports/mvf-truth-04-multivendor-checkout-e2e-hardening-20260409-report.md`

## Dampak Lintas App
- Admin:
  - Oversight parent-vs-split payment state lebih jujur.
  - Count bucket tidak lagi meng-overclaim split final-negative sebagai unpaid biasa.
- Seller:
  - Tidak ada perubahan kode baru pada pass ini.
  - Validasi audit memastikan seller split actionability dari task sebelumnya tetap selaras dengan lane buyer/admin.
- Client / Buyer:
  - Post-checkout payment lane sekarang lebih jujur untuk scope split, deadline summary, dan final-negative state.
- Backend / API:
  - Tidak ada perubahan contract besar.
  - Tidak ada perubahan schema DB.

## Hasil Verifikasi
- `pnpm -F server build` ✅
- `pnpm -F client build` ✅
- `pnpm -F server smoke:product-visibility` ✅
- `pnpm -F server smoke:store-readiness` ✅
- `pnpm -F server smoke:order-payment` ✅
- `pnpm -F server smoke:stripe-webhook` ✅
- `pnpm qa:mvf:visibility:frontend` ✅

Catatan:
- `pnpm -F server smoke:order-payment` sempat gagal sekali dengan `fetch failed / ECONNRESET` pada expiry scenario, lalu lulus penuh saat rerun tanpa perubahan kode tambahan. Indikasinya transient runtime issue, bukan regression deterministik dari patch ini.

## Risiko / Residual
- Buyer payment header sekarang lebih jujur, tetapi aggregate itu tetap consumer-side summary; producer backend belum mengirim aggregate multistore headline khusus.
- Admin audit count masih bucket compatibility summary, bukan klasifikasi penuh per final-negative subtype.
- Surface admin orders utama tetap parent-order focused; split-payment detail tetap dibaca melalui payment audit lane.

## Rekomendasi Task Berikutnya
1. Audit producer aggregate backend untuk payment/order summary lintas admin-seller-buyer jika ingin memisahkan closed subtypes secara eksplisit di cards/counts.
2. Audit checkout preview wording dan grouped amount helper bila ingin memperjelas scope total parent vs total store split lebih jauh, tanpa mengubah flow inti.
