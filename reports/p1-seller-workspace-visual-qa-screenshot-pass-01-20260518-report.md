# P1-SELLER-WORKSPACE-VISUAL-QA-SCREENSHOT-PASS-01 Report

Tanggal: 2026-05-18

## Scope

Visual QA screenshot pass untuk Seller Workspace:
- Payment Setup / Payment Profile
- Store Profile Seller
- Orders
- Order Detail
- Payment Review
- Team
- Team Audit

Viewport yang dicek:
- Desktop 1440px
- Tablet 768px
- Mobile 390px

Artefak screenshot:
- `.codex-artifacts/p1-seller-workspace-visual-qa-20260518/`
- Summary: `.codex-artifacts/p1-seller-workspace-visual-qa-20260518/summary.json`

## Audit Existing

Yang sudah baik:
- Halaman Seller sudah memakai data backend store-scoped dan route `/seller/stores/:storeId/...`.
- Badge payment, readiness, role, order, dan review sudah tersedia.
- Payment Setup sudah menjaga batasan admin approval dan tidak mengklaim checkout memakai draft.
- Payment Review tetap memposisikan seller sebagai reviewer proof.
- Order Detail tetap menampilkan item dari snapshot transaksi.

Temuan visual:
- Mobile/tablet awalnya hanya menampilkan sidebar sehingga konten halaman tidak terlihat.
- Beberapa copy masih terlalu internal untuk seller, seperti `raw payload`, `metadata`, `backend`, `AUDIT_LOG_VIEW`, `Log #`, `Member #`, dan role/status mentah.
- Team dan Team Audit memakai grid lebar yang kurang nyaman di mobile.
- Dense Orders table perlu scroll horizontal terkontrol agar tidak membuat root overflow.

## Patch

Backend runtime:
- Tidak ada perubahan backend runtime.
- Tidak ada perubahan schema, auth, permission, lifecycle order/payment/fulfillment, payment authority, atau readiness gate.

Frontend:
- `SellerLayout.jsx`
  - Sidebar seller menjadi drawer pada layar kecil.
  - Konten halaman langsung terlihat pada mobile/tablet.
  - Copy page metadata dibuat lebih seller-friendly.
- `SellerPaymentProfilePage.jsx`
  - Copy QRIS payload, editable fields, provider/payment type dibuat lebih manusiawi.
- `SellerStoreProfilePage.jsx`
  - Copy internal `metadata/backend/source of truth` disanitasi menjadi bahasa seller-friendly.
- `SellerPaymentReviewPage.jsx`
  - Copy governance dari backend disanitasi sebelum tampil.
  - Role badge diformat agar tidak tampil sebagai raw code.
- `SellerOrdersPage.jsx`
  - Dense table diberi horizontal scroll lokal tanpa root overflow.
  - Copy loading/status dan blocked reason disanitasi.
- `SellerOrderDetailPage.jsx`
  - Copy blocked fulfillment/shipment disanitasi.
  - Permission raw code diganti label seller-friendly.
- `SellerTeamPage.jsx`
  - Role/access/status raw code diformat.
  - Team member grid menjadi stacked mobile cards.
- `SellerTeamAuditPage.jsx`
  - Audit grid menjadi stacked mobile cards.
  - Audit labels dibuat human-readable.

QA tooling:
- `tools/qa/seller-workspace-visual-qa.ts`
  - Menjalankan server/client lokal, membuat fixture store-scoped, login seller, membuat order dan payment proof, lalu mengambil screenshot 21 kombinasi page/viewport.
  - Mengecek root horizontal overflow dan copy internal yang terlihat.

## Visual QA Result

Final screenshot pass:
- Screenshots captured: 21
- Root horizontal overflow: 0
- Developer/internal copy hits: 0

Halaman mobile/tablet kini menampilkan konten utama, bukan hanya sidebar.

## Admin/Seller/Client Sync

Admin:
- Tidak ada perubahan authority admin.
- Admin tetap final reviewer untuk payment profile.
- Admin payment proof tetap audit/read-only sesuai boundary.

Seller:
- UX Seller lebih jelas pada layar mobile/tablet.
- Payment proof review tetap seller approve/reject.
- Fulfillment tetap mengikuti backend actionability dan payment status.
- Team dan Team Audit lebih mudah dibaca tanpa raw permission code.

Client / Storefront:
- Tidak ada perubahan public storefront visibility gate.
- Tidak ada perubahan checkout flow.
- Tidak ada perubahan payment proof submit flow.

Backend API contract:
- Tidak diubah.
- UI hanya memformat copy yang datang dari backend agar tidak tampil developer-only.

## Validasi

Commands:
- `pnpm -F client build` PASS
- `pnpm -F server build` PASS
- `pnpm qa:e2e:truth` PASS, dijalankan dengan `E2E_TRUTH_API_PORT=3101`
- `git diff --check` PASS
- `pnpm exec tsx tools/qa/seller-workspace-visual-qa.ts` PASS

Catatan:
- Client build tetap menampilkan warning Vite chunk besar. Build sukses dan warning ini sudah ada sebagai karakteristik bundle, bukan blocker task ini.

## Risiko Tersisa

- Orders masih menggunakan dense table pada mobile dengan scroll horizontal lokal. Tidak ada root overflow, tetapi task lanjutan bisa membuat mobile order card list yang lebih kaya.
- Beberapa copy operasional masih berasal dari backend read model; frontend saat ini memformat istilah internal sebelum tampil.

## Next Suggested Task

P1 lanjutan:
- Buat mobile order card list untuk Seller Orders agar status, amount, customer, dan next action langsung terlihat tanpa horizontal scroll.
