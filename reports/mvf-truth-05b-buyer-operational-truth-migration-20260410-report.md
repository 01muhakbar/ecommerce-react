# MVF-TRUTH-05B — Buyer Lane `operationalTruth` Migration

## Ringkasan
Task ini memigrasikan buyer consumer aktif agar memprioritaskan `split.operationalTruth` saat membaca split payment, split shipment, bridge payment -> shipment, finality, buyer actions, dan status summary. Patch tetap additive: fallback lama dari contract, payment read model, dan field raw tetap dipertahankan bila response lama belum mengirim field lengkap.

## Halaman Buyer Yang Diaudit
- `client/src/pages/account/AccountOrderPaymentPage.jsx`
- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `client/src/pages/account/AccountOrderDetailPage.jsx`
- `client/src/pages/store/StoreCheckoutSuccessPage.jsx`
- `client/src/pages/account/AccountOrdersPage.jsx` hanya diaudit cepat; tidak ditemukan mismatch yang perlu patch kecil pada pass ini.

## Mismatch Nyata Yang Diperbaiki
1. Buyer payment lane masih memprioritaskan `paymentReadModel`/raw split field untuk status, CTA proof/cancel, dan helper state.
   - Sekarang card split membaca `operationalTruth.statusSummary`, `operationalTruth.payment`, `operationalTruth.shipment`, `operationalTruth.bridge`, dan buyer actions lebih dulu.
   - Badge split/payment/shipment, subtitle shipment, helper lock reason, dan final-negative handling ikut source of truth baru itu.

2. Summary card buyer payment masih mengelompokkan status split hanya dari read model lama.
   - `summarizeGroupedPayments()` sekarang memakai settlement/payment state dari `operationalTruth` lebih dulu, lalu jatuh ke `groupedPaymentReadModel` bila perlu.

3. Tracking page store split masih menampilkan badge/status split dari contract/payment raw lama.
   - Presentasi split sekarang memprioritaskan `operationalTruth` untuk summary, payment badge, shipment badge, dan description blocked-by-payment.

4. Tracking page masih terlalu parent-oriented untuk next-step description.
   - Description sekarang memakai ringkasan split `operationalTruth` bila ada store split yang masih butuh bayar atau masih under review, sehingga buyer diarahkan ke scope split yang benar.

5. Buyer order detail store breakdown masih membaca badge/status split dari field lama.
   - Breakdown split sekarang memprioritaskan `operationalTruth` untuk split summary, payment badge, shipment badge, dan summary description.

6. Checkout success page non-Stripe masih sangat parent-summary oriented.
   - Success label/description sekarang memakai ringkasan split `operationalTruth` bila ada split yang masih butuh bayar, sedang direview, atau sudah final-negative.

## Temuan Yang Sengaja Tidak Disentuh
- `AccountOrdersPage` tidak saya ubah karena audit cepat tidak menemukan mismatch kecil yang lebih baik diselesaikan pada pass ini.
- Parent order summary tetap dipertahankan untuk headline global; task ini hanya memastikan parent aggregate tidak mengalahkan split truth di lane buyer aktif.
- Path CTA `CONTINUE_PAYMENT` / `CONTINUE_STRIPE_PAYMENT` tetap memakai contract/order-level action karena `operationalTruth` split saat ini belum membawa target path lanjutan.

## Helper / Util Baru
- `client/src/utils/splitOperationalTruth.ts`
  - Selector additive untuk:
    - `getSplitOperationalTruth`
    - `getSplitOperationalPayment`
    - `getSplitOperationalShipment`
    - `getSplitOperationalBridge`
    - `getSplitOperationalFinality`
    - `getSplitOperationalStatusSummary`
    - `getSplitOperationalEnabledBuyerAction`
    - `isSplitOperationallyFinal`

## File Yang Diubah
- `client/src/utils/splitOperationalTruth.ts`
- `client/src/pages/account/AccountOrderPaymentPage.jsx`
- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `client/src/pages/account/AccountOrderDetailPage.jsx`
- `client/src/pages/store/StoreCheckoutSuccessPage.jsx`

## Dampak
- Client / Buyer:
  - payment lane lebih backend-driven per split
  - tracking lebih jujur terhadap split payment vs split shipment
  - order detail lebih konsisten dengan split truth
  - success page non-Stripe tidak lagi hanya berbicara dengan parent tone saat split truth mengatakan hal lain
- Seller:
  - tidak ada perubahan langsung; buyer sekarang membaca split lane yang sama dengan seller scope
- Admin:
  - tidak ada perubahan langsung
- Backend / API:
  - tidak ada perubahan backend tambahan pada task ini

## Hasil Verifikasi
- `pnpm -F client build` ✅
- `pnpm -F server build` ✅
- `pnpm -F server smoke:order-payment` ✅
- `pnpm qa:mvf:visibility:frontend` ✅

## Risiko / Residual
- Buyer continue-payment CTA masih memakai order contract/payment entry karena `operationalTruth.actions.buyer` belum membawa target path lanjutan.
- Payment page masih memakai deadline dari payment read model lama, karena `operationalTruth` saat ini belum mengekspor deadline sendiri.
- Tracking headline utama tetap parent-order oriented; patch ini baru mengeraskan next-step description dan split cards agar parent tidak menimpa split truth.

## Perlu Rencana Kolaborasi?
Tidak untuk pass ini. Perubahan tetap kecil, additive, dan tidak memerlukan refactor besar atau perubahan endpoint/schema.
