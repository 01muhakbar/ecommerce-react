# P0.5 Minimum Viable Flow Hardening - Product Variant Coupon Checkout Order

Tanggal: 2026-05-05

## Ringkasan audit MVF

Audit memakai ACUAN: Amati -> Tiru -> Modifikasi. Website acuan diamati untuk pola flow/density:
- Dashtar Admin: admin workspace reference; halaman publik yang terbaca hanya shell/error preload JS, jadi audit utama tetap repo aktual.
- Lynk.id: pola seller/creator workspace dan product/business flow.
- KachaBazar: pola storefront product, coupon panel, checkout, dan account order flow.

Scope MVF yang diaudit:
- Seller membuat/mengelola product dan variant.
- Admin mengontrol visibility/publish/review.
- Client melihat product valid.
- Client memilih variant valid dan cart menjaga snapshot variant.
- Client memakai coupon valid sesuai scope.
- Checkout membuat order/suborder/payment dengan snapshot cukup.
- Admin/Seller/Client membaca order sesuai scope.

Kesimpulan:
- Tidak ditemukan bug kecil baru yang perlu patch logic dalam batas aman task ini.
- Guard utama MVF sudah dibuktikan oleh smoke Product, Attribute/Variant, Coupon, Checkout/Order.
- Perubahan task ini hanya laporan audit. Tidak ada schema, auth, checkout/payment architecture, route legacy, cart architecture, atau UI redesign yang disentuh.

## Matrix flow end-to-end

| Step | Endpoint | Frontend page | Backend route | Data contract | Permission/scope | Status |
|---|---|---|---|---|---|---|
| Seller product create/edit | `/api/seller/stores/:storeId/products*` | `SellerProductAuthoringPage.jsx`, `SellerProductEditPage.jsx` | `server/src/routes/seller.products.ts` | product fields, status, stock, images, variations/variant selections | `requireSellerStoreAccess`, store owner/member scope | OK |
| Admin product visibility | `/api/admin/products*` | `Products.jsx`, `ProductForm.jsx`, admin detail/edit | `server/src/routes/admin.products.ts` | published/status/review visibility metadata | admin guard + product permissions | OK |
| Public product list/detail | `/api/store/products*`, `/api/store/products/:slug` | `StoreSearchPage.jsx`, `StoreProductDetailPage.jsx` | `server/src/routes/store.ts`, `server/src/routes/public.ts` | id/slug/title/price/stock/images/store/variations/purchaseState | public only sees eligible products/stores | OK |
| Variant selection | public product detail + cart add | `StoreProductDetailPage.jsx` | cart and checkout variant normalization in `checkout.ts` | `variantKey`, `variantSelections`, sku/barcode/image/price snapshots | client selection revalidated by backend | OK |
| Cart payload/preflight | `/api/cart*`, `/api/checkout/preview` | `StoreCartPage.jsx` | cart routes + `server/src/routes/checkout.ts` | cartItemId, productId, qty, variantKey, variantSelections, invalid item reasons | buyer session/cart scope | OK |
| Coupon quote/list | `/api/store/coupons`, `/quote`, `/validate` | `CouponPanel.jsx`, `Checkout.jsx` | `server/src/routes/store.coupons.ts`, `coupon.service.ts` | code, discount, scopeType, storeId, minSpend, active/window reason | public active/window/store scope | OK |
| Checkout create | `/api/checkout/create-multi-store` | `Checkout.jsx` | `server/src/routes/checkout.ts` | checkoutRequestKey, shippingDetails, couponCode/groupCoupons, cart snapshot | authenticated buyer, backend cart ownership | OK |
| Product/store eligibility at checkout | `/api/checkout/preview`, `/create-multi-store` | `Checkout.jsx` | `prepareCartGroups`/checkout guards | `PRODUCT_NOT_PUBLIC`, store readiness, stock, variant blockers | backend truth, not frontend-only | OK |
| Order creation | `/api/checkout/create-multi-store` | checkout submit | `server/src/routes/checkout.ts` | Order, OrderItem, Suborder, SuborderItem, Payment, Shipment | buyer-owned parent order, store-scoped suborders | OK |
| Coupon attribution | checkout create | order detail pages | `checkout.ts`, `Order.ts`, `Suborder.ts` | Order `couponCode/discountAmount`; Suborder `appliedCouponId/code/scopeType` | only valid quoted coupons persisted | OK |
| Client order visibility | `/api/orders/:orderId/checkout-payment`, account order APIs | `AccountOrdersPage.jsx`, `AccountOrderDetailPage.jsx`, `StoreOrderTrackingPage.jsx` | `server/src/routes/orders.ts`, store/order payment routes | buyer order/payment read model, variant snapshots | owner user only; admin exception for payment view | OK |
| Seller order visibility | `/api/seller/stores/:storeId/suborders*` | `SellerOrdersPage.jsx`, `SellerOrderDetailPage.jsx` | `server/src/routes/seller.orders.ts` | suborder read model, store-scoped items, fulfillment contract | `requireSellerStoreAccess`, `where: { storeId }` | OK |
| Admin order visibility | `/api/admin/orders*` | `Orders.jsx`, `OrderDetail.jsx` | `server/src/routes/admin.orders.ts` | global order list/detail, contract/actions, suborders/items | `requireStaffOrAdmin`/admin permissions | OK |

