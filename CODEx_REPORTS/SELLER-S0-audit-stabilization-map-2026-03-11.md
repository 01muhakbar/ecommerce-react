# SELLER-S0 — Audit & Stabilization Map

Date: 2026-03-11
Scope: Seller Workspace existing implementation audit only. No application logic changed.

## 1. Seller pages that already exist

| Page | Route | Status | Notes |
| --- | --- | --- | --- |
| Seller Workspace Home | `/seller/stores/:storeId` | Production-ready read | Reads backend seller context and access snapshot. |
| Seller Store Profile | `/seller/stores/:storeId/profile` | Partial write | Can read and patch seller-safe `Store` fields, but most public storefront branding/contact still reads customization. |
| Seller Catalog | `/seller/stores/:storeId/catalog` | Production-ready read | Good tenant-scoped product list read model. No seller create/edit lane yet. |
| Seller Product Detail | `/seller/stores/:storeId/catalog/:productId` | Production-ready read | Good tenant-scoped detail read model. |
| Seller Orders | `/seller/stores/:storeId/orders` | Production-ready read + limited write | Strong suborder read model with phase-1 fulfillment mutation. |
| Seller Order Detail | `/seller/stores/:storeId/orders/:suborderId` | Production-ready read + limited write | Same phase-1 fulfillment guardrail. |
| Seller Payment Profile | `/seller/stores/:storeId/payment-profile` | Partial read | Seller only gets readiness snapshot; edits still live in account/admin lane. |
| Seller Team | `/seller/stores/:storeId/team` | Production-ready phase-1 | Strongest write-heavy seller lane: invite, attach, role update, status, remove. |
| Seller Team Audit | `/seller/stores/:storeId/team/audit` | Production-ready read | Tenant-scoped audit trail for team mutations. |
| Seller Member Lifecycle | `/seller/stores/:storeId/team/:memberId` | Production-ready read | Good lifecycle and audit detail view. |

## 2. Seller endpoints currently present

### Workspace context

- `GET /api/seller/stores/:storeId/context`

### Store profile

- `GET /api/seller/stores/:storeId/profile`
- `PATCH /api/seller/stores/:storeId/profile`

### Catalog

- `GET /api/seller/stores/:storeId/products`
- `GET /api/seller/stores/:storeId/products/:productId`

### Orders / fulfillment

- `GET /api/seller/stores/:storeId/suborders`
- `GET /api/seller/stores/:storeId/suborders/:suborderId`
- `PATCH /api/seller/stores/:storeId/suborders/:suborderId/fulfillment`

### Payment profile readiness

- `GET /api/seller/stores/:storeId/payment-profile`

### Legacy seller payment review lane

- `GET /api/seller/suborders`
- `PATCH /api/seller/payments/:paymentId/review`

Notes:
- This legacy payment review lane is owner-based, not seller-membership-based.
- It bypasses `requireSellerStoreAccess` and resolves store access from `Store.ownerUserId`.

### Team governance

- `GET /api/seller/invitations`
- `POST /api/seller/invitations/:memberId/accept`
- `POST /api/seller/invitations/:memberId/decline`
- `GET /api/seller/stores/:storeId/team/audit`
- `GET /api/seller/stores/:storeId/team`
- `POST /api/seller/stores/:storeId/members/invite`
- `POST /api/seller/stores/:storeId/members/:memberId/reinvite`
- `POST /api/seller/stores/:storeId/members`
- `PATCH /api/seller/stores/:storeId/members/:memberId/role`
- `PATCH /api/seller/stores/:storeId/members/:memberId/remove`
- `PATCH /api/seller/stores/:storeId/members/:memberId/status`
- `GET /api/seller/stores/:storeId/members/:memberId/lifecycle`

## 3. Seller permission matrix

Core seller access is resolved by backend service `resolveSellerAccess` with:

- tenancy boundary: `storeId`
- actor identity: authenticated `userId`
- access mode: `OWNER_BRIDGE` or `MEMBER`
- permissions: derived from `StoreRole.code`

### Effective role-to-lane matrix

| Role | Profile | Catalog | Orders | Payment Profile | Team | Audit |
| --- | --- | --- | --- | --- | --- | --- |
| `STORE_OWNER` | View/Edit | View/Create/Edit/Publish | View/Fulfillment | View/Edit | Full manage | View |
| `STORE_ADMIN` | View/Edit | View/Create/Edit/Publish | View/Fulfillment | View/Edit | Full manage | View |
| `CATALOG_MANAGER` | View only | View/Create/Edit/Publish | No | No | No | No |
| `MARKETING_MANAGER` | View only | View only | No | No | No | No |
| `ORDER_MANAGER` | View only | View only | View/Fulfillment | No | No | No |
| `FINANCE_VIEWER` | View only | No | View only | View only | No | View |
| `CONTENT_MANAGER` | View/Edit | No | No | No | No | No |

Important implementation notes:

- Owner access can succeed even if `StoreMember` is missing, via lazy owner bridge/backfill.
- Page visibility in seller frontend mostly follows `permissionKeys` from context.
- Team routes intentionally require management permissions even for view access.

## 4. Source of truth matrix by domain

