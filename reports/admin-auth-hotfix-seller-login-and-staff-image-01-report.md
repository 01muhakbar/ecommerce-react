# ADMIN-AUTH-HOTFIX-SELLER-LOGIN-AND-STAFF-IMAGE-01

## Summary perubahan

Hotfix ini menutup dua issue kecil yang masih aman dipatch tanpa menyentuh arsitektur permission besar:

- akun `seller` sekarang ditolak di `/api/auth/admin/login`
- request create/edit admin staff sekarang dikirim sebagai `multipart/form-data`, sehingga upload `Profile Image` dapat diproses dengan benar oleh backend

## File yang diubah

- `server/src/routes/auth.ts`
- `client/src/api/adminStaff.ts`

## Dampak

- Seller tidak lagi bisa masuk ke lane admin login walau kredensialnya valid untuk lane seller
- Upload image pada create/edit account admin staff sekarang selaras dengan `multer` di backend
- Tidak ada schema DB baru dan tidak ada contract API besar yang berubah

## Verifikasi

- `pnpm -F server build` ✅
- `pnpm -F client build` ✅
- `pnpm qa:admin:staff` ✅

## Risiko / residual issue

- Ini belum mengerjakan permission-per-account untuk `admin/staff`
- Coverage image upload saat ini sudah dibetulkan di request path, tetapi belum ada smoke browser khusus upload file nyata
