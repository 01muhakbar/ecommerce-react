TASK ID: SELLER-MVF-06
Status: PASS

Yang diamati

- `client/src/pages/seller/SellerWorkspaceHome.jsx`
- `client/src/api/sellerWorkspace.ts`
- `server/src/routes/seller.workspace.ts`
- `server/src/services/sellerWorkspaceReadiness.ts`
- `server/src/routes/seller.orders.ts`
- `server/src/models/Suborder.ts`
- `server/src/models/SuborderItem.ts`
- `server/src/models/Coupon.ts`
- `server/src/routes/seller.coupons.ts`

Gap utama yang ditemukan

- Seller workspace home sudah punya readiness dan finance snapshot, tetapi belum ada baseline analytics operasional lintas order, revenue, coupon, dan product.
- Data order dan revenue seller sudah cukup reliable di level `Suborder`, jadi aman untuk tenant-scoped analytics baseline.
- Coupon seller belum punya atribusi usage per-code yang lengkap di setiap path checkout karena kode coupon belum selalu dipersist per suborder. Karena itu baseline coupon dibuat sebagai inventory + discounted-order activity, bukan BI promo per-code.

Perubahan yang dilakukan

- Menambahkan service backend seller analytics tenant-scoped untuk active store.
- Menambahkan endpoint seller analytics summary di seller workspace backend.
- Menambahkan normalizer dan getter client untuk seller analytics summary.
- Menambahkan panel analytics baseline di seller workspace home dengan state loading/error yang terpisah dari readiness/finance home utama.
- Menjaga boundary:
  - order/revenue analytics hanya terlihat jika role punya `ORDER_VIEW`
  - product analytics hanya terlihat jika role punya `PRODUCT_VIEW`
  - coupon analytics hanya terlihat jika role punya `COUPON_VIEW`

File yang diubah

- `server/src/services/sellerWorkspaceAnalytics.ts`
- `server/src/routes/seller.workspace.ts`
- `client/src/api/sellerWorkspace.ts`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`

Hasil verifikasi

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Dampak ke Seller / Admin / Client

- Seller:
  - mendapat baseline analytics operasional untuk store aktif
  - melihat total orders, paid/processing/completed summary, revenue baseline, AOV, coupon snapshot, dan top products baseline
  - tidak melihat data lintas store
- Admin:
  - tidak ada perubahan authority atau contract admin
- Client:
  - tidak ada perubahan storefront/runtime behavior

Risiko / debt / follow-up

- Coupon analytics saat ini belum aman untuk attribution usage per-code penuh pada semua path checkout multi-store. Baseline yang ditampilkan sengaja dibatasi ke inventory coupon store + discounted-order activity.
- Jika nanti dibutuhkan analytics coupon per code yang akurat, perlu persist coupon attribution di level suborder/suborder payment scope.

Butuh keputusan user?

- Tidak
