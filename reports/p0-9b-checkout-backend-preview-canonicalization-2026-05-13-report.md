# P0.9B Checkout Backend Preview Canonicalization

Tanggal eksekusi: 2026-05-14

## Ringkasan masalah

P0.9 sudah membuat cart selection lebih deterministik dan menambah UI guard, tetapi backend checkout masih menerima `cartId` lama secara eksplisit. Jika client atau stale session mengirim `cartId` lama milik user yang sama, `/api/checkout/preview` dan `/api/checkout/create-multi-store` dapat menghitung cart lama tersebut tanpa error. Ini membuka risiko preview/order memakai cart stale seperti qty 32 atau total Rp400.000/Rp800.000.

## File yang diubah

- `server/src/routes/checkout.ts`
  - Menambahkan `latestCheckoutCartOrder`.
  - `findCartForUser` sekarang memakai resolver latest cart untuk request tanpa `cartId`.
  - Jika `cartId` eksplisit dikirim, cart tersebut harus sama dengan latest cart user.
  - Jika bukan latest, backend mengembalikan 409 `CHECKOUT_CART_STALE`.
  - Error checkout route sekarang bisa mengembalikan 4xx terstruktur, bukan selalu jatuh ke 500.

- `server/src/scripts/smokeCheckoutVariants.ts`
  - Regression backend langsung untuk stale cart:
    - stale Banana qty 32 dibuat dulu,
    - active/latest Banana qty 1 dibuat setelahnya,
    - preview tanpa `cartId` harus qty 1 / subtotal Rp25.000 / grandTotal Rp25.000 / 1 store,
    - preview dengan stale `cartId` harus 409 `CHECKOUT_CART_STALE`,
    - create order dengan stale `cartId` harus 409 `CHECKOUT_CART_STALE`,
    - order tanpa `cartId` harus memakai active cart dan total Rp25.000,
    - additional preview Banana qty 2 harus subtotal/grandTotal Rp50.000 walau ada stale cart qty 32.

- `client/src/pages/store/Checkout.jsx`
  - UI guard dari P0.9 tetap ada sebagai safety net.
  - Guard disesuaikan agar invalid checkout items tetap tampil walau preview groups/summary sedang mismatch.
  - Submit blocker memprioritaskan pesan invalid item/store blocker dibanding pesan sync.

## Dampak ke Admin/Seller/Client

- Admin: tidak ada perubahan flow admin.
- Seller: tidak ada perubahan flow seller.
- Client/Storefront:
  - Jalur normal tidak lagi bergantung pada UI fallback untuk cart kecil.
  - Backend preview/create menjadi canonical terhadap latest cart.
  - Stale explicit cart id ditolak jelas, bukan dihitung diam-diam.

## Validasi yang dijalankan

- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:checkout-coupons`
- `pnpm.cmd qa:e2e:truth`
- `pnpm.cmd qa:public-release`

## Hasil validasi

- PASS: server build.
- PASS: client build.
- PASS: `smoke:checkout-variants`.
- PASS: `smoke:checkout-coupons`.
- PASS: `qa:e2e:truth`.
- PASS: `qa:public-release`.

Catatan validasi:
- Run pertama `smoke:checkout-variants` sempat gagal `ECONNRESET` karena server dev restart setelah patch backend; rerun setelah health OK lulus.
- Run awal `qa:e2e:truth` menangkap guard UI yang menyembunyikan invalid item / salah prioritas pesan blocker; sudah dipatch dan rerun PASS.

## Risiko tersisa

- P1: Data historis duplicate cart masih perlu cleanup/merge terencana bila ingin menghapus cart lama secara permanen.
- P1: Vite chunk-size warning tetap ada.
- P2: Node `[DEP0190]` dari tooling QA tetap ada.
- Production env tetap wajib `COOKIE_SECURE=true` via HTTPS dan `UPLOAD_DIR` tersedia/writable.

## Next task disarankan

- Rencana data maintenance untuk merge/archive duplicate cart per user.
- Tambahkan kolom/state cart `ACTIVE/CHECKED_OUT/ABANDONED` lewat rencana schema terpisah jika ingin definisi active cart yang lebih kuat dari latest-row ordering.
