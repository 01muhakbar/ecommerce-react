# Coupon Dashtar IDR 2026-04-28

## Ringkasan perubahan

Halaman Coupon Admin dan Seller disamakan ke pola Dashtar secara minimal tanpa rewrite business logic coupon. Backend coupon juga dilengkapi agar contract Admin dan Seller konsisten untuk `campaignName`, `bannerImageUrl`, status publish, dan integer Rupiah.

Perubahan utama:

- Menambahkan field persisted `campaignName` pada model coupon dengan fallback kompatibel ke `code`.
- Mengaktifkan `bannerImageUrl` pada create/update coupon Admin dan Seller.
- Menambahkan soft delete Seller Coupon dengan deactivation (`active=false`) agar seller tidak menghapus data fisik.
- Menyamakan serializer coupon Admin, Seller, dan public snapshot agar expose `campaignName`, `bannerImageUrl`, integer `amount`, integer `minSpend`, dan `published`.
- Menyesuaikan UI list dan drawer coupon Admin/Seller ke pola Dashtar: search, filter, action dropdown, published toggle, status badge, dan right drawer form.
- Menstandarkan fixed amount ke Rupiah integer di backend dan format `Rp` di UI.

## File diubah

- `server/src/models/Coupon.ts`
- `server/src/services/coupon.service.ts`
- `server/src/services/couponGovernance.ts`
- `server/src/routes/admin.coupons.ts`
- `server/src/routes/seller.coupons.ts`
- `server/migrations/20260428103000-add-campaign-name-to-coupons.cjs`
- `client/src/api/sellerCoupons.ts`
- `client/src/api/store.types.ts`
- `client/src/components/admin/coupons/AddCouponDrawer.jsx`
- `client/src/components/admin/coupons/EditCouponDrawer.jsx`
- `client/src/components/seller/coupons/SellerCouponDrawer.jsx`
- `client/src/pages/admin/AdminCouponsPage.jsx`
- `client/src/pages/seller/SellerCouponsPage.jsx`

## Migration yang dibuat

- `server/migrations/20260428103000-add-campaign-name-to-coupons.cjs`

Isi migration:

- Menambah kolom `campaign_name` bila belum ada.
- Backfill `campaign_name` dari `code` untuk row lama yang kosong.
- Menormalkan `amount` dan `min_spend` ke nilai integer Rupiah yang aman.

## UI yang disamakan dengan Dashtar

- Admin Coupon dan Seller Coupon sekarang memakai header `Coupon` dan subtitle `Manage discount coupons`.
- Search placeholder menjadi `Search by name or code...`.
- Top action bar memakai pola Dashtar: filter `Published`, filter `Status`, tombol `Export`, `Import`, `Bulk Action`, `Delete`, dan `Add Coupon`.
- Tabel list memakai kolom: checkbox, campaign name, code, discount, published, start date, end date, status, actions.
- Actions per row dipindah ke menu tiga titik dengan opsi `Edit` dan `Delete`.
- Add/Edit Coupon memakai drawer kanan, bukan halaman penuh.
- Status badge dirapikan ke `Active`, `Expired`, `Scheduled`, dan `Draft / Inactive`.

Catatan:

- Tombol `Export` dan `Import` di Seller hanya parity UI dan tetap non-aktif karena repo belum punya seller export/import coupon flow, dan task ini tidak menambah fitur baru di luar scope aman.

## Perubahan format Rupiah

- Fixed discount dan minimum amount di UI memakai prefix `Rp`, bukan `$`.
- Display fixed discount memakai format Rupiah, misalnya `Rp25.000`.
- Percentage tetap tampil sebagai `10%`, `50%`, dan seterusnya.
- Payload backend tetap menyimpan `amount` dan `minSpend` sebagai number integer Rupiah, bukan string berformat.
- Serializer backend menormalkan `amount` dan `minSpend` agar Admin, Seller, dan public coupon snapshot membaca angka integer yang konsisten.

## Backend/API yang disentuh

- Admin coupon create/update/import sekarang menerima dan menyimpan `campaignName` serta `bannerImageUrl`.
- Seller coupon create/update sekarang menerima dan menyimpan `campaignName` serta `bannerImageUrl`.
- Seller coupon delete sekarang memakai soft delete lewat route tenant-scoped yang menonaktifkan coupon milik store sendiri.
- Query list Admin sekarang bisa mencari berdasarkan `code` atau `campaign_name`.
- Public coupon serialization tetap menolak coupon inactive/expired dan sekarang ikut membawa field baru yang aman dipakai UI.

## Hasil QA

Command yang dijalankan:

- `pnpm -F server migrate`
- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm -F server smoke:order-payment`
- `pnpm -F server smoke:store-customization-offers`
- `pnpm qa:e2e:truth`

Hasil:

- `pnpm -F server migrate`: PASS
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm -F server smoke:order-payment`: PASS
- `pnpm -F server smoke:store-customization-offers`: PASS
- `pnpm qa:e2e:truth`: PASS

Catatan QA:

- Repo tidak memiliki smoke script coupon checkout yang lebih spesifik dari ini.
- `smoke:store-customization-offers` dipakai untuk memverifikasi coupon snapshot publik, inactive handling, expired handling, dan deleted-selection handling.
- Manual browser check untuk 8 poin Admin/Seller/Client belum saya jalankan dalam task ini.

## Risiko tersisa

- Admin filter `Published` dan `Status` saat ini diterapkan client-side pada page result yang sedang dimuat, bukan query filter backend baru.
- Tipe kolom lama untuk nilai coupon di database tidak saya ubah; normalisasi integer Rupiah dijaga di migration dan application layer.
- Seller `Delete` sekarang deactivate coupon, jadi histori data tetap ada. Jika nanti dibutuhkan audit trail eksplisit, itu perlu task lanjutan terpisah.
- UI Dashtar diikuti sebagai pola layout dan interaction, bukan copy 1:1. Beberapa detail visual masih mengikuti design system repo saat ini.

## Next recommended task

- Tambahkan smoke khusus coupon checkout yang memverifikasi `minimumAmount`, `expired`, `inactive`, `fixed`, dan `percentage` langsung pada flow apply coupon di checkout.
- Tambahkan backend query filter resmi untuk `published` dan `status` jika list coupon sudah perlu pagination/filter server-side yang lebih besar.
