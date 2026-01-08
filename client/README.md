# E-Commerce Admin Dashboard (Frontend)

## Gambaran Proyek
Frontend ini adalah admin dashboard berbasis React untuk sistem e-commerce. Fokusnya UI yang rapi lebih dulu, dengan alur data yang siap dihubungkan ke API. Implementasi saat ini memakai dummy data dan mock service agar Anda bisa mengerjakan UI/UX tanpa backend.

## Tech Stack
- React (JavaScript)
- React Router v6
- Vite
- CSS biasa

## Struktur Folder (Ringkas)
```
src/
  api/           // Service layer (API-ready)
  auth/          // Auth context dan helpers
  components/    // Komponen UI reusable
  data/          // Dummy data (fallback)
  hooks/         // Custom hooks (orchestrator data per halaman)
  pages/         // Halaman utama
  routes/        // Route guards
  utils/         // Util kecil (formatter, dll.)
  App.jsx        // Routes dan layout
  main.jsx       // Entry point
```

## Cara Menjalankan Frontend
Dari folder `client/`:
```
pnpm install
pnpm dev
```

Jika menggunakan API nyata, set:
```
VITE_API_BASE_URL=http://localhost:3001/api
```

## Alur Data (Sederhana)
```
Page -> Hook -> Service -> (API atau Dummy Data)
```
Halaman hanya mengelola state UI. Service memutuskan apakah memakai API atau fallback ke dummy data.

## Role-Based UI (Admin vs Staff)
- **Admin**: akses UI penuh (add/edit/delete, update status, toggle).
- **Staff**: read-only UI (tombol dinonaktifkan).

## Catatan
- Dummy data menjadi fallback jika API tidak tersedia.
- UI text dan layout sudah stabil; integrasi API bisa ditambahkan tanpa refactor UI.
