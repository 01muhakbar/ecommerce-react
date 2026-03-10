# SW-04-PERMISSION-ARCH

## CODEx REPORT

### Task

Finalisasi arsitektur role permission Seller Workspace untuk repo `ecommerce-react`.

### Input Basis yang Dipakai

- task prompt ini sebagai target permission architecture
- hasil audit baseline repo
- dokumen [SW-01-RK-ARCHITECTURE](./SW-01-RK-ARCHITECTURE.md)
- dokumen [SW-02-PRD-TO-TECH-SPEC](./SW-02-PRD-TO-TECH-SPEC.md)
- dokumen [SW-03-DB-DELTA-MAP](./SW-03-DB-DELTA-MAP.md)
- baseline auth/RBAC aktif di:
  - `server/src/middleware/requireAuth.ts`
  - `server/src/utils/rbac.ts`
  - `client/src/constants/permissions.js`
  - `client/src/components/guards/RequirePerm.jsx`

### Files Changed

- `CODEx_REPORTS/SW-04-PERMISSION-ARCH.md`

### Verification

- cross-check static ke auth dan RBAC backend existing
- cross-check static ke frontend permission gating existing
- cross-check terhadap keputusan arsitektur, tech spec, dan DB delta map yang sudah disetujui
- verified planning-only scope: tidak ada perubahan runtime code

### Risks / Decisions Needed

- seller permission architecture harus dipisah total dari global admin role yang existing
- source of truth permission wajib di backend agar frontend tidak mengarang akses dari role code
- phase awal harus tetap bridge owner-only, tetapi shape akses akhir harus sudah kompatibel dengan `store_roles` dan `store_members`

---

# Permission Architecture

## 1. Executive Summary

Permission architecture Seller Workspace untuk repo `ecommerce-react` direkomendasikan memakai pendekatan `hybrid / staged`:

- phase owner-only bridge:
  - seller access di-resolve sebagai `virtual STORE_OWNER`
- phase membership foundation:
  - tambah `store_roles` dan `store_members`
- phase permission registry lanjut:
  - `permissions` dan `store_role_permissions` tetap ditunda sampai benar-benar dibutuhkan untuk custom role atau permission override

Keputusan final:

- backend adalah source of truth permission resolution
- frontend seller hanya mengonsumsi `resolved role` dan `resolved permissions` dari backend
- namespace seller tetap `/api/seller/stores/:storeId/...`
- role seller sepenuhnya terpisah dari global role platform `staff/admin/super_admin`
- role seller awal memakai fixed system roles, bukan custom role builder

Ini adalah opsi paling aman karena:

- konsisten dengan bridge phase owner-only
- tidak menimpa `stores.owner_user_id`
- tidak memaksa permission tables penuh terlalu awal
- tetap punya jalur bersih ke membership + store-role enforcement final

## 2. Existing Access Baseline Summary

### Backend Existing

- `requireAuth` di [requireAuth.ts](C:/Users/user/Documents/ecommerce-react/server/src/middleware/requireAuth.ts) hanya memverifikasi user global dari cookie JWT.
- `rbac.ts` di [rbac.ts](C:/Users/user/Documents/ecommerce-react/server/src/utils/rbac.ts) hanya mendukung global min-role:
  - `staff`
  - `admin`
  - `super_admin`
- seller access aktif saat ini belum membership-aware; pola utamanya adalah:
  - `requireAuth`
  - cek `Store.ownerUserId === req.user.id`

### Frontend Existing

- `client/src/constants/permissions.js` berisi permission admin-oriented yang di-resolve dari global role.
- `RequirePerm.jsx` hanya mengecek permission admin UI level.
- seller workspace baru tidak boleh reuse sistem ini sebagai source of truth.

### Kesimpulan Baseline

- sistem existing cocok untuk admin global
- tidak cocok untuk tenant-scoped seller permission
- seller permission architecture harus menjadi layer baru, bukan patch ke RBAC global lama

## 3. Seller Role Model

Role seller final yang direkomendasikan:

- `STORE_OWNER`
- `STORE_ADMIN`
- `CATALOG_MANAGER`
- `MARKETING_MANAGER`
- `ORDER_MANAGER`
- `FINANCE_VIEWER`
- `CONTENT_MANAGER`

Semua role ini hidup di level `store`, bukan di level platform.

### Role Definitions

