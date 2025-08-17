require("dotenv").config(); // Muat environment variables
const express = require("express");
const path = require("path"); // Impor modul path
const cookieParser = require("cookie-parser"); // Impor cookie-parser
// Impor objek `db` dari direktori models yang sudah kita perbaiki
const db = require("./src/models");

// Impor rute-rute Anda di sini
const userRoutes = require("./src/routes/userRoutes");
const productRoutes = require("./src/routes/productRoutes");
const { protect } = require("./src/middleware/authMiddleware");
const cartRoutes = require("./src/routes/cartRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk membaca body JSON dari request
app.use(express.json());

// Middleware untuk mem-parsing cookie dari request
app.use(cookieParser());

// Sajikan file statis dari direktori 'public'
// Contoh: akses http://localhost:3000/login.html
app.use(express.static(path.join(__dirname, "public")));

// --- Rute Dinamis untuk Halaman HTML ---

// Daftar halaman yang ingin dibuatkan rute bersih
const pages = ["forgot-password", "login", "register", "reset-password"];
// Halaman yang tidak memerlukan login
const publicPages = ["login", "register", "forgot-password", "reset-password"];

// Loop untuk membuat rute secara otomatis
pages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, "public", `${page}.html`));
  });
});

// Rute yang dilindungi
app.get("/dashboard", protect, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);
app.get("/cart", protect, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "cart.html"))
);
app.get("/add-product", protect, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "add-product.html"))
);

// Rute khusus untuk halaman utama (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Gunakan rute-rute Anda
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

// Sinkronisasi database lalu jalankan server
db.sequelize
  .sync({ force: false }) // Gunakan { force: true } hanya saat development untuk reset database
  .then(() => {
    console.log("Database & tables synced successfully.");
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database or sync:", err);
    process.exit(1); // Keluar dari aplikasi jika koneksi DB gagal
  });
