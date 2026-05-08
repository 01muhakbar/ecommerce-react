# SW-17 Invitation Lifecycle Design

## 1. Executive Summary

Seller Workspace sudah punya fondasi membership yang stabil untuk phase 1:

- attach existing registered user by email sebagai `ACTIVE`
- change role non-owner
- disable/reactivate non-owner
- owner backfill sudah hidup
- audit trail team sudah aktif

Lifecycle invitation yang lebih lengkap memang dibutuhkan, tetapi **tidak aman dibuka sekaligus**. Rekomendasi final untuk repo `ecommerce-react` adalah:

- pertahankan phase 1 apa adanya sebagai baseline aman
- desain target status model menjadi:
  - `INVITED`
  - `ACTIVE`
  - `DISABLED`
  - `REMOVED`
- buka evolusi secara bertahap
- **mulai dari invitation untuk existing registered user lebih dulu**
- tunda undangan untuk email yang belum punya akun sampai acceptance flow dan schema benar-benar siap

Strategi final yang direkomendasikan:

- **hybrid lifecycle with staged rollout**
- phase berikutnya yang paling aman adalah:
  - schema evolution dulu
  - lalu `INVITED` support untuk **existing registered user only**
  - baru setelah itu acceptance flow

## 2. Current State

Current state domain team saat ini:

- `store_members` sudah aktif
- `store_roles` sudah aktif
- owner existing sudah dibackfill menjadi `STORE_OWNER + ACTIVE`
- owner bridge fallback masih hidup
- mutation phase 1 sudah runtime-validated
- audit trail team mutation sudah tercatat di `store_audit_logs`
- audit viewer read-only sudah ada

Current persistence reality:

- `store_members.status` sekarang masih subset lama:
  - `ACTIVE`
  - `INACTIVE`

Current API surface untuk phase 1:

- seller team API menampilkan:
  - `ACTIVE`
  - `DISABLED`
- mapping aktif sekarang:
  - persistence `ACTIVE -> API ACTIVE`
  - persistence `INACTIVE -> API DISABLED`

Current hard boundary:

- `STORE_OWNER` tidak boleh masuk lifecycle normal invite/remove
- invitation email flow belum ada
- token acceptance flow belum ada
- `INVITED` dan `REMOVED` belum punya representasi persistence yang nyata

## 3. Why Invitation Lifecycle Is Needed

Lifecycle invitation dibutuhkan karena phase 1 saat ini hanya mencakup skenario yang paling sederhana:

- target user sudah punya akun
- membership langsung `ACTIVE`
- disable/reactivate masih bersifat operational toggle

Gap yang belum tertutup:

- belum ada status “menunggu diterima”
- belum ada re-invite semantics
- belum ada status “removed” yang jelas
- belum ada cara aman mengundang email yang belum terdaftar
- belum ada acceptance flow yang memisahkan:
  - undangan
  - aktivasi membership
  - disable
  - removal

Tanpa lifecycle yang eksplisit, domain team akan sulit berkembang ke:

- onboarding member yang lebih realistis
- audit trail yang lebih dapat dijelaskan
- UX team management yang tidak membingungkan

## 4. Target Membership Status Model

Status model jangka menengah yang direkomendasikan:

- `INVITED`
- `ACTIVE`
- `DISABLED`
- `REMOVED`

Makna tiap status:

### `INVITED`

- user sudah dialokasikan ke store dan role tertentu
- akses seller belum aktif
- menunggu acceptance flow

### `ACTIVE`

- membership aktif
- access resolver boleh memakai row ini untuk seller access

### `DISABLED`

- membership tetap ada
- history tetap ada
- access ditutup sementara
- bisa direactivate

### `REMOVED`

- membership tidak lagi aktif dan tidak dianggap member berjalan
- history tetap ada
- tidak dipakai untuk access resolver normal
- restore semantics perlu keputusan terpisah

## 5. Compatibility With Current Phase 1

Compatibility principle:

- phase 1 route dan behavior existing **tetap hidup**
- tidak ada breaking change pada:
  - attach existing user as `ACTIVE`
  - role change non-owner
  - disable/reactivate non-owner

