# Task 5B - Release Candidate Final Checklist + DB Env Readiness + Rollback Playbook

Tanggal: 2026-04-10

## 1. Ringkasan Eksekusi

Yang diaudit:
- `tools/qa/public-release-smoke.ts`.
- Production startup path `pnpm -F server start:prod`.
- DB/env dependency yang dipakai gate release.
- Existing `reports/final-release-checklist.md`.

Yang dirapikan:
- DB readiness preflight ditambahkan sebelum build/boot smoke.
- Failure DB sekarang diklasifikasikan sebagai env/readiness blocker yang actionable.
- Final RC checklist dan rollback playbook dibuat.
- Final release checklist existing diperbarui agar sesuai dengan request-id diagnostics dan client bundle hardening terbaru.

Scope perubahan:
- QA/release tooling dan dokumen operasional.
- Tidak ada perubahan contract checkout/order/payment.
- Tidak ada schema migration, secret, dashboard, atau refactor deployment besar.

## 2. Temuan Utama

| Area | Temuan | Dampak |
| --- | --- | --- |
| `qa:public-release` | Env validation ada, tetapi DB credential salah baru terlihat saat `start:prod` | Failure terlihat seperti boot/app failure, padahal env readiness |
| DB env | Gate bergantung pada `DATABASE_URL` atau `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | Operator butuh pesan yang menunjuk credential/connectivity |
| Checklist release | Checklist lama masih menyebut client chunk warning besar sebagai residual | Sudah berkurang di Task 4A; checklist perlu disesuaikan |
| Rollback | Belum ada playbook singkat yang menghubungkan smoke, request id, dan checkout/payment incident | Incident response kurang praktis |

## 3. Perubahan yang Dilakukan

### Release Gate / Smoke

File: `tools/qa/public-release-smoke.ts`

Perubahan:
- Menambahkan DB readiness preflight memakai env yang sama dengan production boot.
- Menjalankan `SELECT 1` sebelum build dan `start:prod`.
- Tidak mencetak password atau full secret.
- Mengklasifikasikan error umum:
  - `ER_ACCESS_DENIED_ERROR`
  - `ER_BAD_DB_ERROR`
  - `ENOTFOUND` / `EAI_AGAIN`
  - `ECONNREFUSED` / `ETIMEDOUT`

Behavior akhir:
- Jika DB env valid, gate lanjut ke build, production boot, health, dan app smoke.
- Jika DB env invalid, gate gagal lebih awal dengan pesan yang jelas dan actionable.

### Env/Readiness Preflight

Critical env:
- `JWT_SECRET`
- `AUTH_COOKIE_NAME`
- `DATABASE_URL` atau `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `COOKIE_SECURE`, `CLIENT_URL`/`CORS_ORIGIN`, public base URL, dan `UPLOAD_DIR` tetap diperlakukan sebagai warning/operational readiness sesuai topology.

### Final Checklist

File:
- `reports/release-candidate-final-checklist-05b-20260410.md`
- `reports/final-release-checklist.md`

Isi utama:
- Go/no-go criteria.
- Env gate.
- Automated gate.
- Manual spot check Admin/Seller/Client/Ops.
- Request diagnostics sanity.

### Rollback Playbook

File:
- `reports/release-rollback-playbook-05b-20260410.md`

Isi utama:
- Kapan stop sebelum deploy.
- Gejala yang memicu rollback setelah deploy.
- Langkah rollback dasar.
- Verifikasi setelah rollback.
- Cara investigasi checkout/payment incident memakai `X-Request-Id` dan `[operational-audit]`.

## 4. Dampak Bisnis

- Confidence release meningkat karena DB/env blocker diklasifikasikan sebelum dianggap regression aplikasi.
- Gate otomatis lebih dapat dipercaya: env invalid berhenti cepat; env valid tetap menjalankan build/boot/smoke utama.
- Operator punya checklist dan rollback playbook yang langsung bisa dipakai sebelum dan setelah deploy.
- Risiko incident checkout/payment lebih cepat ditriage karena playbook mengarah ke request id dan audit log.

## 5. Known Limitations

| Status | Item | Catatan |
| --- | --- | --- |
| selesai | DB readiness preflight | Sudah membedakan credential/connectivity failure dari app regression. |
| selesai | Final RC checklist | Checklist baru dibuat dan checklist lama diperbarui. |
| selesai | Rollback playbook | Playbook singkat dibuat. |
| [!] | `qa:public-release` di env lokal saat ini | Masih gagal karena `root@localhost:3306/ecommerce_dev` ditolak; perlu credential DB valid di env lokal/staging. |
| [!] | Infra/pipeline | Tidak mengubah CI/CD, secret management, atau backup/restore DB. |
| belum | Full pass ulang | Menunggu env DB valid; patch sudah membuat failure lebih actionable. |

## 6. Checklist Status

- selesai - Audit `qa:public-release`.
- selesai - DB/env readiness preflight ditambahkan.
- selesai - Failure mode DB access denied menjadi eksplisit dan actionable.
- selesai - Final RC checklist dibuat.
- selesai - Rollback/readiness playbook dibuat.
- selesai - `pnpm -F server build` lulus.
- selesai - `pnpm -F server smoke:request-diagnostics` lulus.
- [!] butuh keputusan - Env DB valid untuk staging/public release harus disediakan oleh operator/deployer agar `pnpm qa:public-release` bisa pass penuh.

## Verifikasi

Command:
- `pnpm -F server build` - lulus.
- `pnpm -F client build` - lulus.
- `pnpm -F server smoke:request-diagnostics` - lulus.
- `pnpm qa:public-release` - gagal sesuai expected readiness: `DB readiness failed: access denied for root@localhost:3306/ecommerce_dev. Verify DB_USER/DB_PASS or DATABASE_URL...`

Residual blocker:
- DB credential env lokal/staging untuk full `pnpm qa:public-release` belum valid di environment saat ini.

## Rekomendasi Task Berikutnya

Task berikutnya:
- Jalankan `pnpm qa:public-release` pada staging env dengan DB credential valid.
- Jika sudah pass, tag RC dan arsipkan output smoke sebagai release evidence.
- Jika masih gagal, treat failure sebagai release blocker spesifik berdasarkan classification gate.
