# Shipping Multistore Phase 5 Release Readiness

Updated: 2026-04-08

## Scope

Phase 5 locks QA, regression, and release-readiness for the approved MVP:

- `1 parent order + N suborders`
- `1 suborder = 1 shipment`
- canonical shipment read model in backend service/domain layer
- persisted `Shipment` + append-only `TrackingEvent`
- compatibility via `suborder.fulfillmentStatus`
- public tracking entry via `invoiceNo`
- feature flags:
  - `ENABLE_MULTISTORE_SHIPMENT_MVP`
  - `ENABLE_MULTISTORE_SHIPMENT_MUTATION`

This phase does not add new domain objects, does not redesign UI, and does not change payment truth.

## Coverage Inventory

### Existing and Reused

- `pnpm -F server smoke:order-payment`
  - payment/order truth, checkout guardrails, admin/seller/public payment alignment
- `pnpm qa:e2e:truth`
  - browser/runtime truth for checkout, seller order detail, admin payment audit
- `pnpm qa:e2e:shipment-reconciliation`
  - route-level reconciliation across public/client/seller/admin shipment lanes

### Added in Phase 5

- `pnpm -F server smoke:shipment-regression`
  - shipping persisted-first smoke matrix
  - feature flag OFF/ON checks
  - mutation OFF guard-path verification
  - compatibility storage + tracking event timeline verification
- `pnpm qa:shipping:release`
  - repeatable release bundle for shipping MVP

### Manual-Only Residual Checks

- production env/flag deployment values
- migration execution on target environment
- operator rollback drill with flags on deployed runtime

## Regression Matrix

| Scenario ID | Preconditions | Route / Page / Lane | Expected Result | Primary Assertions |
| --- | --- | --- | --- | --- |
| SHIP-FF-01 | `MVP OFF`, `MUTATION OFF`, new order | backend read model, public/client/seller/admin routes | shipment lane hidden, legacy compatibility still safe | `shipmentCount=0`, `shipments=[]`, seller mutation not opened, no persisted shipment created |
| SHIP-FF-02 | `MVP ON`, `MUTATION OFF`, new multi-store order | backend persisted model + route reconciliation | persisted shipment exists but seller mutation remains blocked | `Shipment.count = suborder count`, initial `WAITING_PAYMENT` event exists, read lane visible, all shipping actions disabled |
| SHIP-FF-03 | `MVP ON`, `MUTATION ON`, approved multi-store order | seller mutation + backend read model | seller mutation updates persisted shipment and compatibility storage together | `Shipment.status` syncs, `suborder.fulfillmentStatus` syncs, `TrackingEvent` append-only |
| SHIP-FF-04 | legacy order created while `MVP OFF`, then read while `MVP ON` | backend read model + public/client/admin/seller routes | legacy order still readable through fallback | `usedLegacyFallback=true`, synthesized shipment summary visible, no contract drift |
| SHIP-RT-01 | new multi-store order with 2 shipments | public tracking | public view shows same shipment truth as client/admin | `shipmentCount`, `shipmentStatus`, `trackingNumber`, timeline sequence match canonical snapshot |
| SHIP-RT-02 | same order as `SHIP-RT-01` | client order detail + grouped checkout-payment | buyer sees same canonical shipment truth | `shipmentCount`, `usedLegacyFallback`, timeline, courier/tracking match public/admin |
| SHIP-RT-03 | same order as `SHIP-RT-01` | seller order detail | seller sees only owned shipment and correct actionability | one shipment only, scoped tracking truth, no cross-store leak |
| SHIP-RT-04 | same order as `SHIP-RT-01` | admin order detail | admin sees all suborders + shipments + audit meta | full shipment list, `shipmentAuditMeta`, `suborderShipmentSummary`, mismatch count honest |
| SHIP-BR-01 | `MVP ON`, `MUTATION OFF`, approved single-shipment order | browser public tracking page | read-only shipment section is visible | `Persisted shipment`, shipment section copy, no mutation CTA |
| SHIP-BR-02 | same order | browser client account order detail | buyer sees persisted shipment summary | `Persisted shipment`, pending courier/tracking placeholder, no false mutation |
| SHIP-BR-03 | same order | browser seller order detail | seller sees persisted shipment and rollout-disabled helper | persisted shipment copy present, seller lane still read-only |
| SHIP-BR-04 | same order | browser admin order detail | admin sees persisted audit coverage | `All shipments persisted`, `Persisted shipment truth`, shipment cards visible |
| SHIP-ST-01 | approved shipment becomes `SHIPPED` | backend/service/route read path | tracking number and courier fields reconcile everywhere | `courierCode`, `courierService`, `trackingNumber`, `latestTrackingEvent` match |
| SHIP-ST-02 | approved shipment becomes `DELIVERED` | backend/service/route read path | delivered timeline reconciles everywhere | terminal status `DELIVERED`, append-only event sequence preserved |
| SHIP-ST-03 | mutation flag OFF | seller fulfillment mutation route | rollout block is explicit and honest | returns `SHIPMENT_MUTATION_DISABLED`, not a stale local CTA |

