# SW-11 Owner Backfill Strategy

## 1. Executive Summary

Strategi yang direkomendasikan untuk repo `ecommerce-react` adalah **Opsi C: Hybrid**, yaitu:

- jalankan **one-time backfill script** untuk store existing
- tetap sediakan **lazy ensure fallback** untuk edge case setelah rollout
- **owner bridge tetap hidup** selama transisi dan belum dipensiunkan

Alasan utamanya:

- repo saat ini masih menjadikan `stores.owner_user_id` sebagai boundary ownership aktif
- seller access resolver sudah aman karena bisa fallback ke owner bridge
- `store_members` sudah punya constraint `UNIQUE(store_id, user_id)`, jadi backfill bisa dibuat idempotent
- halaman `Team` dan fondasi membership akan lebih berguna jika owner lama benar-benar punya row membership
- lazy-only tidak cukup untuk merapikan baseline data lama, sedangkan one-time-only tidak cukup aman untuk edge case baru

## 2. Current State

Current state seller access saat ini:

- `stores.owner_user_id` adalah sumber lama ownership
- `store_members` dan `store_roles` sudah ada
- seller access resolver:
  - cek `StoreMember ACTIVE` untuk `storeId + userId`
  - tetap fallback ke owner bridge jika `userId === stores.owner_user_id`
- owner bridge saat ini resolve menjadi:
  - `accessMode = OWNER_BRIDGE`
  - `roleCode = STORE_OWNER`
  - `membershipStatus = VIRTUAL_OWNER` jika belum ada row member
  - `membershipStatus = ACTIVE_MEMBER` jika row member owner sudah ada

Dampak kondisi sekarang:

- seller workspace tetap usable
- team shell sering kosong pada store lama
- membership foundation belum benar-benar aktif untuk owner
- mutation team belum aman dibuka karena baseline data membership belum rapi

## 3. Problem Statement

Masalah arsitektural yang harus diselesaikan:

- owner lama bisa masuk seller workspace tanpa row `store_members`
- data team terlihat kosong walau store sebenarnya punya owner valid
- fondasi membership belum bisa dianggap representatif untuk membuka management features
- kita butuh transisi ke membership tanpa:
  - mematikan owner bridge
  - mengubah `stores.owner_user_id`
  - memecah route/contract seller yang sudah aktif

## 4. Goals

- membuat owner existing punya row `store_members` aktif secara aman
- menjaga akses seller owner existing tetap hidup selama transisi
- menghindari duplicate membership
- menormalkan role owner ke `STORE_OWNER`
- membuat baseline data siap sebelum team mutation dibuka
- menjaga proses idempotent, retryable, dan backward-compatible

## 5. Non-goals

- tidak menghapus atau mengganti `stores.owner_user_id`
- tidak membuka invite/change role/disable member
- tidak memensiunkan owner bridge pada tahap ini
- tidak mengubah namespace seller workspace
- tidak mengubah permission storage strategy yang sudah dipilih
- tidak mengubah behavior route seller existing yang sudah aktif

## 6. Backfill Options Comparison

| Opsi | Ringkasan | Pro | Kontra | Risiko Inconsistency | Kompleksitas Operasional | Kecocokan |
|---|---|---|---|---|---|---|
| A. One-time backfill | Script sekali jalan untuk semua store existing | members baseline cepat rapi, mudah diaudit, cocok untuk report mode | edge case store baru setelah script bisa tetap kosong | medium | medium | cukup baik, tapi tidak cukup sendiri |
| B. Lazy ensure on access | Saat owner akses seller workspace, membership diensure | selalu on-demand, rollout ringan | data lama tetap tidak rapi sampai owner login, team shell tidak konsisten antartoko | medium-high | low-medium | kurang ideal sebagai strategi tunggal |
| C. Hybrid | One-time backfill + lazy ensure untuk edge case | baseline existing rapi, edge case tetap tertangani, paling aman untuk transisi panjang | butuh dua lapis mekanisme dan aturan yang jelas | low-medium | medium | paling cocok untuk repo ini |

### Opsi A — One-time migration/backfill script

Pro:

- paling jelas untuk membersihkan data store existing
- mudah dibuat dry-run/report mode
- mudah diverifikasi hasil total store sukses/gagal
- membuat Team shell langsung lebih representatif

Kontra:

- tidak menangani store baru atau store yang dibuat setelah script jalan
- jika ada kegagalan parsial, perlu rerun manual
- tanpa fallback tambahan, ada risiko drift baru muncul lagi

Risiko utama:

- owner invalid/null menyebabkan sebagian store gagal dibackfill
- mismatch role jika row owner sudah ada dengan role non-owner
- script besar sekali jalan bisa memerlukan monitoring operasional lebih ketat

### Opsi B — Lazy ensure on access

