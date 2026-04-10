# TASK MVF-TRUTH-03 - Summary / Aggregate Truth Hardening

## Ringkasan
- Hardening seller summary/agregat yang masih drift dari raw status di seller orders, seller payment review, dan seller workspace home.
- Hardening buyer dashboard summary agar ringkasan order tidak overclaim dan lebih jelas membedakan closed/problem orders dari active progress buckets.
- Menjaga patch tetap kecil: hanya consumer summary/tone/label/hint, tanpa ubah schema, tanpa ubah contract endpoint besar, tanpa redesign dashboard.

## Surface summary/agregat yang diaudit
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`
- `client/src/pages/account/AccountDashboardPage.jsx`

## Mismatch nyata yang diperbaiki
1. `SellerOrdersPage`
   - Sebelum patch: stat card `Paid Split Orders`, `Awaiting proof review`, dan `Active Fulfillment` masih dihitung dari raw `paymentStatus` / `fulfillmentStatus`.
   - Patch:
     - count sekarang memakai contract/meta-aware selector lebih dulu
     - `Open Fulfillment` menghitung seller state aktif yang lebih dekat ke truth detail page
     - hint card menjelaskan bahwa count mengikuti seller payment contract/meta pada page saat ini
     - tone card paid dibuat lebih aman saat ada review tertunda atau exception snapshot lain

2. `SellerPaymentReviewPage`
   - Sebelum patch: stats review masih membaca raw `payment.status` / `entry.paymentStatus` sebagai primary truth.
   - Patch:
     - stat builder sekarang prioritaskan `statusMeta.code`
     - card `Paid` hanya menghitung backend-paid records
     - exception latest records disebut eksplisit di helper text agar settled count tidak overclaim

3. `SellerWorkspaceHome`
   - Sebelum patch: beberapa label summary memakai kata `Orders` padahal sumbernya seller-scoped `suborders/store splits`, dan beberapa tone terlalu optimistis untuk snapshot operasional.
   - Patch:
     - label diubah menjadi `Paid Store Splits`, `Eligible Paid Gross`, `Total Store Splits`, dan turunan serupa
     - `getPrimaryFocus` untuk paid follow-up diubah dari tone hijau ke amber karena itu attention state, bukan final-good state
     - top-card hints sekarang lebih memanfaatkan `hint` / `boundaryNote` backend saat tersedia
     - tone snapshot paid dibuat lebih aman dan tidak otomatis hijau hanya karena ada angka > 0

4. `AccountDashboardPage`
   - Sebelum patch: count utama memang sudah memakai `getOrderTruthStatus`, tetapi card summary tidak menjelaskan bahwa final-negative / closed orders tidak masuk ke active buckets, dan total card memakai tone yang misleading.
   - Patch:
     - summary sekarang menyebut closed/problem orders secara eksplisit di hint
     - processing bucket diperjelas sebagai processing + shipping active movement
     - total card tone dinetralkan
     - recent-order table memakai snapshot truth yang sama dengan count cards

## Temuan yang sengaja tidak disentuh karena butuh refactor lebih besar
- Analytics aggregate yang sepenuhnya datang dari backend snapshot (`analyticsOrderSnapshot`, `analyticsRevenueSnapshot`, `analyticsCouponSnapshot`) tidak saya hitung ulang di frontend. Itu butuh perubahan query/payload bila ingin lebih contract-aware.
- Seller workspace insight cards (`analytics.insights`, `nextActions`) dibiarkan memakai tone backend apa adanya. Mengubah logika prioritas/tone di sana tanpa boundary map berisiko drift dari source of truth backend.
- Buyer dashboard tidak saya tambah stat baru seperti `Closed Orders`; saya hanya memperjelas hint agar tidak membuka perubahan layout/statistics scope.

## File yang diubah
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`
- `client/src/pages/account/AccountDashboardPage.jsx`

## Dampak lintas app
- Admin: tidak ada perubahan.
- Seller: summary card, label aggregate, hint, dan tone lebih konsisten dengan detail seller order/payment pages.
- Client/Buyer: dashboard order highlights lebih jujur terhadap backend truth buckets.
- Backend/API: tidak ada perubahan contract besar; frontend hanya membaca payload existing dengan prioritas truth yang lebih aman.

## Hasil verifikasi
- `pnpm -F server build` -> PASS
- `pnpm -F client build` -> PASS
- `pnpm -F server smoke:product-visibility` -> PASS
- `pnpm -F server smoke:store-readiness` -> PASS
- `pnpm -F server smoke:order-payment` -> PASS
- `pnpm -F server smoke:stripe-webhook` -> PASS
- `pnpm qa:mvf:visibility:frontend` -> PASS

## Risiko / residual
- Seller workspace analytics summary masih setepat payload snapshot backend; patch ini tidak mengubah definisi aggregate di server.
- Buyer dashboard masih memakai 4-card layout existing; closed/problem orders belum punya kartu terpisah agar tidak melebar ke redesign/stat addition.
- Seller payment review stats tetap page/filter-scoped sesuai payload halaman itu; bukan total lintas semua filter.

## Rekomendasi task berikutnya
- Audit summary/backend snapshot di seller analytics bila ingin menaikkan akurasi aggregate lebih jauh, tetapi itu kemungkinan sudah masuk wilayah `Rencana Kolaborasi` karena menyentuh query/summary producer backend.
- Audit card/hint di admin overview agar wording aggregate lintas Admin/Seller/Buyer benar-benar memakai boundary yang sama.
