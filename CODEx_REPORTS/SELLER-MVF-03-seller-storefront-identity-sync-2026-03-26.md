# SELLER-MVF-03 — Seller Storefront Identity Sync (Seller Workspace → Client/storefront)

Tanggal: 2026-03-26

## Scope yang dikerjakan

- audit source of truth store identity seller/public existing
- sinkronisasi serializer backend untuk public store identity
- sinkronisasi seller card di product detail ke source of truth yang sama
- update seller workspace profile agar seller bisa melihat preview identitas publik
- update microsite product detail agar bio toko mengikuti backend store identity
- verifikasi build `server` dan `client`

## Hasil audit awal

- source of truth store identity seller sudah ada di model `Store` dan seller lane `seller.storeProfile`
- public store slug page sudah membaca `GET /api/store/customization/identity/:slug`
- ada drift implementasi:
  - `store.customization` membangun public identity sendiri
  - `store.ts` membangun seller info PDP sendiri
  - seller workspace punya matrix field sendiri untuk store identity
- tidak perlu migration schema
- tidak perlu ubah route public utama
- tidak perlu ubah auth/session
- tidak perlu refactor besar lintas app

## Perubahan utama

### 1. Shared backend serializer untuk public store identity

File baru:
- `server/src/services/publicStoreIdentity.ts`

Isi utama:
- daftar field publik aman:
  - `PUBLIC_STORE_IDENTITY_ATTRIBUTES`
  - `PUBLIC_STORE_IDENTITY_SELLER_OWNED_FIELDS`
  - `PUBLIC_STORE_IDENTITY_ADMIN_OWNED_FIELDS`
  - `PUBLIC_STORE_IDENTITY_PUBLIC_SAFE_FIELDS`
- serializer contract publik:
  - `serializePublicStoreIdentityContract()`
- summary publik backend-driven:
  - status badge
  - product count publik
  - rating aggregate publik
  - joined date
  - chat/contact availability
- mapper reusable:
  - `serializePublicStoreIdentity(store)`
  - `serializePublicSellerInfo(store)`

Hasil:
- public slug microsite dan seller info card sekarang membaca field publik dari service yang sama
- mapping seller-managed vs admin-owned vs public-safe menjadi eksplisit dan reusable

### 2. Public store identity route memakai serializer yang sama

File:
- `server/src/routes/store.customization.ts`

Perubahan:
- route public identity sekarang memakai `PUBLIC_STORE_IDENTITY_ATTRIBUTES`
- `GET /api/store/customization/identity`
- `GET /api/store/customization/identity/:slug`
  keduanya memakai `serializePublicStoreIdentity(store)`

Hasil:
- nama toko, slug, logo, cover/banner, bio, contact links, dan metadata publik aman dibentuk dari source of truth yang sama
- contract tetap kompatibel, tetapi sekarang punya field governance publik yang lebih eksplisit

### 3. Seller card PDP ikut source of truth yang sama

File:
- `server/src/routes/store.ts`

Perubahan:
- seller info di public product detail sekarang memakai `serializePublicSellerInfo(store)`

Hasil:
- nama toko, logo, short description, status, product count, rating, dan CTA visit/chat tidak lagi dihitung oleh jalur terpisah
- linkage product → store slug tetap stabil

### 4. Seller workspace mendapat preview jalur publik

Files:
- `server/src/routes/seller.storeProfile.ts`
- `client/src/pages/seller/SellerStoreProfilePage.jsx`

Perubahan:
- seller-managed field list di seller route sekarang mengikuti konstanta shared `PUBLIC_STORE_IDENTITY_SELLER_OWNED_FIELDS`
- seller page menampilkan panel `Public Storefront Preview`
- preview menunjukkan:
  - public store name
  - store route `/store/:slug`
  - bio / short description
  - logo + cover snapshot
  - public contact snapshot
  - public location snapshot
- ada CTA langsung ke route publik store

Hasil:
- seller bisa melihat dengan jelas field mana yang benar-benar akan tampil di client/storefront
- source of truth preview tetap dari payload backend seller profile existing

### 5. Microsite product detail menampilkan bio toko yang benar

File:
- `client/src/pages/store/StoreMicrositeProductDetailPage.jsx`

Perubahan:
- compact store shell pada route `/store/:slug/products/:productSlug` sekarang memakai `store.description`
- fallback tetap aman jika bio kosong

Hasil:
- store identity tetap konsisten saat user pindah dari store microsite ke product detail di bawah slug toko yang sama

## Boundary check

- tenant boundary: tetap store-scoped
- auth boundary: tidak berubah
- permission boundary: seller edit tetap lewat `seller.storeProfile`
- admin authority: tetap tidak berubah
- public storefront route: tetap `/store/:slug`
- schema/database: tidak berubah
- payout/coupon/analytics: tidak disentuh

## Acceptance criteria status

- Storefront publik menampilkan identitas toko seller dari source of truth backend: ✅
- Nama toko tampil konsisten antara seller workspace dan client/storefront: ✅
- Logo/cover/fallback tampil aman jika data belum lengkap: ✅
- Bio/deskripsi singkat tampil jika tersedia: ✅
- Tidak ada field internal/admin-only yang bocor ke client: ✅ contract publik dibatasi di serializer shared
- Route store/microsite tetap stabil: ✅
- Tidak merusak flow product detail/listing existing: ✅
- `pnpm --filter server build` lulus: ✅
- `pnpm --filter client build` lulus: ✅

## Validasi build

- `pnpm --filter server build`
- `pnpm --filter client build`

Hasil:
- keduanya lulus pada 2026-03-26
- build client tetap hanya memberi warning chunk size non-blocking

## Risiko residual kecil

- global marketplace header route non-slug masih mengikuti contract existing `identity` default store, karena scope task ini fokus ke seller store slug/microsite dan public seller identity sync.
- rich-about microsite tetap customization-owned; seller bio dari `Store.description` hanya menjadi fallback/default public summary, bukan menggantikan rich content admin customization.