Compatibility mapping yang direkomendasikan:

- phase 1 attach tetap menciptakan member `ACTIVE`
- status API phase 1 tetap:
  - `ACTIVE`
  - `DISABLED`
- persistence lama tetap dipakai sampai schema evolution benar-benar dilakukan

Makna praktisnya:

- invitation lifecycle baru **menambah lane baru**
- bukan mengganti semantics phase 1 yang sudah aktif

Backward compatibility rules:

- existing route `POST /api/seller/stores/:storeId/members` tetap dianggap “direct attach”
- existing role/status mutation tetap bekerja untuk member `ACTIVE` atau `DISABLED`
- access resolver tetap hanya menganggap member aktif sebagai source of truth
- owner bridge fallback tetap tidak berubah

## 6. Invitation Options Comparison

### Option A: Invite existing registered user only

Flow:

- actor memasukkan email user yang sudah ada
- system membuat row `INVITED`
- user login lalu accept invitation

Pro:

- paling cocok dengan auth system existing
- tidak perlu membuka account pre-registration binding lebih awal
- duplicate detection lebih sederhana
- risiko identity mismatch lebih rendah

Contra:

- belum meng-cover merchant yang ingin mengundang email baru
- onboarding terasa lebih manual

Fit untuk repo ini:

- **fit terbaik untuk next phase**

### Option B: Invite by email even if user not registered

Flow:

- system membuat invitation ke email eksternal
- user mendaftar belakangan dan meng-claim invitation

Pro:

- UX bisnis lebih lengkap
- lebih dekat ke marketplace mature flow

Contra:

- perlu token, expiry, claim flow, account linking, race condition handling
- jauh lebih besar scope-nya
- rawan mismatch jika email terdaftar belakangan dengan kondisi berbeda

Fit untuk repo ini:

- **terlalu besar untuk next phase**

### Option C: Hybrid

Flow:

- phase awal dukung existing registered user dulu
- phase berikutnya baru buka unregistered-email invite

Pro:

- rollout aman
- arsitektur tetap punya jalur evolusi penuh
- tidak memaksa refactor auth lebih awal

Contra:

- ada dua tahap implementasi
- perlu dokumentasi semantik yang disiplin

Fit untuk repo ini:

- **opsi final yang direkomendasikan**

## 7. Recommended Lifecycle Strategy

Strategi final:

- **Option C: Hybrid staged invitation lifecycle**

Urutan strategis:

1. Pertahankan phase 1 direct attach tetap hidup
2. Tambahkan schema readiness untuk `INVITED`
3. Buka invite flow untuk existing registered user only
4. Tambahkan acceptance flow
5. Baru evaluasi invite untuk email yang belum punya akun

Keputusan penting:

- `POST /members` existing tidak diubah menjadi invite otomatis
- invite flow nanti harus memakai endpoint baru
- direct attach dan invite flow boleh coexist

Kenapa ini paling aman:

- tidak merusak mutation phase 1 yang sudah aktif
- tidak memaksa perubahan besar di auth
- tidak mematahkan owner bridge, team shell, audit trail, atau access resolver

## 8. Status Transition Matrix

### Transition valid yang direkomendasikan

| From | To | Valid | Catatan |
|---|---|---:|---|
| `INVITED` | `ACTIVE` | Ya | Setelah acceptance berhasil |
| `INVITED` | `REMOVED` | Ya | Invite dibatalkan/ditutup |
| `ACTIVE` | `DISABLED` | Ya | Phase 1 semantics existing |
| `DISABLED` | `ACTIVE` | Ya | Phase 1 semantics existing |
| `ACTIVE` | `REMOVED` | Ya | Future remove semantics |
| `REMOVED` | `INVITED` | Ya | Re-invite sebagai lifecycle baru |
| `REMOVED` | `ACTIVE` | Tidak langsung | Lewat re-invite atau restore policy eksplisit |
| `DISABLED` | `INVITED` | Tidak | Semantics membingungkan |
| `INVITED` | `DISABLED` | Tidak | Invite belum pernah active |
| `REMOVED` | `DISABLED` | Tidak | Tidak ada nilai operasional yang jelas |

