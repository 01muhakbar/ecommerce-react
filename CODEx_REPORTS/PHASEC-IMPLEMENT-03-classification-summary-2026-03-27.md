# PHASEC-IMPLEMENT-03 Classification Summary

## Klasifikasi komponen

### `StatusBadge`

- Keputusan: `internal-table-kit`
- Alasan:
  - taxonomy status hardcoded sempit: `pending`, `paid`, `processing`, `shipped`, `delivered`, `completed`, `cancelled`, `selling`, `soldout`
  - tidak dipakai sebagai badge global lintas admin/seller/storefront
  - consumer utamanya row/table internal
  - domain lain sudah punya badge/status helper sendiri:
    - `components/admin/OrderStatusBadge.jsx`
    - `components/payments/PaymentReadModelBadges.jsx`
    - `utils/orderStatus.js`

### `ToggleSwitch`

- Keputusan: `internal-table-kit`
- Alasan:
  - langsung tergantung `useAuth()`
  - default behavior mengunci interaksi untuk non-admin
  - dipakai sebagai toggle action-cell di row produk, bukan primitive toggle netral
  - tidak cocok masuk `primitives/ui` selama masih auth-aware

### `ActionButtons`

- Keputusan: `internal-table-kit`
- Alasan:
  - langsung tergantung `useAuth()`
  - semantik tombolnya spesifik untuk action-cell tabel: edit/delete
  - wording/title disabled masih admin-oriented
  - styling dan interaction model sangat cocok untuk row action cell, bukan primitive action container umum

## Consumer map

### `StatusBadge`

- `components/Tables/OrderRow.jsx`
- `components/Tables/ProductRow.jsx`
- import lama di `components/dashboard/RecentOrderRow.jsx` ternyata tidak dipakai dan sudah dibersihkan

### `ToggleSwitch`

- `components/Tables/ProductRow.jsx`

### `ActionButtons`

- `components/Tables/OrderRow.jsx`
- `components/Tables/ProductRow.jsx`

## Boundary yang dibuat

- `client/src/components/internal-table-kit/`
  - `StatusBadge.jsx`
  - `ToggleSwitch.jsx`
  - `ActionButtons.jsx`
  - `index.js`

## Komponen yang ditahan

- file lama di `client/src/components/UI/*` tetap dipertahankan sebagai compatibility layer
- tidak dipindah ke `primitives/ui`
- tidak digeneralisasi props atau behavior-nya
