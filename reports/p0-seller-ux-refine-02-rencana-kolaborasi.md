# Rencana Kolaborasi — P0-SELLER-UX-REFINE-02

## Tujuan
Refine Seller Workspace agar terasa seperti seller control center modern: lebih compact, action-oriented, dan mudah dipahami tanpa mengubah business lifecycle. Fokus perubahan adalah presentasi UI/copy, visual hierarchy, empty state, dan work queue behavior di halaman seller yang sudah ada.

## Scope
Yang akan dikerjakan:
- Polish Store Profile, Payment Setup, Payment Review, Team, Team Audit, dan Orders seller.
- Audit Seller Order Detail, Seller Orders API, seller order backend route, dan admin order route untuk sinkronisasi lifecycle.
- Gunakan data/backend contract existing, tanpa field/status/model baru.
- Buat report rencana dan report akhir.

Yang tidak akan dikerjakan:
- Tidak mengubah auth, permission, tenant boundary, checkout calculation, order/payment/team lifecycle, database schema, atau public API contract.
- Tidak mengganti UI kit/layout aplikasi secara besar.
- Tidak membuat mock permanen.
- Tidak menghapus fitur existing.

## Area Terdampak
- Backend: hanya diaudit; tidak direncanakan disentuh kecuali ditemukan bug mapping kecil.
- Admin Workspace: order, payment review, store profile, dan governance tetap menjadi source sinkronisasi.
- Seller Workspace: visual hierarchy dan microcopy di halaman target.
- Client/storefront: store identity, checkout payment destination, dan order tracking tidak diubah.
- Database: tidak ada perubahan.
- QA/smoke: `pnpm -F client build`, dan `pnpm -F server build` hanya jika backend tersentuh.

## Screenshot-Based UX Issues Found
- Store Profile: terlalu banyak status/card dengan bobot visual mirip; readiness belum cukup mengarahkan satu aksi utama.
- Payment Setup: flow sudah fungsional, tetapi masih terasa sebagai form panjang dan copy internal seperti approval/read model terlalu menonjol.
- Payment Review: sudah bersih, namun summary 0 dan empty state belum terasa seperti work queue.
- Team: summary dan invite ada, tetapi workflow invite bersaing dengan add user/access detail.
- Team Audit: table formal; timeline dan empty state bisa dibuat lebih natural.
- Orders: sudah punya queue table dan status, namun perlu audit agar next action dan status payment/fulfillment lebih tajam tanpa lifecycle baru.

## Temuan Awal Repo
- File terkait:
  - `client/src/pages/seller/SellerStoreProfilePage.jsx`
  - `client/src/pages/seller/SellerPaymentProfilePage.jsx`
  - `client/src/pages/seller/SellerPaymentReviewPage.jsx`
  - `client/src/pages/seller/SellerTeamPage.jsx`
  - `client/src/pages/seller/SellerTeamAuditPage.jsx`
  - `client/src/pages/seller/SellerOrdersPage.jsx`
  - `client/src/pages/seller/SellerOrderDetailPage.jsx`
  - `client/src/components/seller/SellerWorkspaceFoundation.jsx`
  - `client/src/pages/seller/sellerStatusPresentation.js`
- API terkait:
  - `client/src/api/sellerStoreProfile.ts`
  - `client/src/api/sellerPaymentProfile.ts`
  - `client/src/api/sellerPayments.ts`
  - `client/src/api/sellerTeam.ts`
  - `client/src/api/sellerTeamAudit.ts`
  - `client/src/api/sellerOrders.ts`
  - `server/src/routes/seller.orders.ts`
  - `server/src/routes/admin.orders.ts`
- Report lama terkait:
  - `CODEx_REPORTS/SELLER-MVF-01-seller-payment-profile-self-service-2026-03-26.md`
  - `CODEx_REPORTS/SELLER-MVF-02-seller-onboarding-checklist-readiness-gate-2026-03-26.md`
  - `CODEx_REPORTS/SELLER-MVF-03-seller-storefront-identity-sync-2026-03-26.md`
  - `CODEx_REPORTS/SELLER-S2A-order-operations-boundary-review-2026-03-12.md`
  - `CODEx_REPORTS/SELLER-S1B-native-payment-review-cutover-2026-03-12.md`
  - `CODEx_REPORTS/SW-04-PERMISSION-ARCH.md`
  - `reports/p0-seller-workspace-ux-hardening-sync-01-20260517-report.md`
  - `reports/p1-store-readiness-gate-consistency-20260517-report.md`
  - `reports/p0-mvf-order-status-sync-05-2026-05-14-report.md`
  - `reports/p0-payment-proof-01-2026-05-16-report.md`
- Risiko:
  - Copy UI tidak boleh menciptakan status lifecycle baru; harus mapping dari status/readiness existing.
  - Orders harus tetap sinkron dengan Admin Orders dan Client Order Tracking.
  - Payment Setup tidak boleh membuat seller mengira draft langsung dipakai checkout.