| Domain | Seller source of truth | Admin source of truth | Client/storefront consumption | Assessment |
| --- | --- | --- | --- | --- |
| Access / tenancy | `resolveSellerAccess`, `Store`, `StoreMember`, `StoreRole` | Admin not primary | N/A | Good baseline for MVF-1 |
| Store profile | `Store` via seller profile route | Admin store customization still owns public branding/content | Public identity route reads `Store`, but storefront header/contact/content mostly read customization | Split source of truth |
| Catalog visibility | `Product.storeId`, `status`, `isPublished` | Admin product governance still authoritative for full product admin lane | Public listing depends on active + published products | Mostly aligned, still read-heavy |
| Orders / fulfillment | `Suborder` + `SuborderItem` + payment snapshot | Admin sees parent order + suborders + payment audit | Client order flow still rooted in parent `Order`, checkout split produces `Suborder` | Good MVF-4 baseline |
| Payment profile readiness | Seller reads `StorePaymentProfile` snapshot | Admin reviews through `/api/admin/stores/:storeId/payment-profile/review` | Checkout/payment flow consumes approved payment profile | Read/write split is explicit |
| Payment proof review | Legacy seller route uses owner-owned `Store` + `Payment` + `Suborder` | Admin payment audit also operates here | Client uploads proof in buyer flow | Auth model is inconsistent |
| Team governance | `StoreMember`, `StoreRole`, `StoreAuditLog` | Admin not primary operator yet | Account lane consumes invitations | Strong MVF-6 baseline |

## 5. Priority gaps

### P0

1. Legacy seller payment review lane still uses owner-only auth instead of seller workspace tenancy.
   - Impact:
     - owner can review via `/api/seller/payments/:paymentId/review`
     - seller team finance/order roles do not participate through the same permission model
     - seller payment readiness and seller order lane are store-scoped, but proof review is not
   - Risk:
     - authorization policy drift
     - duplicated seller payment concepts
     - harder MVF-1 and MVF-5 guarantees

2. Store profile and public storefront still have split source of truth.
   - Seller profile writes `Store.name/description/logoUrl/contact/address`.
   - Public storefront header, WhatsApp, contact blocks, and rich content mostly come from store customization.
   - Result:
     - seller can save data that does not visibly update major public surfaces
     - admin/seller/client alignment is still ambiguous

### P1

1. Catalog lane is stable but still read-heavy.
   - No seller create/edit/publish mutation lane in seller workspace.
   - Visibility explanation exists, but operational control still lives elsewhere.

2. Payment profile lane is stable but only read-only inside seller workspace.
   - Actual write path is still account owner flow: `/api/stores/:storeId/payment-profile`
   - Seller team members with finance visibility cannot fix data from seller workspace.

3. Team viewing is manager-only.
   - Non-manager roles cannot open team summary/lifecycle pages as read-only observers.
   - May be acceptable for phase 1, but should be explicit product policy.

4. Multi-store usability is thin.
   - Tenancy boundary is strong per route, but store switching/discovery UI is not present in seller shell.

### P2

1. Seller coupons entry is visible as placeholder in navigation but not implemented.
2. Seller catalog/storefront explanations are documented in API/UI text, but not yet consolidated into one published sync matrix for the team.

## 6. MVF readiness snapshot

| MVF | Status | Notes |
| --- | --- | --- |
| MVF-1 Seller Access & Tenant Boundary | Strong but not finished | New seller workspace routes are good; legacy payment review route breaks the purity of this model. |
| MVF-2 Seller Store Profile | Partial | Patch works, but public storefront sync is still split. |
| MVF-3 Seller Catalog Visibility | Strong read model | Good visibility explanation, still no seller write lane. |
| MVF-4 Seller Orders & Fulfillment Read Model | Strong | One of the most coherent seller lanes in repo. |
| MVF-5 Seller Payment Profile Readiness | Partial | Readiness snapshot is clear; remediation still outside seller workspace. |
| MVF-6 Seller Team Governance | Strong phase-1 | Best seller write-heavy lane currently. |

## 7. Recommended next tasks

### Recommended next task 1

`SELLER-S1A — Seller Access Boundary Hardening`

Goal:
- unify seller payment review access under store-scoped seller authorization
- decide whether legacy `/api/seller/suborders` and `/api/seller/payments/:paymentId/review` should be migrated into seller workspace rules or retired

Why this first:
- closes the most important MVF-1 inconsistency
- reduces auth drift before more seller features are added

### Recommended next task 2

`SELLER-S2 — Store Profile Source-of-Truth Alignment`

Goal:
- document and tighten field ownership between:
  - seller `Store` profile
  - admin store customization
  - public storefront identity/header/contact/about surfaces

Why second:
- closes the current seller-to-storefront ambiguity
- makes seller profile lane trustworthy

### Recommended next task 3

`SELLER-S5A — Payment Readiness Contract Clarification`

Goal:
- make seller payment profile clearly state:
  - who can edit
  - where to fix rejected/incomplete data
  - whether finance team members need seller-side write capability later

## 8. Verification run

- `pnpm --filter client build` ✅

Build note:
- build succeeded
- Vite reported large chunk warnings only, not blocking seller audit

## 9. Bottom line

Seller workspace is already real and materially beyond foundation level.

Current strongest lanes:
- access/context
- orders/suborders
- team governance

Current weakest alignment points:
- seller payment review auth model
- seller store profile versus storefront/public customization ownership
