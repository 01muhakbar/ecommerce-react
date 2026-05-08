# P0 Product Sync Audit & Stabilization - Admin/Seller/Client

Tanggal: 2026-05-05

## Ringkasan audit

Audit memakai ACUAN: Amati -> Tiru -> Modifikasi. Scope dibatasi pada sinkronisasi kontrak product Admin/Seller/Client dan gate visibility public, tanpa refactor besar, tanpa ubah auth, tanpa ubah database schema, dan tanpa hapus legacy route.

Temuan utama: canonical store route `/api/store/products` sudah memakai public operational store gate untuk list dan detail non-storeSlug. Legacy public route `/api/products/:slug` masih memakai include store yang hanya mengecek `Store.status = ACTIVE`, sehingga detail legacy bisa membuka produk dari store aktif tetapi belum operational. Ini tidak selaras dengan list public yang sudah memakai `buildPublicOperationalStoreInclude`.

## Matrix field product

| Field | Backend source | Admin | Seller | Client/storefront | Status |
| --- | --- | --- | --- | --- | --- |
| `id` | `Product.id` | List/detail memakai id | List/detail scoped store memakai id | List/detail memakai id | OK |
| `slug` | `Product.slug` | List/detail/form memakai slug | Authoring/list/detail memakai slug | Storefront route/detail memakai slug | OK |
| `title/name` | `Product.name` | `name`, title fallback di mapper | `name`, label authoring | `name/title` dinormalisasi | OK |
| `sku` | `Product.sku` | List/detail/form | List/detail/authoring | Ditambahkan ke legacy public mapper, store route sudah expose | OK |
| `price` | `Product.price` base price | Admin list/detail menjaga base price | Seller pricing menjaga base price | Storefront menampilkan effective price dengan `originalPrice` saat diskon | Compatible |
| `salePrice` | `Product.salePrice` | Field terpisah | Field terpisah | Ditambahkan/selaras di legacy public mapper; store route sudah expose | OK |
| `stock` | `Product.stock` | List/detail/form | Inventory/availability | Storefront `stock` + purchase state | OK |
| `variants` | `Product.variations` | Admin detail/form via variations | Seller authoring/detail via variations | Store detail meneruskan `variations` | OK |
| `attributes` | Category/attribute + product `variations/tags` | Admin detail warnings tersedia | Seller attribute warnings tersedia | Public detail masih read-only variasi/tags | OK |
| `images` | `promoImagePath`, `imagePaths` | Admin list/detail/form | Seller media/detail/authoring | Legacy public mapper kini expose `imagePaths/imageUrls`; store route sudah expose | OK |
| `status` | `Product.status` | Admin controls `active/inactive` | Seller sees lifecycle, write guarded | Public gates `active` only | OK |
| `published/visibility` | `Product.published`, `sellerSubmissionStatus`, store readiness | Admin visibility meta | Seller visibility meta | Public list/detail gated; regression added for legacy detail | OK |
| `storeId/storeSlug/seller identity` | `Product.storeId`, `Store.slug/name/status` | Admin has `storeId` and visibility store status | Seller scoped by `storeId` via middleware | Store/public product payloads now include `storeId`, `storeSlug`, public-safe `store` summary | OK |

## Bug/gap ditemukan

- BUG: `GET /api/products/:slug` legacy public detail only required `Store.status = ACTIVE`, not operational payment readiness. This could expose detail data for products from a store that list/discovery hides as not-ready.
- GAP: Client storefront list payload did not consistently include public-safe store identity (`storeId`, `storeSlug`, `store` summary), while Admin/Seller payloads already carry store ownership context.
- GAP: Legacy public mapper returned a thinner product payload than `/api/store/products`, missing `sku`, `salePrice`, `originalPrice`, `imageUrls`, `status`, `published`, and store identity.

## Perubahan yang dibuat

- Changed legacy public product mapper to emit a fuller storefront-compatible payload:
  - `sku`
  - effective `price`
  - `originalPrice`
  - `salePrice`
  - `imagePaths`
  - `imageUrls`
  - `storeId`
  - `storeSlug`
  - public-safe `store`
  - `status`
  - `published`
- Changed legacy `GET /api/products/:slug` to use `buildPublicOperationalStoreInclude`, matching public list visibility gate.
- Changed `/api/store/products` list include to return `Store.name` and `Store.slug`, then map `storeId/storeSlug/store` into product list items.
- Updated storefront normalizer/type to preserve normalized store identity fields.
- Extended `smokeProductVisibility` to assert:
  - not-ready store products stay hidden from legacy public detail while still allowing gated store-specific detail with `purchaseState = STORE_NOT_READY`;
  - visible public/storefront list and detail payloads carry `storeId/storeSlug`.

## File diubah

- `server/src/routes/public.ts`
- `server/src/routes/store.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `client/src/api/store.types.ts`
- `client/src/utils/storefrontCatalog.ts`

## Backend sync

- Admin product route was audited and left unchanged. It already keeps `price` as base price and `salePrice` as separate discount field.
- Seller product route was audited and left unchanged. Seller reads/writes are store-scoped through `requireSellerStoreAccess` and `Product.storeId`.
- Public/store product visibility is now more consistent between legacy `/api/products` and canonical `/api/store/products`.

## Frontend sync

- Storefront normalizer now preserves `storeId`, `storeSlug`, and normalized public-safe `store` summary when backend supplies it.
- No page-level UI rewrite was made.
- Existing Admin/Seller product pages continue to consume their established DTO adapters.

## Validasi command + hasil

Baseline before patch:

- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS, with existing non-blocking Vite chunk-size warning
- `pnpm -F server smoke:product-visibility`: FAIL initially because no server was listening on `http://localhost:3001` (`ECONNREFUSED`)

After patch:

- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS, with existing non-blocking Vite chunk-size warning
- `pnpm -F server smoke:product-visibility`: PASS
- `pnpm qa:mvf:visibility`: PASS
- `pnpm qa:public-release`: FAIL at DB readiness preflight: access denied for `root@localhost:3306/ecommerce_dev`; product flow assertions did not run.

## Risiko tersisa

- `pnpm qa:mvf:visibility:frontend` passes but still prints non-blocking `Missing vendor` debug warnings for synthetic products without store context.
- Legacy `/api/products` remains a compatibility route with its own mapper. It is now closer to `/api/store/products`, but full deduplication would be a larger refactor and was intentionally avoided.
- `qa:public-release` requires valid release DB credentials/environment before it can be treated as a product readiness signal.

## Rekomendasi task berikutnya

- P1: Extract a shared public product serializer for `/api/products` and `/api/store/products` behind a small adapter, after owner approval if the change grows beyond mapper-level cleanup.
- P1: Add a frontend smoke that confirms a real product card carries `storeId/storeSlug` through the storefront normalizer without relying on synthetic payloads.