### Transition invalid yang harus ditolak

- `STORE_OWNER` ke status apa pun selain tetap active protected
- self remove
- self disable bila rule operational masih sama
- mutation apa pun terhadap owner melalui lane invite/remove normal

## 9. Re-invite / Reactivate / Remove Rules

### Re-invite rules

#### User already `ACTIVE`

- reject
- code: `MEMBER_ALREADY_ACTIVE`

#### User already `INVITED`

- default: reject sebagai duplicate invite
- opsional: allow resend tanpa membuat row baru
- code: `MEMBER_ALREADY_INVITED`

#### User `DISABLED`

- jangan buat invitation baru
- gunakan reactivate jika maksudnya mengaktifkan kembali member lama
- code bila memakai invite endpoint:
  - `MEMBER_REACTIVATION_REQUIRED`

#### User `REMOVED`

- boleh di-reinvite
- tapi harus reuse row atau create lifecycle baru secara konsisten
- rekomendasi repo ini:
  - **reuse row existing** lebih aman daripada hard-create row baru karena ada unique `(store_id, user_id)`
  - ubah state `REMOVED -> INVITED` dengan metadata invite baru

#### Email belum terdaftar

- untuk next phase:
  - reject
  - code: `INVITE_EMAIL_NOT_REGISTERED`
- baru dibuka di phase yang lebih matang

#### Email terdaftar tapi role target berbeda

- jika existing membership `INVITED`, update role hanya bila actor memang punya hak
- jika existing membership `ACTIVE`, jangan lewat invite flow; gunakan role change flow biasa

### Reactivate rules

- tetap lane terpisah dari invite
- `DISABLED -> ACTIVE`
- tidak perlu token

### Remove rules

Rekomendasi remove semantics:

- **soft status `REMOVED`**
- bukan hard delete

Pro:

- audit/history utuh
- unique `(store_id, user_id)` tetap menjaga satu identity lane per store
- restore/reinvite lebih mudah

Contra:

- status machine lebih kompleks
- query active member harus lebih disiplin

Keputusan final:

- `REMOVED` sebaiknya **soft status**, bukan hard delete

## 10. Schema Evolution Recommendation

### Apakah schema evolution perlu?

- **Ya, tetapi bukan di task ini**

### Field/status yang direkomendasikan

Perluasan minimal yang direkomendasikan untuk `store_members`:

- `status` enum diperluas menjadi:
  - `INVITED`
  - `ACTIVE`
  - `DISABLED`
  - `REMOVED`

Field tambahan yang direkomendasikan:

- `invited_by_user_id`
- `invited_at`
- `invite_expires_at`
- `accepted_at`
- `removed_at`
- `removed_by_user_id`

Field yang **belum perlu** untuk next safest phase:

- `invite_token`
- `invite_token_hash`

Alasannya:

- kalau phase berikutnya hanya existing-registered-user invite + in-app acceptance, token belum wajib
- token baru wajib saat membuka email-driven acceptance yang lebih luas

### Kapan field-field itu dibutuhkan

Perlu lebih dulu:

- `status` expansion
- `invited_by_user_id`
- `invited_at`
- `accepted_at`
- `removed_at`
- `removed_by_user_id`

Boleh ditunda:

- `invite_expires_at`
- `invite_token`
- `invite_token_hash`

## 11. API Readiness Draft

### `POST /api/seller/stores/:storeId/members/invite`

Purpose:

- membuat membership `INVITED`

Initial safe scope:

- existing registered user only

Body draft:

```json
{
  "email": "staff@brand.com",
  "roleCode": "ORDER_MANAGER"
}
```

### `POST /api/seller/stores/:storeId/members/:memberId/resend-invite`

Purpose:

- resend notification atau refresh invite metadata

Catatan:

- hanya meaningful jika `INVITED` sudah hidup

### `POST /api/seller/stores/:storeId/members/:memberId/accept`

Purpose:

- ubah `INVITED -> ACTIVE`

Readiness note:

- untuk existing registered user, acceptance idealnya butuh:
  - auth user
  - valid target membership
  - membership user cocok dengan current user