## Strategi ACUAN
### Amati
Halaman seller sudah menggunakan `SellerWorkspaceFoundation` dan API adapter yang mengubah backend DTO menjadi read model. Backend seller/admin order route sudah punya allowed status/action dan governance.

### Tiru
Pertahankan pola query/mutation, permission guard, badge tone, card/panel foundation, route helper, dan API adapter existing. Ambil inspirasi Dashtar/Lynk/KachaBazar pada kepadatan informasi, queue, preview, dan CTA yang jelas, bukan menyalin visual mentah.

### Modifikasi
Lakukan perubahan kecil di frontend: hero summary, checklist compact, better empty state, shorter copy, visual preview, table/card hybrid, timeline visual, dan CTA ordering. Tidak menambah contract backend.

## Pages to Refine
- Store Profile
- Payment Setup
- Payment Review
- Team
- Team Audit
- Orders

## Pages Only Audited
- Seller Order Detail akan diaudit dan hanya dipoles kecil bila aman.
- Backend seller/admin orders routes hanya diaudit kecuali ada bug mapping kecil.

## Backend Sync Risk Matrix
| Seller Page | Seller API | Admin Sync | Client Sync | Risk | Action |
|---|---|---|---|---|---|
| Store Profile | seller store profile | admin store profile | public store page | Medium: readiness/payment/shipping wording can imply wrong public availability | UI-only copy mapped to existing profile/readiness/shipping fields |
| Orders | seller orders | admin orders | order tracking | High: status/order/payment/fulfillment lifecycle must stay canonical | Audit backend route/status, polish UI only around existing fields/actions |
| Payment Review | seller payments | admin payment audit | checkout/order payment | High: approve/reject lifecycle affects buyer payment state | Work queue UI only; keep existing mutation actions |
| Payment Setup | seller payment profile | admin payment profile review | checkout payment destination | High: draft/pending/approved affects checkout destination | Step-based UI using activeSnapshot/pendingRequest/readModel only |
| Team | seller team | admin governance if any | none/direct | Medium: permission semantics must remain unchanged | Compact presentation only; no permission/status changes |
| Team Audit | seller audit | admin/security audit if any | none | Low-Medium: audit event semantics must remain exact | Timeline UI using existing action/readModel/delta |

## UI Principles to Apply
- Page header: short eyebrow/title/subtitle, max 2-3 chips, one clear primary action when relevant.
- Readiness/summary: one hero card, then compact checks/metrics.
- Empty state: small icon, short headline, one helper sentence, CTA only when useful.
- Badges: reduce repeated yellow/red badges; use human copy sourced from existing status.
- Copy: short English UI copy such as "2 steps left", "Waiting for review", "Ready for checkout".
- Forms: keep fields, but group visual priority around the next action.

## Tahapan Eksekusi
1. Refine Payment Setup into status header, required checklist, QRIS preview/editor, action bar.
2. Refine Store Profile readiness hero, compact checklist, buyer preview, smaller admin-managed note.
3. Refine Orders as operational queue and audit detail copy/status sync.
4. Refine Payment Review as work queue with tighter empty state and record emphasis.
5. Refine Team summary/invite/member list/role summary.
6. Refine Team Audit filter/timeline/empty state.
7. Build validation and final report.

## Acceptance Criteria
- [ ] Store Profile lebih ringkas, visual, dan action-oriented.
- [ ] Store readiness tidak lagi terasa seperti banyak warning terpisah.
- [ ] Payment Setup terasa seperti step-based setup flow.
- [ ] Payment Review terasa seperti work queue.
- [ ] Team lebih mudah dipahami dan invite workflow lebih jelas.
- [ ] Team Audit terlihat seperti timeline aktivitas modern.
- [ ] Orders diaudit dan jika aman di-polish.
- [ ] Tidak ada lifecycle order/payment/team yang berubah.
- [ ] Tidak ada field backend baru tanpa alasan.
- [ ] Tidak ada mock permanen.
- [ ] Admin/Seller/Client sync matrix dibuat.
- [ ] `pnpm -F client build` PASS.
- [ ] Jika backend tersentuh, `pnpm -F server build` PASS.

## Validasi
Command minimal:
- `pnpm -F client build`

Jika backend tersentuh:
- `pnpm -F server build`

Smoke/manual check:
- [ ] Seller Store Profile shows one readiness narrative and buyer preview.
- [ ] Seller Payment Setup keeps draft/submit/admin review lifecycle intact.
- [ ] Seller Payment Review approve/reject actions stay unchanged.
- [ ] Seller Team invite/manage actions still use existing role/status contract.
- [ ] Seller Team Audit displays same audit events as a timeline.
- [ ] Seller Orders still uses existing payment/fulfillment actions and links to detail.
