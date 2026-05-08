TASK ID: SELLER-MVF-08
Status: PASS

Yang diamati

- Model `Suborder` belum memiliki metadata coupon attribution.
- Jalur checkout modern di `server/src/routes/checkout.ts` selalu membuat `Suborder`, termasuk saat checkout hanya berisi 1 store (`SINGLE_STORE`).
- Jalur legacy single-store di `server/src/routes/store.ts` masih hanya mempersist `Order.couponCode` dan tidak membuat `Suborder`.
- Seller analytics readiness sebelumnya masih menandai suborder coupon attribution sebagai `MISSING`.

Keputusan metadata attribution

- Metadata minimum yang dipersist di level `Suborder`:
  - `appliedCouponId` nullable
  - `appliedCouponCode` nullable
  - `appliedCouponScopeType` nullable (`PLATFORM` / `STORE`)
- Alasan:
  - cukup untuk attribution seller yang aman
  - tetap ringan dan kompatibel
  - `couponId` membantu join/read helper berikutnya tanpa harus mengandalkan code string saja

Perubahan yang dilakukan

- Menambahkan field attribution coupon ke model `Suborder`.
- Menambahkan migration kecil untuk kolom baru di tabel `suborders`.
- Memperluas `quoteCoupon` agar mengembalikan `couponId` sebagai metadata internal yang aman.
- Mempersist coupon attribution di jalur checkout modern:
  - single-store checkout modern
  - multi-store checkout per store group
- Menjaga compatibility parent-order lama:
  - `Order.couponCode` tetap dipertahankan
  - route legacy `store.ts` tidak dirombak
- Memperbarui seller analytics readiness copy agar tidak lagi mengklaim `MISSING` untuk checkout modern.

Schema / migration

- Migration baru:
  - `server/migrations/20260327184500-add-suborder-coupon-attribution-columns.cjs`
- Kolom baru:
  - `applied_coupon_id`
  - `applied_coupon_code`
  - `applied_coupon_scope_type`
- Migration lokal berhasil dijalankan.

File yang diubah

- `server/src/models/Suborder.ts`
- `server/src/routes/checkout.ts`
- `server/src/services/coupon.service.ts`
- `server/src/services/sellerWorkspaceAnalytics.ts`
- `server/migrations/20260327184500-add-suborder-coupon-attribution-columns.cjs`

Hasil verifikasi

- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus
- `pnpm --filter server migrate` lulus
- Verifikasi schema DB:
  - `suborders.applied_coupon_id` ada
  - `suborders.applied_coupon_code` ada
  - `suborders.applied_coupon_scope_type` ada
- Verifikasi source:
  - checkout modern sekarang memetakan quote coupon ke metadata suborder per group
  - single-store checkout modern memakai metadata yang sama saat hanya ada 1 group
  - route legacy parent-order tetap aman dan tidak berubah behavior

Dampak ke Seller / Admin / Client

- Seller:
  - fondasi attribution coupon seller jadi lebih akurat untuk order yang dibuat lewat checkout modern
  - readiness analytics kini lebih jujur terhadap state teknis yang terbaru
- Admin:
  - tidak ada perubahan authority atau governance coupon
  - fondasi data untuk monitoring coupon per suborder jadi lebih siap
- Client:
  - tidak ada perubahan UI checkout/order yang breaking
  - contract checkout/order yang sudah stabil tetap dipertahankan

Risiko / debt / follow-up

- Route legacy single-store di `server/src/routes/store.ts` masih hanya menyimpan `Order.couponCode`.
- Attribution seller yang benar-benar penuh masih membutuhkan compatibility bridge atau backfill untuk order legacy tersebut.
- Langkah berikut yang paling tepat:
  - expose seller-safe attribution snapshot dari metadata `Suborder`
  - bila perlu, tambahkan bridge untuk order legacy yang belum punya `Suborder`

Butuh keputusan user?

- Tidak
