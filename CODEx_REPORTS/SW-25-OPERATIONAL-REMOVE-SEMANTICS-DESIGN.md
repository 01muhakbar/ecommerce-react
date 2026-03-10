# SW-25 Operational Remove Semantics Design

## 1. Executive Summary

`REMOVED` sudah menjadi status runtime nyata di Seller Workspace karena flow decline invitation memakai transisi:

- `INVITED -> REMOVED`

Sebelum membuka remove runtime umum untuk member seller yang sudah aktif atau disabled, repo ini perlu semantics yang tegas agar:

- `REMOVED` tidak membingungkan
- inbox invitation tetap aman
- lane `re-invite` yang sudah aktif tetap valid
- owner/admin safety tetap utuh

Rekomendasi final untuk `ecommerce-react`:

- tetap gunakan **satu status `REMOVED`**
- bedakan asal `REMOVED` lewat **audit action** dan, bila diperlukan di phase berikutnya, metadata ringan seperti `removedSource`
- operational remove memakai lane yang sama:
  - `ACTIVE -> REMOVED`
  - `DISABLED -> REMOVED`
- `INVITED -> REMOVED` tetap dipakai untuk decline invitation
- jangan buat status baru
- jangan buka hard delete row

Dengan keputusan ini, lifecycle tetap sederhana, unique `(store_id, user_id)` tetap aman, dan lane `re-invite` yang sudah ada tetap bisa dipakai untuk membership hasil decline maupun hasil operational remove.

## 2. Current Lifecycle State

Lifecycle runtime yang sudah aktif:

- attach existing user as `ACTIVE`
- change role non-owner
- disable/reactivate non-owner
- invite existing user -> `INVITED`
- accept invite -> `ACTIVE`
- decline invite -> `REMOVED`
- re-invite `REMOVED -> INVITED`

Invariants penting saat ini:

- `store_members` unik per `(store_id, user_id)`
- access resolver hanya memberi akses seller untuk status `ACTIVE`
- inbox invitation hanya membaca `INVITED`
- `REMOVED` sudah punya arti praktis sebagai closed membership row
- owner protection aktif:
  - `STORE_OWNER` tidak boleh dimutasi
- peer-admin protection aktif:
  - `STORE_ADMIN` tidak boleh mutate peer `STORE_ADMIN`
- self role/status mutation saat ini juga ditolak

## 3. Why Operational Remove Needs Its Own Semantics

Remove operasional berbeda dari disable:

- disable cocok untuk penghentian sementara
- remove cocok untuk menutup membership secara operasional

Tanpa semantics yang tegas, runtime remove akan berisiko:

- membingungkan perbedaan `DISABLED` vs `REMOVED`
- merusak lane `re-invite`
- memunculkan history yang tidak jelas antara:
  - user decline invitation
  - owner/admin mengeluarkan member dari tim

Karena `REMOVED` sudah dipakai, keputusan sekarang bukan “status apa yang dipakai”, melainkan “bagaimana menjaga agar satu status itu tetap jelas”.

## 4. Options Comparison

### Option A — Satu status `REMOVED`, dibedakan lewat audit saja

Pro:

- perubahan schema paling kecil
- lifecycle tetap sederhana
- cocok dengan row reuse dan unique constraint existing
- sangat cocok dengan audit trail yang sudah aktif

Contra:

- UI/history harus cukup disiplin membaca audit action
- tanpa metadata tambahan, source `REMOVED` hanya diketahui dari audit log

Dampak ke repo sekarang:

- aman
- paling sedikit perubahan

### Option B — Satu status `REMOVED`, tambah metadata/source ringan

Contoh:

- `removedSource = DECLINE | OPERATIONAL`
- atau `removedReason`

Pro:

- source `REMOVED` lebih eksplisit
- memudahkan UI dan reporting ringan di masa depan

Contra:

- butuh schema evolution tambahan
- belum wajib untuk membuka lane remove runtime pertama

Dampak ke repo sekarang:

- masih cocok
- tetapi lebih baik sebagai follow-up kecil, bukan prasyarat wajib

### Option C — Status terpisah untuk decline vs operational remove

Contoh:

- `DECLINED`
- `REMOVED`

Pro:

- semantics sangat eksplisit

Contra:

- memperberat status machine
- memaksa patch access, inbox, team page, lifecycle read, audit, dan re-invite semantics
- terlalu besar untuk fase repo saat ini

Dampak ke repo sekarang:

- tidak sepadan
- terlalu mahal secara compatibility

## 5. Recommended Semantics

Rekomendasi final:

- `REMOVED` tetap satu status
- operational remove **layak memakai `REMOVED`**
- pembedaan sumber perubahan dilakukan lewat:
  - audit action yang berbeda
  - optional metadata ringan nanti jika benar-benar dibutuhkan

