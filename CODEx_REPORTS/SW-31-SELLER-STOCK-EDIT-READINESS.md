# SW-31 - Seller Stock Edit Readiness

## 1. Executive Summary

Domain inventory seller di repo `ecommerce-react` saat ini cukup matang untuk membuka mutation katalog pertama yang sempit: stock edit pada level `Product.stock` saja. Entry point yang paling aman bukan bulk update, bukan variant stock, dan bukan inventory management penuh, tetapi single-field update yang seller-scoped by `Product.storeId`.

Rekomendasi final:

- field yang aman diubah sekarang: `Product.stock`
- mode mutation paling aman: `absolute set`
- endpoint readiness paling aman: `PATCH /api/seller/stores/:storeId/products/:productId/stock`
- entry point UI paling aman: seller product detail page, bukan list inline
- dependency besar yang tetap ditahan: variant stock, overselling redesign, preorder inventory semantics, stock history framework, bulk adjustment

## 2. Current Inventory Baseline

### 2.1 Product Model

Model aktif di [server/src/models/Product.ts](c:/Users/user/Documents/ecommerce-react/server/src/models/Product.ts) menunjukkan bahwa inventory runtime saat ini masih bertumpu pada satu field utama:

- `stock: number`

Field inventory lain yang ada tetapi belum inventory-native:

- `preOrder: boolean`
- `preorderDays: number | null`
- `variations: JSON | null`
- `wholesale: JSON | null`

Tidak ditemukan model variant stock terpisah, warehouse stock, reservation layer, atau inventory ledger khusus.

Kesimpulan baseline:

- inventory phase sekarang adalah single-stock-per-product
- `Product.stock` adalah field inventori yang benar-benar dipakai di runtime aktif
- mutation seller yang aman hanya boleh menyasar field ini dulu

### 2.2 Admin Product Baseline

Route admin products aktif di [server/src/routes/admin.products.ts](c:/Users/user/Documents/ecommerce-react/server/src/routes/admin.products.ts).

Hal penting yang sudah aktif di admin:

- `stock` divalidasi sebagai integer valid
- nilai disanitasi dengan `Math.max(0, Math.round(...))`
- schema admin juga mengunci `stock` ke integer `min(0)`

Artinya repo ini sudah punya preseden kuat bahwa:

- stock tidak boleh negatif
- stock diperlakukan sebagai integer absolut, bukan decimal

### 2.3 Storefront / Checkout Baseline

Storefront dan checkout aktif membaca `Product.stock` secara langsung:

- [server/src/routes/store.ts](c:/Users/user/Documents/ecommerce-react/server/src/routes/store.ts)
- [server/src/routes/checkout.ts](c:/Users/user/Documents/ecommerce-react/server/src/routes/checkout.ts)
- [client/src/pages/store/StoreProductDetailPage.jsx](c:/Users/user/Documents/ecommerce-react/client/src/pages/store/StoreProductDetailPage.jsx)

Perilaku aktif yang relevan:

- product detail storefront membaca `stock` untuk label availability
- cart / checkout membatasi quantity terhadap `stock`
- create order / checkout mengurangi `stock` langsung saat transaksi commit
- checkout mengembalikan `409 Insufficient stock` bila qty melebihi stock saat validasi

Kesimpulan:

- stock update seller akan langsung mempengaruhi availability storefront dan validasi checkout
- ini aman dibuka hanya jika mutation tetap sempit dan menjaga invariant `stock >= 0`

## 3. Inventory Risk Assessment

### 3.1 Risk Yang Rendah

- read/write ke `Product.stock` tunggal
- tenant scope by `Product.storeId`
- integer non-negative validation
- seller mutation via route sendiri tanpa menyentuh admin route

### 3.2 Risk Yang Sedang

- race condition jika admin dan seller mengubah stock produk yang sama berdekatan
- perubahan stock seller langsung mempengaruhi storefront availability
- produk dengan `preOrder=true` masih memakai `stock` yang sama, belum punya semantics inventori terpisah

### 3.3 Risk Yang Tinggi

- variant-level stock
- stock adjustment berbasis delta tanpa audit/ledger
- publishability coupling
- overselling / reservation redesign
- bulk inventory operation

## 4. Safe Mutation Scope

### Safe Field List

Field yang aman diubah sekarang:

- `Product.stock`

