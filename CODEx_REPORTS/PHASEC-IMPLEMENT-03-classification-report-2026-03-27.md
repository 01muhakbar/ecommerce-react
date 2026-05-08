TASK ID: PHASEC-IMPLEMENT-03
Status: PASS

Yang diamati

- `client/src/components/UI/StatusBadge.jsx`
- `client/src/components/UI/ToggleSwitch.jsx`
- `client/src/components/UI/ActionButtons.jsx`
- `client/src/components/Tables/OrderRow.jsx`
- `client/src/components/Tables/ProductRow.jsx`
- `client/src/components/dashboard/RecentOrderRow.jsx`
- CSS terkait:
  - `StatusBadge.css`
  - `ToggleSwitch.css`
  - `ActionButtons.css`

Consumer map

- `StatusBadge`
  - `components/Tables/OrderRow.jsx`
  - `components/Tables/ProductRow.jsx`
  - `components/dashboard/RecentOrderRow.jsx` hanya import lama yang tidak terpakai
- `ToggleSwitch`
  - `components/Tables/ProductRow.jsx`
- `ActionButtons`
  - `components/Tables/OrderRow.jsx`
  - `components/Tables/ProductRow.jsx`

Klasifikasi komponen

- `StatusBadge` -> `internal-table-kit`
- `ToggleSwitch` -> `internal-table-kit`
- `ActionButtons` -> `internal-table-kit`

Boundary yang dibuat

- `client/src/components/internal-table-kit/`

Komponen yang ditahan

- `client/src/components/UI/StatusBadge.jsx`
- `client/src/components/UI/ToggleSwitch.jsx`
- `client/src/components/UI/ActionButtons.jsx`

Ketiganya ditahan sebagai compatibility shim dan tidak dipromosikan ke `primitives/ui`.

Compatibility note

- Consumer tabel yang aman diarahkan ke `internal-table-kit`.
- File lama di `components/UI` tetap hidup, jadi tidak ada refactor agresif di seluruh repo.
- Tidak ada redesign atau perubahan behavior auth/UI.

File yang diubah

- `client/src/components/internal-table-kit/StatusBadge.jsx`
- `client/src/components/internal-table-kit/ToggleSwitch.jsx`
- `client/src/components/internal-table-kit/ActionButtons.jsx`
- `client/src/components/internal-table-kit/index.js`
- `client/src/components/Tables/OrderRow.jsx`
- `client/src/components/Tables/ProductRow.jsx`
- `client/src/components/dashboard/RecentOrderRow.jsx`
- `CODEx_REPORTS/PHASEC-IMPLEMENT-03-classification-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-IMPLEMENT-03-classification-report-2026-03-27.md`

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Risiko / debt / follow-up

- Jika nanti komponen ini ingin dipromosikan ke `primitives/ui`, perlu cleanup lanjutan:
  - hapus ketergantungan `useAuth()` dari `ToggleSwitch` dan `ActionButtons`
  - pindahkan authority gating ke consumer
  - perluas/normalisasi status taxonomy `StatusBadge`
- Untuk fase sekarang, boundary `internal-table-kit` lebih akurat dan lebih aman dibanding over-generalization ke primitive global.

Butuh keputusan user?

- Tidak
