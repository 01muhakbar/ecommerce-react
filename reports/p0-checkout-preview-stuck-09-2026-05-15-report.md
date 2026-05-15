# P0-CHECKOUT-PREVIEW-STUCK-09 Report

Tanggal: 2026-05-15

## Tujuan

Memperbaiki ulang checkout preview stuck dengan snapshot identity yang eksplisit, supaya cart valid seperti Organic Banana qty 3 tidak terus dianggap stale.

## Root Cause

Task 08 sudah mengeluarkan `price` dan `lineTotal` dari syarat match, tetapi guard masih punya dua kelemahan production-readiness:

1. Mismatch masih hanya boolean/summary reason, sehingga root cause lapangan tidak terlihat dari snapshot visible vs preview.
2. React Query preview masih punya window cache (`staleTime`) dan tidak otomatis retry/refetch saat mismatch. Jika response preview lama atau backend cart baru saja catch up setelah update qty, UI bisa tetap berada di state `previewMismatch` sampai ada trigger lain.

Patch task 09 mengunci dua hal itu:
- comparison sekarang berbasis normalized identity + qty dengan reason eksplisit;
- preview checkout selalu fresh saat mount/focus dan otomatis refetch pendek saat mismatch, tanpa mematikan stale guard.

## Instrumentasi Snapshot

`Checkout.jsx` sekarang membangun snapshot dev-only saat mismatch:

- visible cart fingerprint
- preview fingerprint
- reason eksplisit:
  - `VISIBLE_CART_EMPTY`
  - `PREVIEW_EMPTY`
  - `ITEM_COUNT_MISMATCH`
  - `PRODUCT_ID_MISMATCH`
  - `VARIANT_ID_MISMATCH`
  - `STORE_MISMATCH`
  - `STORE_ID_SLUG_UNMAPPED`
  - `QUANTITY_MISMATCH`
  - `PREVIEW_LOADING`
  - `PREVIEW_ERROR`
- visible normalized lines
- preview normalized lines
- candidate preview lines
- `canApplyCoupon`
- `canPlaceOrder`
- `disabledReason`

Log hanya aktif di dev (`import.meta.env.DEV`) melalui `console.debug("[checkout-preview-sync]", snapshot)`, jadi tidak spam production.

## Perubahan

- `client/src/pages/store/Checkout.jsx`
  - Normalisasi quantity sekarang membaca `quantity`, `qty`, `count`, dan `cartQuantity`, plus mencatat source field.
  - Variant identity diperluas:
    - `variantId`
    - `selectedVariantId`
    - `variant.id`
    - `variant.variantId`
    - `selectedVariant.id`
    - `optionsHash`
    - `variantKey`
  - Store identity memakai `storeId/vendorId` dan `storeSlug`; slug-vs-id tanpa mapping aman tidak langsung menjadi permanent stale.
  - Matching guard hanya memakai product identity, variant identity/options, store identity jika bisa dibandingkan aman, dan quantity.
  - Preview query memakai `staleTime: 0`, `refetchOnMount: "always"`, dan `refetchOnWindowFocus: true`.
  - Saat mismatch dan tidak sedang cart/preview loading, checkout menjadwalkan `refetch()` setelah 700ms.
  - Invalid items diprioritaskan sebagai blocker eksplisit, bukan disembunyikan sebagai cart mismatch.

- `tools/qa/e2e-truth-smoke.ts`
  - Sudah mengunci checkout browser untuk Organic Banana qty 1, 2, dan 3:
    - qty 3 -> `Rp 75.000`
    - pesan `Backend preview is still catching up` hilang
    - coupon apply tidak sync-blocked
    - submit CTA tidak sync-blocked
  - Assertion canonical price drift tetap memastikan backend preview boleh menjadi source of truth harga final.

Tidak ada perubahan backend, schema DB, pricing engine, lifecycle order/payment/suborder, Admin route, Seller route, atau UI redesign.

## Dampak Boundary

- Admin Workspace: tidak terdampak.
- Seller Workspace: tidak terdampak.
- Client/Storefront:
  - Checkout preview valid menjadi ready.
  - `Order Summary by Store` memakai backend groups.
  - Coupon apply aktif setelah preview ready.
  - Total cost memakai backend canonical totals.
  - `Place an Order` tidak lagi diblokir oleh false-positive preview sync.
  - Guard anti-stale tetap aktif untuk mismatch nyata.

## Validasi

- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F client build` - PASS
- `pnpm.cmd -F server smoke:checkout-variants` - PASS
- `pnpm.cmd -F server smoke:checkout-coupons` - PASS
- `pnpm.cmd -F server smoke:order-payment` - PASS
- `pnpm.cmd qa:e2e:truth` - PASS
- `pnpm.cmd qa:e2e:truth` - PASS, rerun kedua untuk browser checkout
- `git diff --check` - PASS

Manual-equivalent browser validation dilakukan lewat `qa:e2e:truth`: skenario checkout membuka `/checkout`, memverifikasi Organic Banana qty 3 menampilkan `Rp 75.000`, `Order Summary by Store` berisi produk/store, warning catching-up hilang, coupon apply aktif, dan submit CTA tidak diblokir oleh preview sync.

## Risiko Tersisa

- Jika user masih melihat mismatch di dev, console sekarang akan menampilkan reason spesifik dan normalized snapshot. Itu sengaja ditinggalkan dev-only untuk diagnosis tanpa mengubah production behavior.
- Guard tetap tidak membandingkan harga lokal vs backend, karena backend preview adalah canonical source of truth untuk final totals.

## Rollback

Rollback aman dengan mengembalikan perubahan `client/src/pages/store/Checkout.jsx`, menghapus assertion tambahan terkait checkout browser di `tools/qa/e2e-truth-smoke.ts` bila perlu, dan menghapus report ini.