Makna final `REMOVED` untuk repo ini:

- closed non-access membership row
- row tetap dipertahankan
- row boleh dipakai ulang lewat lane `re-invite`
- row tidak memberi akses seller

Makna source:

- `REMOVED` dari decline invitation:
  - penutupan invitation oleh target user
- `REMOVED` dari operational remove:
  - penutupan membership oleh actor store

Perbedaan source tidak perlu dipisah ke status lain sekarang, karena:

- audit trail sudah cukup untuk pembeda operasional
- lane `re-invite` tetap sama untuk kedua source
- schema tambahan bisa ditunda sampai benar-benar dibutuhkan

## 6. Remove vs Disable Recommendation

### `DISABLED`

Gunakan untuk:

- penghentian sementara
- member masih dianggap bagian dari tim, tetapi aksesnya dibekukan
- actor menginginkan reactivation cepat tanpa invitation ulang

Karakteristik:

- reactivation langsung `DISABLED -> ACTIVE`
- tidak kembali ke inbox invitation
- history tetap menunjukkan continuity membership

### `REMOVED`

Gunakan untuk:

- penutupan membership secara operasional
- member tidak lagi dianggap bagian dari tim
- re-entry ke store harus lewat invitation ulang

Karakteristik:

- tidak punya akses
- hilang dari lane aktif operasional
- jika ingin kembali, gunakan `re-invite`

Keputusan praktis:

- remove operasional **bukan** variasi disable
- remove operasional berarti closure yang lebih kuat dari disable

## 7. Transition Matrix Recommendation

| From | To | Valid | Catatan |
|---|---|---:|---|
| `ACTIVE` | `REMOVED` | Ya | Lane remove operasional utama. |
| `DISABLED` | `REMOVED` | Ya | Penutupan permanen dari state nonaktif sementara. |
| `INVITED` | `REMOVED` | Ya | Sudah dipakai oleh decline invitation. Tidak perlu remove operasional terpisah. |
| `REMOVED` | `REMOVED` | Tidak | No-op atau error `MEMBER_ALREADY_REMOVED`. |
| `REMOVED` | `INVITED` | Ya | Sudah aktif lewat re-invite lane. |
| `REMOVED` | `ACTIVE` | Tidak | Tidak boleh bypass acceptance. |
| `REMOVED` | `DISABLED` | Tidak | Tidak memberi nilai operasional yang jelas. |

Rekomendasi tambahan:

- remove operasional tidak perlu berlaku untuk `INVITED`
- untuk undangan yang belum diterima, semantics yang benar tetap:
  - target user decline sendiri
  - atau di future phase baru ada cancel invitation khusus

## 8. Guardrail Recommendation

Actor yang paling aman untuk operational remove phase awal:

- `STORE_OWNER`
- `STORE_ADMIN`, tetapi dengan batasan ketat

Guardrail final yang direkomendasikan:

- `STORE_OWNER` tidak boleh di-remove
- self remove ditolak di phase awal
- `STORE_ADMIN` tidak boleh remove peer `STORE_ADMIN`
- `STORE_ADMIN` tidak boleh remove `STORE_OWNER`
- `STORE_OWNER` boleh remove non-owner, termasuk `STORE_ADMIN`
- target `INVITED` tidak memakai operational remove lane
- target `REMOVED` tidak boleh di-remove lagi

Alasan self remove ditolak:

- mengurangi risiko lockout atau kehilangan operator penting secara tidak sengaja
- ownership transfer belum ada
- self-exit semantics lebih aman ditunda

## 9. Audit / Metadata Recommendation

Audit action baru yang direkomendasikan untuk remove operasional:

- `TEAM_MEMBER_REMOVE`

Before/after minimum:

- before:
  - `roleCode`
  - `status`
- after:
  - `roleCode`
  - `status: REMOVED`

Rekomendasi metadata:

- phase awal remove runtime **tidak wajib** menambah field baru
- audit action `TEAM_MEMBER_REMOVE` sudah cukup untuk membedakan:
  - `TEAM_MEMBER_INVITE_DECLINE`
  - `TEAM_MEMBER_REMOVE`

Metadata yang boleh dipertimbangkan nanti jika UI/history membutuhkannya:

- `removedSource`
- `removedReason`

Tetapi ini bukan syarat untuk membuka lane remove pertama.

## 10. Re-invite Compatibility Notes

Lane `re-invite` existing harus tetap kompatibel dengan remove operasional.

Rekomendasi:

- membership yang di-remove operasional juga boleh memakai lane:
  - `REMOVED -> INVITED`
- actor harus memilih role target baru secara eksplisit
- user tetap tidak punya akses sampai accept ulang

Alasan:

