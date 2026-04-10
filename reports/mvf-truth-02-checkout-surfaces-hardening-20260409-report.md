# TASK MVF-TRUTH-02 - Checkout Surfaces Hardening

## Summary perubahan
- Hardening checkout success storefront agar tidak jatuh ke state sukses hijau ketika snapshot order non-Stripe gagal dimuat.
- Hardening tracking storefront agar CTA continuation dan narasi next-step mengikuti action contract backend yang enabled.
- Hardening buyer account orders/detail agar CTA payment tetap membaca `paymentEntry` atau action contract backend yang enabled.
- Hardening seller orders/detail agar tombol fulfillment tidak lagi tampil aktif saat governance action backend sudah non-enabled.

## Daftar mismatch yang diperbaiki
1. `StoreCheckoutSuccessPage` sebelumnya masih bisa menampilkan success final untuk flow non-Stripe saat fetch snapshot order gagal atau kosong.
   Patch:
   - tambah branch `Status Unavailable` untuk `orderSnapshotQuery.isError`
   - tambah guard saat snapshot backend tidak tersedia
   - tetap arahkan buyer ke tracking / my orders tanpa klaim status palsu
2. `StoreOrderTrackingPage` sebelumnya masih mensintesis path Stripe continuation lokal walau contract action backend sudah bisa menyediakan `targetPath`.
   Patch:
   - prioritaskan `availableActions` enabled via helper contract
   - pakai `targetPath` backend lebih dulu
   - fallback lokal hanya dipakai bila action enabled ada tetapi `targetPath` belum dikirim backend
   - kartu `Next Step` sekarang mengikuti actionability / review state / final-negative state
3. `AccountOrdersPage` sebelumnya hanya menampilkan tombol payment bila `paymentEntry` ada, walau contract action enabled bisa tetap tersedia.
   Patch:
   - fallback ke `CONTINUE_PAYMENT` atau `CONTINUE_STRIPE_PAYMENT` yang enabled
   - helper text ikut membaca deskripsi action contract saat `paymentEntry` belum ada
4. `AccountOrderDetailPage` sebelumnya hanya membaca CTA payment dari `paymentEntry`, dan breakdown store masih menarasikan status raw fulfillment walau split contract summary tersedia.
   Patch:
   - CTA payment fallback ke action contract enabled
   - status dan deskripsi breakdown store memprioritaskan `group.contract.statusSummary`
5. `SellerOrdersPage` sebelumnya tetap merender semua `availableActions` fulfillment sebagai tombol aktif walau backend bisa menandai action disabled.
   Patch:
   - hanya render action dengan `enabled !== false`
   - bila semua action non-enabled, tampilkan blocked reason backend
   - badge tone seller/payment mengikuti tone meta contract bila tersedia
6. `SellerOrderDetailPage` sebelumnya memiliki masalah yang sama pada lane governance non-shipment.
   Patch:
   - filter action non-enabled
   - tampilkan blocked reason backend saat tidak ada action enabled
   - badge tone seller/payment mengikuti tone meta contract bila tersedia

## File yang diubah
- `client/src/utils/orderContract.ts`
- `client/src/pages/store/StoreCheckoutSuccessPage.jsx`
- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `client/src/pages/account/AccountOrdersPage.jsx`
- `client/src/pages/account/AccountOrderDetailPage.jsx`
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`

## Dampak lintas app
- Admin: tidak ada perubahan langsung.
- Seller: action fulfillment sekarang lebih jujur terhadap governance backend; badge tone lebih sinkron dengan contract meta.
- Client/storefront: checkout success, tracking, my orders, dan order detail lebih backend-driven untuk status serta CTA payment.
- Backend/API: tidak ada perubahan endpoint atau contract besar; hanya konsumsi frontend yang diperketat.

## Hasil verifikasi
- `pnpm -F server build` -> PASS
- `pnpm -F client build` -> PASS
- `pnpm -F server smoke:product-visibility` -> PASS
- `pnpm -F server smoke:store-readiness` -> PASS
- `pnpm -F server smoke:order-payment` -> PASS
- `pnpm -F server smoke:stripe-webhook` -> PASS
- `pnpm qa:mvf:visibility:frontend` -> PASS

## Risiko / residual issue
- Buyer account list/detail masih bergantung pada `paymentEntry` untuk summary copy yang paling kaya; fallback action contract hanya dipakai saat entry tidak ada.
- Seller stats agregat di list masih memakai field raw `paymentStatus` dan `fulfillmentStatus`; ini presentasional dan belum disentuh pada task ini.
- Tracking footer masih menyisakan fallback path lokal untuk Stripe hanya sebagai compatibility net bila backend action enabled belum mengirim `targetPath`.

## Saran task berikutnya
- Audit surface status ringkasan lain yang masih menghitung aggregate tone/count dari field raw, terutama statistik seller dan buyer summary card.
- Audit helper copy payment review agar buyer/seller/admin membaca deskripsi final-negative yang sama dari contract meta saat tersedia.
