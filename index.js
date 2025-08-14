// 1. Impor & Konfigurasi Awal
require("dotenv").config(); // Panggil dotenv di paling atas
const express = require("express");
const session = require("express-session");
const flash = require("express-flash");
const methodOverride = require("method-override");
const sequelize = require("./config/database");
const webRoutes = require("./src/routes/web"); // Impor rute satu kali

// 2. Inisialisasi Aplikasi
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Konfigurasi View Engine
app.set("view engine", "ejs");

// 4. Konfigurasi Middleware (URUTAN PENTING, CUKUP SATU KALI)
// Middleware untuk membaca body dari form dan JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware untuk bisa menggunakan metode PUT atau DELETE dari form HTML
app.use(methodOverride("_method"));

// Middleware untuk Session HARUS didaftarkan SEBELUM Flash dan middleware lain yang butuh session
app.use(
  session({
    secret: "ganti-dengan-kunci-rahasia-yang-kuat",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 jam
    },
  })
);

// Middleware untuk Flash Messages (bergantung pada session)
app.use(flash());

// Middleware GLOBAL untuk mengirim status login ke semua view (bergantung pada session)
app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session.userId ? true : false;
  res.locals.userName = req.session.userName || null;
  next();
});

// 5. Daftarkan Rute Utama Anda (CUKUP SATU KALI)
app.use(webRoutes);

// Rute sederhana untuk halaman utama (jika tidak ada di webRoutes)
app.get("/", (req, res) => {
  res.send("<h1>Selamat Datang di E-Commerce API!</h1>");
});

// 6. Jalankan Server dan Sinkronisasi Database
app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Koneksi ke database berhasil.");

    // Cukup panggil sync() satu kali.
    // Gunakan { alter: true } hanya jika Anda ingin mengubah struktur tabel yang sudah ada.
    // Untuk penggunaan normal, sync() saja sudah cukup.
    await sequelize.sync();
    console.log("✅ Semua tabel berhasil disinkronkan.");
  } catch (error) {
    console.error("❌ Gagal melakukan sinkronisasi atau koneksi ke DB:", error);
  }

  console.log(`🚀 Server berjalan pada http://localhost:${PORT}`);
});
