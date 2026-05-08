# TASK-11 - Admin Shell Parity Audit + Polish Prioritas Tinggi pada Sidebar Navigation

## Objective

Meningkatkan parity UI/UX sidebar admin agar lebih dekat ke arah Dashtar, khususnya pada hierarchy navigasi, active-state clarity, grouping rhythm, dan konsistensi shell visual, tanpa mengubah backend, contract API, atau logic routing/navigation.

## Audited Component

- `client/src/components/Layout/Sidebar.jsx`
- `client/src/components/Layout/Sidebar.css`
- `client/src/components/layouts/AdminLayout.jsx`

## Key Parity Gaps

- Sidebar masih terasa seperti daftar menu linear, belum cukup terstruktur per section.
- Active state parent/child belum cukup jelas, terutama pada route bersarang.
- Brand block dan menu rhythm belum cukup nyambung dengan topbar/dashboard yang sudah dipoles sebelumnya.

## Selected Polish Areas

1. `Active-state emphasis + icon/label rhythm`
2. `Section grouping clarity + shell continuity`

## Files Changed

- `client/src/components/Layout/Sidebar.jsx`
- `client/src/components/Layout/Sidebar.css`

## What Changed

### 1. Sidebar.jsx

- Menambahkan grouping section ringan pada menu: `Overview`, `Commerce`, dan `Workspace`.
- Menambahkan brand copy yang lebih kuat dengan subtitle `Admin Workspace`.
- Menambahkan state visual `is-current` untuk parent menu yang memiliki child route aktif.
- Menambahkan `end` pada link dashboard agar active state lebih jujur dan tidak ikut aktif di semua route admin.

### 2. Sidebar.css

- Menambahkan styling baru untuk section title, brand subtitle, dan rhythm spacing sidebar.
- Memperjelas active/current state pada menu utama dengan emphasis background, accent rail, dan icon state.
- Memperhalus hover rhythm dan continuity shell dengan border/padding yang lebih dekat ke gaya Dashtar.
- Menambahkan dark theme support untuk elemen baru.

## Before vs After

- Sebelum: sidebar fungsional, tetapi grouping dan active-state masih datar.
- Sesudah: sidebar lebih mudah dipindai, parent menu lebih jelas saat child route aktif, dan shell admin terasa lebih kohesif setelah polish topbar/dashboard sebelumnya.

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260307-083315/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260307-083315/summary.txt`

## MVF Impact

- Admin login -> PASS
- Dashboard -> PASS
- Orders list -> PASS
- Order detail -> PASS
- Update status -> PASS
- Persist after refresh -> PASS
- Store MVF smoke tetap PASS

## Risks / Follow-up

- Sidebar masih belum punya collapsed mode parity; itu sengaja di luar scope task ini.
- Jika nanti ingin parity Dashtar lebih dalam, kandidat aman berikutnya adalah sidebar footer/logout shell atau responsive drawer behavior.

## Final Status

PASS
