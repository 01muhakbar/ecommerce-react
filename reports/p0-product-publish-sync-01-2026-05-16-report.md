# P0-PRODUCT-PUBLISH-SYNC-01 Report

## Ringkasan
Audit menemukan dua gap P0 pada workflow Seller product publish:

1. Seller publish masih bisa menaikkan draft langsung menjadi `active + published` tanpa Admin approval.
2. Admin review approval masih memakai aksi "publish", sehingga approval sekaligus membuat produk live di Client.

Patch minimal memisahkan kembali dua status:

```txt
Review approval = Product.status active + sellerSubmissionStatus none + published false
Publish status = Product.isPublished true, hanya oleh Seller setelah approved
Client visible = active + published + sellerSubmissionStatus none + store operational + stock > 0
```

Tidak ada schema, enum, atau route publik yang diubah/dihapus.

## Scope
- Seller create draft, submit review, publish approved product.
- Admin review queue, approve/revision request.
- Public Client listing/detail eligibility.
- Admin/Seller status and visibility mapping.
- Product visibility smoke strengthened.

## File Diubah
- `server/src/routes/seller.products.ts`
- `server/src/routes/admin.products.ts`
- `server/src/routes/store.ts`
- `server/src/routes/public.ts`
- `server/src/services/productVisibility.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `client/src/pages/admin/ProductPreviewDrawer.jsx`
- `client/src/api/productDto.ts`
- `reports/p0-product-publish-sync-01-2026-05-16-report.md`

## Existing Product Lifecycle Audit
- Seller draft source: `Product.status = draft`, `Product.isPublished = false`, `Product.sellerSubmissionStatus = none`.
- Seller submit review source: `POST /api/seller/stores/:storeId/products/:productId/submit-review` sets `sellerSubmissionStatus = submitted`.
- Admin review source: `GET /api/admin/products` review queue counts `submitted` and `needs_revision`.
- Publish toggle source: Seller `PATCH /api/seller/stores/:storeId/products/:productId/published`.
- Public client visibility filter: `status = active`, `isPublished = true`, `sellerSubmissionStatus = none`, active operational store, `stock > 0`.
- Store readiness dependency: public routes use `buildPublicOperationalStoreInclude`; shared visibility uses `buildPublicStoreOperationalReadiness`.
- Shipping readiness dependency: covered through operational store/payment profile readiness, not product row fields.
- Stock/variant dependency: base stock now gates public listing/detail; variant availability remains revalidated by detail/cart/checkout.
- Risiko awal: Admin approval and publish were conflated; Seller could publish draft directly.

## Status Matrix
| Event | Product review status | isPublished | Seller view | Admin view | Client visible |
| --- | --- | --- | --- | --- | --- |
| Seller creates draft | `none`, `status=draft` | `false` | Draft, submit allowed | Not submitted/internal | No |
| Seller submits review | `submitted`, `status=draft` | `false` | Locked pending review | Review queue pending | No |
| Admin approves | `none`, `status=active` | `false` | Approved but unpublished, publish allowed if ready | Approved/readable, no review queue | No |
| Seller publishes | `none`, `status=active` | `true` | Published | Published/visible if eligible | Yes if store operational and stock > 0 |
| Admin rejects | `needs_revision` | unchanged/hidden | Revision required, publish locked | Needs revision | No |
| Store shipping/payment incomplete | `none` | `true` | Published blocked | Published blocked | No |
| Stock unavailable | `none` | `true` | Published blocked, `OUT_OF_STOCK` | Published blocked, `OUT_OF_STOCK` | No |

## Backend Client Visibility Audit
Backend is the source of truth:
- `/api/store/products` and `/api/store/products/:id` use public product filters with `stock > 0`.
- `/api/products` and `/api/products/:slug` use the same stock visibility gate.
- Store must be active and have an active approved payment profile through `buildPublicOperationalStoreInclude`.
- Product must be `active`, `published`, and have `sellerSubmissionStatus = none`.
- Variant-specific combinations are still sanitized/read on product detail and revalidated in cart/checkout smoke.

## Seller/Admin Mapping Audit
- Seller publish now requires `Product.status === active`; draft publish returns `409 SELLER_PRODUCT_REVIEW_APPROVAL_REQUIRED`.
- Seller UI/API metadata reports draft next action as submit/review, not direct publish.
- Admin review drawer wording now says "Approve Review", not "Publish as Final Outcome".
- Admin approval clears submission and sets product active but keeps `published=false`.
- Admin/Seller visibility read model uses the shared `buildProductVisibilitySnapshot`, including `OUT_OF_STOCK`.

## Patch Minimal
- Split Admin approval from publish without adding a new enum or schema.
- Prevent Seller draft direct publish.
- Add stock as public visibility gate for Client public product routes.
- Align Admin/Seller visibility metadata with stock-blocked public visibility.
- Strengthen `smokeProductVisibility` to assert:
  - draft publish before review is blocked,
  - Admin approve does not publish,
  - Seller publish after approval makes product visible,
  - out-of-stock product is hidden from public routes and marked `OUT_OF_STOCK`.

## Dampak Admin/Seller/Client
### Admin
Admin remains product reviewer. The review drawer now approves without publishing and can still request revision.

### Seller
Seller can create draft, submit review, and publish only after Admin approval plus readiness checks.

### Client
Client public listing/detail only receives eligible products: approved active, published, review-cleared, operational store, and stock available.

### Backend
Backend remains source of truth for review, publish, readiness, and visibility. No database schema or lifecycle enum change.

## Validasi
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm -F server smoke:product-visibility`: PASS
- `pnpm -F server smoke:checkout-variants`: PASS
- `pnpm -F server smoke:checkout-coupons`: PASS
- `pnpm -F server smoke:order-payment`: PASS
- `pnpm qa:e2e:truth`: PASS
- `git diff --check`: PASS

Catatan validasi: satu percobaan `smoke:order-payment` pada server dev lama kena 429 auth rate limit karena bucket login lokal sudah penuh. Validasi akhir dijalankan ulang pada server sementara `BASE_URL=http://localhost:3101` dengan bucket bersih dan PASS; server sementara sudah dimatikan.

## Risiko Tersisa
- Variant-level visibility masih tidak difilter langsung di SQL public list; varian disanitasi pada detail dan divalidasi oleh cart/checkout.
- Admin masih memiliki publish toggle umum untuk produk non-review sesuai modul existing; task ini hanya memisahkan review approval Seller submission dari publish.

## Next Suggested Task
P0-CATALOG-VARIANT-VISIBILITY-01: audit apakah produk variant-only dengan semua varian stok 0 perlu disembunyikan dari public listing sebelum buyer membuka detail.