## Bug/gap ditemukan

BUG:
- Tidak ada bug baru yang terbukti dari audit dan smoke wajib pada task ini.

GAP / catatan:
- `client/src/pages/store/Cart.jsx`, `client/src/pages/user/MyOrders.jsx`, `client/src/pages/admin/AdminOrdersPage.jsx`, dan `client/src/pages/admin/AdminOrderDetailPage.jsx` tidak ada dengan nama persis di repo. Implementasi aktual:
  - `client/src/pages/store/StoreCartPage.jsx`
  - `client/src/pages/account/AccountOrdersPage.jsx`
  - `client/src/pages/account/AccountOrderDetailPage.jsx`
  - `client/src/pages/admin/Orders.jsx`
  - `client/src/pages/admin/OrderDetail.jsx`
- `qa:mvf:visibility` PASS tetapi frontend QA masih mencetak diagnostic non-fatal `Missing vendor` untuk synthetic product tanpa store context. Ini sudah pernah dicatat di Product P0 dan tidak memblokir exit code.
- `qa:public-release` masih gagal di DB readiness preflight environment lokal.

## Perubahan yang dibuat

- Tidak ada perubahan logic aplikasi.
- Tidak ada perubahan schema/model, auth/permission, payment flow, checkout calculation besar, serializer besar, route legacy, cart architecture, atau UI redesign.
- Menambahkan laporan audit MVF ini.

## File diubah

- `reports/mvf-hardening-product-variant-coupon-checkout-order-2026-05-05-report.md`

## Validasi command + hasil

- `pnpm -F server build` - PASS
- `pnpm -F client build` - PASS, dengan warning Vite chunk >500 kB
- `pnpm -F server smoke:product-visibility` - PASS
- `pnpm -F server smoke:checkout-variants` - PASS
- `BASE_URL=http://localhost:3011 pnpm -F server smoke:coupon-scope` - PASS
- `pnpm -F server smoke:order-payment` - PASS
- `pnpm qa:mvf:visibility` - PASS
  - Catatan: command exit 0, tetapi frontend QA mencetak diagnostic non-fatal `Missing vendor` untuk fixture synthetic tanpa store context.
- `pnpm qa:public-release` - FAIL environment preflight
  - Failure: `DB readiness failed: access denied for root@localhost:3306/ecommerce_dev`.
  - Aplikasi smoke/assertion public release tidak berjalan setelah DB readiness gagal.

## Risiko tersisa

- Full public release gate belum bisa dianggap PASS sampai DB credential/env staging atau lokal production-like valid.
- Coupon advanced rules belum ada: usage ledger, usage limit/count, per-user limit, max discount, product/category restriction.
- Shared public product serializer tetap ditunda karena berpotensi menjadi refactor besar lintas route/serializer.
- Attribute runtime validation tetap backlog setelah Product/Attribute/Coupon/MVF stabil.
- Frontend QA diagnostic `Missing vendor` masih noisy walau non-fatal.

## Environment issue

`qa:public-release` gagal sebelum menjalankan assertion aplikasi:
- DB target: `root@localhost:3306/ecommerce_dev`
- Error: `ER_ACCESS_DENIED_ERROR`

Rekomendasi environment:
- Sediakan `DATABASE_URL` atau `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS` yang valid untuk environment staging/public-release.
- Gunakan DB test/staging terpisah dari dev lokal agar gate release tidak bergantung pada credential root lokal.
- Jalankan ulang `pnpm qa:public-release` setelah DB readiness PASS.

## Backlog yang sengaja ditunda

- Coupon Usage Ledger & Limits:
  - usage limit,
  - usage count,
  - per-user limit,
  - max discount,
  - product/category restriction,
  - coupon usage ledger,
  - coupon attribution reporting.
- Attribute Runtime Validation:
  - validasi live attribute/value aktif saat seller product save,
  - public sanitizer untuk inactive attribute/value,
  - cart/checkout validator untuk selected variant/value.
- Shared public product serializer.
- Checkout/payment/order refactor besar.

## Rekomendasi task berikutnya

1. Perbaiki environment `qa:public-release` dengan DB credential staging/test yang valid, lalu jalankan gate penuh.
2. P1 Coupon Usage Ledger & Limits setelah approval desain schema.
3. P1 MVF Browser Walkthrough: Playwright happy path buyer checkout + buyer/seller/admin order detail visual check, tanpa mengubah logic aplikasi.
