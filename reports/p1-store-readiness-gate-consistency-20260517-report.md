# P1 Store Readiness Gate Consistency - 2026-05-17

## Summary

Store readiness gate sudah diaudit lintas Backend, Client, Seller, dan Admin. Source of truth backend yang aktif adalah `buildPublicStoreOperationalReadiness`: store hanya operational jika `Store.status = ACTIVE` dan active payment profile siap (`isActive = true`, `verificationStatus = ACTIVE`).

Patch kecil dibuat untuk menutup mismatch public microsite: endpoint public identity/rich-about per slug sekarang hanya resolve store operational, selaras dengan public product list/detail dan checkout gate.

## Files changed

- `server/src/routes/store.customization.ts`
- `server/src/scripts/smokeStoreReadiness.ts`
- `reports/p1-store-readiness-gate-consistency-20260517-report.md`

## Existing readiness rules found

- Backend canonical readiness:
  - `server/src/services/publicStoreIdentity.ts`
  - `buildPublicOperationalPaymentProfileInclude`
  - `buildPublicOperationalStoreInclude`
  - `buildPublicStoreOperationalReadiness`
- Public product listing/detail:
  - `server/src/routes/store.ts`
  - `server/src/routes/public.ts`
  - Uses active store + active verified payment include, plus product publish/status/review/stock gates.
- Checkout/cart:
  - `server/src/routes/checkout.ts`
  - `server/src/controllers/cartController.ts`
  - Revalidates store operational readiness from DB before checkout/preview.
- Seller metadata:
  - `server/src/routes/seller.storeProfile.ts`
  - `server/src/routes/seller.products.ts`
  - Seller product visibility metadata uses `STORE_NOT_READY` when public readiness blocks visibility.
- Admin metadata:
  - `server/src/routes/admin.storeProfiles.ts`
  - `server/src/routes/admin.products.ts`
  - Admin product/store profile payloads expose operational readiness and visibility reason.
- Seller dashboard checklist:
  - `server/src/services/sellerWorkspaceReadiness.ts`
  - Tracks store profile, payment profile, shipping setup, products, and team. Product readiness derives visible storefront product count, so it remains aligned with backend public visibility.

## Mapping Admin/Seller/Client

- Client storefront/product:
  - Product list/detail require product active + published + no seller review block + sellable stock + operational store.
  - Checkout preview/create re-check readiness from backend and blocks stale cart lines.
- Client store microsite:
  - `identity/:slug` and `microsites/:slug/rich-about` now require active verified payment profile, not only active store status.
  - Non-operational store slug returns `404` without exposing public store identity/rich-about content.
- Seller:
  - Store profile response includes `operationalReadiness`.
  - Product list/detail visibility metadata returns `PUBLISHED_BLOCKED` and `STORE_NOT_READY` when payment readiness blocks public visibility.
  - Workspace readiness checklist remains separate but product readiness is driven by storefront-visible product count.
- Admin:
  - Store profile list serializes public identity summary/readiness.
  - Product list visibility metadata uses the same public operational readiness helper.
  - Admin keeps review/payment governance visibility; no admin full-access behavior was changed.

## Bug/mismatch ditemukan

- `server/src/routes/store.customization.ts` previously allowed `identity/:slug` and microsite rich-about to resolve any `ACTIVE` store even if payment readiness was not ready.
- Product list/detail and checkout already blocked that same store, so public microsite identity could imply a store was public while its products/checkout were gated.

## Patch yang dibuat

- `resolvePublicStoreBySlug` now includes `buildPublicOperationalPaymentProfileInclude()` as a required include.
- Public slug identity and microsite rich-about now return `404` for:
  - active store without active verified payment profile
  - inactive/not-approved store
- No DB schema, auth architecture, payment provider flow, checkout lifecycle, or Seller/Admin permission behavior was changed.

## Smoke coverage

Updated `smoke:store-readiness` now covers:

- Store active + active verified payment profile + published stock-ready product => public identity, microsite rich-about, product list, PDP seller readiness all visible/ready.
- Store active + payment not configured => public identity hidden, microsite rich-about hidden, product list does not leak product, PDP hidden.
- Store inactive + active verified payment profile => public identity hidden, microsite rich-about hidden, product list does not leak product, PDP hidden.

Existing `smoke:product-visibility` continues to cover:

- Seller/Admin visibility metadata for `STORE_NOT_READY`.
- Public product discovery/detail hidden when store readiness blocks visibility.
- Checkout preview blocked for not-ready store products.

## Test command dan hasil

- `pnpm.cmd -F server build` => PASS
- `pnpm.cmd -F client build` => PASS
- `pnpm.cmd -F server smoke:store-readiness` => PASS
- `pnpm.cmd -F server smoke:product-visibility` => PASS
- `pnpm.cmd -F server smoke:checkout-variants` => PASS
- `pnpm.cmd -F server smoke:order-payment` => PASS
- `pnpm.cmd -F server smoke:seller-order-ownership` => PASS
- `pnpm.cmd -F server smoke:orders` => PASS
- `git diff --check` => PASS with existing autocrlf warning for `server/scripts/smoke-orders-admin.mjs`

## Risiko tersisa

- Seller workspace checklist has richer operational items than public readiness, especially shipping setup and profile completeness. Current public sell gate is intentionally store status + payment readiness + product visibility/stock; shipping/profile checklist does not block public product visibility unless the project later decides to expand the source-of-truth rule.
- Store application approval is represented operationally through provisioned `Store.status`; no schema/lifecycle change was made to couple public visibility directly to application rows.

## Apakah butuh Rencana Kolaborasi lanjutan

Tidak untuk patch ini.

Ya, jika Product Owner ingin mengubah public sell gate agar juga mewajibkan shipping setup/profile completeness/application row linkage secara hard-blocking. Itu akan menyentuh store lifecycle rule lintas Seller/Admin/Client dan perlu Rencana Kolaborasi.

## Rekomendasi task berikutnya

- P1 audit store application -> Store.status activation path, khususnya apakah semua approval/rejection path menjaga `Store.status` dan payment readiness metadata tetap sinkron.
- P1 audit checkout shipping readiness jika shipment carrier/origin setup akan dijadikan blocker public sell gate.
