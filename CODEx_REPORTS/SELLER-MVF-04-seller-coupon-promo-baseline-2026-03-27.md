TASK ID: SELLER-MVF-04
Status: STOP

Yang diamati

- Admin coupon domain existing:
  - `server/src/routes/admin.coupons.ts`
  - `client/src/pages/admin/AdminCouponsPage.jsx`
- Public/store coupon domain existing:
  - `server/src/routes/store.coupons.ts`
  - `server/src/services/coupon.service.ts`
  - `client/src/api/store.service.ts`
  - `client/src/pages/store/Checkout.jsx`
- Seller permission map existing:
  - `server/src/services/seller/permissionMap.ts`

Temuan utama

1. Schema coupon existing masih global, bukan store-scoped.
- Model `Coupon` hanya punya field:
  - `code`
  - `discountType`
  - `amount`
  - `minSpend`
  - `active`
  - `expiresAt`
- Tidak ada:
  - `storeId`
  - `createdBySeller`
  - `adminReviewStatus`
  - `startsAt`
  - field ownership/governance lain

2. Public/store coupon contract saat ini membaca coupon global.
- `GET /api/store/coupons` di `server/src/routes/store.coupons.ts` mengambil semua coupon aktif yang belum expired.
- `quoteCoupon()` dan `validateCoupon()` di `server/src/services/coupon.service.ts` mencari coupon hanya dengan `Coupon.findOne({ where: { code } })`.
- Artinya checkout/client belum punya tenant boundary coupon berdasarkan store aktif.

3. Admin coupon lane existing juga global.
- `server/src/routes/admin.coupons.ts` melakukan CRUD langsung ke tabel `coupons` tanpa scope store.
- `client/src/pages/admin/AdminCouponsPage.jsx` juga memperlakukan coupon sebagai daftar global.

4. Acceptance task meminta store-scoped seller ownership, tetapi contract existing belum bisa menjaminnya.
- Seller harus hanya melihat/mengubah coupon store aktif.
- Client/storefront harus hanya membaca coupon valid milik store yang semestinya.
- Dengan schema dan service sekarang, membuka seller write lane akan membuat drift serius:
  - seller bisa membuat coupon yang secara contract terbaca global
  - checkout global bisa membaca coupon lintas store
  - admin visibility dan seller ownership belum bisa dipisah aman

Keputusan STOP

STOP dipicu karena:

- schema existing tidak cukup untuk seller coupon baseline yang tenant-safe
- checkout/cart coupon contract saat ini masih global dan akan drift bila seller write lane dibuka tanpa perubahan data model
- ownership admin vs seller belum bisa ditentukan aman di contract existing

Perubahan yang dilakukan

- Tidak ada perubahan kode aplikasi.
- Tidak ada route seller coupon yang dibuka.
- Tidak ada perubahan pada admin/client/backend coupon runtime.

File yang diubah

- `CODEx_REPORTS/SELLER-MVF-04-seller-coupon-promo-baseline-2026-03-27.md`

Hasil verifikasi

- Audit selesai.
- Implementasi dihentikan sesuai STOP condition.
- Build tidak dijalankan karena tidak ada perubahan kode runtime.

Dampak ke Seller / Admin / Client

- Seller:
  - lane coupon baseline belum aman untuk dibuka dengan contract saat ini
- Admin:
  - lane admin coupon tetap global seperti existing
- Client:
  - checkout/store coupon tetap membaca coupon global existing

Risiko / debt / follow-up

- Domain coupon existing belum memenuhi tenant boundary.
- Pricing contract coupon masih global dan belum siap untuk multi-store seller ownership.
- Menambah seller coupon tanpa foundation baru akan berisiko merusak boundary Seller/Admin/Client.

Rencana Kolaborasi yang disarankan

Phase 1: Contract decision
- Tetapkan apakah coupon benar-benar harus store-scoped.
- Tetapkan apakah code coupon unik global atau unik per store.
- Tetapkan authority admin:
  - read-only visibility
  - moderation/review optional
  - full override atau tidak

Phase 2: Schema minimal
- Tambah field minimal:
  - `storeId`
  - `startsAt`
  - optional governance metadata bila dibutuhkan
- Review dampak ke unique index `code`

Phase 3: Pricing contract hardening
- Ubah `store.coupons` dan `coupon.service` agar coupon divalidasi dalam scope store aktif atau store yang relevan dari checkout
- Pastikan checkout tidak bisa menerapkan coupon lintas store

Phase 4: Seller/Admin lanes
- Baru setelah store-scoped contract aman:
  - buka seller list/create/edit/activate
  - sinkronkan admin visibility

Butuh keputusan user?

Ya
