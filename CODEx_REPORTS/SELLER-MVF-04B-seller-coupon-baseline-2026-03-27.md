TASK ID: SELLER-MVF-04B
Status: PASS

Yang diamati

- Fondasi coupon split platform/store yang sudah ada di:
  - `server/src/models/Coupon.ts`
  - `server/src/services/coupon.service.ts`
  - `server/src/routes/store.coupons.ts`
  - `server/src/routes/admin.coupons.ts`
- Boundary seller workspace yang sudah stabil di:
  - `server/src/middleware/requireSellerStoreAccess.ts`
  - `server/src/services/seller/permissionMap.ts`
  - `client/src/layouts/SellerLayout.jsx`
  - `client/src/utils/sellerWorkspaceRoute.js`
- Pola seller-native lane dari payment profile/store profile/readiness.

Perubahan yang dilakukan

- Menambahkan seller coupon route backend yang tenant-scoped dan permission-guarded.
- Memaksa semua create/update seller menjadi `STORE` scope dengan `storeId` aktif dari route.
- Menolak mutation lintas store dengan lookup coupon yang dibatasi `scopeType=STORE` dan `storeId` aktif.
- Menambahkan seller API helper untuk list/create/update coupon.
- Menambahkan halaman seller coupon baseline untuk list, create, edit, dan activate/deactivate.
- Mengaktifkan route dan sidebar seller untuk lane `Coupons`.

File yang diubah

- `server/src/app.ts`
- `server/src/routes/seller.coupons.ts`
- `client/src/App.jsx`
- `client/src/layouts/SellerLayout.jsx`
- `client/src/utils/sellerWorkspaceRoute.js`
- `client/src/api/sellerCoupons.ts`
- `client/src/pages/seller/SellerCouponsPage.jsx`

API/route yang ditambah

- Frontend seller route:
  - `/seller/stores/:storeSlug/coupons`
- Seller route helper:
  - `createSellerWorkspaceRoutes(store).coupons()`
- Backend seller APIs:
  - `GET /api/seller/stores/:storeId/coupons`
  - `POST /api/seller/stores/:storeId/coupons`
  - `PATCH /api/seller/stores/:storeId/coupons/:couponId`

Hasil verifikasi

- Build:
  - `pnpm --filter server build` PASS
  - `pnpm --filter client build` PASS
- Smoke seller/admin/public:
  - PASS seller page render di `/seller/stores/super-admin-1/coupons`
  - PASS seller UI create coupon
  - PASS seller UI edit coupon
  - PASS seller UI activate/deactivate coupon
  - PASS seller list store A hanya menampilkan coupon store A
  - PASS seller list store B tidak melihat coupon store A
  - PASS seller create attempt dengan payload `scopeType=PLATFORM` tetap dipaksa menjadi `STORE` untuk store aktif
  - PASS seller patch lintas store ditolak `404`
  - PASS admin API melihat coupon seller sebagai `STORE` dengan `storeId` benar
  - PASS admin page render dan menampilkan coupon seller di lane `/admin/coupons`
  - PASS public coupon list store A memuat coupon seller store A + coupon platform
  - PASS public coupon list store B tidak memuat coupon seller store A
  - PASS quote coupon seller untuk store yang benar valid
  - PASS quote coupon seller untuk store yang salah memberi `scope_mismatch`
  - PASS quote coupon seller inactive memberi `inactive`
  - PASS coupon platform tetap valid di store A dan store B
- Artefak smoke:
  - `.codex-artifacts/seller-mvf-04b/smoke-2026-03-27T00-40-37-049Z.json`

Dampak ke Seller / Admin / Client

- Seller:
  - punya lane coupon baseline yang usable untuk active store
  - tidak bisa membuat coupon platform
  - tidak bisa menyentuh coupon store lain
- Admin:
  - tetap melihat coupon seller di admin coupon lane existing
  - governance tetap membedakan `PLATFORM` vs `STORE`
- Client/storefront:
  - tetap hanya melihat coupon valid untuk scope store yang benar
  - coupon platform tidak regresi
  - quote/validation tetap scope-aware

Risiko / debt / follow-up

- Checkout UI saat ini masih memakai quote/validation existing dan settlement coupon tetap dibatasi flow checkout sekarang. Task ini tidak membuka perubahan checkout UX besar.
- Seller coupon lane masih baseline satu halaman. Jika nanti dibutuhkan filter/pagination/bulk action seller, sebaiknya dijadikan task terpisah agar tidak melebar ke promo engine.
- Smoke browser admin membutuhkan `authSessionHint` yang normalnya memang di-set oleh flow login UI. Ini bukan defect produk, tetapi perlu diingat saat automation langsung lewat cookie.

Butuh keputusan user?

Tidak
