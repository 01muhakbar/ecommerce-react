# Public Release Gate Environment Fix Report

Tanggal: 2026-05-05

## Ringkasan Penyebab

`pnpm qa:public-release` gagal di tahap DB readiness preflight sebelum mencapai product/order/coupon assertions karena runner memakai konfigurasi DB dari `.env` lokal:

- user: `root`
- host: `localhost`
- port: `3306`
- database: `ecommerce_dev`

Konfigurasi tersebut berasal dari env aktif dan fallback backend, bukan hardcode khusus di script public release. Credential lokal untuk `root@localhost:3306/ecommerce_dev` tidak bisa dipakai oleh smoke runner, sehingga MySQL mengembalikan `ER_ACCESS_DENIED_ERROR`.

Patch yang dibuat hanya menyentuh QA tooling, fixture QA, dokumentasi, dan contoh env. Tidak ada perubahan logic product, checkout, coupon, order/payment, auth, schema, model, serializer, atau UI.

## File/Script yang Memakai DB Env

| File/script | Peran | DB env yang dipakai | Status |
|---|---|---|---|
| `package.json` | Mendefinisikan `qa:public-release` sebagai `tsx ./tools/qa/public-release-smoke.ts` | Mewariskan env proses | OK |
| `tools/qa/public-release-smoke.ts` | Release smoke runner dan DB readiness preflight | `DATABASE_URL` atau `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | PATCHED |
| `server/src/config/database.ts` | Runtime DB config backend | `DATABASE_URL` atau fallback `DB_NAME=ecommerce_dev`, `DB_USER=root`, `DB_PASS=""`, `DB_HOST=localhost`, `DB_PORT=3306` | OK, diamati saja |
| `server/src/config/config.cjs` | Sequelize CLI config | Env untuk dev/prod, test fallback `database_test`/`root` | OK, tidak dipakai langsung oleh public-release smoke |
| `.env.example` | Contoh env utama | Dokumentasi env QA public release | PATCHED |
| `.env.public-release.example` | Contoh env dedicated release/test DB | Dedicated DB env untuk public-release gate | ADDED |
| `docs/public-release-env.md` | Dokumentasi setup DB public-release | Instruksi SQL dan command env file | ADDED |

## Env Variable yang Dibutuhkan

Minimal:

- `JWT_SECRET`
- `AUTH_COOKIE_NAME`
- `DATABASE_URL`

Atau, sebagai pengganti `DATABASE_URL`:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

Opsional tetapi direkomendasikan:

- `COOKIE_SECURE`
- `CLIENT_URL`
- `CORS_ORIGIN`
- `PUBLIC_BASE_URL`
- `UPLOAD_DIR`
- `PUBLIC_RELEASE_SMOKE_ENV_FILE`
- `PUBLIC_RELEASE_SMOKE_PORT`
- `PUBLIC_RELEASE_SMOKE_SKIP_BUILD`
- `PUBLIC_RELEASE_SMOKE_SKIP_APP_SMOKES`

## Perubahan yang Dibuat

1. `tools/qa/public-release-smoke.ts`
   - Menambahkan dukungan env file khusus melalui `PUBLIC_RELEASE_SMOKE_ENV_FILE` atau `PUBLIC_RELEASE_ENV_FILE`.
   - Env file khusus dimuat dengan `override: true`, sehingga release/test DB bisa dipisahkan dari `.env` dev lokal.
   - Menambahkan error message DB readiness yang actionable untuk access denied, missing DB, host unresolved, dan koneksi gagal.
   - Menjaga behavior existing: jika env file khusus tidak diset, runner tetap membaca `.env` default.

2. `.env.public-release.example`
   - Menambahkan template env dedicated untuk public-release smoke gate.
   - Menggunakan placeholder non-secret untuk DB release/test terpisah.

3. `docs/public-release-env.md`
   - Menambahkan instruksi setup DB/user test terpisah.
   - Menambahkan contoh command PowerShell dan Bash.
   - Menjelaskan failure pattern `root@localhost:3306/ecommerce_dev`.

4. `.env.example`
   - Menambahkan pointer ke dokumentasi dan `.env.public-release.example`.

5. `tools/qa/mvf-visibility-frontend.ts`
   - Menambahkan konteks `store` pada fixture sintetis frontend MVF.
   - Tujuannya hanya menghilangkan warning `Missing vendor` non-fatal dari fixture QA; runtime storefront tidak diubah.

## Command Validasi + Hasil

| Command | Hasil | Catatan |
|---|---|---|
| `pnpm -F server build` | PASS | Build server berhasil. |
| `pnpm -F client build` | PASS | Build client berhasil; ada warning Vite chunk size > 500 kB, non-fatal. |
| `pnpm qa:mvf:visibility` | PASS | Product visibility smoke PASS dan frontend MVF visibility PASS. Diagnostic `Missing vendor` tidak muncul lagi. |
| `pnpm qa:public-release` | FAIL | Masih gagal di DB readiness preflight karena access denied `root@localhost:3306/ecommerce_dev`; error message sekarang memuat instruksi env file dedicated. |
| `git diff --check -- tools/qa/public-release-smoke.ts tools/qa/mvf-visibility-frontend.ts .env.example .env.public-release.example docs/public-release-env.md` | PASS | Tidak ada whitespace error. Git memberi warning CRLF untuk `.env.example`, non-fatal. |

## Status `qa:public-release`

Status: FAIL karena credential DB lokal belum tersedia/valid.

Failure spesifik:

```text
DB readiness failed: access denied for root@localhost:3306/ecommerce_dev.
Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS to a valid staging/test database.
For a dedicated local file, copy .env.public-release.example to .env.public-release and run
PUBLIC_RELEASE_SMOKE_ENV_FILE=.env.public-release pnpm qa:public-release.
```

Script sekarang sudah cukup jelas untuk membedakan masalah environment dari regression product/order/coupon. Karena DB readiness masih gagal, assertion product/order/coupon belum dijalankan pada command ini.

## Langkah Manual yang Harus Dilakukan Jika Masih FAIL

1. Copy `.env.public-release.example` menjadi `.env.public-release`.
2. Isi `JWT_SECRET`, `DB_NAME`, `DB_USER`, dan `DB_PASS` dengan credential lokal yang valid.
3. Buat DB/user MySQL khusus untuk release smoke, contoh:

```sql
CREATE DATABASE ecommerce_public_release;
CREATE USER 'public_release_user'@'localhost' IDENTIFIED BY 'replace_password';
GRANT ALL PRIVILEGES ON ecommerce_public_release.* TO 'public_release_user'@'localhost';
FLUSH PRIVILEGES;
```

4. Jalankan:

```powershell
$env:PUBLIC_RELEASE_SMOKE_ENV_FILE=".env.public-release"
pnpm qa:public-release
```

## Catatan `Missing vendor` Diagnostic

Sumber diagnostic ada di frontend QA fixture `tools/qa/mvf-visibility-frontend.ts`. Fixture sintetis memanggil `normalizeStorefrontProduct` tanpa konteks `store`/`seller`/`vendor`, sehingga adapter frontend mengeluarkan warning `Missing vendor` walaupun assertion PASS.

Patch kecil menambahkan objek `store` ke fixture sintetis. Hasil:

- `pnpm qa:mvf:visibility` PASS.
- Warning `Missing vendor` tidak muncul lagi.
- Tidak ada perubahan runtime storefront.

## Risiko Tersisa

- `qa:public-release` belum bisa membuktikan product/order/coupon assertions sampai credential DB release/test valid tersedia.
- Repo masih bergantung pada operator lokal/CI untuk menyediakan DB yang sesuai.
- Warning Vite chunk size client masih ada, tetapi tidak terkait public-release DB readiness.

## Backlog yang Sengaja Ditunda

- Coupon Usage Ledger & Limits: STOP, butuh approval schema/model.
- Shared public product serializer: ditunda, refactor maintenance dan bukan blocker env gate.
- Attribute Runtime Validation: ditunda sampai public-release gate/env jelas.
- UI redesign Admin/Seller/Client: ditunda.

## Rekomendasi Task Berikutnya

Setelah owner/CI menyediakan DB release/test credential, jalankan ulang:

```powershell
$env:PUBLIC_RELEASE_SMOKE_ENV_FILE=".env.public-release"
pnpm qa:public-release
```

Jika command sudah melewati DB readiness tetapi gagal pada product/order/coupon assertion, buat task P0.6 lanjutan yang scope-nya hanya assertion failure tersebut, bukan perubahan environment.