| Role | Fungsi Utama | Domain Boleh | Domain Tidak Boleh |
|---|---|---|---|
| `STORE_OWNER` | pemegang hak tertinggi per store | semua domain seller, termasuk anggota, role, dan ownership transfer | tidak ada batas fungsional seller; tetap tunduk pada batas platform |
| `STORE_ADMIN` | operator penuh harian store | store, members, roles, catalog, coupons, inventory, orders, payment profile, storefront, audit | tidak boleh transfer ownership; tidak boleh menghapus atau menurunkan owner |
| `CATALOG_MANAGER` | kelola katalog dan stok | product, media, variants, categories/collections, attributes, inventory | tidak boleh coupon, order fulfillment, payment profile, members, storefront settings sensitif |
| `MARKETING_MANAGER` | kelola promosi dan kampanye | coupons, campaign-facing store data, view katalog, view storefront | tidak boleh fulfillment, inventory write, payment profile edit, member management |
| `ORDER_MANAGER` | operasional order dan fulfillment | order view, fulfillment manage, payment status view, view katalog seperlunya | tidak boleh katalog write, coupon write, members, storefront edit, payment profile edit |
| `FINANCE_VIEWER` | melihat status finansial dan audit | payment profile view, payment status view, order view, audit log view | tidak boleh mengubah data apa pun |
| `CONTENT_MANAGER` | kelola profil store dan storefront content | store view/edit, storefront view/edit | tidak boleh order fulfillment, coupon, inventory, payment profile edit, member management |

## 4. Permission Key Registry

Registry final yang direkomendasikan:

### Store Core

- `STORE_VIEW`
- `STORE_EDIT`
- `STORE_MEMBERS_MANAGE`
- `STORE_ROLES_MANAGE`
- `STORE_OWNERSHIP_TRANSFER`

### Catalog

- `PRODUCT_VIEW`
- `PRODUCT_CREATE`
- `PRODUCT_EDIT`
- `PRODUCT_PUBLISH`
- `PRODUCT_ARCHIVE`
- `PRODUCT_MEDIA_MANAGE`
- `PRODUCT_VARIANT_MANAGE`

### Taxonomy

- `CATEGORY_VIEW`
- `CATEGORY_MANAGE`
- `ATTRIBUTE_VIEW`
- `ATTRIBUTE_MANAGE`

### Promotions

- `COUPON_VIEW`
- `COUPON_CREATE`
- `COUPON_EDIT`
- `COUPON_STATUS_MANAGE`

### Inventory

- `INVENTORY_VIEW`
- `INVENTORY_MANAGE`

### Orders and Payments

- `ORDER_VIEW`
- `ORDER_FULFILLMENT_MANAGE`
- `PAYMENT_PROFILE_VIEW`
- `PAYMENT_PROFILE_EDIT`
- `PAYMENT_STATUS_VIEW`

### Storefront and Audit

- `STOREFRONT_VIEW`
- `STOREFRONT_EDIT`
- `AUDIT_LOG_VIEW`

### Registry Notes

- `STORE_OWNERSHIP_TRANSFER` ditambahkan secara eksplisit karena itu hard rule owner-only dan tidak boleh diwakili secara implisit.
- key registry tetap flat dan string-based supaya mudah dipakai di backend resolver dan frontend gating.
- tidak disarankan memakai key yang terlalu granular dulu pada phase awal.

## 5. Role -> Permission Mapping Matrix

### Final Mapping

