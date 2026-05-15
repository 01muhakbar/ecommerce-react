# P0-CHECKOUT-PREVIEW-STUCK-08 Report

Tanggal: 2026-05-15

## Tujuan

Memperbaiki checkout preview yang false-positive dianggap stale sehingga `Order Summary by Store` kosong, coupon apply terkunci, dan `Place an Order` tidak bisa dipakai walau visible cart valid.

## Temuan

- Backend `/api/checkout/preview` mengembalikan canonical `groups`, `summary`, `invalidItems`, dan totals.
- `Checkout.jsx` sudah membaca `groups` dari backend preview dengan fallback kompatibel ke `storeGroups`, `stores`, dan `sellerGroups`.
- Guard frontend sebelumnya membandingkan `price` dan `lineTotal` visible cart melawan backend preview.
- Perbandingan harga terlalu ketat untuk checkout: backend preview adalah source of truth final, sehingga item yang sama dengan qty sama tidak boleh dianggap stale hanya karena canonical price/line total backend berbeda dari snapshot visible cart.
- Kondisi ini bisa membuat UI terus menampilkan pesan `Backend preview is still catching up...`, mengosongkan store group, dan menahan coupon/submit.

## Perubahan

- `client/src/pages/store/Checkout.jsx`
  - Normalisasi checkout preview line diperluas untuk `variantId` dan `storeSlug`.
  - Matching visible cart vs backend preview kini memakai identitas item dan qty:
    - `productId`
    - `cartItemId` atau `lineId` bila tersedia
    - `variantId`, `variantKey`, atau `variantSelections` untuk produk varian/duplikat
    - `storeSlug` bila kedua sisi punya field tersebut
    - `qty`
  - `price`, `lineTotal`, dan subtotal tetap dihitung sebagai diagnostik, tetapi tidak lagi memblokir readiness.
  - Backend preview tetap menjadi source of truth untuk `Order Summary by Store`, subtotal, shipping, discount, dan grand total.
  - Preview query juga menunggu user auth object tersedia agar request preview tidak berjalan dari state auth yang belum siap.

- `tools/qa/e2e-truth-smoke.ts`
  - Menambahkan assertion browser bahwa checkout tetap ready saat backend canonical preview mengirim harga/line total berbeda dari visible cart, selama item identity dan qty sama.
  - Assertion memastikan:
    - pesan `Backend preview is still catching up` hilang;
    - `Order Summary by Store` tetap menampilkan produk;
    - coupon apply tidak disabled karena preview stuck;
    - submit CTA tidak disabled karena preview stuck.

Tidak ada perubahan backend route, pricing engine, schema DB, lifecycle order/payment/suborder, dependency, atau UI redesign.

## Dampak Boundary

- Admin Workspace: tidak terdampak.
- Seller Workspace: tidak terdampak.
- Client/Storefront:
  - Checkout guard tetap ada untuk cart item/qty mismatch yang nyata.
  - Checkout tidak lagi stuck hanya karena backend canonical total berbeda dari visible cart snapshot.
  - Final totals tetap berasal dari backend preview.

## Validasi

- `pnpm.cmd -F server build` - PASS
- `pnpm.cmd -F client build` - PASS
- `pnpm.cmd -F server smoke:checkout-variants` - PASS
- `pnpm.cmd -F server smoke:checkout-coupons` - PASS
- `pnpm.cmd -F server smoke:order-payment` - PASS
- `pnpm.cmd qa:e2e:truth` - PASS
- `pnpm.cmd qa:e2e:truth` - PASS, rerun kedua setelah penambahan assertion browser
- `git diff --check` - PASS

Catatan: sempat ada percobaan gating refresh cart tambahan yang membuat checkout skeleton terlalu lama di e2e. Perubahan itu tidak dipertahankan; final patch memakai fix matching yang lebih kecil dan sesuai root cause.

## Risiko Tersisa

- Jika backend preview benar-benar membaca cart remote berbeda dari visible cart tetapi item identity dan qty kebetulan sama, guard tidak akan memblokir hanya karena harga berbeda. Ini disengaja agar backend tetap menjadi source of truth harga final.
- Coverage baru mengunci kasus single item checkout dengan canonical price drift. Multi-store canonical price drift belum dibuat sebagai skenario terpisah.

## Rollback

Rollback aman dengan mengembalikan perubahan pada `client/src/pages/store/Checkout.jsx`, menghapus assertion tambahan di `tools/qa/e2e-truth-smoke.ts`, dan menghapus report ini. Tidak ada migration atau contract change.