Pro:

- implementasi bertahap
- minim operasi bulk
- otomatis memperbaiki store yang benar-benar diakses seller

Kontra:

- data baseline tetap tidak merata
- store yang belum diakses owner tidak akan pernah ter-backfill
- halaman Team untuk store lama tetap kosong sampai owner login
- debugging jadi lebih sulit karena membership bisa muncul “diam-diam” saat access

Risiko utama:

- perilaku data bergantung pada traffic
- store lama yang belum pernah diakses seller tetap terlihat tidak punya team
- audit coverage buruk karena tidak ada snapshot sekali jalan

### Opsi C — Hybrid

Pro:

- one-time backfill merapikan data lama
- lazy ensure menjaga edge case tetap sinkron
- owner bridge tetap aman sebagai fallback
- paling seimbang untuk repo yang sedang transisi

Kontra:

- perlu aturan coexistence yang lebih disiplin
- perlu mencegah double-write antara script dan lazy ensure

Risiko utama:

- jika aturan idempotency longgar, bisa muncul mismatch role/status
- jika lazy ensure terlalu agresif, debugging perilaku transisi jadi kabur

## 7. Recommended Strategy

Strategi final yang direkomendasikan: **Hybrid**

Komposisinya:

1. **Phase 1**
   - siapkan backfill service/script dengan mode `dry-run`
   - audit store mana yang:
     - owner valid
     - owner invalid
     - owner sudah punya membership
     - owner punya membership tapi role mismatch

2. **Phase 2**
   - jalankan one-time backfill untuk store existing
   - create or normalize owner membership menjadi `STORE_OWNER`

3. **Phase 3**
   - tambahkan lazy ensure ringan untuk edge case
   - hanya aktif pada jalur owner bridge tertentu, bukan semua request membabi buta

4. **Phase 4**
   - observasi hasil dan pastikan team shell/context endpoint stabil
   - baru setelah itu siapkan mutation team read-write

Kenapa bukan one-time saja:

- repo ini masih bergerak
- seller workspace sudah hidup
- akan selalu ada peluang store baru atau store drift setelah backfill awal

Kenapa bukan lazy saja:

- terlalu lambat merapikan baseline existing
- tidak cukup baik untuk menyiapkan mutation team secara terkontrol

## 8. Data Rules

Aturan data yang harus dipakai saat implementasi nanti:

- owner store existing selalu dipetakan ke role `STORE_OWNER`
- `UNIQUE(store_id, user_id)` wajib dihormati
- jika row membership owner sudah ada:
  - jangan buat duplicate row
  - lakukan evaluasi normalisasi, bukan insert baru
- `status` hasil backfill untuk owner harus `ACTIVE`
- `created_at`/`updated_at` mengikuti waktu insert/update normal DB
- jika nanti ada field seperti `invitedByUserId`, untuk owner backfill harus `null`
- `joinedAt` secara logis mengikuti `created_at` row membership hasil backfill
- store tanpa `ownerUserId` valid:
  - jangan dipaksa dibuat member
  - masukkan ke anomaly report
- owner yang tidak punya user valid:
  - jangan dipaksa dibuat member
  - masukkan ke anomaly report

### Rule untuk mismatch

Jika ditemukan row `(store_id, user_id)` milik owner sudah ada tetapi:

- `status != ACTIVE`
- `role != STORE_OWNER`

maka rekomendasi:

- **normalize carefully**
- owner existing harus menang di level seller store membership
- hasil akhir yang diinginkan:
  - `status = ACTIVE`
  - `roleCode = STORE_OWNER`

Alasan:

- `stores.owner_user_id` masih boundary ownership resmi
- membership tidak boleh bertentangan dengan ownership boundary lama

## 9. Idempotency Rules

Implementasi backfill nanti wajib idempotent.

Aturan idempotency utama:

- setiap store diproses berdasarkan pasangan unik `(store_id, owner_user_id)`
- jika membership owner belum ada:
  - insert row baru
- jika membership owner sudah ada dan sudah benar:
  - no-op
- jika membership owner sudah ada tapi mismatch:
  - update ke state yang benar
- script boleh dijalankan ulang tanpa menciptakan duplicate row
- lazy ensure juga harus mengikuti aturan yang sama

Urutan lookup yang direkomendasikan:

1. resolve `STORE_OWNER` role id
2. baca store + owner
3. cari `store_members` by `(store_id, user_id)`
4. `insert` jika tidak ada
5. `normalize` jika ada tapi salah
6. skip jika sudah benar

## 10. Coexistence Rules

Selama transisi:

- seller access resolver tetap membaca membership aktif jika ada
- fallback ke owner bridge tetap dipertahankan jika membership owner belum ada
- owner bridge tidak boleh dipensiunkan sebelum:
  - backfill existing selesai
  - lazy ensure stabil
  - anomaly report tertangani
  - coverage membership owner mendekati penuh
  - team mutation selesai diuji

