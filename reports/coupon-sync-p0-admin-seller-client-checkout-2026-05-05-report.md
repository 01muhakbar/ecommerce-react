# P0 Coupon Sync Audit & Stabilization - Admin/Seller/Client/Checkout

Tanggal: 2026-05-05

## Ringkasan audit

Audit memakai metode ACUAN: Amati -> Tiru -> Modifikasi. Acuan UI dipakai sebatas pola flow/density dari Dashtar Admin, Lynk.id concept, dan KachaBazar storefront; tidak ada copy-paste asset/kode/desain.

Repo sudah memiliki split coupon domain yang cukup jelas:
- Admin coupon route: `server/src/routes/admin.coupons.ts`
- Seller coupon route: `server/src/routes/seller.coupons.ts`
- Public coupon route: `server/src/routes/store.coupons.ts`
- Checkout validation: `server/src/routes/checkout.ts` via `quoteCoupon`
- Runtime calculation/scope: `server/src/services/coupon.service.ts`
- Governance serializer: `server/src/services/couponGovernance.ts` dan re-export shared contract
- Client public type: `client/src/api/store.types.ts`
- Admin API coupon tidak berada di `client/src/api/adminCoupons*`; implementasi aktual ada di `client/src/lib/adminApi.js`

Hasil utama:
- Admin platform coupon punya `scopeType=PLATFORM` dan `storeId=null`.
- Seller coupon dipaksa `scopeType=STORE` dan `storeId` berasal dari route/middleware store seller.
- Public coupon list/quote/validate sudah menyaring active/time-window.
- Checkout memvalidasi ulang coupon di backend, bukan hanya frontend.
- Order attribution sudah tersedia pada `Order.couponCode`, `Order.discountAmount`, dan suborder `appliedCouponId/appliedCouponCode/appliedCouponScopeType`.

Bug kecil yang diperbaiki:
- Public coupon resolver sebelumnya menerima `storeId/storeSlug` dari store nonaktif. Akibatnya coupon store nonaktif bisa dianggap scoped/eligible di public coupon list atau quote jika client mengirim store nonaktif. Sekarang public coupon scope hanya meresolve store `ACTIVE`.

## Matrix field coupon

| Field | Backend | Admin | Seller | Client CouponPanel | Checkout | Order attribution | Status |
|---|---|---|---|---|---|---|---|
| coupon id | `Coupon.id` | list/form response | list response | optional render key | quote returns `couponId` | suborder `appliedCouponId` | OK |
| code | uppercase on create/update/quote | create/update/list | create/update/list | displayed/copy code | normalized uppercase | `couponCode`, `appliedCouponCode` | OK |
| title/name | `campaignName` fallback code | drawer/list | drawer/list | displayed via snapshot/list data | not used for calc | not stored | OK |
| description | no first-class model field | not first-class | not first-class | not first-class | not used | not stored | GAP |
| discount type | `percent`/`fixed` | create/update/list | create/update/list | label formatting | percent/fixed calc | discount amount only | OK |
| discount value | `amount` integer normalized | amount | amount | discount label | `discountValue`, discount calc | discount amount only | OK |
| max discount | no model field | not supported | not supported | not shown | not enforced | not stored | GAP |
| minimum order | `minSpend` | create/update/list | create/update/list | min order label | enforced in `quoteCoupon` | not stored separately | OK |
| usage limit/count | no model fields | not supported | not supported | not shown | not enforced | not stored | GAP |
| per-user limit | no model field | not supported | not supported | not shown | not enforced | not stored | GAP |
| start date | `startsAt` | date drawer -> ISO | date drawer/API -> ISO | countdown/window source | enforced | not stored separately | OK |
| expiry date | `expiresAt` | date drawer -> ISO | date drawer/API -> ISO | countdown/window source | enforced | not stored separately | OK |
| active/status | `active` + time window meta | status filter/toggle | status/manage permission | only active public list | inactive rejected | attribution only if valid | OK |
| scope | `scopeType` PLATFORM/STORE | selectable + store required | forced STORE | scope label/note | policy-surface aware | suborder scope type | OK |
| storeId/storeSlug | `storeId`, Store include | store selector/meta | route store only | store coupon link/name | matching store required | suborder store + coupon fields | OK |
| product/category restriction | no model fields | not supported | not supported | not shown | not enforced | not stored | GAP |
| visibility in Client | public route active/window/scope | governed by active/scope | governed by active/scope | renders valid list | backend quote validates | valid coupon only | OK |

## Flow Admin/Seller/Client/Checkout

Admin:
- `client/src/App.jsx` routes `/admin/catalog/coupons` behind `COUPONS_CRUD`; legacy `/admin/coupons` redirects.
- `server/src/routes/admin.coupons.ts` can create platform coupon and store-scoped coupon.
- Store-scoped admin coupon requires a valid store.
- Admin list includes governance metadata and store summary.

Seller:
- `client/src/App.jsx` routes `/seller/stores/:storeSlug/catalog/coupons`.
- `server/src/routes/seller.coupons.ts` uses `requireSellerStoreAccess`.
- Seller list/create/update/delete is limited to `scopeType=STORE` and the route store.
- Seller delete is a soft deactivate (`active=false`).
- Seller cannot create platform coupon or move coupon to another store via seller route.

