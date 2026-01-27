# E-Commerce Admin Dashboard (Frontend)

## Gambaran Proyek

Frontend ini adalah admin dashboard berbasis React untuk sistem e-commerce. Fokusnya UI yang rapi lebih dulu, dengan alur data yang siap dihubungkan ke API. Implementasi saat ini memakai dummy data dan mock service agar Anda bisa mengerjakan UI/UX tanpa backend.

## Tech Stack

- React (JavaScript)
- React Router v6
- Vite
- CSS biasa

## Routing Overview

Storefront (public):
- `/`
- `/category/:slug`
- `/product/:id`
- `/cart`
- `/checkout`
- `/auth/login`
- `/auth/register`

Admin (protected):
- `/admin/login`
- `/admin`
- `/admin/products`
- `/admin/orders`
- `/admin/customers`
- `/admin/settings`

## Dev Seed (Storefront)

Run a simple dev seed to publish categories and products for the storefront:

```bash
pnpm -C server seed:dev
```

## Dev Reset (DB)

If `db:sync` fails on legacy rows (e.g. zero dates), reset the dev schema:

```bash
pnpm -C server db:reset
pnpm -C server seed:dev
pnpm -C server dev
pnpm -C client dev
```

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

### 6️⃣ Install & Jalankan Frontend

Masuk ke folder client:

```bash
cd client
npm install
npm start
```

Frontend akan berjalan di:

```
http://localhost:3000
```

---

## 🔄 Alur Kerja Aplikasi

1. Frontend (React) mengirim request ke Backend (Express)
2. Backend memproses logic & database
3. Backend mengembalikan response JSON
4. Frontend menampilkan data ke user

---

## Analytics API (Dashboard)

Endpoint analytics digunakan oleh dashboard admin (read-only untuk staff/admin).

Contoh curl:

```bash
curl -i http://localhost:3001/api/admin/analytics/overview
curl -i "http://localhost:3001/api/admin/analytics/sales?range=7d"
curl -i "http://localhost:3001/api/admin/analytics/best-selling?range=7d&limit=5"
curl -i "http://localhost:3001/api/admin/analytics/recent-orders?limit=10"
```

Seed demo data (agar grafik punya data):

```bash
pnpm seed:analytics
```

---

## 🧠 Catatan untuk Pemula

- Jangan takut mencoba dan error
- Baca error log di terminal
- Periksa request API menggunakan Postman
- Mulai dari memahami **1 fitur kecil** terlebih dahulu

---

## 🚀 Rencana Pengembangan (Roadmap)

- Autentikasi (Login & Register)
- Keranjang belanja
- Checkout & pembayaran
- Admin dashboard
- Validasi & security (JWT, bcrypt)

---

## 🤝 Kontribusi

Kontribusi sangat terbuka!

1. Fork repository
2. Buat branch baru
3. Commit perubahan
4. Buat Pull Request

---

## 📄 Lisensi

Proyek ini menggunakan lisensi **MIT** (atau sesuaikan).

---

## 📬 Kontak

Jika ada pertanyaan atau saran, silakan buka issue di repository ini.

Selamat belajar dan ngoding 🚀
