# MVF-TRUTH-05C — Seller Lane `operationalTruth` Migration

## Ringkasan
Task ini memigrasikan seller consumer aktif agar memprioritaskan `split.operationalTruth` untuk payment readiness, shipment truth, bridge payment -> shipment, seller actions, finality, dan status summary. Patch tetap additive dan mempertahankan fallback ke governance, contract/meta lama, serta shipment compatibility payload bila field `operationalTruth` belum lengkap.

## Halaman Seller Yang Diaudit
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`

## Mismatch Nyata Yang Diperbaiki
1. Seller list masih memprioritaskan raw `paymentStatus` / `fulfillmentStatus` untuk badge, aggregate code, dan operational snapshot.
   - Sekarang list memprioritaskan `operationalTruth.statusSummary`, `operationalTruth.payment`, dan `operationalTruth.shipment`.
   - Chip seller utama berubah menjadi operational status, lalu payment dan shipment dipisahkan agar split truth tidak bercampur.

2. Helper text seller di list masih terlalu bergantung pada `readModel.operationalNote` dan governance lama.
   - Sekarang helper text memprioritaskan `operationalTruth.bridge.shipmentBlockedReason` dan `statusSummary.description`.

3. Tombol fulfillment di list/detail masih membaca governance lama langsung sebagai sumber utama.
   - Sekarang consumer memprioritaskan `operationalTruth.actions.sellerFulfillment`, lalu jatuh ke governance lama hanya bila field baru belum ada.

4. Seller detail masih membaca shipment actionability dari shipment fallback lama sebagai primary truth.
   - Sekarang consumer memprioritaskan `operationalTruth.actions.sellerShipment`, `operationalTruth.shipment`, `operationalTruth.bridge`, dan `operationalTruth.finality`.

5. Detail seller masih berpotensi terlihat actionable saat split sebenarnya blocked/final-negative.
   - `shipmentActionBlockedReason` dan `fulfillmentActionBlockedReason` sekarang memprioritaskan final-negative / bridge blocked reason dari `operationalTruth`.
   - Shipment mutation tidak lagi dianggap terbuka bila split masih blocked by payment atau sudah final-negative.

6. Seller detail payment/shipping/totals panel masih terlalu raw-driven untuk wording status.
   - Panel sekarang memprioritaskan operational status, shipment truth, dan bridge reason supaya tone/detail tidak misleading.

## Temuan Yang Sengaja Tidak Disentuh
- Seller dashboard summary besar di luar `SellerOrdersPage` tidak saya ubah lagi pada task ini.
- Payload shipment card per-row masih memakai shipment read model untuk timeline/detail, karena itu memang masih source operasional persisted shipment di backend.
- Filter query seller (`paymentStatus`, `fulfillmentStatus`) tetap memakai parameter existing; task ini tidak mengubah producer/filter backend.

## Helper / Util Yang Dirapikan
- `client/src/utils/splitOperationalTruth.ts`
  - ditambah selector seller:
    - `getSplitOperationalSellerFulfillmentActions`
    - `getSplitOperationalSellerShipmentActions`
    - `getSplitOperationalEnabledSellerFulfillmentActions`
    - `getSplitOperationalEnabledSellerShipmentActions`

## File Yang Diubah
- `client/src/utils/splitOperationalTruth.ts`
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`

## Dampak
- Seller:
  - status, payment readiness, shipment truth, dan action gating lebih backend-driven
  - split blocked/final-negative tidak lagi terlihat seolah siap fulfill
  - shipment mutation mengikuti bridge payment -> shipment lebih jujur
- Buyer:
  - tidak ada perubahan langsung pada task ini
- Admin:
  - tidak ada perubahan langsung pada task ini
- Backend / API:
  - tidak ada perubahan backend tambahan

## Hasil Verifikasi
- `pnpm -F client build` ✅
- `pnpm -F server smoke:shipment-regression` ✅
- `pnpm qa:mvf:visibility:frontend` ✅

## Risiko / Residual
- Filter list seller masih mengikuti query backend lama (`paymentStatus` / `fulfillmentStatus`) dan belum memakai status summary contract-aware penuh.
- Shipment detail card masih menampilkan shipment payload/timeline lama sebagai fallback detail source, meski gating utama sekarang diprioritaskan dari `operationalTruth`.
- Governance lama masih disimpan sebagai fallback untuk kompatibilitas response lama.

## Perlu Rencana Kolaborasi?
Tidak. Patch tetap kecil, additive, dan tidak menyentuh refactor besar atau perubahan endpoint/schema.