| Permission | OWNER | ADMIN | CATALOG | MARKETING | ORDER | FINANCE | CONTENT |
|---|---|---|---|---|---|---|---|
| `STORE_VIEW` | Y | Y | Y | Y | Y | Y | Y |
| `STORE_EDIT` | Y | Y | N | N | N | N | Y |
| `STORE_MEMBERS_MANAGE` | Y | Y | N | N | N | N | N |
| `STORE_ROLES_MANAGE` | Y | Y | N | N | N | N | N |
| `STORE_OWNERSHIP_TRANSFER` | Y | N | N | N | N | N | N |
| `PRODUCT_VIEW` | Y | Y | Y | Y | Y | N | N |
| `PRODUCT_CREATE` | Y | Y | Y | N | N | N | N |
| `PRODUCT_EDIT` | Y | Y | Y | N | N | N | N |
| `PRODUCT_PUBLISH` | Y | Y | Y | N | N | N | N |
| `PRODUCT_ARCHIVE` | Y | Y | Y | N | N | N | N |
| `PRODUCT_MEDIA_MANAGE` | Y | Y | Y | N | N | N | N |
| `PRODUCT_VARIANT_MANAGE` | Y | Y | Y | N | N | N | N |
| `CATEGORY_VIEW` | Y | Y | Y | Y | N | N | N |
| `CATEGORY_MANAGE` | Y | Y | Y | N | N | N | N |
| `ATTRIBUTE_VIEW` | Y | Y | Y | N | N | N | N |
| `ATTRIBUTE_MANAGE` | Y | Y | Y | N | N | N | N |
| `COUPON_VIEW` | Y | Y | N | Y | N | N | N |
| `COUPON_CREATE` | Y | Y | N | Y | N | N | N |
| `COUPON_EDIT` | Y | Y | N | Y | N | N | N |
| `COUPON_STATUS_MANAGE` | Y | Y | N | Y | N | N | N |
| `INVENTORY_VIEW` | Y | Y | Y | N | Y | N | N |
| `INVENTORY_MANAGE` | Y | Y | Y | N | N | N | N |
| `ORDER_VIEW` | Y | Y | N | N | Y | Y | N |
| `ORDER_FULFILLMENT_MANAGE` | Y | Y | N | N | Y | N | N |
| `PAYMENT_PROFILE_VIEW` | Y | Y | N | N | N | Y | N |
| `PAYMENT_PROFILE_EDIT` | Y | Y | N | N | N | N | N |
| `PAYMENT_STATUS_VIEW` | Y | Y | N | N | Y | Y | N |
| `STOREFRONT_VIEW` | Y | Y | N | Y | N | N | Y |
| `STOREFRONT_EDIT` | Y | Y | N | N | N | N | Y |
| `AUDIT_LOG_VIEW` | Y | Y | N | N | N | Y | N |

### View-Only Behavior

- `FINANCE_VIEWER` adalah role read-only murni.
- `ORDER_MANAGER` boleh view order dan payment status, tetapi tidak boleh edit payment profile dan tidak boleh mengubah katalog.
- `MARKETING_MANAGER` boleh mengelola coupon, tetapi tidak boleh fulfillment order.
- `CONTENT_MANAGER` fokus pada profil store dan storefront content.

### Explicit Denial Areas

- `FINANCE_VIEWER`:
  - tidak boleh permission write apa pun
- `ORDER_MANAGER`:
  - tidak boleh `PRODUCT_*`, `COUPON_*`, `STORE_MEMBERS_MANAGE`, `STORE_ROLES_MANAGE`
- `MARKETING_MANAGER`:
  - tidak boleh `ORDER_FULFILLMENT_MANAGE`, `INVENTORY_MANAGE`, `PAYMENT_PROFILE_EDIT`
- `CONTENT_MANAGER`:
  - tidak boleh `ORDER_*`, `COUPON_*`, `INVENTORY_*`, `PAYMENT_PROFILE_EDIT`
- `STORE_ADMIN`:
  - tidak boleh `STORE_OWNERSHIP_TRANSFER`

## 6. Hard Rules & Non-Negotiable Constraints

- seller role tidak boleh dicampur dengan global platform role
- seluruh authorization seller harus tenant-scoped by `storeId`
- hanya `STORE_OWNER` yang boleh `STORE_OWNERSHIP_TRANSFER`
- `FINANCE_VIEWER` tidak boleh punya permission write
- `ORDER_MANAGER` tidak boleh mengubah katalog atau coupon
- `MARKETING_MANAGER` tidak boleh fulfillment order
- `CONTENT_MANAGER` hanya fokus profile/storefront content
- `STORE_ADMIN` adalah operator penuh kecuali aksi super sensitif
- owner-only bridge harus tetap kompatibel dengan role model akhir
- namespace seller tidak boleh berubah ketika membership diaktifkan

## 7. Backend Enforcement Design

### Final Principle

Backend harus menjadi `source of truth` untuk permission resolution.

### Resolution Flow

1. `requireAuth`
2. parse `storeId` dari route `/api/seller/stores/:storeId/...`
3. load store by `storeId`
4. resolve access mode:
   - bridge mode:
     - jika user adalah `stores.owner_user_id`, resolve sebagai `STORE_OWNER`
   - membership mode:
     - wajib ada active row di `store_members`
5. resolve `roleCode`
6. resolve `permissions`
   - phase 1 and 2:
     - dari hardcoded backend permission map
   - future optional:
     - dari `permissions` + `store_role_permissions`
