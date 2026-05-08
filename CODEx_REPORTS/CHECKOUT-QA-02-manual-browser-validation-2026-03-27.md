TASK ID: CHECKOUT-QA-02
Status: PASS

Defect yang ditemukan

- Tidak ada defect produk baru yang ditemukan pada flow multi-store coupon per store group.
- Satu kegagalan yang tersisa hanya pada harness QA:
  - langkah `db_query_order` di artefak Playwright gagal karena cara pemanggilan query DB dari script inline
  - ini bukan defect checkout; verifikasi DB yang sama berhasil dijalankan manual setelah smoke browser selesai

Perbaikan yang dilakukan

- Tidak ada patch kode aplikasi pada task ini.
- Menjalankan manual browser validation end-to-end untuk multi-store checkout.
- Menjalankan verifikasi API parent order setelah submit checkout.
- Menjalankan verifikasi DB manual untuk parent order, suborder, dan payment amount.

File yang diubah

- `CODEx_REPORTS/CHECKOUT-QA-02-manual-browser-validation-2026-03-27.md`

Hasil smoke test

- Cart multi-store dengan 2 store berhasil dimuat di `/checkout`.
- Tiap store group menampilkan input coupon sendiri.
- Area coupon global di sidebar tidak misleading pada mode multi-store.
- Coupon valid store A berhasil di-apply:
  - `QA-MULTI-A10`
- Coupon valid store B berhasil di-apply:
  - `QA-MULTI-B15`
- Coupon mismatch scope tertolak dengan reason yang benar:
  - `QA-MULTI-A10` saat dicoba di store B
- Coupon inactive tertolak:
  - `QA-MULTI-B-INACTIVE`
- Coupon expired tertolak:
  - `QA-MULTI-B-EXPIRED`
- Coupon platform tertolak di store-group lane:
  - `QA-PLATFORM-5`
- Remove coupon per group bekerja normal.
- Reload checkout tidak meninggalkan state coupon yang menyesatkan; coupon group dibersihkan dan total kembali ke subtotal asli.
- Submit multi-store checkout berhasil dan redirect ke payment page:
  - order id `144`
  - ref `STORE-1774593736394-823`

Verifikasi amount setelah submit

- Sidebar sebelum submit dengan dua coupon valid:
  - subtotal `117000`
  - discount `16650`
  - total `100350`
- Payment page setelah submit:
  - parent grand total `100350`
  - store 1 payment amount `16200`
  - store 3 payment amount `84150`
- API parent order:
  - `discount = 16650`
  - `totalAmount = 100350`
  - `couponCode = null`
- Verifikasi DB manual:
  - `orders.discount_amount = 16650.00`
  - `orders.total_amount = 100350.00`
  - `orders.coupon_code = null`
  - `suborders(store 1) = 16200.00`
  - `suborders(store 3) = 84150.00`
  - `payments(store 1) = 16200.00`
  - `payments(store 3) = 84150.00`

Artefak QA

- `.codex-artifacts/checkout-qa-02/playwright-checkout-qa-02.json`
- `.codex-artifacts/checkout-qa-02/checkout-loaded.png`
- `.codex-artifacts/checkout-qa-02/checkout-before-submit.png`
- `.codex-artifacts/checkout-qa-02/payment-after-submit.png`

Catatan artefak

- File JSON artefak masih bertanda `FAIL` karena hanya langkah harness `db_query_order` yang gagal.
- Hasil produk tetap dinyatakan `PASS` karena semua verifikasi browser, API, dan DB manual untuk checkout berhasil.

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Risiko / follow-up

- State coupon per group saat reload saat ini dibersihkan, bukan dipersist. Ini aman, tetapi jika nanti ingin persist antar refresh, perlu desain state yang eksplisit agar tidak misleading.
- Harness QA bisa dirapikan terpisah supaya langkah query DB terakhir tidak memberi status `FAIL` palsu pada artefak otomatis.
