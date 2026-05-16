# P0-SYNC-GATE-01 Report

## Ringkasan
Audit production sync gate Checkout -> Payment -> Order -> Fulfillment -> Tracking selesai.

Flow backend utama sudah sinkron berdasarkan audit statis dan smoke:
- checkout preview dan submit sama-sama membaca cart backend;
- submit memakai snapshot checkout backend dan idempotency key;
- order/payment/suborder/shipment dibuat sebagai backend truth;
- Admin, Seller, Client payment page, dan public tracking membaca read model status yang sama.

Patch minimal yang dilakukan hanya untuk stabilitas QA browser:
- Vite dev proxy sekarang bisa dipaksa ke host API tertentu via `VITE_PROXY_API_HOST`.
- `qa:e2e:truth` memakai `127.0.0.1` untuk proxy test backend agar tidak terkena mismatch `localhost`/IPv6 di Windows.
- Assertion payment redirect di E2E diselaraskan ke kontrak halaman yang ada: halaman payment menampilkan `Order Payment`, invoice, total, instruksi, deadline, dan tracking, bukan banner copy "Order created successfully.".

Tidak ada fitur baru, redesign, schema change, route rename, lifecycle change, atau dummy fallback runtime.

## Scope
- Audit endpoint cart, checkout, payment, seller order, admin order, admin payment audit, public tracking.
- Jalankan build dan smoke wajib.
- Patch minimal hanya pada QA/dev proxy dan assertion smoke yang terbukti menghalangi validasi.

## File Diubah
- `client/vite.config.ts`
- `tools/qa/e2e-truth-smoke.ts`
- `reports/p0-sync-gate-01-2026-05-16-report.md`

## Tidak Diubah
- Database schema/migration.
- Model inti Order, Suborder, Payment, Product, Store, Coupon, Attribute.
- Checkout pricing, payment lifecycle, order lifecycle, fulfillment lifecycle.
- Route publik `/order/:ref` dan backend `/api/store/orders/:ref`.
- Admin/Seller/Client UI layout.

## Admin/Seller/Client Sync Matrix

| Event | Backend Truth | Admin | Seller | Client/Public | Status |
| --- | --- | --- | --- | --- | --- |
| Add to cart | `/api/cart` + `Cart`/`CartItem`, variant line by `cartItemId`/variant snapshot | N/A | N/A | Client cart + checkout reads same backend cart | PASS |
| Checkout preview | `POST /api/checkout/preview` + `prepareCartGroups` | N/A | N/A | Checkout summary from backend preview | PASS |
| Submit order | `POST /api/checkout/create-multi-store` transaction + idempotent invoice when `checkoutRequestKey` exists | `/api/admin/orders` reads created parent order | `/api/seller/stores/:storeId/suborders` reads suborder | Payment page/public tracking reads invoice/order/payment | PASS |
| Payment created | `Payment.status=CREATED`, `Order.paymentStatus=UNPAID`, `Suborder.paymentStatus=UNPAID` | Admin order/payment audit reads UNPAID/CREATED | Seller detail reads UNPAID/CREATED | Client payment/public tracking reads CREATED/actionable | PASS |
| Payment approved | Seller payment review updates payment/suborder/parent aggregation | Admin audit/order reflects PAID | Seller fulfillment actions unlocked | Client/public tracking reflects paid/ready operational truth | PASS |
| Fulfillment update | Seller fulfillment mutation + shipment read model + parent fulfillment aggregation | Admin order/shipping views read updated shipment/status | Seller detail returns updated fulfillment/shipment | Client/public tracking reads updated split/shipping status | PASS |
| Public tracking | `GET /api/store/orders/:ref`, invoice-only public ref lookup | N/A | N/A | `/order/:ref` reads same invoice/status/totals | PASS |

## Validasi
- `pnpm -F server build`: PASS
- `pnpm -F client build`: PASS
- `pnpm -F server smoke:checkout-variants`: PASS
- `pnpm -F server smoke:checkout-coupons`: PASS
- `pnpm -F server smoke:order-payment`: PASS
- `pnpm qa:e2e:truth`: PASS

## Bug/GAP Ditemukan
1. `qa:e2e:truth` awal gagal pada checkout preview browser dengan HTTP 403 karena Vite proxy test menargetkan `localhost` sementara backend test listen di `127.0.0.1`. Ini membuat validasi browser bisa mengenai origin/host yang tidak sama pada Windows.
2. `qa:e2e:truth` masih menunggu copy "Order created successfully.", padahal halaman payment existing tidak menampilkan copy itu. Data order/payment yang wajib justru sudah tampil dan sinkron.

## Patch Minimal
1. Tambah `VITE_PROXY_API_HOST` di `client/vite.config.ts`, default tetap `localhost` agar dev behavior existing tidak berubah.
2. Set `VITE_PROXY_API_HOST=127.0.0.1` di `tools/qa/e2e-truth-smoke.ts` khusus test backend.
3. Ubah assertion payment redirect dari copy sukses non-kontrak ke heading existing `Order Payment`.

## Risiko Tersisa
- `qa:e2e:truth` masih mencetak 404 untuk fixture `/uploads/products/demo.svg`; command tetap PASS.
- `qa:e2e:truth` masih dapat mencetak deadlock MySQL transient pada add-to-cart fixture path; retry existing membuat command PASS.
- Client build masih menampilkan warning Vite chunk size besar; bukan error build.

## Rekomendasi Next Task
Audit kecil berikutnya: stabilisasi noise QA fixture, khususnya demo image 404 dan deadlock transient add-to-cart fixture, tanpa mengubah checkout/payment lifecycle.
