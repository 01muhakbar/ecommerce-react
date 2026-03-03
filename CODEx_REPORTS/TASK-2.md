# TASK-2 UI Parity Sprint #1 (Search Store + Admin Orders)

## Amati Notes

### A) KachaBazar Search (target parity points)

- Search page pattern prioritizes two-column layout on desktop:
  - Left filter panel (fixed visual width)
  - Right result panel (title + count + sort + product grid)
- Mobile pattern keeps result area clean and surfaces filter controls through a dedicated trigger (panel/drawer style interaction).
- Product grid cards use dense spacing, clear price prominence, and compact metadata.
- No-result state is rendered as a card section in the same content flow (not blank screen).

### B) Dashtar Orders (target parity points)

- Top toolbar groups controls in one stable header region (search + filters + action buttons).
- Orders table uses clear header contrast, comfortable row padding, and hover emphasis.
- Status badges are compact pill styles with semantic colors.
- Pagination is aligned in a stable footer area.
- Feedback for row update should not push table layout (prefer compact inline indicator/toast style).

## Discovery & File Budget

### Route files discovered

- Store search route: `client/src/pages/store/StoreSearchPage.jsx`
- Admin orders route: `client/src/pages/admin/Orders.jsx`

### Supporting components discovered

- `client/src/components/store/SearchProductCard.jsx`
- `client/src/components/admin/OrderStatusBadge.jsx`
- `client/src/components/ui-states/UiUpdatingBadge.jsx`
- `client/src/components/ui-states/UiEmptyState.jsx`
- `client/src/components/ui-states/UiErrorState.jsx`

### Planned file changes (<=10)

1. `client/src/pages/store/StoreSearchPage.jsx`
2. `client/src/components/store/SearchProductCard.jsx`
3. `client/src/pages/admin/Orders.jsx`
4. `client/src/components/admin/OrderStatusBadge.jsx`

### Actual files changed

1. `client/src/pages/store/StoreSearchPage.jsx`
2. `client/src/components/store/SearchProductCard.jsx`
3. `client/src/pages/admin/Orders.jsx`
4. `client/src/components/admin/OrderStatusBadge.jsx`

## Before/After Notes

### Store `/search` (KachaBazar parity sprint)

- Before:
  - Single-column layout with top bar + grid.
  - Filter controls not structured as desktop sidebar.
  - Mobile had no dedicated filter trigger panel.
- After:
  - Desktop two-column layout (`280px` filter sidebar + result panel).
  - Result header now shows query-centric title (`Search results for "..."`) + count.
  - Mobile now has explicit `Filter` button opening slide-in panel with overlay.
  - Filter form is consistent across desktop and mobile (search + category + apply/reset).
  - Existing loading/empty/error states are preserved and placed in stable result area.

### Admin `/admin/orders` (Dashtar parity sprint)

- Before:
  - Controls were split grid sections, less dashboard-toolbar feel.
  - Success notice rendered inline and could shift content flow.
  - Empty state rendered as separate card outside table.
- After:
  - Toolbar restyled to grouped dashboard control area (search + filters + date + actions).
  - Success feedback now fixed-position toast, reducing layout shift impact.
  - Table rows have clearer alternating background + hover.
  - Empty state rendered as proper empty table row (inside table body).
  - Status update indicator shown inline compactly (`Saving...`) beside status select.
  - Status badge styling tightened to compact uppercase pill style.

## Commands & Results

- `pnpm --filter client exec vite build` -> PASS
- `pnpm dev` manual route readiness check:
  - `/search?q=test` -> reachable
  - `/admin/orders` -> reachable
- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260303-004631/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260303-004631/summary.txt`

## Known Gaps + Next Recommendation

1. Search parity uses minimal custom mobile drawer in-page (not a shared global drawer component).
2. Filter options in search remain limited to existing state (`q`, `category`, `sort`) by scope; no advanced facet filters.
3. Orders table density and typography are closer to Dashtar but not pixel-identical.
4. Orders toast is local to page; no unified global toast stack yet.
5. Pagination visuals improved but still use existing behavior contract.

Recommended Task #3:
- Continue parity on store product/category listing and admin order-detail print view for stronger visual consistency end-to-end.
