# SW-13 Team Mutation Readiness

## 1. Executive Summary

Mutation phase 1 **aman dibuka secara terbatas**, tetapi hanya jika dibatasi pada operasi non-owner dan mengikuti guardrail ketat.

Rekomendasi final untuk phase 1:

- `invite member` hanya untuk **existing user by email**
- membership baru langsung dibuat sebagai **ACTIVE**
- `change role` hanya untuk **non-owner**
- `disable member` hanya untuk **non-owner**
- `STORE_OWNER` mutation tetap ditutup
- `ownership transfer` tetap di luar scope
- `INVITED` dan `REMOVED` tetap menjadi **future state**, belum dipakai di phase 1 karena schema sekarang belum mendukungnya secara eksplisit

## 2. Current State

Current state repo setelah seller foundation + backfill:

- `store_members` sudah hidup
- `store_roles` sudah seeded
- owner existing sudah dibackfill ke `STORE_OWNER + ACTIVE`
- owner bridge fallback masih hidup dan tetap valid
- team shell sudah bisa membaca membership nyata
- backend masih source of truth authorization
- permission tables granular belum ada; permission masih resolve dari role map hardcoded

Current technical constraint penting:

- model `StoreMember.status` saat ini hanya punya:
  - `ACTIVE`
  - `INACTIVE`

Artinya:

- status machine penuh `INVITED / ACTIVE / DISABLED / REMOVED` **belum ada di schema aktif**
- readiness design harus membedakan:
  - **target state machine jangka menengah**
  - **subset aman yang bisa dibuka di phase 1**

## 3. Mutation Scope Recommendation

Scope mutation yang direkomendasikan untuk phase 1:

- `POST /api/seller/stores/:storeId/members`
  - attach existing user ke store berdasarkan email
  - role target hanya non-owner
  - hasil create langsung `ACTIVE`
- `PATCH /api/seller/stores/:storeId/members/:memberId/role`
  - ubah role non-owner
- `PATCH /api/seller/stores/:storeId/members/:memberId/status`
  - hanya untuk non-owner
  - phase 1 aman dibatasi ke:
    - `ACTIVE`
    - `DISABLED` secara konsep, dipersist sebagai `INACTIVE`

Yang **tidak** direkomendasikan untuk phase 1:

- email invitation flow
- create `INVITED` member tanpa user existing
- remove permanen
- mutation untuk `STORE_OWNER`
- self-role-change
- self-disable
- owner transfer

## 4. Permission Guardrails

### Invite Member

Boleh:

- `STORE_OWNER`
- `STORE_ADMIN`

Tidak boleh:

- `CATALOG_MANAGER`
- `MARKETING_MANAGER`
- `ORDER_MANAGER`
- `FINANCE_VIEWER`
- `CONTENT_MANAGER`

Guardrail:

- `STORE_ADMIN` hanya boleh invite ke role non-owner operasional:
  - `CATALOG_MANAGER`
  - `MARKETING_MANAGER`
  - `ORDER_MANAGER`
  - `FINANCE_VIEWER`
  - `CONTENT_MANAGER`
- `STORE_ADMIN` **tidak boleh** membuat `STORE_ADMIN` lain
- `STORE_ADMIN` **tidak boleh** membuat `STORE_OWNER`
- `STORE_OWNER` boleh membuat `STORE_ADMIN` dan semua role non-owner

### Change Role

Boleh:

- `STORE_OWNER`
- `STORE_ADMIN` dengan batasan

Guardrail:

- `STORE_OWNER` boleh ubah role non-owner mana pun
- `STORE_OWNER` boleh promote/demote `STORE_ADMIN`
- `STORE_ADMIN` hanya boleh ubah antar-role operasional non-owner
- `STORE_ADMIN` tidak boleh:
  - mengubah `STORE_OWNER`
  - mengubah `STORE_ADMIN` lain
  - mempromosikan siapa pun menjadi `STORE_ADMIN`
- user tidak boleh mengubah role dirinya sendiri

### Disable Member

Boleh:

- `STORE_OWNER`
- `STORE_ADMIN` dengan batasan

Guardrail:

- `STORE_OWNER` boleh disable non-owner mana pun
- `STORE_ADMIN` hanya boleh disable role operasional non-owner
- `STORE_ADMIN` tidak boleh disable `STORE_ADMIN` lain
- tidak ada role yang boleh disable `STORE_OWNER` di phase 1
- user tidak boleh disable dirinya sendiri

