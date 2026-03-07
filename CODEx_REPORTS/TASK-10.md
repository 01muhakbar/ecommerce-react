# TASK-10 - Admin Shell Parity Audit + Polish Prioritas Tinggi pada Topbar

## Objective

Meningkatkan parity UI/UX topbar admin agar lebih dekat ke arah Dashtar pada area paling sering terlihat, khususnya search anchor, action cluster, dan header rhythm, tanpa mengubah backend, contract API, atau logic bisnis.

## Audited Component

- `client/src/components/Layout/Navbar.jsx`
- `client/src/components/Layout/Navbar.css`
- `client/src/components/admin/AdminNotifications.jsx`
- `client/src/components/admin/AdminProfileMenu.jsx`

## Key Parity Gaps

- Topbar belum punya search anchor visual yang membuat header terasa seperti admin shell modern.
- Action area masih terasa sebagai tombol-tombol terpisah, belum sebagai cluster yang rapi.
- Hierarki header masih tipis untuk area yang muncul di semua halaman admin.

## Selected Polish Areas

1. `Topbar search hierarchy + header rhythm`
2. `Action cluster grouping + profile emphasis`

## Files Changed

- `client/src/components/Layout/Navbar.jsx`
- `client/src/components/Layout/Navbar.css`

## What Changed

### 1. Navbar.jsx

- Menambahkan title block yang lebih eksplisit dengan eyebrow `Admin Panel` dan page title yang lebih tegas.
- Menambahkan search shell presentational yang read-only agar topbar terasa lebih dekat ke Dashtar tanpa mengubah logic search.
- Mengelompokkan language, theme toggle, notifications, dan profile ke dalam satu `navbar__cluster`.

### 2. Navbar.css

- Menambahkan styling baru untuk title block, search shell, dan action cluster.
- Menguatkan ritme visual topbar dengan card-like search box dan grouped action area.
- Menambahkan dark-mode styling untuk elemen baru.
- Menambahkan responsive adjustments agar topbar tetap stabil pada viewport lebih sempit.

## Before vs After

- Sebelum: topbar admin fungsional, tetapi masih terasa datar dan utilitarian.
- Sesudah: topbar punya search anchor visual, action cluster terasa lebih kohesif, dan header rhythm lebih dekat ke referensi Dashtar.

## Verification Run

- `pnpm --filter client exec vite build` -> PASS
- `pnpm qa:mvf` -> PASS
  - Artifact: `.codex-artifacts/qa-mvf/20260306-230801/result.json`
  - Summary: `.codex-artifacts/qa-mvf/20260306-230801/summary.txt`

## MVF Impact

- Admin login -> PASS
- Dashboard -> PASS
- Orders list -> PASS
- Order detail -> PASS
- Update status -> PASS
- Persist after refresh -> PASS
- Store MVF smoke tetap PASS

## Risks / Follow-up

- Search shell saat ini masih visual placeholder agar scope tetap aman; jika nanti ingin search global admin sungguhan, itu harus jadi task terpisah.
- Topbar belum menyentuh notif count semantics atau quick actions tambahan.
- Kandidat aman berikutnya: parity polish sidebar/admin navigation rhythm.

## Final Status

PASS
