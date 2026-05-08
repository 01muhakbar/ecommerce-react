TASK ID: SELLER-MVF-07
Status: PASS

Yang diamati

- `server/src/services/sellerWorkspaceAnalytics.ts`
- `client/src/api/sellerWorkspace.ts`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`
- `server/src/routes/checkout.ts`
- `server/src/routes/store.ts`
- `client/src/pages/store/Checkout.jsx`

Perubahan yang dilakukan

- Menambahkan `insights` backend-driven pada seller analytics summary.
- Menambahkan blok `couponAttributionReadiness` backend-driven untuk memetakan status persistence coupon attribution saat ini.
- Merapikan wording di seller analytics agar tidak overclaim:
  - `Revenue Baseline` -> `Paid Revenue`
  - `Discounted Orders` -> `Discount Activity`
  - `Discounted Paid Orders` -> `Paid Discount Activity`
- Menambahkan panel insight yang langsung mengarah ke lane seller terkait.
- Menambahkan penjelasan readiness coupon attribution di seller analytics UI, termasuk next step teknis yang realistis.

File yang diubah

- `server/src/services/sellerWorkspaceAnalytics.ts`
- `client/src/api/sellerWorkspace.ts`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`
- `CODEx_REPORTS/SELLER-MVF-07-analytics-follow-up-2026-03-27.md`

Hasil verifikasi

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Dampak ke Seller / Admin / Client

- Seller:
  - analytics baseline jadi lebih actionable
  - wording lebih jujur terhadap batas data
  - coupon attribution gap sekarang terlihat eksplisit di seller workspace
- Admin:
  - tidak ada perubahan authority atau governance runtime
- Client:
  - tidak ada perubahan checkout/public behavior

Gap coupon attribution yang dipetakan

- `store.ts` single-store order path:
  - parent `Order.couponCode` sudah persist
- `checkout.ts` multi-store split checkout:
  - parent order coupon signal hanya parsial
  - applied coupon code belum persist per `Suborder`
- Akibatnya:
  - discounted-order activity bisa dihitung
  - attribution per code untuk semua suborder belum bisa diklaim akurat

Rekomendasi attribution readiness berikutnya

- Persist applied coupon code + scope di level `Suborder` saat split checkout create
- Pastikan single-store dan multi-store memakai source of truth attribution yang sejajar
- Buka seller-safe attribution snapshot setelah persistence itu stabil

Risiko / debt / follow-up

- Seller analytics masih baseline operasional, bukan BI/reporting engine
- Coupon attribution readiness baru berupa peta teknis dan next step, belum attribution analytics final

Butuh keputusan user?

- Tidak