Client/storefront:
- `server/src/routes/store.coupons.ts` returns active, started, non-expired coupons.
- Without store scope, only platform coupons are returned.
- With active store scope, platform coupons plus matching store coupons are returned.
- After fix, inactive store scope is not resolved for public list/quote/validate.
- `client/src/components/kachabazar-demo/CouponPanel.jsx` shows scope, countdown, min order, copy action, empty/loading/error states.

Checkout:
- `client/src/pages/store/Checkout.jsx` quotes coupon before applying.
- Multi-store checkout blocks order-level coupon and uses store-group coupons.
- `server/src/routes/checkout.ts` quotes coupon again inside checkout transaction.
- Store-group coupon must be `STORE`; platform coupon is rejected for store-group split checkout.
- Invalid coupon, inactive coupon, expired coupon, min spend failure, and scope mismatch return backend errors.

## Bug/gap ditemukan

BUG:
- Public coupon scope accepted inactive stores when resolving `storeId/storeSlug`. This could expose or validate store coupon scope for an inactive store.

GAP:
- No first-class coupon description field.
- No max discount field/enforcement.
- No usage limit, usage count, or per-user limit field/enforcement.
- No product/category restriction fields/enforcement.
- Coupon code uniqueness is global, so identical seller coupon code across two stores is not supported by current schema.
- Dedicated checkout coupon smoke was missing before this task; existing coverage was spread across offers customization and order-payment guardrails.

Tidak dikerjakan karena masuk STOP/batas aman:
- Database schema untuk max discount/usage limits/product restrictions.
- Refactor besar shared coupon serializer lintas Admin/Seller/Store.
- Checkout/payment/order calculation besar.
- Attribute runtime validation backlog.

## Perubahan yang dibuat

1. `server/src/routes/store.coupons.ts`
   - Public `resolveStoreScopeId` sekarang hanya meresolve store dengan `status: "ACTIVE"` untuk lookup by `storeId` dan `storeSlug`.
   - Dampak: store coupon milik store nonaktif tidak lagi public-listed atau valid lewat public quote/validate scope.

2. `server/src/scripts/smokeCouponScope.ts`
   - Smoke regression baru untuk coupon scope.
   - Membuat platform coupon, active-store coupon, dan inactive-store coupon.
   - Membuktikan active store melihat platform + own store coupon.
   - Membuktikan inactive-store coupon tidak tampil public dan quote-nya ditolak scope guard.

3. `server/package.json`
   - Menambahkan script `smoke:coupon-scope`.

## File diubah

- `server/src/routes/store.coupons.ts`
- `server/src/scripts/smokeCouponScope.ts`
- `server/package.json`
- `reports/coupon-sync-p0-admin-seller-client-checkout-2026-05-05-report.md`

## Validasi command + hasil

Baseline sebelum patch:
- `pnpm -F server build` - PASS
- `pnpm -F client build` - PASS, dengan warning chunk Vite >500 kB
- `pnpm -F server smoke:store-customization-offers` - PASS
- `pnpm -F server smoke:order-payment` - PASS

Setelah patch:
- `pnpm -F server build` - PASS
- `pnpm -F client build` - PASS, dengan warning chunk Vite >500 kB
- `BASE_URL=http://localhost:3011 pnpm -F server smoke:coupon-scope` - PASS
- `pnpm -F server smoke:store-customization-offers` - PASS
- `pnpm -F server smoke:order-payment` - PASS

Catatan validasi:
- Smoke baru dijalankan terhadap server sementara di port 3011 agar pasti memakai kode hasil patch. Server sementara sudah dihentikan setelah smoke PASS.

## Risiko tersisa

- Coupon usage limits/per-user limits belum ada karena butuh schema/model dan aturan checkout tambahan.
- Max discount untuk percent coupon belum ada karena butuh schema/model dan update calculation.
- Product/category coupon restriction belum ada.
- Order attribution menyimpan kode/discount/suborder coupon attribution, tetapi belum menyimpan snapshot lengkap campaign/minSpend/discount type/value pada order.
- Global unique coupon code membatasi seller berbeda memakai kode yang sama.

## Backlog yang sengaja ditunda

- Attribute Runtime Validation:
  - live attribute/value active validation saat seller product save,
  - public sanitizer untuk inactive attribute/value,
  - cart/checkout validator untuk selected variant/value.
- Coupon advanced governance:
  - usage limit/usage count/per-user limit,
  - max discount,
  - product/category restrictions,
  - coupon redemption ledger/audit.
- Shared coupon serializer consolidation lintas Admin/Seller/Client hanya jika owner menyetujui refactor lebih besar.

## Rekomendasi task berikutnya

1. P1 Coupon Usage Ledger & Limits: desain schema kecil untuk redemption/usage count/per-user limit dengan STOP approval.
2. P1 Coupon Max Discount: tambah `maxDiscount` pada model/DTO/calculation setelah approval schema.
3. P1 Coupon Restriction Audit: product/category coupon eligibility jika business rule sudah disepakati.
