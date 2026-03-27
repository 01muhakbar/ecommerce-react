TASK ID: COUPON-DOMAIN-XSPLIT-01
Status: PASS

Yang diamati

- Model coupon existing masih global-only di `server/src/models/Coupon.ts`: belum ada `storeId`, `startsAt`, atau marker scope eksplisit.
- Admin coupon CRUD existing di `server/src/routes/admin.coupons.ts` memperlakukan semua coupon sebagai domain tunggal admin/global.
- Public coupon lane di `server/src/routes/store.coupons.ts` dan validation di `server/src/services/coupon.service.ts` membaca coupon hanya berdasarkan `code`, sehingga store coupon berisiko bocor lintas tenant.
- Legacy order create di `server/src/routes/store.ts` memvalidasi coupon tanpa konteks store, sehingga coupon store A berpotensi dipakai di store B.
- Client checkout modern hanya memakai quote/preview, tetapi checkout legacy dan public coupon list tetap membaca contract coupon existing.

Keputusan ownership

- `PLATFORM`
  ownership: Admin Workspace
  scope: platform/global
  rule: `storeId = null`
- `STORE`
  ownership: Seller store, dengan admin governance penuh
  scope: hanya untuk 1 store
  rule: `storeId` wajib terisi dan harus cocok saat validation
- Admin governance:
  admin create/manage platform coupon
  admin monitor/manage store-scoped coupon
  admin dapat disable/update coupon seller bila perlu
- Seller lane belum dibuka di task ini. Foundation backend disiapkan dulu.

Perubahan yang dilakukan

- Menambah foundation model coupon:
  `scopeType`, `storeId`, `startsAt`
- Menambah shared governance service di `server/src/services/couponGovernance.ts` untuk ownership/scope serialization.
- Mengubah `coupon.service.ts` menjadi scope-aware:
  validasi active window `startsAt` + `expiresAt`
  validasi `PLATFORM` vs `STORE`
  cegah `scope_required` dan `scope_mismatch`
- Mengeraskan public coupon routes:
  list public default hanya expose platform coupon
  list/quote/validate dapat membaca scope store via `storeId` / `storeSlug`
- Mengeraskan order create legacy:
  coupon validation sekarang menerima `storeIds` hasil product lookup order
  coupon store tidak bisa dipakai lintas store
- Merapikan admin coupon governance:
  admin list/create/update sekarang paham `scopeType`
  admin bisa link coupon store ke store tertentu
  admin list menampilkan governance/store summary
- Merapikan admin UI coupon:
  drawer add/edit punya selector `Platform / Global` vs `Store-scoped`
  store selector muncul hanya untuk coupon store
  list admin menampilkan scope + ownership
- Mengunci `StoreCustomization` agar tetap hanya membaca coupon `PLATFORM`, supaya CMS global tidak menarik seller coupon.

Schema / migration

- Migration baru:
  `server/migrations/20260327123000-split-coupon-domain-platform-store.cjs`
- Field yang ditambah:
  `scope_type`
  `store_id`
  `starts_at`
- Index yang ditambah:
  `idx_coupons_scope_type`
  `idx_coupons_store_id`
  `idx_coupons_scope_active`
- Keputusan kompatibilitas:
  coupon lama dibaca sebagai `PLATFORM`
  `code` tetap global-unique untuk menghindari ambiguity dan perubahan besar pada checkout contract

Validation / pricing hardening

- `PLATFORM` coupon:
  valid lintas storefront selama active, started, tidak expired, dan min spend terpenuhi
- `STORE` coupon:
  wajib punya `storeId`
  valid hanya jika checkout punya tepat 1 store context yang sama
  invalid bila tidak ada store context
  invalid bila store context berbeda atau multi-store
- Cross-store leakage dicegah di dua titik:
  `store/coupons/quote` dan `store/coupons/validate`
  `store/orders` legacy order creation

File yang diubah

- `server/src/models/Coupon.ts`
- `server/src/models/Store.ts`
- `server/src/services/couponGovernance.ts`
- `server/src/services/coupon.service.ts`
- `server/src/routes/store.coupons.ts`
- `server/src/routes/store.ts`
- `server/src/routes/admin.coupons.ts`
- `server/migrations/20260327123000-split-coupon-domain-platform-store.cjs`
- `client/src/lib/adminApi.js`
- `client/src/api/store.service.ts`
- `client/src/pages/store/Checkout.jsx`
- `client/src/components/admin/coupons/AddCouponDrawer.jsx`
- `client/src/components/admin/coupons/EditCouponDrawer.jsx`
- `client/src/pages/admin/AdminCouponsPage.jsx`
- `client/src/pages/admin/StoreCustomization.jsx`

Hasil verifikasi

- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus
- Verifikasi logic yang di-hardening:
  coupon reason sekarang mengenali `not_started`, `scope_required`, `scope_mismatch`
  admin list/create/update sudah menerima scope platform/store
  public coupon list default tetap aman untuk lane global
  store coupon tidak lagi tervalidasi tanpa context store yang benar

Dampak ke Seller / Admin / Client

- Seller:
  belum ada UI seller coupon dibuka
  foundation sudah siap untuk task seller coupon lane berikutnya
- Admin:
  sekarang punya governance eksplisit atas coupon global dan coupon store
  bisa membedakan ownership coupon dengan jelas
- Client/storefront:
  coupon global existing tetap kompatibel
  public route tidak lagi rawan bocor lintas tenant
  checkout quote memberi reason yang lebih akurat untuk scope mismatch

Risiko / debt / follow-up

- Migration belum saya jalankan manual pada environment ini; yang diverifikasi baru build/compile.
- `code` masih global-unique. Ini sengaja dipertahankan agar checkout contract tidak melebar. Jika nanti ingin duplicate code per store, itu perlu task terpisah karena validation dan UX akan berubah.
- Seller coupon UI belum dibuka. Task lanjutan yang tepat adalah membuka seller store-scoped CRUD di atas foundation ini.
- Legacy checkout page client belum punya store context eksplisit saat apply coupon. Server sudah aman, tetapi UX coupon store-scoped akan lebih baik jika lane seller/store checkout berikutnya mengirim `storeId`/`storeSlug` secara eksplisit.

Butuh keputusan user?

Tidak