## Feature Flag Behavior

### `ENABLE_MULTISTORE_SHIPMENT_MVP = OFF`

- checkout does not persist `Shipment`
- canonical read model hides shipment lane
- public/client/seller/admin continue through compatibility path
- safe rollback mode for UI/read exposure

### `ENABLE_MULTISTORE_SHIPMENT_MVP = ON` and `ENABLE_MULTISTORE_SHIPMENT_MUTATION = OFF`

- checkout persists `Shipment` + initial `TrackingEvent`
- canonical read lanes expose `shipments[]`
- seller mutation is blocked centrally
- frontend should not show enabled mutation CTA

### `ENABLE_MULTISTORE_SHIPMENT_MVP = ON` and `ENABLE_MULTISTORE_SHIPMENT_MUTATION = ON`

- persisted shipment truth is active
- seller mutation updates `Shipment.status`
- compatibility storage stays synchronized
- public/client/seller/admin continue reading the same canonical service output

### Safe Defaults

- non-production default:
  - `ENABLE_MULTISTORE_SHIPMENT_MVP=true`
  - `ENABLE_MULTISTORE_SHIPMENT_MUTATION=false`
- production default:
  - `ENABLE_MULTISTORE_SHIPMENT_MVP=false`
  - `ENABLE_MULTISTORE_SHIPMENT_MUTATION=false`

## Release Checklist

### Schema / Migration

- [ ] `shipments` table migrated
- [ ] `tracking_events` table migrated
- [ ] unique constraint on `shipments.suborder_id` verified
- [ ] no-backfill expectation communicated to operators

### Backend Readiness

- [ ] `pnpm -F server build`
- [ ] `pnpm -F server smoke:order-payment`
- [ ] `pnpm -F server smoke:shipment-regression`
- [ ] feature flag env values verified for target environment

### Frontend / Cross-View Readiness

- [ ] `pnpm -F client build`
- [ ] `pnpm qa:e2e:truth`
- [ ] `pnpm qa:e2e:shipment-reconciliation`
- [ ] public/client/seller/admin all read canonical shipment truth
- [ ] mutation CTA hidden when `MUTATION OFF`

### Rollback Readiness

- [ ] `ENABLE_MULTISTORE_SHIPMENT_MVP=false` tested
- [ ] `ENABLE_MULTISTORE_SHIPMENT_MUTATION=false` tested
- [ ] legacy orders still render with fallback
- [ ] new orders do not break order/payment truth when shipment lane is hidden

### Operational Limitations Accepted for MVP

- [ ] `IN_TRANSIT` remains read-path only
- [ ] `admin.payments.audit.ts` is not the primary shipment audit lane
- [ ] single shipment per suborder only
- [ ] courier/rate engine remains minimal and snapshot-based

## Rollback Strategy

1. Turn `ENABLE_MULTISTORE_SHIPMENT_MUTATION=false` to stop seller shipment operations immediately.
2. If needed, also turn `ENABLE_MULTISTORE_SHIPMENT_MVP=false` to hide shipment read lane and return consumers to compatibility path.
3. Do not roll back schema for a read-lane incident.
4. Keep order/payment routes unchanged; rollback stays flag-based.
5. Legacy orders and new orders continue through `suborder.fulfillmentStatus` compatibility path if shipment lane is hidden.

## Known Residual Risk

