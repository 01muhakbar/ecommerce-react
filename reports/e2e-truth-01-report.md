# E2E-TRUTH-01

## Framework yang dipakai

- Reuse pola QA live existing: `tsx` script + Playwright headless + backend app in-process + Vite dev server.
- Browser coverage baru ditaruh di `tools/qa/e2e-truth-smoke.ts`.
- Fixture dibuat additive via model/API yang sudah dipakai smoke server existing, tanpa refactor harness bersama.

## Flow yang dicakup

- Client:
  - buka product detail valid
  - klik add to cart
  - buka cart
  - buka checkout
  - verifikasi backend preview aktif tetap menghasilkan readiness/payment labels yang sama
  - setelah payment profile store dimatikan, verifikasi checkout tetap mem-pause CTA utama
- Admin:
  - buka payment audit list hasil order yang sama
  - verifikasi parent order status dan parent payment state tampil berdampingan pada row list
- Seller:
  - buka seller order detail untuk suborder yang sama
  - verifikasi seller status dan store split payment label tetap sinkron dengan state backend

## File yang diubah

- `package.json`
- `tools/qa/e2e-truth-smoke.ts`

## Gap yang belum tercakup

- Client checkout live DOM belum mengassert badge/store-group label langsung dari render preview component karena lane dev proxy di smoke ini masih memunculkan preview fetch instability/CORS pada browser path tertentu.
- Verifikasi client truth untuk readiness/payment preview tetap dicek dari endpoint preview yang sama di smoke helper, lalu browser tetap mengecek CTA utama agar tidak misleading.
- Belum ada coverage browser untuk checkout success, tracking, account orders, atau account payment di task ini.

## Residual risk

- Smoke browser client saat ini lebih kuat pada guardrail CTA daripada render detail preview group di DOM.
- Harness live masih sensitif terhadap bootstrap auth/cart frontend, jadi perubahan besar di auth hydration bisa mempengaruhi stabilitas smoke ini walau order/payment contract backend tetap benar.

## Rekomendasi next task

- Tambahkan selector/test hook kecil non-visual di checkout untuk state preview group aktif, supaya smoke browser bisa mengassert readiness/payment labels langsung dari DOM tanpa bergantung pada copy global atau fallback error state.
