# P0.10 Final Release Candidate Snapshot Report

Tanggal eksekusi lokal: 2026-05-14
Nama report mengikuti task release: 2026-05-13

## Ringkasan RC

Release candidate MVF sudah melewati gate akhir untuk flow utama product, attribute, coupon, checkout, order, auth session invalidation, dan public release smoke. Tidak ada app code yang diubah pada task P0.10; perubahan hanya dokumentasi snapshot ini.

Backend tetap menjadi source of truth untuk checkout preview, coupon quote, order submit, product eligibility, variant pricing/stock, dan auth session validity.

## Ringkasan P0.1 sampai P0.9C-FIX

- P0.1 Coupon checkout truth: coupon platform dan seller/store sudah divalidasi terhadap scope, ownership store, minimum order, expired coupon, usage limit, kalkulasi diskon, dan order attribution.
- P0.2 Product/variant checkout truth: product yang tampil di storefront divalidasi terhadap admin approval/status, seller status, store readiness, variant stock, variant price override, dan snapshot order.
- P0.3 Attribute truth: attribute/value aktif dihormati dari Admin ke Seller, Client, Checkout, dan Order; variant selection tidak mengandalkan value inactive/deleted.
- P0.4 Playwright unblock: Chromium Playwright sudah tersedia dan `qa:e2e:truth` dapat dijalankan sebagai gate.
- P0.5 Production readiness gate: audit readiness memastikan tidak ada P0 leak dari fallback/demo, endpoint public, env, checkout/order, dan auth/session basics.
- P0.6 Public release gate audit: `qa:public-release` menjadi gate release publik; `pnpm-workspace.yaml` tetap dianggap dirty lama/unrelated dan tidak disentuh.
- P0.7 Auth session invalidation: session/token lama invalid setelah password reset; login baru tetap berhasil.
- P0.8 RC snapshot sebelumnya: checklist deployment, rollback, env production, dan risiko P1/P2 sudah dicatat.
- P0.9 Checkout cart/summary consistency: cart drawer, checkout summary, payment summary, dan order-by-store memakai cart truth yang sama; mismatch ghost seperti Rp400.000/Rp800.000/32 items ditutup.
- P0.9B Backend preview canonicalization: backend checkout preview/quote canonical terhadap active/latest cart; stale explicit `cartId` tidak dipakai diam-diam.
- P0.9C Checkout preview ready-state fix: frontend menormalkan matching visible cart vs backend preview agar checkout aktif ketika preview sudah match.
- P0.9C-FIX Sync warning still visible fix: warning sync tidak lagi tampil untuk cart valid variant Blue qty 2 total Rp50.000; guard stale/mismatch tetap aktif.

## Final Gate

| Command | Hasil | Catatan |
| --- | --- | --- |
| `pnpm -F server build` | PASS | TypeScript server build selesai. |
| `pnpm -F client build` | PASS | Vite build selesai; ada chunk-size warning non-blocking. |
| `pnpm -F server smoke:product-visibility` | PASS | Product visibility, store readiness, checkout eligibility, dan review metadata valid. |
| `pnpm -F server smoke:checkout-variants` | PASS | Variant cart, preview, order snapshot, invalid selection, dan inactive attribute value valid. |
| `pnpm -F server smoke:checkout-coupons` | PASS | Platform/seller coupon, scope, min-spend, expired, dan attribution valid. |
| `pnpm -F server smoke:auth-session-invalidation` | PASS | Old session invalid setelah password reset; login baru berhasil. |
| `pnpm qa:e2e:truth` | PASS | Browser truth suite termasuk checkout ready-state regression lulus. |
| `pnpm qa:public-release` | PASS | Public release smoke gate lulus dengan env lokal proof. |

## Checkout Proof

Target proof:

- Product: Organic Banana
- Variant: Blue
- Quantity: 2
- Unit price: Rp25.000
- Expected estimated total: Rp50.000

Proof status:

- Estimated Total: Rp50.000
- Coupon Apply: enabled ketika input coupon valid/tersedia
- Place Order: enabled setelah required contact/shipping form valid, tidak terkunci sync blocker
- Order Summary by Store: visible dan menampilkan item normal
- Sync warning: tidak tampil

Artifact browser proof:

- `reports/p0-9c-fix-checkout-ready-variant-qty2.png`

## Production Requirements

- `COOKIE_SECURE=true` wajib untuk HTTPS production.
- `UPLOAD_DIR` wajib diset dan writable pada target deployment.
- Production env harus menyediakan secret/auth/cors/public URL sesuai gate.
- Public release gate lokal dijalankan dengan `COOKIE_SECURE=false` hanya sebagai proof lokal, bukan konfigurasi production.

## Risiko Tersisa

- P1 performance: client build masih memberi chunk-size warning. Ini tidak memblokir release, tetapi perlu optimisasi/code splitting setelah release gate.
- P2 tooling: Node `[DEP0190]` warning masih muncul dari tooling dependency path. Ini tidak memblokir app runtime gate.
- Config deployment: `COOKIE_SECURE=true` dan writable `UPLOAD_DIR` wajib diverifikasi di target production.
- Worktree hygiene: `pnpm-workspace.yaml` tetap dirty lama/unrelated dan sengaja tidak disentuh.

## Change Note P0.10

- Tidak ada app code yang diubah untuk P0.10.
- File baru: `reports/p0-10-final-release-candidate-snapshot-2026-05-13-report.md`.
- Perubahan app code dari task P0 sebelumnya tetap berada di worktree dan tidak direvert.

## Release Decision

Tidak ada P0 blocker yang tersisa dari gate lokal. RC siap dipakai sebagai kandidat deployment publik setelah env production final diverifikasi sesuai checklist di atas.
