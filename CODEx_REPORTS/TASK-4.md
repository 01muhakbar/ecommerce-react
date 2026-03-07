# TASK-4 - MVF Parity Audit + Polish Prioritas Tinggi pada Storefront

## Task ID

`TASK-4`

## Objective

Melakukan audit parity terhadap flow Storefront MVF dan memoles 2 area visual/UX dengan dampak tertinggi agar lebih dekat ke arah KachaBazar, tanpa menambah fitur baru dan tanpa mengubah flow data.

## Audited Pages

- `/` via `client/src/pages/store/KachaBazarDemoHomePage.jsx`
- `/cart` via `client/src/pages/store/StoreCartPage.jsx`
- `/checkout` via `client/src/pages/store/Checkout.jsx`
- `/order/:ref` via `client/src/pages/store/StoreOrderTrackingPage.jsx`
- Referensi visual: `https://kachabazar-store-nine.vercel.app`

## Key Parity Gaps

1. `Cart`
   - Summary card masih fungsional, tetapi hierarchy visual belum cukup kuat.
   - CTA checkout belum terasa seutama pola KachaBazar.
   - Informasi "apa yang akan terjadi di langkah berikutnya" masih lemah.

2. `Order Tracking`
   - Halaman terlalu invoice-first.
   - Status order sudah ada, tetapi progress dan next-step clarity belum menonjol.
   - Reassurance block dan struktur status belum sekuat referensi storefront e-commerce.

3. `Checkout`
   - Sudah cukup kuat dari task sebelumnya, jadi bukan prioritas polish tertinggi pada task ini.

4. `Home`
   - Sudah paling dekat ke arah KachaBazar dibanding halaman MVF lainnya.

## Selected Polish Areas

1. `Cart summary hierarchy + CTA clarity`
2. `Order tracking status clarity + top-level hierarchy`

## Files Changed

- `client/src/pages/store/StoreCartPage.jsx`
- `client/src/pages/store/StoreOrderTrackingPage.jsx`
- `CODEx_REPORTS/TASK-4.md`

## What Changed

### `client/src/pages/store/StoreCartPage.jsx`

- Memperkuat hero/header cart dengan eyebrow label, copy yang lebih jelas, dan item count badge.
- Memperkuat summary card dengan blok `Estimated Total` yang lebih dominan.
- Menambahkan explanatory note bahwa shipping/tax difinalkan di checkout.
- Mempertegas CTA `Proceed to Checkout` agar lebih menonjol.

### `client/src/pages/store/StoreOrderTrackingPage.jsx`

- Menambahkan top tracking hero dengan status-aware title, reference chip, status chip, dan date chip.
- Menambahkan card `Next Step` supaya user langsung paham konteks order saat ini.
- Menambahkan visual progress section 4 tahap: received, processing, on delivery, delivered.
- Menambahkan cancelled-state treatment yang lebih jelas untuk progress section.

## Before vs After

### Before

- `Cart` terasa seperti daftar item + summary biasa, dengan total dan CTA yang belum cukup dominan.
- `Order tracking` lebih mirip invoice mentah; status ada, tetapi belum menjadi pusat perhatian pertama.

### After

- `Cart` sekarang lebih punya hierarchy seperti storefront e-commerce modern: headline, summary emphasis, total highlight, dan CTA yang lebih jelas.
- `Order tracking` sekarang membuka dengan reassurance + progress context dulu, baru invoice detail di bawahnya.

## Verification Run

1. `pnpm --filter client exec vite build`
   - PASS
2. `pnpm qa:mvf`
   - PASS
3. QA artifact:
   - `.codex-artifacts/qa-mvf/20260306-220621/result.json`
   - `.codex-artifacts/qa-mvf/20260306-220621/summary.txt`

## MVF Impact

- Home: PASS
- Cart: PASS
- Checkout: PASS
- Checkout success: PASS
- Order tracking: PASS
- Search: PASS
- Product detail: PASS
- Admin login/orders/update status persist: PASS

## Risks / Follow-up

- Tracking page masih memuat invoice table yang padat; parity penuh ke storefront reference masih butuh fase polish lanjutan, bukan task ini.
- Cart drawer di layout masih mengikuti hierarchy lama; saya sengaja tidak redesign drawer agar scope tidak melebar.
- Checkout masih punya peluang polish pada grouping field dan side summary, tetapi tidak saya sentuh di task ini karena cart/tracking memberi ROI parity yang lebih tinggi.

## Recommended Next Task

`[TASK-5] Checkout Parity Polish - Form Grouping + Summary CTA Hierarchy`

## Final Status

`PASS`
