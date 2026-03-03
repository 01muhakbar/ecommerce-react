# TASK-1 MVF UI/UX Polish

## Discovery

### MVF file candidates (store)

- `client/src/pages/store/KachaBazarDemoHomePage.jsx` - route `/` (home)
- `client/src/pages/store/StoreSearchPage.jsx` - route `/search`
- `client/src/pages/store/StoreProductDetailPage.jsx` - route `/product/:slug`
- `client/src/pages/store/StoreCartPage.jsx` - route `/cart` and cart drawer
- `client/src/pages/store/Checkout.jsx` - route `/checkout`
- `client/src/pages/store/StoreCheckoutSuccessPage.jsx` - route `/checkout/success`
- `client/src/pages/store/StoreOrderTrackingPage.jsx` - route `/order/:ref`

### MVF file candidates (admin)

- `client/src/pages/admin/Orders.jsx` - route `/admin/orders`
- `client/src/pages/admin/OrderDetail.jsx` - route `/admin/orders/:invoiceNo`

### Existing reusable UI-state patterns discovered

- `client/src/components/ui-states/UiEmptyState.jsx`
- `client/src/components/ui-states/UiErrorState.jsx`
- `client/src/components/ui-states/UiSkeleton.jsx`
- `client/src/components/ui-states/UiUpdatingBadge.jsx`
- `client/src/components/UI/QueryState.jsx`

### Selected files to change (<=8 app files)

- `client/src/pages/store/KachaBazarDemoHomePage.jsx`
- `client/src/pages/store/StoreProductDetailPage.jsx`
- `client/src/pages/admin/Orders.jsx`

## Changes Implemented

### `/` Home (`client/src/pages/store/KachaBazarDemoHomePage.jsx`)

- Added explicit state contract for featured categories section:
  - Loading: `UiSkeleton` section with fixed container.
  - Error: `UiErrorState` with retry action (`refetchCategories`).
  - Empty: `UiEmptyState` with CTA to `/search`.
- Reused existing UI-state components; no business logic changes.

### `/product/:slug` Product detail (`client/src/pages/store/StoreProductDetailPage.jsx`)

- Replaced plain text loading with `UiSkeleton` for clearer and stable loading layout.
- Added structured error handling:
  - 404 -> `UiEmptyState` with browse/home CTA.
  - Non-404 error -> `UiErrorState` with retry (`refetchProduct`).
- Added explicit empty state when product payload missing.
- Fixed related-products query state:
  - `isError` now reflects `relatedQuery.isError` (previously forced false).
  - `isEmpty` only shown when not loading and not error.

### `/admin/orders` Admin orders list (`client/src/pages/admin/Orders.jsx`)

- Improved status-update feedback:
  - Success alert now shown after status update (`notice`).
  - Row-level saving indicator shown via `UiUpdatingBadge` ("Saving...").
  - Added retry action on update failure (`Retry status update`) using stored last payload.
- Kept existing behavior for filtering/export; no API contract or business logic changes.

### Notes (visual verification)

- State blocks now consistently render in-card, not blank screens, across updated pages.
- Critical actions now provide visible progress feedback and recovery action (retry).

## Commands & Results

- `pnpm dev` (readiness check via HTTP) -> PASS
  - `http://localhost:5173` reachable
  - `http://localhost:3001/api/health` reachable
- `pnpm qa:mvf` run #1 -> FAIL (runtime process-state issue; stack reused, connection dropped)
- Cleanup: terminated stale `node` processes
- `pnpm qa:mvf` run #2 -> PASS
- `pnpm --filter client exec vite build` -> PASS

## QA MVF Result

- Final status: PASS
- Artifact:
  - `.codex-artifacts/qa-mvf/20260303-003659/result.json`
  - `.codex-artifacts/qa-mvf/20260303-003659/summary.txt`
- Key checks still PASS:
  - Store checkout generated order ref
  - Tracking resolved ref
  - Admin login/orders list/status update/persist

## Risks / Follow-up

1. Home coupon panel still uses lightweight fallback strategy (dummy coupons) and not a dedicated skeleton/loading variant.
2. Admin orders retry button is focused for status update failures; export/download failures still rely on message-only handling.
3. Product detail related-products uses generic `QueryState`; if design needs richer skeleton parity, dedicated related-card skeleton can be added later.
4. QA script can fail when stale runtime processes exist; preflight cleanup step can make QA runs more deterministic.