Field yang tidak aman diubah sekarang sebagai bagian stock edit:

- `status`
- `isPublished`
- `price`
- `salePrice`
- `preOrder`
- `preorderDays`
- `variations`
- `wholesale`
- category fields
- media fields

### Safe Scope Statement

Scope aman phase pertama:

- update satu angka stock absolut untuk satu product
- hanya pada product yang tenant-scoped ke `storeId` seller saat ini
- tanpa menyentuh field lain

## 5. Out-of-Scope Inventory Features

Fitur yang harus tetap ditunda:

- variant stock
- warehouse stock
- reserved stock
- stock movement history framework penuh
- bulk stock edit
- import/export stock
- stock sync lintas marketplace
- preorder stock redesign
- bundle/composite stock
- auto publish/unpublish berdasarkan stock

## 6. Mutation Guardrails

### 6.1 Access and Scope Guardrails

- wajib memakai `requireSellerStoreAccess`
- permission key paling tepat: `INVENTORY_MANAGE`
- tenant filter wajib: `Product.storeId = :storeId`
- `Product.userId` tidak boleh dijadikan filter utama
- product yang tidak cocok `storeId` harus diperlakukan sebagai not found aman

### 6.2 Validation Guardrails

- payload hanya menerima `stock`
- `stock` wajib integer
- `stock >= 0`
- value kosong / NaN / decimal invalid harus ditolak
- nilai sangat besar sebaiknya dibatasi secara wajar pada validasi aplikasi

Rekomendasi batas aman awal:

- minimum: `0`
- maksimum: `999999`

Tujuannya bukan rule bisnis final, tetapi mencegah input absurd yang berpotensi menimbulkan side effect UI dan checkout.

### 6.3 Product State Guardrails

Rule paling aman untuk phase awal:

- `active`, `inactive`, dan `draft` boleh diubah stock-nya
- `published` maupun non-published tetap boleh diubah stock-nya

Alasan:

- seller memang perlu menyiapkan stock sebelum product public
- memblokir `draft` atau non-public justru menambah coupling yang belum perlu
- checkout/storefront tetap aman karena visibility public masih dikontrol field lain

### 6.4 Mutation Surface Guardrails

- no bulk action
- no delta adjustment mode
- no side effects ke field publish/status
- no media/variant coupling
- no auto audit framework besar di task pertama

## 7. Checkout / Storefront Compatibility Notes

### 7.1 Why This Can Be Opened Safely

Stock edit seller bisa dibuka tanpa redesign besar karena:

- storefront sudah membaca `Product.stock`
- checkout sudah memvalidasi stock sebelum create order
- checkout sudah mengurangi stock saat transaksi commit
- field inventori tunggal sudah konsisten di runtime aktif

### 7.2 What Must Not Be Changed

- jangan ubah cara storefront menentukan availability
- jangan ubah validasi insufficient stock di checkout
- jangan ubah pengurangan stock saat order commit
- jangan ubah publishability logic

### 7.3 Known Runtime Caveat

Mutation stock seller tetap tidak menyelesaikan race condition antar actor. Itu acceptable untuk phase sempit ini karena:

- admin juga hidup di model yang sama
- repo existing memang belum punya reservation layer
- task ini hanya membuka lane mutation paling sederhana, bukan inventory concurrency redesign

## 8. Recommended Mutation Mode

### Options Compared

#### Opsi A - Absolute Set

Set `stock` ke angka final baru.

Pro:

- selaras dengan model existing `Product.stock`
- selaras dengan validasi admin route yang sudah ada
- sederhana untuk seller dan backend
- mudah diverifikasi
- minim ambiguity

Kontra:

- tidak memberi jejak delta movement
- operator harus tahu angka final yang ingin diset

#### Opsi B - Increment / Decrement

Kirim delta `+N` atau `-N`.

Pro:

- terasa natural untuk operasi gudang

Kontra:

- lebih rawan race condition
- perlu semantics tambahan untuk delta negatif
- tanpa history/ledger, sulit diaudit
- membuka ambiguity lebih cepat

#### Opsi C - Support Both

Pro:

- fleksibel

Kontra:

- terlalu dini
- API dan UI jadi lebih kompleks
- mudah mendorong inventory framework yang belum siap

### Final Decision

Mutation mode paling aman: `absolute set`.

Alasan:

