# Checkout Stabilization 2026-04-28

## Ringkasan perubahan

Workflow checkout distabilkan dengan patch kecil tanpa ubah arsitektur dan tanpa ubah contract API.

Perubahan utama:

- Menyamakan bootstrap auth cookie-based dengan hint session legacy agar reload checkout, admin workspace, dan seller/admin browser surfaces tidak salah jatuh ke state guest/login.
- Mengurangi drift antara cart lokal dan remote cart saat sesi buyer sudah ada tetapi mode cart belum sempat berpindah ke `remote`.
- Memperbaiki middleware auth admin agar request terautentikasi dari cookie storefront tetap masuk ke role gate dan mengembalikan `403` yang benar, bukan `401`, pada route admin yang memang forbidden.

## File diubah

- `client/src/auth/AuthContext.jsx`
- `client/src/hooks/useCart.ts`
- `server/src/middleware/requireAuth.ts`

## Bug yang diperbaiki

- Checkout reload pada sesi cookie-based bisa terlempar ke login karena `AuthContext` hanya membaca `accountSessionHint` / `adminSessionHint`, sementara flow lama dan smoke browser masih memakai hint legacy `authSessionHint`.
- Buyer dengan sesi valid bisa mengalami `checkout preview -> CART_EMPTY` karena bootstrap cart remote terlambat dan aksi cart masih memakai jalur guest sebelum mode remote aktif.
- Route admin tertentu mengembalikan `401` alih-alih `403` untuk user non-admin yang sudah terautentikasi, sehingga shipment regression smoke gagal di guardrail authorization.
- Surface checkout/admin/seller yang bergantung pada session restore kini kembali sinkron pada hard reload dan browser smoke.

## Risiko tersisa

- Tidak ada perubahan contract response backend. Contract order reference, grouped store/suborder, payment profile, payment status, fulfillment/shipment status, dan totals tetap divalidasi lewat smoke suite, tetapi area ini tidak saya refactor.
- Daftar risiko domain seperti invalid variant, stock tidak cukup, inactive payment profile, idempotency submit, cart cleanup setelah order, dan sinkronisasi status order/payment/shipment saat ini tertutup oleh smoke QA yang lulus, namun tidak semuanya membutuhkan perubahan kode tambahan pada patch ini.
- `client build` masih memberi warning chunk size besar pada bundle existing. Ini bukan blocker checkout, tetapi tetap layak jadi tugas terpisah.

## Command QA yang dijalankan

- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm -F server smoke:checkout-variants`
- `pnpm -F server smoke:order-payment`
- `pnpm -F server smoke:shipment-regression`
- `pnpm qa:e2e:truth`

## Hasil QA

- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm -F server smoke:checkout-variants`: PASS
- `pnpm -F server smoke:order-payment`: PASS
- `pnpm -F server smoke:shipment-regression`: PASS
- `pnpm qa:e2e:truth`: PASS

## Rekomendasi next task

- Konsolidasikan penggunaan session hint frontend ke satu nama canonical dan hapus legacy path hanya setelah semua consumer lama sudah dipindahkan serta smoke/browser QA tetap hijau.
- Tambahkan regression smoke yang secara eksplisit memverifikasi cookie-only restore untuk buyer, seller, dan admin tanpa bantuan token localStorage.