Rule coexistence yang direkomendasikan:

- jika user adalah owner store:
  - access tetap valid walau row membership belum ada
- jika row membership owner ada:
  - resolver boleh tetap return `accessMode = OWNER_BRIDGE` selama owner semantics lama masih dipertahankan
  - `membershipStatus` bisa `ACTIVE_MEMBER`
- migration ke full membership enforcement **belum boleh** dilakukan hanya karena membership rows sudah ada

Syarat minimum sebelum owner bridge boleh mulai dipensiunkan:

- semua owner valid sudah punya active membership
- owner anomaly list sudah kecil dan tertangani
- resolver sudah diuji dalam mode membership-first tanpa fallback regressions
- team management mutation sudah stabil di environment dev/staging

## 11. Failure / Recovery Strategy

Backfill wajib punya mode:

- `dry-run`
- `apply`
- `report`

Failure handling yang direkomendasikan:

- proses per store harus terisolasi
- jika satu store gagal, store lain tetap lanjut
- simpan hasil:
  - inserted
  - normalized
  - skipped
  - failed
  - invalid-owner

Recovery strategy:

- rerun aman karena idempotent
- failure store tertentu bisa diproses ulang terpisah
- anomaly owner invalid/null harus keluar sebagai report, bukan silent failure

## 12. Rollout Plan

### Rollout Phase 1 — Readiness

- buat service backfill owner membership
- buat dry-run report
- verifikasi `STORE_OWNER` role selalu tersedia
- verifikasi jumlah store dengan owner valid vs invalid

### Rollout Phase 2 — Dry Run

- jalankan dry-run di dev/staging
- hasil minimal:
  - total store scanned
  - insert candidates
  - normalize candidates
  - invalid-owner cases
  - existing-correct cases

### Rollout Phase 3 — Controlled Apply

- jalankan apply mode
- create/normalize owner membership
- jangan ubah `stores.owner_user_id`
- jangan matikan owner bridge

### Rollout Phase 4 — Lazy Ensure Edge Case

- aktifkan lazy ensure ringan pada jalur owner bridge tertentu
- hanya ensure owner membership bila:
  - user adalah owner valid
  - store role `STORE_OWNER` tersedia
- tetap no-op jika row sudah benar

### Rollout Phase 5 — Observation

- validasi:
  - team shell
  - context endpoint
  - profile/orders/payment read modules
- pastikan tidak ada regressi seller access

### Rollout Phase 6 — Next Domain

- baru setelah itu lanjut ke task mutation team awal

## 13. Acceptance Criteria for Future Implementation

Implementasi backfill nanti dianggap siap jika:

- ada dry-run mode yang tidak mengubah data
- ada apply mode yang idempotent
- owner valid dibackfill menjadi `ACTIVE STORE_OWNER` membership
- duplicate row tidak tercipta
- role mismatch owner dinormalisasi
- store dengan owner invalid/null masuk anomaly report
- seller access existing tetap lolos via owner bridge bila membership belum ada
- endpoint seller context/team tetap bekerja sebelum dan sesudah backfill
- rerun backfill aman dan hasilnya stabil

## 14. Recommendation for Next Task

Task berikutnya yang paling aman:

- implement **owner membership backfill service + dry-run report**

Scope yang direkomendasikan untuk task implementasi berikut:

- service/helper backend, bukan UI
- satu command/script khusus
- belum membuka mutation team
- belum memensiunkan owner bridge

Urutan terbaik:

1. implement backfill service internal
2. implement dry-run + report output
3. implement apply mode
4. validasi team shell dan context endpoint
5. baru rencanakan team mutation

## OWNER BACKFILL STRATEGY RECOMMENDATION

1. Strategi final yang dipilih:
   - **Opsi C: Hybrid**

2. Apakah backfill sebaiknya one-time, lazy, atau hybrid:
   - **Hybrid**
   - one-time backfill untuk baseline existing
   - lazy ensure untuk edge case/store drift setelah rollout

3. Aturan idempotency utama:
   - gunakan pasangan unik `(store_id, user_id)`
   - insert hanya jika row owner belum ada
   - normalize jika row owner ada tapi role/status salah
   - no-op jika row owner sudah benar

4. Bagaimana owner bridge tetap dipertahankan sementara:
   - resolver tetap fallback ke `stores.owner_user_id`
   - owner bridge tidak dipensiunkan sampai coverage membership owner stabil dan mutation team siap

5. Risiko paling kritis:
   - owner membership sudah ada tapi role/status mismatch terhadap `stores.owner_user_id`

6. Apakah siap lanjut ke task implementasi backfill:
   - **YA**