7. validate object tenant ownership
   - contoh `product.storeId === route.storeId`
   - contoh `suborder.storeId === route.storeId`
8. authorize action by permission key
9. continue handler

### Recommended Backend Components

- `requireAuth`
- `requireSellerStoreAccess`
- `resolveSellerContext`
- `requireSellerPermission(permissionKey)`
- `assertSellerTenantResource(resourceStoreId, routeStoreId)`

### Recommended Resolved Seller Context Shape

```ts
type ResolvedSellerContext = {
  storeId: number;
  storeSlug: string;
  membershipMode: "OWNER_BRIDGE" | "MEMBERSHIP";
  roleCode: "STORE_OWNER" | "STORE_ADMIN" | "CATALOG_MANAGER" | "MARKETING_MANAGER" | "ORDER_MANAGER" | "FINANCE_VIEWER" | "CONTENT_MANAGER";
  permissionKeys: string[];
  isOwner: boolean;
  memberId: number | null;
};
```

### Standard Error Response

- `401 Unauthorized`
  - user belum login
- `403 Forbidden`
  - user login tetapi tidak punya membership aktif atau permission yang dibutuhkan
- `404 Not Found`
  - store/resource tidak ada atau tidak berada dalam tenant scope route

Recommended shape:

```json
{
  "success": false,
  "code": "SELLER_FORBIDDEN",
  "message": "You do not have permission to perform this action."
}
```

### Object Ownership Validation Rules

- permission lulus bukan berarti object otomatis boleh diakses
- semua object seller harus tetap diverifikasi terhadap `storeId`
- ini wajib terutama untuk:
  - `products`
  - `suborders`
  - `suborder_items`
  - `payments`
  - `store_payment_profiles`

## 8. Frontend Enforcement Design

### Final Principle

Frontend seller tidak boleh menginfer akses final dari `roleCode` saja. Frontend harus consume `resolved permissions` dari backend.

### Recommended Frontend Data Contract

Saat seller workspace load store context, frontend menerima:

- `storeId`
- `roleCode`
- `permissionKeys`
- `isOwner`
- display info store

### Frontend Gating Layers

#### Route Visibility

- route seller besar seperti `/seller/stores/:storeId/orders` hanya tampil jika permission page-level terpenuhi
- contoh:
  - orders page memerlukan `ORDER_VIEW`
  - payment profile page memerlukan `PAYMENT_PROFILE_VIEW`

#### Page Visibility

- halaman boleh dirender hanya jika permission minimal terpenuhi
- fallback:
  - forbidden state
  - atau redirect ke landing seller workspace

#### Action/Button Visibility

- tombol `Edit`, `Publish`, `Archive`, `Fulfill`, `Manage Members` disembunyikan bila permission tidak ada

#### Form Disable / Read-Only

- untuk role view-only, page tetap boleh dilihat jika permission view ada
- semua field dan submit action menjadi disabled/read-only

### Frontend Recommended Strategy

- backend kirim resolved permission list
- frontend buat util:
  - `hasSellerPerm(permissionKey)`
  - `hasAnySellerPerm([...])`
  - `hasAllSellerPerm([...])`
- frontend boleh memakai `roleCode` hanya untuk label UI, bukan authorization logic utama

## 9. Storage Strategy Recommendation

### Opsi yang Dibandingkan

| Opsi | Ringkasan | Pro | Contra |
|---|---|---|---|
| A | hardcoded role matrix saja | paling cepat | dead-end untuk membership storage |
| B | `store_roles` + hardcoded permission map | sederhana dan cukup kuat | belum mendukung custom role permission override |
| C | `permissions` + `store_role_permissions` dari awal | paling fleksibel | terlalu berat untuk repo saat ini |
| D | hybrid / staged | bridge aman, phase 2 cukup ringan, phase lanjut tetap terbuka | butuh disiplin phase rollout |

### Final Decision

Pilih `Option D: hybrid / staged approach`.

### Final Storage Strategy

#### Phase 1

- belum perlu `store_roles` dan `store_members` untuk enforcement phase awal
- owner existing di-resolve sebagai `virtual STORE_OWNER`

#### Phase 2

- buat `store_roles`
- buat `store_members`
- permission map tetap hardcoded di backend untuk system roles

#### Phase 3+

- bila butuh custom role editor atau per-store custom permission mapping:
  - tambahkan `permissions`
  - tambahkan `store_role_permissions`

### Why This Is Final Recommendation