## 5. Membership Status Machine

## Target status model jangka menengah

Status yang secara konseptual direkomendasikan:

- `INVITED`
- `ACTIVE`
- `DISABLED`
- `REMOVED`

## Realitas schema saat ini

Persisted state yang ada sekarang:

- `ACTIVE`
- `INACTIVE`

Karena itu, rekomendasi readiness:

- phase 1 memakai subset aman:
  - `ACTIVE`
  - `DISABLED` secara API, dipersist ke `INACTIVE`
- `INVITED` dan `REMOVED` hanya level desain dulu, belum diimplementasikan

## Valid transition rules

### Phase 1 effective transitions

- `ACTIVE -> DISABLED`
- `DISABLED -> ACTIVE`

### Future transitions, not for phase 1

- `INVITED -> ACTIVE`
- `INVITED -> REMOVED`
- `ACTIVE -> REMOVED`

### Invalid transitions for phase 1

- `ACTIVE -> INVITED`
- `DISABLED -> INVITED`
- mutation apa pun ke `STORE_OWNER` via status endpoint

## 6. Role Transition Rules

### Valid phase 1 transitions

- `CATALOG_MANAGER -> MARKETING_MANAGER`
- `MARKETING_MANAGER -> ORDER_MANAGER`
- `ORDER_MANAGER -> FINANCE_VIEWER`
- `CONTENT_MANAGER -> CATALOG_MANAGER`
- `STORE_ADMIN -> ORDER_MANAGER`
- `ORDER_MANAGER -> STORE_ADMIN` hanya oleh `STORE_OWNER`

### Invalid phase 1 transitions

- apa pun `-> STORE_OWNER`
- `STORE_OWNER ->` role lain
- self demote
- self promote
- `STORE_ADMIN -> STORE_ADMIN` peer management

### Jawaban eksplisit untuk pertanyaan inti

- apakah `STORE_ADMIN` boleh ubah `CATALOG_MANAGER -> MARKETING_MANAGER`
  - **YA**
- apakah `STORE_ADMIN` boleh ubah `STORE_OWNER`
  - **TIDAK**
- apakah `STORE_OWNER` boleh demote dirinya sendiri
  - **TIDAK**
- apakah user boleh mengubah role dirinya sendiri
  - **TIDAK**

## 7. Owner Protection Rules

Owner protection rules wajib keras:

- owner terakhir tidak boleh hilang
- owner terakhir tidak boleh di-disable
- owner terakhir tidak boleh di-remove
- `STORE_OWNER` mutation tidak dibuka di phase 1
- ownership transfer hanya bisa dibuka di phase lain yang terpisah

Aturan turunan:

- endpoint role mutation harus reject jika target member ber-role `STORE_OWNER`
- endpoint status mutation harus reject jika target member ber-role `STORE_OWNER`
- bahkan `STORE_OWNER` sendiri tidak boleh self-demote
- `STORE_ADMIN` tidak boleh menyentuh owner sama sekali

## 8. Duplicate / Conflict Handling

### Duplicate prevention

Primary rule:

- `UNIQUE(store_id, user_id)` adalah constraint utama

Mutation layer tetap harus pre-check dan tidak hanya bergantung pada DB error.

### Conflict cases

#### User already ACTIVE in same store

Hasil:

- reject
- code: `MEMBER_ALREADY_ACTIVE`

#### User already INVITED

Status ini belum dipakai di phase 1.

Hasil readiness recommendation:

- reserve code `MEMBER_ALREADY_INVITED`
- belum dibuka sampai invitation flow siap

#### User DISABLED lalu diundang lagi

Phase 1 recommendation:

- jangan buat row baru
- gunakan status mutation untuk re-activate
- code: `MEMBER_REACTIVATION_REQUIRED`

#### User REMOVED lalu diundang lagi

Phase 1 recommendation:

- belum dibuka
- treat as conflict requiring future restore/remove policy
- code: `MEMBER_REMOVED_RESTORE_REQUIRED`

#### Email tidak ditemukan di sistem

Karena phase 1 tidak membuka email invitation flow:

- reject
- code: `MEMBER_EMAIL_NOT_FOUND`

#### Role target tidak valid

- reject
- code: `INVALID_STORE_ROLE`

#### Duplicate member anomaly detected

- reject
- code: `DUPLICATE_STORE_MEMBER`
- mutation tidak boleh destructive fix anomaly ini

