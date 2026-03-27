TASK ID: COUPON-QA-01
Status: PASS

Defect yang ditemukan

- Tidak ada defect domain coupon yang memblokir migration atau smoke flow.
- Ditemukan defect kecil di login admin saat smoke UI:
  label `Email` dan `Password` belum terikat ke input via `htmlFor`/`id`, sehingga selector aksesibel gagal. Ini bukan blocker fungsi login, tetapi defect UX/accessibility nyata.

Perbaikan yang dilakukan

- Menjalankan migration `20260327123000-split-coupon-domain-platform-store.cjs` di DB dev.
- Memvalidasi schema hasil migration:
  `scope_type`
  `store_id`
  `starts_at`
  index scope/store aktif
- Memvalidasi compatibility coupon legacy dengan insert legacy-style row tanpa field baru, lalu memastikan row terbaca sebagai `PLATFORM`.
- Menjalankan smoke admin coupon flow:
  admin login
  create platform coupon
  edit platform coupon
  create store-scoped coupon untuk store A
  create store-scoped inactive coupon untuk store B
  list/meta coupon admin
- Menjalankan smoke public/store validation:
  platform coupon valid
  store A coupon valid di store A
  store A coupon invalid di store B
  store A coupon invalid tanpa context store
  inactive coupon memberi reason benar
  expired coupon memberi reason benar
- Menjalankan smoke UI headless untuk `/admin/coupons`.
- Hardening kecil:
  mengikat label login admin ke input di `client/src/pages/admin/AdminLoginPage.jsx`.
- Membersihkan data QA coupon setelah smoke selesai.

File yang diubah

- `client/src/pages/admin/AdminLoginPage.jsx`
- `CODEx_REPORTS/COUPON-QA-01-migration-smoke-validation-2026-03-27.md`

Hasil smoke test

- Migration run: sukses
- Schema inspect: sesuai desain
- Legacy coupon compatibility: lolos
  row legacy tanpa field scope baru otomatis terbaca sebagai `PLATFORM`
- Admin smoke: lolos
  list coupon render
  scope governance terbaca jelas
  create/edit platform coupon berhasil
  store-scoped coupon tampil dengan ownership yang benar
- Public/store validation smoke: lolos
  default public list hanya expose coupon platform
  list store A expose platform + coupon store A
  list store B tidak expose coupon store A
  coupon store A tidak valid untuk store B
  coupon store A tidak valid tanpa context store
  inactive/expired reason tidak misleading
- Admin UI headless: lolos
  `/admin/coupons` render normal
  heading `Coupons`, label `Platform`, dan label `Store-scoped` tampil

Hasil build

- `pnpm --filter server build` lulus
- `pnpm --filter client build` lulus

Risiko / follow-up

- Seller coupon UI masih belum dibuka, sesuai scope task.
- Legacy checkout page masih lebih aman bila nanti lane checkout/store mengirim context `storeId`/`storeSlug` secara eksplisit saat apply coupon, walau server-side validation saat ini sudah aman.
- Artefak smoke tersimpan di:
  `.codex-artifacts/coupon-qa-01/api-smoke.json`
  `.codex-artifacts/coupon-qa-01/admin-coupons-ui.json`
  `.codex-artifacts/coupon-qa-01/admin-coupons-page.png`