- paling konsisten dengan baseline repo
- paling sedikit surface area
- paling kecil risiko semantik
- cocok sebagai mutation seller pertama di domain catalog

## 9. API Readiness Draft

### Recommended Endpoint

`PATCH /api/seller/stores/:storeId/products/:productId/stock`

### Recommended Payload

```json
{
  "stock": 125
}
```

### Recommended Success Response

```json
{
  "success": true,
  "message": "Product stock updated.",
  "data": {
    "id": 1,
    "storeId": 1,
    "stock": 125,
    "updatedAt": "2026-03-10T09:00:00.000Z"
  }
}
```

### Recommended Error Conditions

- `400` invalid stock payload
- `403` seller permission denied
- `404` product not found for store
- `409` optional conflict if later concurrency handling is introduced

### Recommended Error Codes

- `SELLER_FORBIDDEN`
- `SELLER_PERMISSION_DENIED`
- `SELLER_PRODUCT_NOT_FOUND`
- `INVALID_STOCK_VALUE`
- `INVALID_MEMBER_STATUS_TRANSITION` is not relevant here and should not be reused

## 10. Frontend Readiness Draft

### Recommended Entry Point

UI paling aman nanti: seller product detail page.

Target:

- [client/src/pages/seller/SellerProductDetailPage.jsx](c:/Users/user/Documents/ecommerce-react/client/src/pages/seller/SellerProductDetailPage.jsx)

### Why Not List Inline First

Inline edit di list lebih berisiko karena:

- mudah salah target saat banyak row
- menyulitkan feedback error per-row
- terlalu cepat mendorong bulk editing mental model

### Recommended UI Shape

- satu card sederhana `Inventory`
- field numeric tunggal untuk stock
- tombol `Save stock`
- loading state jelas
- success/error feedback jelas
- tetap read-heavy, mutation kecil

## 11. Validation Rules

Validation yang direkomendasikan untuk runtime nanti:

- `stock` required
- integer only
- `0 <= stock <= 999999`
- reject decimal
- reject negative
- reject empty string / NaN

Normalisasi yang direkomendasikan:

- jangan diam-diam clamp input seller
- lebih aman fail-fast daripada auto-correct, supaya operator tahu nilai yang dikirim salah

Catatan:

- admin route saat ini memakai normalisasi `Math.max(0, Math.round(...))`
- untuk seller lane baru, fail-fast lebih aman agar UX seller tidak menyembunyikan input error

## 12. Recommended Rollout

### Phase 1

- stock edit absolute set pada seller product detail
- satu product per request
- no bulk
- no variant stock

### Phase 2

- optional small polish di seller product list untuk refresh badge stock read-only
- optional audit trail ringan jika memang dibutuhkan operasional

### Phase 3

- baru evaluasi apakah price edit bisa dibuka dengan pola guardrail serupa

## 13. Acceptance Criteria for Future Implementation

Task implementasi stock runtime berikutnya dianggap siap bila:

- hanya mengubah `Product.stock`
- memakai `INVENTORY_MANAGE`
- tenant scope by `Product.storeId`
- product lain store lain tidak bisa disentuh
- negative stock ditolak
- decimal stock ditolak
- seller detail page bisa submit dan refresh state
- storefront/admin contract tetap tidak berubah

## 14. Next Task Recommendation

Task implementasi berikutnya paling aman:

`SW-32-SELLER-STOCK-EDIT-RUNTIME`

Scope yang direkomendasikan:

- endpoint `PATCH /api/seller/stores/:storeId/products/:productId/stock`
- absolute set only
- single-field update
- entry point UI di seller product detail page
- no bulk, no delta, no variant stock

---

# SELLER STOCK EDIT READINESS RECOMMENDATION

1. Field stock mana yang paling aman diubah:
   - `Product.stock`

2. Mutation mode paling aman:
   - `absolute set`

3. Guardrail paling kritis:
   - tenant scope wajib `Product.storeId = :storeId` dengan permission `INVENTORY_MANAGE`, dan payload hanya boleh menerima integer non-negative

4. Risiko paling kritis:
   - stock seller yang berubah akan langsung mempengaruhi storefront availability dan checkout validation, sementara repo belum punya reservation/concurrency redesign

5. Apakah siap lanjut ke task implementasi stock edit runtime:
   - `YA`