## 9. Suggested API Contract Readiness

### POST `/api/seller/stores/:storeId/members`

Tujuan:

- attach existing user ke store sebagai member aktif

Body recommendation:

```json
{
  "email": "member@example.com",
  "roleCode": "ORDER_MANAGER"
}
```

Guardrails:

- hanya existing user
- `roleCode` tidak boleh `STORE_OWNER`
- `STORE_ADMIN` tidak boleh assign `STORE_ADMIN`

Suggested success:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "userId": 44,
    "roleCode": "ORDER_MANAGER",
    "status": "ACTIVE"
  }
}
```

### PATCH `/api/seller/stores/:storeId/members/:memberId/role`

Body recommendation:

```json
{
  "roleCode": "MARKETING_MANAGER"
}
```

Guardrails:

- target tidak boleh `STORE_OWNER`
- actor tidak boleh self-mutate
- `STORE_ADMIN` hanya boleh mutate role operasional non-owner

### PATCH `/api/seller/stores/:storeId/members/:memberId/status`

Body recommendation:

```json
{
  "status": "DISABLED"
}
```

Phase 1 behavior recommendation:

- API menerima `ACTIVE` / `DISABLED`
- persistence layer boleh map:
  - `ACTIVE -> ACTIVE`
  - `DISABLED -> INACTIVE`

Guardrails:

- target tidak boleh `STORE_OWNER`
- actor tidak boleh self-disable

## 10. Error Code Recommendation

Recommended error codes:

- `SELLER_FORBIDDEN`
- `INVALID_STORE_ROLE`
- `MEMBER_NOT_FOUND`
- `MEMBER_EMAIL_NOT_FOUND`
- `MEMBER_ALREADY_ACTIVE`
- `MEMBER_ALREADY_INVITED`
- `MEMBER_REACTIVATION_REQUIRED`
- `MEMBER_REMOVED_RESTORE_REQUIRED`
- `DUPLICATE_STORE_MEMBER`
- `OWNER_LAST_MEMBER_PROTECTED`
- `OWNER_MUTATION_FORBIDDEN`
- `SELF_MUTATION_FORBIDDEN`
- `ROLE_CHANGE_FORBIDDEN`
- `STATUS_CHANGE_FORBIDDEN`
- `INVALID_MEMBER_STATUS_TRANSITION`

## 11. Rollout Recommendation

### Phase 1

Buka hanya:

- attach existing registered user by email as `ACTIVE`
- change role non-owner
- disable/reactivate non-owner

### Phase 2

Tambahkan:

- invitation semantics yang benar
- `INVITED` state nyata
- richer audit log

### Phase 3

Baru pertimbangkan:

- remove semantics
- ownership transfer workflow

## 12. Acceptance Criteria for Future Mutation Implementation

Mutation phase 1 nanti dianggap siap jika:

- guardrail permission diterapkan di backend
- duplicate prevention by `(store_id, user_id)` diterapkan
- owner mutation ditolak keras
- self-role-change dan self-disable ditolak
- `STORE_ADMIN` hanya bisa kelola role operasional non-owner
- email yang tidak ada di sistem ditolak eksplisit
- disable hanya memengaruhi non-owner
- team shell tetap konsisten setelah mutation
- owner bridge fallback tetap aman

## 13. Recommendation for Next Task

Task implementasi mutation paling aman setelah readiness ini:

- **Team Mutation Phase 1**

Scope yang direkomendasikan:

1. `POST member` untuk existing user by email
2. `PATCH role` untuk non-owner
3. `PATCH status` untuk non-owner active/disabled

Yang tetap ditunda:

- invitation email
- `INVITED` real state
- remove permanen
- owner transfer
- custom role editor

## TEAM MUTATION READINESS RECOMMENDATION

1. Apakah mutation phase 1 aman dibuka:
   - **YA**, jika dibatasi ke non-owner mutation saja

2. Operasi mutation mana yang aman dibuka lebih dulu:
   - attach existing user by email as `ACTIVE`
   - change role non-owner
   - disable/reactivate non-owner

3. Guardrail paling kritis:
   - `STORE_OWNER` tidak boleh disentuh oleh role/status mutation apa pun

4. Risiko paling kritis:
   - membuka mutation terlalu cepat tanpa membatasi `STORE_ADMIN` terhadap peer admin / owner management

5. Apakah siap lanjut ke task implementasi mutation phase 1:
   - **YA**
