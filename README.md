# 📦 Proyek E-Commerce Fullstack (React + Node.js)

## 👋 Selamat Datang

Repository ini berisi **aplikasi website e-commerce fullstack** yang dibangun menggunakan **React** untuk frontend dan **Node.js (Express)** untuk backend. Proyek ini ditujukan untuk **pemula** yang ingin belajar membangun aplikasi web modern secara end-to-end.

README ini akan membantu Anda memahami struktur proyek, cara menjalankan aplikasi, serta alur kerja frontend dan backend.

---

## 🎯 Tujuan Proyek

* Mempelajari arsitektur **frontend & backend terpisah**
* Mengimplementasikan **REST API**
* Mengelola database menggunakan **ORM (Sequelize)**
* Memahami alur upload file dan autentikasi dasar
* Menjadi dasar pengembangan e-commerce skala kecil–menengah

---

## ✨ Fitur Utama

* Manajemen produk
* Upload gambar produk
* Struktur user & role (dasar)
* API backend terstruktur
* Frontend React siap dikembangkan

---

## 🧰 Tech Stack

### Frontend

* React
* JavaScript (ES6)
* CSS / kemungkinan framework UI

### Backend

* Node.js
* Express.js
* Sequelize ORM
* Database SQL (MySQL / PostgreSQL / SQLite – tergantung konfigurasi)

### Tools Pendukung

* Nodemon
* PNPM / NPM
* dotenv

---

## 📁 Struktur Folder

```
ecommerce-react-main/
├── client/        # Frontend React
├── server/        # Backend Express API
├── models/        # Model database (Sequelize)
├── config/        # Konfigurasi database & server
├── uploads/       # File upload (gambar, dll)
├── .env.example   # Contoh environment variable
├── package.json   # Konfigurasi dependency backend
├── pnpm-workspace.yaml
└── nodemon.json
```

---

## ⚙️ Cara Menjalankan Proyek (Untuk Pemula)

### 1️⃣ Prasyarat

Pastikan sudah terinstall:

* Node.js (disarankan v18+)
* NPM atau PNPM
* Database (MySQL / PostgreSQL / SQLite)

---

### 2️⃣ Clone Repository

```bash
git clone <url-repository>
cd ecommerce-react-main
```

---

### 3️⃣ Konfigurasi Environment

Salin file `.env.example` menjadi `.env` lalu sesuaikan:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=ecommerce_db
DB_DIALECT=mysql
PORT=5000
```

---

### 4️⃣ Install Dependency Backend

```bash
npm install
# atau
pnpm install
```

---

### 5️⃣ Jalankan Backend Server

```bash
npm run dev
```

Server akan berjalan di:

```
http://localhost:5000
```

---

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

## 🧠 Catatan untuk Pemula

* Jangan takut mencoba dan error
* Baca error log di terminal
* Periksa request API menggunakan Postman
* Mulai dari memahami **1 fitur kecil** terlebih dahulu

---

## 🚀 Rencana Pengembangan (Roadmap)

* Autentikasi (Login & Register)
* Keranjang belanja
* Checkout & pembayaran
* Admin dashboard
* Validasi & security (JWT, bcrypt)

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
