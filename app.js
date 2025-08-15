require("dotenv").config(); // Muat environment variables
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path"); // Impor modul path
// Impor objek `db` dari direktori models yang sudah kita perbaiki
const db = require("./src/models");

// Impor rute-rute Anda di sini
const authRoutes = require("./src/routes/authRoutes"); // Impor rute otentikasi dari folder src
const userRoutes = require("./src/routes/userRoutes");
const productRoutes = require("./src/routes/productRoutes");
const cartRoutes = require("./src/routes/cartRoutes");
const { protect } = require("./src/middleware/authMiddleware"); // Impor middleware pelindung

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk membaca body JSON dari request
app.use(express.json());

// Middleware untuk mem-parsing cookie
app.use(cookieParser());

// Middleware untuk menyajikan file statis dari folder 'public'
// Sekarang Anda bisa mengakses http://localhost:3000/login.html, dll.
app.use(express.static(path.join(__dirname, "public")));

// --- Rute untuk Menyajikan Halaman (UI) ---
// Kode ini menyajikan file HTML dari folder 'public' untuk URL yang bersih.
// Contoh: Mengakses /login akan menampilkan public/login.html
const pages = ["login", "register", "dashboard", "cart", "add-product", "forgot-password", "reset-password"];
pages.forEach((page) => {
  const routeHandler = (req, res) => {
    res.sendFile(path.join(__dirname, "public", `${page}.html`));
  };

  app.get(`/${page}`, routeHandler);
});

// --- Rute untuk API ---
// Semua logika bisnis (login, data user, produk) ada di sini.
app.use("/api/auth", authRoutes); // Gunakan rute otentikasi di bawah /api/auth
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

// Setelah menggunakan Migrations, kita tidak lagi membutuhkan sync().
// Aplikasi hanya perlu memastikan koneksi database berhasil.
db.sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
    app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
  })
  .catch(err => console.error('Unable to connect to the database:', err));
