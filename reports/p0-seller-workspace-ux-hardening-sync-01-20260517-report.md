# P0 Seller Workspace UX Hardening Sync 01 - 2026-05-17

Task ID: P0-SELLER-WORKSPACE-UX-HARDENING-SYNC-01

## Summary

Seller Workspace UX hardening selesai untuk Payment Setup, Store Profile, Payment Review, Orders, Order Detail, Team, dan Team Audit. Patch dibatasi ke UI/frontend seller dan satu assertion QA. Tidak ada perubahan backend runtime, schema database, auth/session/permission architecture, order lifecycle, payment lifecycle, store readiness gate, atau payment proof authority.

## Audit Existing Implementation

- Payment Setup sudah memakai route store-scoped `/api/seller/stores/:storeId/payment-profile` dan memisahkan active approved setup dari seller request. Gap utama: copy terlalu teknis dan belum ada checklist readiness yang mudah dipahami seller.
- Store Profile sudah menampilkan status, completeness, public storefront preview, shipping setup, dan editable/read-only fields. Gap utama: microcopy masih banyak memakai istilah internal seperti backend governance, snapshot, bridge, dan fallback.
- Payment Review sudah memakai route store-scoped dan actionability dari backend. Gap utama: reject proof belum dipandu dengan alasan wajib di UI.
- Orders sudah memakai route store-scoped `/api/seller/stores/:storeId/suborders` dan fulfillment action berasal dari backend `availableActions`. Gap utama: toolbar menampilkan action disabled/non-production dan belum ada summary cepat.
- Order Detail sudah memakai seller-owned suborder, transaction item snapshot dari backend, payment status, shipment read model, dan fulfillment governance. Gap utama: wording masih internal.
- Team dan Team Audit sudah route store-scoped dan permission-gated. Gap utama: copy masih berbau engineer seperti tenant-scoped, mutation, phase, shell, dan raw permission labels.
- Tidak ditemukan dummy data production flow yang menggantikan backend. Fallback yang ada bersifat empty/loading/read-only display.

## Files Changed

Runtime frontend:

- `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- `client/src/pages/seller/SellerStoreProfilePage.jsx`
- `client/src/pages/seller/SellerPaymentReviewPage.jsx`
- `client/src/pages/seller/SellerOrdersPage.jsx`
- `client/src/pages/seller/SellerOrderDetailPage.jsx`
- `client/src/pages/seller/SellerTeamPage.jsx`
- `client/src/pages/seller/SellerTeamAuditPage.jsx`

Validation:

- `tools/qa/e2e-truth-smoke.ts`

Report:

- `reports/p0-seller-workspace-ux-hardening-sync-01-20260517-report.md`

## Backend Changes

Tidak ada perubahan backend runtime.

Backend contract yang dijaga:

- Payment proof tetap buyer submit, seller approve/reject, admin audit/read-only.
- Fulfillment seller tetap bergantung pada paid split state dan backend actionability.
- Store readiness public tetap `Store.status = ACTIVE` plus active verified payment profile.
- Seller ownership tetap route store-scoped.
- Order detail tetap memakai transaction snapshot dari backend ketika tersedia.

## Frontend Changes

- Payment Setup: menambahkan readiness banner dan checklist active setup, admin verified, QRIS image, dan required request fields. Copy diperjelas bahwa checkout hanya memakai active approved setup.
- Store Profile: memperjelas basic information, public media/address, storefront preview, editable fields, dan shipping setup tanpa istilah internal.
- Payment Review: reject proof sekarang membutuhkan alasan jelas di UI sebelum tombol reject aktif. Header, stats, loading, dan role warning dibuat lebih seller-friendly.
- Orders: menambahkan summary cards untuk visible rows: Pending Payment, Paid, Need Fulfillment, Completed. Toolbar non-production/disabled disederhanakan. Empty state dibuat lebih jelas.
- Order Detail: wording payment, shipment, item snapshot, totals, dan fulfillment action dibuat lebih operasional tanpa mengubah guard/actionability.
- Team: copy team management dibuat lebih human-readable, permission chips diformat dari raw key menjadi label manusiawi.
- Team Audit: copy audit timeline dibuat lebih readable dan read-only, tanpa raw JSON exposure.

## Admin/Seller/Client Sync

- Admin: tidak ada perubahan authority. Admin payment proof tetap audit/read-only. Admin payment setup approval tetap authority untuk active payment setup.
- Seller: UX lebih jelas untuk readiness, payment proof review, order fulfillment, dan team activity. Seller mutation tetap mengikuti permission dan backend actionability.
- Client/Storefront: tidak ada perubahan public visibility, checkout, tracking, atau product readiness. Copy seller tidak mengubah public sell gate.
- Backend API contract: tidak ada endpoint baru dan tidak ada route legacy yang dihapus.

## Validation

- `pnpm.cmd -F server build`: PASS
- `pnpm.cmd -F client build`: PASS, dengan warning Vite existing tentang chunk besar.
- `pnpm.cmd -F server smoke:store-readiness`: PASS
- `pnpm.cmd -F server smoke:product-visibility`: PASS
- `pnpm.cmd -F server smoke:order-payment`: PASS
- `pnpm.cmd -F server smoke:seller-order-ownership`: PASS
- `pnpm.cmd qa:e2e:truth`: PASS setelah dijalankan dengan `E2E_TRUTH_API_PORT=3101` karena port 3001 sedang dipakai proses node lokal.
- `git diff --check`: PASS

## Notes

- Percobaan pertama `pnpm qa:e2e:truth` timeout pada 3 menit.
- Percobaan berikutnya gagal karena port 3001 sudah digunakan oleh proses node lokal. Proses tersebut tidak dimatikan.
- `qa:e2e:truth` kemudian dijalankan di port API alternatif via `E2E_TRUTH_API_PORT=3101`.
- Assertion e2e seller order disesuaikan dengan copy baru `Saved shipment data for this store order` dan `Shipment record`.

## Risks

- Orders summary cards menghitung visible rows pada halaman/filter aktif, bukan global total semua order. Copy sudah menyebut "Visible" agar tidak mengklaim total global.
- Payment Setup masih mengikuti model request/admin approval yang ada. Seller belum bisa mengaktifkan payment setup sendiri, sesuai boundary saat ini.
- Team permission labels diformat untuk keterbacaan, tetapi masih berasal dari permission backend yang sama.

## Next Suggested Task

P1 visual QA screenshot pass untuk Seller Workspace mobile dan desktop pada Payment Setup, Orders, Payment Review, Team, dan Team Audit, terutama table overflow dan action density.
