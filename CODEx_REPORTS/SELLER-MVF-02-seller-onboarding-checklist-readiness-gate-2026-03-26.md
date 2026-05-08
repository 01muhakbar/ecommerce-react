# SELLER-MVF-02 — Seller Onboarding Checklist + Workspace Readiness Gate

Tanggal: 2026-03-26

## Scope yang dikerjakan

- audit seller workspace home existing
- definisi readiness minimum berbasis data existing
- backend summary/serializer readiness baru
- endpoint seller khusus readiness
- seller home checklist + summary card + CTA lane
- admin read-only visibility atas readiness di page payment profiles
- verifikasi build `server` dan `client`

## Hasil audit awal

- `SellerWorkspaceHome.jsx` sebelumnya masih finance-centric:
  - fokus pada payment review
  - order payment snapshot
  - payment setup readiness read-heavy
- repo aktif sudah punya source data yang cukup untuk readiness minimum:
  - store profile completeness di `seller.storeProfile`
  - payment workflow/readiness di `seller.paymentProfiles` + `storePaymentProfileState`
  - product lifecycle counts di seller catalog route
- tidak perlu migration schema
- tidak perlu ubah auth global
- tidak perlu state machine baru

## Perubahan utama

### 1. Backend readiness service baru

File baru:
- `server/src/services/sellerWorkspaceReadiness.ts`

Isi utama:
- builder checklist `store_profile`
- builder checklist `payment_profile`
- builder checklist `products`
- team item info-only opsional
- overall summary status:
  - `READY`
  - `WAITING_REVIEW`
  - `ACTION_REQUIRED`
  - `IN_PROGRESS`
- next-step picker
- grouped loader untuk:
  - product pipeline summary by store
  - team member summary by store

Readiness minimum yang dipakai:
- store profile: field completeness existing
- payment profile: workflow existing draft/submitted/revision/ready
- products: minimal pipeline existing, complete jika ada minimal 1 product storefront-visible
- team: info-only, tidak memblokir readiness

### 2. Endpoint seller baru

File:
- `server/src/routes/seller.workspace.ts`

Endpoint baru:
- `GET /api/seller/stores/:storeId/workspace-readiness`

Behavior:
- tenant-scoped via `requireSellerStoreAccess(["STORE_VIEW"])`
- memuat:
  - store profile fields
  - active payment snapshot
  - latest open payment request
  - product pipeline summary
  - team summary
- response menjadi source of truth backend untuk checklist seller workspace

### 3. Seller home memakai backend readiness

Files:
- `client/src/api/sellerWorkspace.ts`
- `client/src/pages/seller/SellerWorkspaceHome.jsx`

Perubahan:
- client API baru:
  - `getSellerWorkspaceReadiness(storeId)`
- seller home sekarang menampilkan:
  - summary card readiness
  - progress `%` + `completed/total`
  - next step backend-driven
  - checklist item dengan status badge
  - CTA per lane existing:
    - `STORE_PROFILE`
    - `PAYMENT_PROFILE`
    - `CATALOG`
    - `HOME` untuk item team info-only
- payment setup stat di home sekarang membaca readiness checklist backend, bukan hitung frontend liar
- priority action list kini memprioritaskan `nextStep` readiness jika masih ada gate onboarding

### 4. Admin read-only visibility

Files:
- `server/src/routes/admin.storePaymentProfiles.ts`
- `client/src/api/storePaymentProfiles.ts`
- `client/src/pages/admin/AdminStorePaymentProfilesPage.jsx`

Perubahan:
- admin payload sekarang membawa `workspaceReadiness`
- admin page menampilkan:
  - readiness badge
  - progress summary
  - checklist read-only
- tidak ada authority baru untuk admin maupun seller
- ini hanya visibility sync atas state readiness seller

## Boundary check

- tenant boundary: tetap store-scoped
- auth boundary: tidak berubah
- permission boundary: readiness menyesuaikan visibility role, item yang tidak visible tidak dihitung sebagai checklist required untuk role itu
- admin final authority: tidak berubah
- public storefront contract: tidak berubah
- payout/settlement: tidak disentuh

## Acceptance criteria status

- Seller melihat checklist readiness yang jelas di workspace: ✅
- Setiap item punya status dan CTA yang relevan: ✅
- Payment profile status mengikuti workflow backend existing: ✅
- Product readiness memakai data existing tanpa contract drift: ✅ memakai product pipeline summary existing
- Store profile readiness tercermin jelas: ✅
- Source of truth readiness ada di backend: ✅
- Tidak mengubah authority admin: ✅
- `pnpm --filter server build` lulus: ✅
- `pnpm --filter client build` lulus: ✅

## Verifikasi yang tercakup oleh contract

- seller baru dengan profile belum lengkap:
  - store profile item -> `Needs update`
- seller dengan payment profile draft:
  - payment item -> `Draft incomplete` atau `Ready to submit`
- seller dengan payment profile submitted:
  - payment item -> `Pending review`
- seller dengan revision-needed:
  - payment/product item -> `Needs revision`
- seller dengan minimal 1 product siap:
  - product item -> `Ready`
- seller dengan belum ada produk:
  - product item -> `No products yet`

## Validasi build

- `pnpm --filter server build`
- `pnpm --filter client build`

Hasil:
- keduanya lulus pada 2026-03-26
- build client hanya memberi warning chunk size non-blocking

## Risiko residual kecil

- readiness product saat ini menganggap baseline operasional paling aman adalah minimal 1 product storefront-visible; ini mengikuti contract visibility existing, bukan definisi baru.
- team readiness masih info-only dan belum menjadi blocking gate, sesuai scope task dan agar tidak membuka workflow baru.
