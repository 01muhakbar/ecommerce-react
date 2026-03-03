# TASK-3 UI Parity Sprint #2 (Cart + Checkout)

## Amati Notes (KachaBazar)

- Visual language dominan: kartu putih dengan border halus, radius besar, aksen hijau untuk CTA utama, dan latar abu lembut.
- Cart feel: daftar item padat namun rapi (thumbnail, nama produk, harga, qty stepper, remove), lalu ringkasan total di panel terpisah.
- Checkout feel: layout dua kolom desktop (form di kiri, order summary di kanan), dan stack vertikal di mobile.
- Summary card menggunakan hierarki harga yang jelas (subtotal/shipping/discount/total) dengan CTA utama menonjol.
- Responsiveness: mobile mempertahankan CTA full-width, spacing ringkas, dan blok informasi tetap terbaca tanpa layout patah.

## Discovery & File Budget

### Route/entry aktif MVF

- `client/src/pages/store/StoreCartPage.jsx` (cart page + cart drawer)
- `client/src/pages/store/Checkout.jsx` (checkout form + order summary)
- `client/src/pages/store/StoreCheckoutSuccessPage.jsx` (success page, kandidat minor alignment jika diperlukan)

### Planned file changes (<=10)

1. `client/src/pages/store/StoreCartPage.jsx`
2. `client/src/pages/store/Checkout.jsx`
3. `client/src/pages/store/StoreCheckoutSuccessPage.jsx` (opsional, hanya jika perlu alignment ringan)

### Actual file changes

1. `client/src/pages/store/StoreCartPage.jsx`
2. `client/src/pages/store/Checkout.jsx`

## Before/After Notes

### Cart page + cart drawer (`StoreCartPage.jsx`)

- Before:
  - Item row masih compact/basic, hierarki harga belum tegas, summary card masih sederhana.
  - Drawer footer belum menonjolkan total secara jelas.
- After:
  - Item row lebih mendekati pola KachaBazar: thumbnail lebih tegas, informasi harga + total item, qty stepper lebih konsisten, remove action tetap stabil.
  - Summary area diperjelas (subtotal + total + dashed separator), badge jumlah item ditampilkan di card summary.
  - Mobile CTA tetap full-width, desktop tetap 2 kolom (items + summary) dengan spacing lebih rapi.

### Checkout layout + summary (`Checkout.jsx`)

- Before:
  - Form sections masih terasa campuran panel abu, hierarchy visual belum sekuat referensi.
  - Order summary card sudah ada, tapi density item row/stepper/button belum konsisten dengan target parity.
  - Tombol submit berpotensi shifting isi saat loading.
- After:
  - Checkout card diberi hierarchy lebih jelas (label “Secure Checkout”, border/shadow lebih konsisten).
  - Form section distandarkan ke card putih ber-border (lebih dekat feel KachaBazar).
  - Order Summary ditingkatkan: item badge, item row lebih rapi, qty control density diseragamkan.
  - Tombol `Place Order` sekarang menjaga stabilitas isi saat loading (`spinner slot` tetap ada), tetap disable saat submit/sync.
  - Tidak ada perubahan API call, payload, ataupun kalkulasi subtotal/discount/total.

## Commands & Results

- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260303-083000/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260303-083000/summary.txt`
- `pnpm --filter client exec vite build` -> PASS
- `pnpm dev` (smoke startup + route readiness)
  - Client ready: `http://localhost:5173`
  - Server ready: `http://localhost:3001`
  - Route checks:
    - `http://localhost:5173/cart` -> `200`
    - `http://localhost:5173/checkout` -> `200`
    - `http://localhost:5173/checkout/success` -> `200`

## Known Gaps + Rekomendasi Task #4

- Pixel parity belum 100% karena implementasi tetap mengikuti komponen/style system lokal repo.
- Cart drawer masih page-level implementation (belum global drawer system), sesuai scope.
- Checkout success page tidak diubah karena alignment saat ini sudah konsisten dan tidak menghambat MVF.
- Typographic scale masih menggunakan token Tailwind lokal, bukan token khusus parity reference.
- Rekomendasi TASK #4: parity sprint untuk `Product Detail + Order Tracking` agar transisi end-to-end store flow lebih seragam dengan acuan KachaBazar.
