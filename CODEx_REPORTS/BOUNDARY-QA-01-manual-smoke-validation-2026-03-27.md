TASK ID: BOUNDARY-QA-01
Status: PARTIAL

Defect yang ditemukan

- Tidak ada defect produk yang ditemukan pada flow yang berhasil diuji.
- Ada false negative pada harness QA headless saat menunggu `networkidle` di legacy no-access page `/user/store-payment-profile`.
  - Ini bukan defect produk.
  - Page tetap render benar saat diverifikasi ulang dengan wait `domcontentloaded` + heading assertion.

Perbaikan yang dilakukan

- Tidak ada perubahan kode produk.
- Smoke verification diulang dengan strategi wait yang lebih tepat untuk page React Query no-access fallback.

File yang diubah

- `CODEx_REPORTS/BOUNDARY-QA-01-manual-smoke-validation-2026-03-27.md`

Hasil smoke test

- PASS: login storefront owner `superadmin@local.dev`
- PASS: `/user/store-payment-profile` auto-redirect ke `/seller/stores/super-admin-1/payment-profile`
- PASS: `/user/store-payment-review` auto-redirect ke `/seller/stores/super-admin-1/payment-review`
- PASS: seller canonical payment lane render normal, tombol `Save draft` dan `Submit for review` tampil
- PASS: seller canonical payment lane tidak menampilkan marker `ACCOUNT_*`
- PASS: user storefront tanpa seller access melihat fallback `No seller access for this lane` + CTA `Open store invitations`
- PASS: user login tanpa seller access yang membuka seller canonical payment lane mendapat boundary `Access Forbidden`
- PASS: user anonim yang membuka seller canonical payment lane mendapat boundary `Seller Session Required` + CTA `Storefront Login`
- PASS: `/admin/online-store/store-payment` menuju `/admin/store/payment-profiles`
- PASS: `/admin/online-store/payment-review` menuju `/admin/store/payment-profiles`
- PASS: route yang diuji tidak menampilkan copy `ACCOUNT_*` di UI body

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Risiko / follow-up

- Status `PARTIAL` dipilih karena branch chooser multi-store pada sunset page belum bisa dieksekusi penuh di fixture lokal saat ini.
- Data lokal yang tersedia hanya memunculkan:
  - branch auto-redirect untuk seller owner dengan 1 store
  - branch no-access fallback untuk user tanpa seller access
- Untuk menutup gap terakhir, perlu fixture user dengan access ke >1 seller store agar state chooser pada sunset page bisa diuji langsung di browser.
- Artefak smoke tersimpan di:
  - `.codex-artifacts/boundary-qa-01/playwright-boundary-qa.json`
  - `.codex-artifacts/boundary-qa-01/playwright-boundary-qa-secondary.json`