- menjaga satu semantics re-entry
- tidak perlu restore umum
- tetap konsisten bahwa akses aktif hanya lahir dari:
  - attach langsung sebagai `ACTIVE`
  - atau acceptance dari `INVITED`

Compatibility note penting:

- history akan tetap jelas jika audit action dibedakan:
  - `TEAM_MEMBER_INVITE_DECLINE`
  - `TEAM_MEMBER_REMOVE`
  - `TEAM_MEMBER_REINVITE`

## 11. API Readiness Draft

Endpoint masa depan yang paling aman:

- `PATCH /api/seller/stores/:storeId/members/:memberId/remove`

Kenapa `PATCH`, bukan `DELETE`:

- row tidak dihapus
- semantics adalah status transition
- lebih konsisten dengan lifecycle status mutation

Expected rules:

- target row harus milik store yang sama
- target status harus `ACTIVE` atau `DISABLED`
- target owner tidak boleh
- self remove ditolak
- peer admin remove oleh `STORE_ADMIN` ditolak
- success mengubah:
  - `status = REMOVED`
  - `removedAt = now`
  - `removedByUserId = actor`
  - `disabledAt` dan `disabledByUserId` boleh dipertahankan atau di-reset sesuai keputusan implementasi; default aman:
    - reset state-operasional dan andalkan audit untuk history

Error codes yang direkomendasikan:

- `MEMBER_NOT_FOUND`
- `MEMBER_ALREADY_REMOVED`
- `INVALID_MEMBER_STATUS_TRANSITION`
- `MEMBER_REMOVE_FORBIDDEN`
- `OWNER_MUTATION_FORBIDDEN`
- `SELF_MUTATION_FORBIDDEN`
- `PEER_ADMIN_MUTATION_FORBIDDEN`
- `SELLER_FORBIDDEN`

## 12. Rollout Recommendation

Urutan implementasi paling aman:

1. Lock semantics remove operasional di dokumen ini
2. Buka runtime lane remove operasional sempit:
   - hanya `ACTIVE` dan `DISABLED`
   - owner-safe
   - self-safe
   - peer-admin-safe
3. Tambah audit action `TEAM_MEMBER_REMOVE`
4. Reuse lifecycle read dan team page untuk menampilkan hasil remove
5. Tunda metadata enrichment seperti `removedSource` sampai benar-benar dibutuhkan

Yang tidak direkomendasikan sekarang:

- status baru tambahan
- hard delete membership
- remove untuk `INVITED` lewat lane operasional yang sama
- restore umum

## 13. Acceptance Criteria for Future Implementation

Implementasi remove runtime nanti dianggap benar jika:

- hanya target `ACTIVE` atau `DISABLED` yang bisa di-remove
- `STORE_OWNER` tetap tidak bisa disentuh
- self remove tetap ditolak
- peer admin remove oleh `STORE_ADMIN` tetap ditolak
- status berubah ke `REMOVED`
- member kehilangan akses seller
- audit `TEAM_MEMBER_REMOVE` tercatat
- lane `re-invite` existing tetap bisa dipakai setelah remove
- inbox invitation tidak rusak

## 14. Next Task Recommendation

Task berikutnya paling aman:

- implement **operational remove runtime lane** yang sempit

Bukan langkah berikutnya yang direkomendasikan:

- metadata/schema evolution dulu
- restore umum
- history viewer besar

Alasan:

- audit trail yang ada sudah cukup untuk membedakan decline vs operational remove
- lifecycle read polish sudah tersedia
- semantics remove sekarang sudah cukup jelas untuk membuka lane runtime pertama secara aman

## 15. Lowest-Risk Next Step

Lowest-risk next step adalah:

- `operational remove runtime lane`

Scope idealnya sempit:

- target `ACTIVE` dan `DISABLED` saja
- memakai status `REMOVED`
- mencatat `TEAM_MEMBER_REMOVE`
- tidak menyentuh `INVITED` flow
- tidak membuka restore umum

---

## OPERATIONAL REMOVE SEMANTICS RECOMMENDATION

1. Semantics final yang direkomendasikan:
   - `REMOVED` tetap satu status closed membership, dibedakan source-nya lewat audit action, bukan status baru.
2. Apakah remove operasional layak memakai `REMOVED`:
   - `YA`
3. Guardrail paling kritis:
   - `STORE_OWNER` tidak boleh di-remove, dan self remove harus tetap ditolak di phase awal.
4. Risiko paling kritis:
   - jika UI atau implementasi runtime nanti tidak membedakan audit source dengan jelas, `REMOVED` hasil decline dan `REMOVED` hasil remove operasional bisa terlihat sama secara operasional.
5. Apakah siap lanjut ke task implementasi remove runtime:
   - `YA`
