# P0 Order Item Snapshot Consistency Report

Task ID: P0-ORDER-ITEM-SNAPSHOT-CONSISTENCY-20260517
Date: 2026-05-17

## Summary

Backend order detail serializers were tightened so split-order detail surfaces prefer persisted transaction snapshots from `SuborderItem` instead of current `Product` state. Smoke coverage now mutates product name, product price, and variant prices after checkout, then verifies Client, Seller, and Admin order details still show the original order snapshot.

## Files Changed

Task-specific changes:

- `server/src/routes/store.ts`
- `server/src/routes/admin.orders.ts`
- `server/src/scripts/smokeCheckoutVariants.ts`
- `reports/p0-order-item-snapshot-consistency-20260517-report.md`

Existing pending P0 worktree changes from previous stabilization tasks are still present:

- `server/src/routes/checkout.ts`
- `server/src/routes/public.ts`
- `server/src/routes/seller.products.ts`
- `server/src/routes/admin.products.ts`
- `server/src/scripts/smokeProductVisibility.ts`
- `server/src/services/productVisibility.ts`
- `reports/p0-catalog-variant-visibility-01-2026-05-17-report.md`
- `reports/p0-checkout-variant-stock-enforcement-20260517-report.md`

## Mapping Client/Seller/Admin Order Detail

Client authenticated order detail:

- Endpoint: `GET /api/store/orders/my/:id`
- Ownership: `Order.findOne({ where: { id, userId } })`
- Before patch: top-level `items` came from `OrderItem` plus current `Product.name`.
- After patch: when suborders exist, top-level `items` are built from `SuborderItem` snapshots.

Client public tracking detail:

- Endpoint: `GET /api/store/orders/:ref`
- Lookup: public invoice reference only.
- Before patch: top-level `items` came from `OrderItem` plus current `Product` fields.
- After patch: when suborders exist, top-level `items` are built from `SuborderItem` snapshots.

Seller order detail:

- Endpoint: `GET /api/seller/stores/:storeId/suborders/:suborderId`
- Ownership: `requireSellerStoreAccess(["ORDER_VIEW"])` plus `Suborder.findOne({ where: { id, storeId } })`
- Existing behavior already used `SuborderItem` snapshot fields for line items.

Admin order detail:

- Endpoint: `GET /api/admin/orders/by-invoice/:invoiceNo` and `GET /api/admin/orders/:id`
- Existing group items already used `SuborderItem` snapshot fields.
- After patch: top-level `items` for split orders are derived from group snapshot items, keeping Admin top-level lines aligned with Seller and Client.

## Bug Ditemukan

- Client order detail top-level `items` could display current product name instead of the transaction-time product snapshot for split orders.
- Public tracking detail had the same current-product fallback in top-level `items`.
- Admin group items were snapshot-safe, but Admin top-level `items` still came from legacy `OrderItem + Product`, which could diverge from group item names after product edits.
- Smoke coverage verified order snapshots immediately after checkout, but did not mutate product or variant data after order creation to catch historical drift.

## Bug Diperbaiki

- Added `mapSuborderSnapshotItemsForBuyerDetail()` in `store.ts`.
- Authenticated Client order detail now prefers `SuborderItem` snapshot fields when suborders exist.
- Public tracking detail now prefers `SuborderItem` snapshot fields when suborders exist.
- Admin top-level `items` now derive from snapshot group items for split orders.
- `smoke:checkout-variants` now mutates current product and variant prices after checkout and verifies Client, Seller, and Admin order details still show original snapshot values.
- `smoke:checkout-variants` now verifies seller cannot read a suborder through another seller's store route.

## Snapshot Fields Yang Dipakai

Used from `OrderItem` for legacy fallback:

- `productId`
- `quantity`
- `price`
- `variantKey`
- `variantLabel`
- `variantSelections`
- `skuSnapshot`
- `barcodeSnapshot`
- `imageSnapshot`

Used from `SuborderItem` for split-order detail:

- `productId`
- `storeId`
- `productNameSnapshot`
- `skuSnapshot`
- `variantKey`
- `variantLabel`
- `variantSelections`
- `barcodeSnapshot`
- `imageSnapshot`
- `priceSnapshot`
- `qty`
- `totalPrice`

## Backend Contract Yang Diperkuat

- Split-order detail lines are historical transaction snapshots.
- `price` and `lineTotal` in Client, Seller, and Admin detail are sourced from persisted order/suborder item snapshots, not current product or variant price.
- Product display name for split-order detail is sourced from `productNameSnapshot` when available.
- Seller order detail remains scoped by store ownership.

## Dampak Ke Client/Seller/Admin

Client:

- Order detail and public tracking are more stable for historical orders after product edits.
- No frontend contract break: existing fields like `name`, `productName`, `quantity`, `qty`, `price`, `lineTotal`, `variantKey`, and `variantLabel` remain available.

Seller:

- No direct route contract change.
- Smoke confirms seller cannot access another seller store's suborder.

Admin:

- Top-level detail `items` now align with group snapshot items for split orders.
- Historical product/variant price changes no longer create top-level item drift.

## Test Command Dan Hasil

- `pnpm.cmd -F server build` PASS
- `pnpm.cmd -F client build` PASS, with existing Vite chunk size warning
- `pnpm.cmd -F server smoke:checkout-variants` PASS
- `pnpm.cmd -F server smoke:order-payment` PASS
- `pnpm.cmd -F server smoke:product-visibility` PASS
- `git diff --check` PASS
- `pnpm.cmd -F server smoke:orders` NOT RUN SUCCESSFULLY: script requires `ADMIN_COOKIE` or `ADMIN_TOKEN`; without those it returns HTTP 401 before testing order detail.

## Risiko Tersisa

- `OrderItem` does not store product name or slug snapshot. Legacy orders without suborders still must fall back to current product name.
- `SuborderItem` does not store product slug snapshot, so slug remains current product state when exposed.
- Per-item discount allocation is not represented as a dedicated persisted snapshot field. Order and suborder discount totals remain available, but item-level discount allocation would require a separate approved schema plan.
- No DB schema change was made.

## Rekomendasi Task Berikutnya

- Add a planned schema review for legacy `OrderItem` product name/slug snapshot and per-item discount allocation.
- Add an authenticated admin smoke that logs in like the newer TypeScript smoke scripts instead of requiring manual `ADMIN_COOKIE` or `ADMIN_TOKEN`.
- Audit frontend order detail adapters to ensure all three apps prefer backend snapshot fields over any client-side product fallback.

## Apakah Butuh Rencana Kolaborasi Lanjutan

Tidak untuk patch ini.

Ya untuk item lanjutan yang membutuhkan schema/migration, khususnya product slug snapshot, legacy `OrderItem` product name snapshot, atau per-item discount allocation.
