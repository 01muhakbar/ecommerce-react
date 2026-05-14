# P0.3 Attribute Admin/Seller/Client Truth Report

Tanggal: 2026-05-13

## Ringkasan Masalah

Audit menemukan satu mismatch penting di jalur Admin attribute ke Seller product authoring:

- Seller attribute list sudah menampilkan global/admin attributes yang `published=true` dan `status=active`.
- Namun endpoint `GET /api/seller/stores/:storeId/attributes/:attributeId/values` sebelumnya hanya menerima attribute scope `store`.
- Akibatnya Seller bisa melihat attribute Admin aktif, tetapi gagal mengambil value id/label untuk menyusun product variant.

Flow Client/Cart/Checkout/Order sudah memiliki guard runtime:

- Storefront product detail memakai sanitizer attribute variation.
- Cart dan checkout memakai `applyRuntimeVariationSanitizerToProduct`.
- Variant dengan inactive/archived attribute value sudah ditolak di cart dan checkout.
- Order item snapshot menyimpan `variantKey`, `variantLabel`, dan `variantSelections`.

Patch P0.3 menjaga backend sebagai source of truth tanpa menambah mapping field baru.

## File yang Diubah

- `server/src/routes/seller.attributes.ts`
  - Endpoint read values sekarang mengizinkan Seller membaca value dari global/admin attribute yang published, active, dan tersedia di store workspace.
  - Global/admin attribute dikembalikan sebagai read-only: `editable=false`, `managedByAdmin=true`.
  - Archived values untuk global/admin attributes tetap disembunyikan.
  - Store-owned attributes tetap dapat menampilkan archived values untuk halaman manajemen seller.

- `server/src/scripts/smokeSellerAttributes.ts`
  - Menambah regression smoke bahwa Seller bisa membaca values dari published global/admin attribute.
  - Menambah regression smoke bahwa archived global/admin values tidak bocor ke Seller variant selection.
  - Merapikan fixture agar `attribute_values` selalu mendapatkan id melalui fallback query saat driver tidak mengembalikan `insertId`.

## Dampak ke Admin/Seller/Client

- Admin Workspace:
  - Tidak ada perubahan Admin UI/API.
  - Attribute Admin yang published/active sekarang benar-benar bisa menjadi definisi variant Seller.

- Seller Workspace:
  - Seller dapat mengambil values dari global/admin attributes untuk product variant composition.
  - Seller tetap tidak bisa mengedit global/admin attribute values lewat endpoint seller.
  - Store-owned attribute behavior tetap sama.

- Client/Storefront:
  - Client hanya menerima variations yang lolos sanitizer runtime.
  - Archived/inactive attribute values tetap tidak tampil di public variant selector.

- Cart/Checkout/Order:
  - Variant selection tetap divalidasi ulang di cart dan checkout.
  - Order snapshot tetap membawa `variantSelections`, sehingga label/value attribute tidak hilang di Buyer/Seller/Admin order detail.

## Validasi yang Dijalankan

- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:product-visibility`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:checkout-coupons`
- `cmd /c "cd server && pnpm.cmd exec tsx src/scripts/smokeSellerAttributes.ts"`

## Hasil Validasi

- PASS: `pnpm.cmd -F server build`
- PASS: `pnpm.cmd -F client build`
  - Catatan: Vite masih memberi warning chunk `vendor-misc` > 500 kB; ini warning existing, bukan blocker P0.3.
- PASS: `pnpm.cmd -F server smoke:product-visibility`
- PASS: `pnpm.cmd -F server smoke:checkout-variants`
- PASS: `pnpm.cmd -F server smoke:checkout-coupons`
- PASS: `cmd /c "cd server && pnpm.cmd exec tsx src/scripts/smokeSellerAttributes.ts"`

## Risiko Tersisa

- Smoke P0.3 mengunci backend contract; belum ada Playwright UI coverage untuk memastikan Seller Product Authoring menampilkan read-only global/admin values dengan state visual yang ideal.
- Store-owned attributes masih menampilkan archived values pada endpoint values karena halaman manajemen seller membutuhkan informasi usage/archive. Product authoring harus tetap memakai status dari response atau backend runtime validation sebagai pengaman.
- Build client masih memiliki warning ukuran chunk existing.

## Next Task Disarankan

1. Tambahkan smoke kecil untuk Seller product create/update memakai global/admin attribute value langsung dari endpoint seller values.
2. Tambahkan UI/E2E coverage Seller Product Authoring untuk pilih Admin global attribute, generate variant, buka storefront detail, add cart, checkout, lalu cek order snapshot.
3. Audit apakah halaman authoring perlu filter UI eksplisit `status=active` untuk store-owned archived values, walaupun backend checkout sudah memblokir value inactive.