### `PATCH /api/seller/stores/:storeId/members/:memberId/status`

Current:

- dipakai untuk `ACTIVE / DISABLED`

Future:

- jangan overload endpoint ini untuk semua semantics invite/remove
- rekomendasi:
  - tetap pakai untuk operational status
  - jangan pakai untuk accept invite

### Remove endpoint

Draft yang direkomendasikan:

- `POST /api/seller/stores/:storeId/members/:memberId/remove`

Alasan:

- lebih eksplisit daripada `DELETE`
- karena remove adalah soft lifecycle mutation, bukan hard delete

## 12. Error Code Recommendation

Error code masa depan yang direkomendasikan:

- `MEMBER_ALREADY_INVITED`
- `MEMBER_ALREADY_ACTIVE`
- `MEMBER_ALREADY_DISABLED`
- `MEMBER_ALREADY_REMOVED`
- `MEMBER_REACTIVATION_REQUIRED`
- `INVITE_EMAIL_NOT_REGISTERED`
- `INVITE_TOKEN_INVALID`
- `INVITE_TOKEN_EXPIRED`
- `INVALID_MEMBER_STATUS_TRANSITION`
- `MEMBER_REMOVE_FORBIDDEN`
- `OWNER_MUTATION_FORBIDDEN`
- `SELF_MUTATION_FORBIDDEN`
- `ROLE_CHANGE_FORBIDDEN`
- `SELLER_FORBIDDEN`
- `INVALID_STORE_ROLE`

## 13. Rollout Strategy

### Phase A

- keep phase 1 as-is
- direct attach existing user as `ACTIVE`
- role change non-owner
- disable/reactivate non-owner

### Phase B

- schema evolution untuk status lifecycle
- add `INVITED` support
- invite existing registered user only
- belum ada unregistered-email invite

### Phase C

- add accept invitation flow
- login required
- in-app acceptance lebih aman daripada email-token flow dulu

### Phase D

- baru evaluasi unregistered-email invite
- add token/expiry/account-linking jika benar-benar dibutuhkan

## 14. Acceptance Criteria for Future Implementation

Invitation phase berikutnya dianggap siap bila:

- schema evolution sudah jelas dan non-breaking
- phase 1 route tetap aman
- direct attach tetap hidup
- `INVITED` row tidak dipakai sebagai access source
- only `ACTIVE` membership yang membuka access seller
- duplicate/reinvite/reactivate/remove semantics jelas
- owner protection tetap utuh
- audit trail bisa mencatat invite lifecycle baru

## 15. Recommendation for Next Task

Lowest-risk next step:

- **schema evolution planning/mapping dulu**

Lebih aman daripada langsung membuka invite flow, karena:

- status machine sekarang masih subset phase 1
- tanpa schema yang benar, `INVITED` dan `REMOVED` akan jadi semantik palsu
- direct attach phase 1 perlu dijaga tetap kompatibel

Next task paling aman yang direkomendasikan:

1. `SW-18-INVITATION-SCHEMA-DELTA`
2. lalu `existing-user invite flow design-to-implementation`
3. baru setelah itu acceptance flow

## INVITATION LIFECYCLE DESIGN RECOMMENDATION

1. Strategi lifecycle final yang dipilih:
   - `Hybrid staged lifecycle`

2. Status model yang direkomendasikan:
   - `INVITED`
   - `ACTIVE`
   - `DISABLED`
   - `REMOVED`

3. Apakah schema evolution diperlukan sekarang atau nanti:
   - `Diperlukan, tetapi sebagai langkah berikutnya sebelum implementasi invite penuh`

4. Langkah implementasi berikutnya paling aman:
   - schema evolution recommendation/delta mapping dulu

5. Risiko paling kritis:
   - memaksa `INVITED` dan `REMOVED` tanpa schema evolution akan membingungkan access logic dan merusak kejelasan phase 1

6. Apakah siap lanjut ke task implementasi invitation phase berikutnya:
   - `YA`, tetapi hanya jika langkah berikutnya adalah schema evolution, bukan langsung invitation flow penuh