- paling cocok dengan constraint repo sekarang
- tidak membebani phase awal
- tidak dead-end
- masih compatible dengan DB Delta Map

## 10. Owner-Only Bridge Compatibility Strategy

### Bridge Mapping Rule

Owner existing dipetakan sebagai:

- `virtual roleCode = STORE_OWNER`
- `membershipMode = OWNER_BRIDGE`

### Phase Awal Route Behavior

Route phase awal tetap jalan dengan rule:

- auth user valid
- load store by `storeId`
- jika `store.ownerUserId === user.id`, maka user lolos sebagai owner bridge

### Migration Compatibility Rule

Saat `store_members` dan `store_roles` diperkenalkan:

- setiap store lama akan memiliki owner membership row
- owner role row akan menjadi `STORE_OWNER`
- tetapi fallback owner bridge boleh tetap dipertahankan sementara selama transisi

### Non-Breaking Access Strategy

- namespace tidak berubah
- route params tidak berubah
- response seller context shape tidak perlu berubah besar
- hanya source resolusi role yang berubah dari:
  - owner check
  - menjadi membership lookup plus owner fallback

## 11. Evolution Path to Full Membership + Store-Role

### Phase Owner-Only

- access source:
  - `store.owner_user_id`
- resolved role:
  - `STORE_OWNER`
- permissions:
  - hardcoded owner permission set

### Phase Membership Foundation

- add `store_roles`
- add `store_members`
- owner existing dibackfill menjadi member aktif
- non-owner seller team mulai bisa diundang / dihubungkan

### Phase Full Role Enforcement

- seller middleware resolve:
  - active membership
  - role code
  - permission set
- frontend seller consume resolved permission payload
- write actions seller mulai dibuka bertahap

### Phase Optional Permission Tables

- hanya jika diperlukan:
  - custom roles
  - per-store override
  - permission editor UI

## 12. Risks & Tradeoffs

### Risks

- kalau frontend menginfer permission dari role code sendiri, akses akan drift dari backend
- kalau `permissions` table dibangun terlalu awal, implementasi phase 2 akan jadi lebih berat tanpa manfaat langsung
- kalau owner bridge tidak dipetakan ke `STORE_OWNER`, transisi ke membership akan terasa seperti rewrite
- kalau admin global role dicampur dengan seller role, boundary tenant akan rusak

### Tradeoffs

- hardcoded permission map di backend membatasi custom role di awal
- tetapi itu justru menjaga kesederhanaan dan keamanan fondasi
- optional permission tables tetap tersedia sebagai jalur evolusi, bukan beban awal

## 13. Recommendation for Next Implementation Task

Task implementasi berikutnya yang paling aman:

1. implement `store_roles` dan `store_members` DB foundation
2. siapkan backend permission registry hardcoded untuk system seller roles
3. siapkan seller access resolver:
   - owner bridge fallback
   - membership-aware path
4. expose seller context endpoint read-only untuk frontend seller workspace shell

Task yang belum aman dibuka:

- product write actions penuh
- payment profile write dari seller team non-owner
- custom role editor
- permission override per store

---

# PERMISSION FOUNDATION RECOMMENDATION FOR NEXT IMPLEMENTATION TASK

1. Storage strategy final:
   - `Option D: hybrid / staged approach`

2. Apakah `permissions` dan `store_role_permissions` dibuat sekarang atau ditunda:
   - `ditunda`
   - phase berikutnya cukup `store_roles` + `store_members` dengan hardcoded permission map di backend

3. Backend source of truth strategy:
   - backend wajib menjadi source of truth permission resolution

4. Frontend consumption strategy:
   - frontend consume `roleCode` dan `permissionKeys` hasil resolve dari backend
   - frontend tidak boleh infer akses final dari role code saja

5. Owner-only bridge mapping strategy:
   - owner existing dipetakan ke `virtual STORE_OWNER`
   - saat membership foundation hadir, owner dibackfill menjadi active store member tanpa ganti namespace atau route shape

6. Warning teknis paling kritis:
   - jangan mencampur seller roles dengan global admin roles, dan jangan membiarkan frontend menjadi penentu final authorization

7. Apakah siap lanjut ke implementasi DB/access foundation:
   - `YA`

Alasannya singkat:

- role model final sudah terkunci
- permission registry final sudah jelas
- storage strategy bertahap sudah dipilih
- backend/frontend enforcement boundary sudah jelas
- owner-only bridge sudah punya jalur transisi yang non-breaking
