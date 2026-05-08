E-Commerce Admin Dashboard (Frontend)
Gambaran Proyek
Repo ini adalah monorepo e-commerce dengan aplikasi Admin dan Storefront berbasis React + Vite, serta backend Express + Sequelize. Baseline MVF saat ini sudah backend-driven untuk flow utama store dan admin; beberapa fallback demo/config backup masih ada di area tertentu dan perlu diaudit per task, bukan dianggap sebagai source of truth utama.

Tech Stack
React (JavaScript)
React Router v6
Vite
CSS biasa
Dev ports:

Server: http://localhost:3001
Client: http://localhost:5173
Catatan dev: jika 5173 sedang dipakai, Vite akan otomatis pindah ke port lain (mis. 5176). Selalu gunakan port yang tercetak di terminal.
Routing Overview
Storefront (public):

/
/category/:slug
/product/:id
/cart
/checkout
/auth/login
/auth/register
Admin (protected):

/admin/login
/admin
/admin/products
/admin/orders
/admin/customers
/admin/settings
Baseline Command Discipline
Gunakan command berikut sebagai baseline kerja harian:

Install dependency:

pnpm install

DB health check:

powershell -ExecutionPolicy Bypass -File .\scripts\db-health.ps1

Fresh baseline reset + seed:

pnpm --filter server db:reset
pnpm --filter server seed:demo

Run full stack:

pnpm dev

Run server only:

pnpm dev:server

Run client only:

pnpm dev:client

Build client:

pnpm --filter client exec vite build

Smoke MVF:

pnpm qa:mvf

Catatan:
- `pnpm dev` adalah jalur utama yang dipakai untuk sesi Codex.
- `seed:demo` sudah mencakup super admin + demo katalog.
- Artifact `qa:mvf` ditulis ke `.codex-artifacts/qa-mvf/<runId>/`.
- Jika `5173` sibuk, Vite bisa pindah ke port lain; selalu cek port aktual di terminal.
Struktur Folder (Ringkas)
src/
api/ // Service layer (API-ready)
auth/ // Auth context dan helpers
components/ // Komponen UI reusable
data/ // Dummy data (fallback)
hooks/ // Custom hooks (orchestrator data per halaman)
pages/ // Halaman utama
routes/ // Route guards
utils/ // Util kecil (formatter, dll.)
App.jsx // Routes dan layout
main.jsx // Entry point
Cara Menjalankan Frontend
Untuk development normal, jalankan dari root repo:

pnpm dev

Jika hanya perlu client:

pnpm dev:client

Client menggunakan API melalui base `/api` dan mengandalkan server lokal di `http://localhost:3001`.

Alur Data (Sederhana)
Page -> Hook -> Service -> API backend

Catatan:
- MVF store/admin saat ini diharapkan membaca backend nyata.
- Beberapa fallback demo masih ada di area tertentu dan harus diperlakukan sebagai pengecualian terkontrol, bukan perilaku standar runtime.

Role-Based UI (Admin vs Staff)
Admin: akses UI penuh (add/edit/delete, update status, toggle).
Staff: read-only UI (tombol dinonaktifkan).
QA UI (Opt-in)
Jalankan QA UI untuk memverifikasi /account/orders dan /order/:ref (termasuk print mode).

pnpm qa:ui

Jika Playwright belum terpasang:

pnpm qa:ui:install

Catatan:
- Script akan menyalakan `pnpm -w dev`, menjalankan QA, lalu mematikan server.
- Script opt-in dan tidak berjalan otomatis.
🔄 Alur Kerja Aplikasi
Frontend (React) mengirim request ke Backend (Express)
Backend memproses logic & database
Backend mengembalikan response JSON
Frontend menampilkan data ke user
Analytics API (Dashboard)
Endpoint analytics digunakan oleh dashboard admin (read-only untuk staff/admin).

Contoh curl:

curl -i http://localhost:3001/api/admin/analytics/overview
curl -i "http://localhost:3001/api/admin/analytics/sales?range=7d"
curl -i "http://localhost:3001/api/admin/analytics/best-selling?range=7d&limit=5"
curl -i "http://localhost:3001/api/admin/analytics/recent-orders?limit=10"
Seed demo data (agar grafik punya data):

pnpm seed:analytics
Minimum API Contract (Public)
Auth:

curl -i -X POST http://localhost:3001/api/auth/login \
 -H "Content-Type: application/json" \
 -d "{\"email\":\"admin@local\",\"password\":\"admin123\"}"

curl -i http://localhost:3001/api/auth/me

# Logout (update cookie jar)

curl -i -c cookies.txt -b cookies.txt -X POST http://localhost:3001/api/auth/logout
Categories:

curl -i "http://localhost:3001/api/categories"
Products:

curl -i "http://localhost:3001/api/products?page=1&limit=12&q=shoe"
curl -i "http://localhost:3001/api/products?category=electronics"
curl -i "http://localhost:3001/api/products/your-product-slug"
Upload:

curl -i -X POST http://localhost:3001/api/upload \
 -F "file=@./path/to/image.jpg"
🧠 Catatan untuk Pemula
Jangan takut mencoba dan error
Baca error log di terminal
Periksa request API menggunakan Postman
Mulai dari memahami 1 fitur kecil terlebih dahulu
🚀 Rencana Pengembangan (Roadmap)
Autentikasi (Login & Register)
Keranjang belanja
Checkout & pembayaran
Admin dashboard
Validasi & security (JWT, bcrypt)
🤝 Kontribusi
Kontribusi sangat terbuka!

Fork repository
Buat branch baru
Commit perubahan
Buat Pull Request
📄 Lisensi
Proyek ini menggunakan lisensi MIT (atau sesuaikan).

📬 Kontak
Jika ada pertanyaan atau saran, silakan buka issue di repository ini.

Selamat belajar dan ngoding 🚀

Line Ending Guidance (Windows)
Untuk menjaga `pnpm-lock.yaml` tetap stabil lintas OS, gunakan Git dengan `core.autocrlf=input` (atau `core.autocrlf=false` jika editor sudah konsisten LF), lalu pastikan editor menyimpan file text dengan line ending `LF` agar `git status` tidak menandai perubahan palsu setelah `pnpm install`.
