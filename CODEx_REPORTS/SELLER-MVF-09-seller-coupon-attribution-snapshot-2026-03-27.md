TASK ID: SELLER-MVF-09
Status: PASS

Yang diamati

- `Suborder` sekarang sudah menyimpan metadata coupon attribution minimal:
  - `appliedCouponId`
  - `appliedCouponCode`
  - `appliedCouponScopeType`
- Checkout modern sudah mempersist metadata itu per suborder/store group.
- Analytics seller yang ada sebelumnya masih berhenti di inventory coupon + discounted-order activity + readiness note.
- Data legacy masih bercampur:
  - suborder modern bisa diatribusikan
  - order path lama yang hanya menyimpan `Order.couponCode` tidak saya klaim sebagai attribution penuh

Keputusan metrik attribution

- Metrik yang dipakai hanya yang bisa dihitung aman dari `Suborder`:
  - `attributedSuborders`
  - `attributedPaidSuborders`
  - `totalDiscountAmount`
  - `paidDiscountAmount`
  - `topCouponCodes`
  - `scopeBreakdown`
  - `coverage`:
    - `discountedSuborders`
    - `attributedDiscountedSuborders`
    - `attributedCoveragePercent`
    - `note`
- Tidak menambah metrik seperti ROI, revenue lift, atau attribution funnel.

Perubahan yang dilakukan

- Menambahkan read model backend `couponAttributionSnapshot` berbasis `Suborder`.
- Menghitung attribution seller-safe hanya dari discounted suborders yang benar-benar memiliki `appliedCouponCode`.
- Menambahkan coverage note untuk membedakan:
  - attributed modern path
  - discounted suborders yang belum punya metadata coupon
- Menambahkan top coupon code snapshot dan scope usage summary.
- Menambahkan insight backend ringan untuk coupon code teratas yang terlihat.
- Menambahkan normalizer/type client untuk `couponAttributionSnapshot`.
- Menampilkan panel baru `Coupon attribution snapshot` di seller workspace analytics.

File yang diubah

- `server/src/services/sellerWorkspaceAnalytics.ts`
- `client/src/api/sellerWorkspace.ts`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`

Coverage note

- Snapshot attribution seller sekarang memakai `Suborder` modern sebagai source utama.
- Jika discounted suborder belum membawa `appliedCouponCode`, data itu dihitung sebagai `unattributedDiscountedSuborders`.
- Order path legacy yang masih hanya punya `Order.couponCode` tetap dianggap di luar snapshot per-code ini.
- Karena itu panel tetap jujur: coverage bisa `READY`, `PARTIAL`, atau `NO_ACTIVITY`, bukan full attribution claim.

Hasil verifikasi

- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus
- Tidak ada perubahan contract storefront/admin yang breaking

Dampak ke Seller / Admin / Client

- Seller:
  - sekarang bisa melihat snapshot attribution coupon yang lebih akurat
  - bisa melihat total attributed discount, coverage, top coupon code, dan scope usage
- Admin:
  - tidak ada perubahan authority atau governance
  - fondasi attribution seller tetap aman dan tenant-scoped
- Client:
  - tidak ada perubahan flow checkout/storefront
  - tidak ada overclaim analytics yang bocor ke public lane

Risiko / debt / follow-up

- Attribution snapshot masih bergantung pada coverage metadata yang tersedia di `Suborder`.
- Order legacy yang hanya punya `Order.couponCode` belum ikut ke per-code attribution snapshot.
- Follow-up yang paling tepat:
  - bridge/backfill legacy attribution jika memang dibutuhkan
  - expose admin-safe cross-store attribution read model bila kelak diperlukan

Butuh keputusan user?

- Tidak