- `IN_TRANSIT` does not yet have a dedicated operational mutation path.
- Admin shipment audit lives primarily in order detail, not payment audit page.
- Courier/service snapshot at checkout is still minimal until a richer shipping-rate lane is approved.
- Production rollout still depends on operator discipline for flag values and migration sequencing.

## Go / No-Go

Current recommendation after Phase 5 verification:

- `No-Go` for immediate public production if migrations and release flag defaults are not explicitly validated on the target environment.
- `Go` for controlled release candidate once:
  - builds pass
  - shipment/order/payment smokes pass
  - route-level shipment reconciliation passes
  - browser truth smoke passes
  - production flags are set to safe defaults

The MVP is release-candidate safe, but production go-live still depends on deployment-level migration and flag verification.

## Release Sign-off

### Status Keputusan

- `GO WITH CONDITIONS`

### Rekomendasi Rollout

- `Staged rollout`
- Bukan `full public production` hari ini

### Dasar Keputusan

- Shipping multistore MVP sudah kuat pada:
  - code path utama
  - build
  - smoke/regression
  - route QA
  - browser QA
  - rollback berbasis flag
  - cross-view truth di `public`, `client`, `seller`, dan `admin`
- `GO` penuh belum diberikan karena validasi target environment aktual belum selesai.

### Urutan Rollout Yang Disetujui

1. Deploy dengan:
   - `ENABLE_MULTISTORE_SHIPMENT_MVP=ON`
   - `ENABLE_MULTISTORE_SHIPMENT_MUTATION=OFF`
2. Validasi target environment:
   - migration `Shipment` dan `TrackingEvent`
   - cross-view truth pada deployed routes
   - rollback berbasis flag
3. Jika stabil, lanjut canary:
   - `ENABLE_MULTISTORE_SHIPMENT_MVP=ON`
   - `ENABLE_MULTISTORE_SHIPMENT_MUTATION=ON`
4. Setelah operator sign-off lengkap, baru pertimbangkan public expansion.

### Conditions Yang Wajib Dipenuhi

- migration target benar-benar applied
- schema target sesuai dengan code yang aktif
- nilai flag target backend terverifikasi
- nilai flag target frontend/build terverifikasi
- deployed route spot-check lulus di:
  - public tracking
  - client order detail
  - seller order detail
  - admin order detail
- rollback drill berbasis flag lulus
- DevOps sign-off
- DBA sign-off
- QA/Product Ops sign-off

### Rekomendasi Mode Release

#### Phase A — Controlled Read Rollout

- `MVP=ON`
- `MUTATION=OFF`

Tujuan:

- membuka read lane shipment
- memvalidasi truth lintas view
- meminimalkan risiko operasional seller mutation

#### Phase B — Controlled Mutation Canary

- `MVP=ON`
- `MUTATION=ON`

Tujuan:

- mengaktifkan lane operasional seller secara terbatas
- memonitor shipment mutation dan tracking timeline

#### Phase C — Public Expansion

Dilakukan hanya jika:

- Phase A stabil
- Phase B stabil
- semua owner sudah sign-off

### Known Limitations Untuk Sign-off

- `IN_TRANSIT` belum punya mutation operasional tersendiri
- shipment audit utama masih berada di order detail, belum menjadi lane utama di payment audit
- shipping rate snapshot checkout masih minimal
- frontend production flag masih bergantung pada build-time env

Status limitation:

- acceptable untuk `controlled MVP rollout`
- belum ideal untuk `full public sign-off` tanpa validasi target env

### Owner Actions

#### DevOps

- verifikasi env target
- verifikasi backend flags
- verifikasi frontend build flags
- jalankan deploy/redeploy
- jalankan rollback drill

#### DBA

- verifikasi migration target
- verifikasi schema/index/constraint target

#### QA / Product Ops

- jalankan spot-check deployed routes
- validasi cross-view truth
- validasi hidden/visible state sesuai flag

#### Release Owner

- set rollout ke `staged rollout`
- mulai dari `MVP ON + MUTATION OFF`
- tahan full public release sampai semua sign-off lengkap

### Kesimpulan Sign-off

- Shipping Multistore MVP `siap untuk controlled release`
- Shipping Multistore MVP `belum disetujui untuk full public production hari ini`
