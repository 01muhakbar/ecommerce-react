# SW-22 Re-Invite / Restore Design

## 1. Executive Summary

`REMOVED` sekarang sudah menjadi status runtime nyata di Seller Workspace karena flow decline memakai transisi:

- `INVITED -> REMOVED`

Untuk repo `ecommerce-react`, semantics paling aman adalah:

- `REMOVED` diperlakukan sebagai **historical closed membership row**
- row `REMOVED` **tetap dipakai**, bukan dibuat row baru
- lane runtime berikutnya yang paling aman adalah **re-invite**, bukan restore umum
- re-invite direkomendasikan sebagai:
  - `REMOVED -> INVITED`
  - dengan actor memilih role target baru secara eksplisit

Restore umum tidak direkomendasikan sebagai langkah berikutnya karena terlalu ambigu:

- `REMOVED` saat ini berasal dari decline invitation, bukan dari offboarding operasional penuh
- restore langsung ke `ACTIVE` atau `DISABLED` akan mencampur semantics undangan, acceptance, dan operational membership

## 2. Current State

Lifecycle membership yang sudah aktif:

- `INVITED`
- `ACTIVE`
- `DISABLED`
- `REMOVED`

Flow runtime yang sudah aktif:

- attach existing user as `ACTIVE`
- change role non-owner
- disable/reactivate non-owner
- invite existing registered user -> `INVITED`
- accept invite -> `ACTIVE`
- decline invite -> `REMOVED`

Invariants penting repo saat ini:

- `store_members` punya unique `(store_id, user_id)`
- access resolver hanya menganggap `ACTIVE` sebagai sumber akses seller
- inbox invitation hanya membaca `INVITED`
- `REMOVED` belum punya lane runtime lanjutan
- audit trail sudah mencatat:
  - `TEAM_MEMBER_INVITE`
  - `TEAM_MEMBER_INVITE_ACCEPT`
  - `TEAM_MEMBER_INVITE_DECLINE`

## 3. Why `REMOVED` Needs Formal Semantics

Tanpa semantics yang tegas, lane berikutnya akan berbahaya karena beberapa pertanyaan inti belum dijawab:

- apakah `REMOVED` itu terminal?
- apakah row lama boleh dipakai lagi?
- apakah actor harus memilih role baru saat mengundang ulang?
- apakah `REMOVED` dari decline sama artinya dengan `REMOVED` dari remove operasional masa depan?

Karena unique `(store_id, user_id)` sudah aktif, runtime lane berikutnya tidak bisa mengandalkan pembuatan row baru secara naif.

## 4. Options Comparison

### Option A — Re-invite = mutate row `REMOVED -> INVITED`

Pro:

- paling cocok dengan unique `(store_id, user_id)`
- tidak perlu redesign constraint
- history membership tetap terpusat di satu row
- paling kecil dampaknya ke query existing

Contra:

- satu row akan memuat beberapa lifecycle event sepanjang waktu
- perlu audit trail yang disiplin agar riwayat tetap jelas

Dampak ke repo sekarang:

- sangat cocok
- paling kecil perubahan DB/runtime-nya

### Option B — Restore = mutate row `REMOVED -> DISABLED/ACTIVE/INVITED`

Pro:

- fleksibel untuk berbagai use case

Contra:

- terlalu ambigu untuk fase sekarang
- `REMOVED` hasil decline belum seharusnya lompat langsung ke `ACTIVE`
- membuka restore umum terlalu dekat ke remove/offboarding semantics yang belum didesain

Dampak ke repo sekarang:

- berisiko membingungkan API dan UI
- tidak cocok sebagai lane pertama

### Option C — Re-invite = buat row membership baru

Pro:

- history per-attempt lebih bersih secara konseptual

Contra:

- bentrok langsung dengan unique `(store_id, user_id)`
- butuh redesign constraint atau soft-delete strategy yang belum ada
- memicu perubahan lebih besar pada access dan audit queries

Dampak ke repo sekarang:

- tidak aman

### Option D — Hybrid berdasarkan asal `REMOVED`

Contoh:

- `REMOVED` dari decline -> re-invite row lama
- `REMOVED` dari remove operasional -> semantics berbeda

Pro:

- lebih ekspresif jangka panjang

Contra:

- sekarang belum ada pembeda reason/source `REMOVED`
- akan memaksa metadata tambahan lebih awal

Dampak ke repo sekarang:

- terlalu cepat untuk saat ini

## 5. Recommended Semantics

Rekomendasi final:

- `REMOVED` diperlakukan sebagai **closed non-access membership with preserved history**
- row `REMOVED` **bukan terminal secara absolut**
- tetapi lane aktif berikutnya harus sempit:
  - **re-invite row lama**
  - bukan restore umum

Makna praktis:

- `REMOVED` hasil decline tetap dianggap historical closure
- jika store ingin mengundang user yang sama lagi, sistem memakai row lama
- sistem mengubah row lama:
  - `REMOVED -> INVITED`
- lalu user harus menerima ulang melalui flow accept yang sama

Kenapa ini paling aman:

- sesuai unique `(store_id, user_id)`
- tidak perlu row baru
- tidak mengaktifkan akses secara diam-diam
- tetap menjaga acceptance sebagai gerbang aktivasi akses

## 6. Unique Constraint / Data Model Implications

Karena `uq_store_members_store_user` sudah aktif:

- row baru untuk user yang sama di store yang sama **tidak boleh** dibuat
- lane re-invite yang aman harus **update row existing**

Implikasi desain:

- duplicate prevention tetap sederhana
- query membership tetap satu-row-per-user-per-store
- history harus dibaca dari audit, bukan dari multiple membership rows

Keputusan data model:

- tidak perlu ubah constraint untuk phase berikutnya
- tidak perlu hard delete row `REMOVED`
- tidak perlu secondary history table untuk membuka lane re-invite pertama

## 7. Role Handling Recommendation

Untuk re-invite membership `REMOVED`, actor harus memilih role target secara eksplisit.

Rekomendasi:

- role lama boleh dipakai sebagai **default suggestion** di UI nanti
- tetapi backend tetap menerima dan memvalidasi role target baru
- jangan otomatis reuse role lama tanpa input actor

Alasan:

- saat user diundang ulang, kebutuhan store bisa berubah
- mengurangi surprise behavior
- tetap konsisten dengan invite lane existing yang selalu eksplisit soal role

## 8. Audit Trail Recommendation

Audit action yang direkomendasikan untuk phase berikutnya:

- `TEAM_MEMBER_REINVITE`

Tidak direkomendasikan memakai:

- `TEAM_MEMBER_RESTORE`

untuk lane pertama, karena istilah restore terlalu umum dan ambigu.

Before/after minimum:

- before:
  - `roleCode`
  - `status: REMOVED`
- after:
  - `roleCode`
  - `status: INVITED`

Jika role berubah saat re-invite, audit harus menangkap itu secara eksplisit.

## 9. Future Compatibility Notes

Compatibility dengan flow existing:

- invite inbox tetap hanya membaca `INVITED`
- accept flow existing tetap dipakai tanpa perubahan besar
- decline flow existing tetap valid
- access resolver tetap aman karena hanya `ACTIVE` yang memberi akses

Compatibility dengan future remove flow:

- untuk saat ini, semantics `REMOVED` decline dan `REMOVED` remove operasional **boleh disamakan**
- alasan:
  - belum ada runtime remove operasional
  - belum ada kebutuhan mendesak untuk membedakan source
  - audit trail sudah cukup untuk mengetahui action yang menyebabkan state

Jika nanti remove operasional dibuka dan butuh pembedaan lebih kaya, pertimbangan berikut bisa ditambah:

- `removedReason`
- `removedSource`

Tetapi itu belum perlu sekarang.

## 10. Transition Matrix Recommendation

### Transition yang direkomendasikan

| From | To | Valid | Catatan |
|---|---|---:|---|
| `REMOVED` | `INVITED` | Ya | Lane berikutnya paling aman. |
| `REMOVED` | `ACTIVE` | Tidak | Terlalu bypass acceptance. |
| `REMOVED` | `DISABLED` | Tidak | Ambigu dan tidak actionable untuk inbox. |

### Tambahan aturan

- `REMOVED -> INVITED` harus dilakukan oleh actor seller yang berwenang
- target role divalidasi ulang saat re-invite
- `acceptedAt` harus dikosongkan kembali saat re-invite
- `removedAt` dan `removedByUserId` boleh dipertahankan sebagai historical metadata, atau dikosongkan hanya jika ada keputusan eksplisit; untuk next step yang aman, **biarkan audit menjadi sumber history dan reset field status-operasional hanya jika memang dibutuhkan endpoint**

Rekomendasi praktis untuk lane runtime nanti:

- update row ke `INVITED`
- set `invitedAt` baru
- set `invitedByUserId` baru
- set `acceptedAt = null`
- pertahankan atau reset `removedAt/removedByUserId` harus diputuskan eksplisit saat task implementasi; default aman:
  - **reset field operasional row**
  - history tetap di audit trail

## 11. API Readiness Draft

Lane berikutnya yang direkomendasikan:

- `POST /api/seller/stores/:storeId/members/:memberId/reinvite`

Alternatif yang juga aman:

- re-use endpoint invite existing user existing, tetapi dengan branch khusus saat row existing berstatus `REMOVED`

Rekomendasi lebih baik:

- endpoint eksplisit `reinvite`

Alasan:

- semantics lebih jelas
- error handling lebih bersih
- lebih mudah diaudit dan diuji

Error codes yang direkomendasikan:

- `MEMBER_NOT_FOUND`
- `MEMBER_STATUS_TRANSITION_FORBIDDEN`
- `MEMBER_ALREADY_ACTIVE`
- `MEMBER_ALREADY_INVITED`
- `INVALID_STORE_ROLE`
- `ROLE_CHANGE_FORBIDDEN`
- `OWNER_MUTATION_FORBIDDEN`

## 12. Rollout Recommendation

Urutan rollout paling aman:

1. Planning selesai untuk re-invite semantics
2. Implement runtime lane `REMOVED -> INVITED`
3. Pakai audit action baru `TEAM_MEMBER_REINVITE`
4. Reuse inbox + accept flow existing
5. Tunda restore umum sampai future remove semantics benar-benar dibutuhkan

Yang tidak direkomendasikan sekarang:

- membuka `REMOVED -> ACTIVE`
- membuka generic restore endpoint
- membedakan jenis `REMOVED` lewat schema baru

## 13. Acceptance Criteria for Future Implementation

Task implementasi berikutnya dianggap benar jika:

- re-invite untuk member `REMOVED` memakai row lama
- unique `(store_id, user_id)` tetap aman
- hasil re-invite menjadi `INVITED`
- user tidak punya akses seller sampai accept ulang
- inbox kembali menampilkan invitation yang diundang ulang
- audit `TEAM_MEMBER_REINVITE` tercatat
- flow existing accept/decline tidak rusak

## 14. Next Task Recommendation

Task berikutnya paling aman:

- implement **runtime re-invite lane** untuk membership `REMOVED`

Tidak direkomendasikan sebagai next step:

- generic restore
- history viewer besar
- remove operasional umum

Alasan:

- re-invite paling sesuai dengan semantics yang sudah aktif
- memanfaatkan inbox + accept flow yang sudah ada
- perubahan tetap sempit dan non-breaking

