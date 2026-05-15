# P0-MVF-CHECKOUT-READINESS-SMOKE-02

Tanggal eksekusi: 2026-05-15 Asia/Makassar

## Tujuan

Mengunci behavior checkout preview ketika store/payment profile seller belum ready, tanpa mengubah kontrak response lama. Coverage ditambahkan ke smoke existing agar regression pada reason lama `PRODUCT_NOT_PUBLIC`, field additive `message`, dan metadata readiness bisa terdeteksi.

## Observasi

- Checkout preview storefront dikonsumsi dari route backend checkout dan dipakai Client sebelum submit order.
- Task sebelumnya sudah menambahkan `message` dan `meta` readiness secara additive untuk invalid item.
- Smoke checkout variants sudah punya fixture buyer/seller/store/product/payment profile, helper cart, helper preview, assertion PASS/FAIL, dan validasi buyer/seller/admin snapshot.
- Jalur Admin/Seller tidak perlu diubah karena task ini hanya mengunci preview guardrail sebelum order/payment/suborder dibuat.

## File Diubah

- `server/src/scripts/smokeCheckoutVariants.ts`
  - Menyimpan fixture `paymentProfile`.
  - Menambahkan skenario checkout preview ketika `StorePaymentProfile.isActive = false`.
  - Memastikan item tidak masuk checkout-ready group dan summary valid tetap nol.
  - Memastikan reason lama tetap `PRODUCT_NOT_PUBLIC`.
  - Memastikan `message` menjelaskan payment readiness.
  - Memastikan `meta.blockedBy`, `meta.storeReadinessCode`, dan `meta.paymentProfileCode` terisi.
  - Mengaktifkan kembali payment profile yang sama dan memastikan produk kembali valid pada preview.

## Dampak Admin/Seller/Client

- Admin: tidak ada route/UI Admin yang diubah. Smoke lama `smoke:order-payment` dan `qa:e2e:truth` tetap pass untuk pembacaan order/payment.
- Seller: tidak ada route/UI Seller yang diubah. Smoke lama tetap pass untuk pembacaan suborder/order seller.
- Client: tidak ada perubahan UI. Smoke memastikan Client preview menerima response backward-compatible dengan tambahan metadata readiness.
- Backend: hanya smoke coverage yang ditambah; route checkout dan lifecycle order/payment/suborder tidak diubah dalam task ini.

## Validasi

- `pnpm.cmd -F server build` PASS.
- `pnpm.cmd -F client build` PASS.
- `pnpm.cmd -F server smoke:checkout-variants` PASS.
  - Coverage baru muncul di log:
    - `blocking checkout preview when store payment profile is inactive`
    - `PASS payment profile inactive preview returns compatible reason plus readiness metadata`
- `pnpm.cmd -F server smoke:checkout-coupons` PASS.
- `pnpm.cmd -F server smoke:order-payment` PASS.
- `pnpm.cmd qa:e2e:truth` PASS.

## Catatan Validasi

- `pnpm.cmd` digunakan karena PowerShell lokal memblokir `pnpm` tanpa ekstensi `.cmd`.
- `pnpm.cmd -F client build` masih menampilkan warning ukuran chunk Vite existing, bukan regresi dari task ini.
- `pnpm.cmd qa:e2e:truth` masih menampilkan warning Node `[DEP0190]` existing setelah PASS.

## Risiko Tersisa

- Smoke baru mengunci profil inactive (`PAYMENT_INACTIVE`/`INACTIVE`). Kode readiness lain seperti profil belum dikonfigurasi atau belum diverifikasi sudah bergantung pada coverage route/readiness existing dan bisa ditambah sebagai task kecil berikutnya bila diperlukan.
- Report ini dibuat pada 2026-05-15 walau nama file mengikuti requirement task `2026-05-14`.

## Next Suggested Task

Tambahkan coverage smoke kecil untuk payment profile belum verified/not configured jika production readiness ingin mengunci semua variasi readiness, tetap memakai pola smoke existing yang sama.
