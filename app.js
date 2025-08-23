require("dotenv").config(); // Muat environment variables
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors"); // Impor CORS

// Impor dari modul lokal
const db = require("./src/models");
const userRoutes = require("./src/routes/userRoutes");
const authRoutes = require("./src/routes/authRoutes");
const productRoutes = require("./src/routes/productRoutes");
const cartRoutes = require("./src/routes/cartRoutes");
const sellerRoutes = require('./src/routes/sellerRoutes');
const productController = require("./src/controllers/productController"); // Impor controller
const userController = require("./src/controllers/userController"); // Impor user controller
const { protect, restrictTo } = require("./src/middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk membaca body JSON dari request
app.use(express.json());

// Middleware untuk mem-parsing cookie dari request
app.use(cookieParser());

// Aktifkan CORS untuk semua rute
app.use(cors());

// Setup EJS view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Sajikan file statis dari direktori 'public'
// Contoh: akses http://localhost:3000/login.html
app.use(express.static(path.join(__dirname, "public")));

// --- Rute Dinamis untuk Halaman HTML ---

// Daftar halaman yang ingin dibuatkan rute bersih
const pages = ["forgot-password", "login", "register", "reset-password"];

// Loop untuk membuat rute secara otomatis
pages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, "public", `${page}.html`));
  });
});

// Rute yang dilindungi
app.get("/dashboard", protect, userController.renderDashboard);
app.get("/cart", protect, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "cart.html"))
);
app.get("/dashboard/add-product", protect, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "add-product.html"))
);

// New route for become-seller
app.get("/become-seller", protect, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "become-seller.html"))
);



// Rute khusus untuk halaman utama (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rute untuk halaman produk
app.get("/dashboard/products", productController.renderAllProducts);

// Rute untuk halaman manajemen pengguna admin
app.get("/dashboard/admin/users", protect, restrictTo("admin"), (req, res) => {
  res.render("admin/users"); // Render the EJS file
});

// Rute untuk halaman manajemen produk admin
app.get("/dashboard/admin/products", protect, restrictTo("admin"), (req, res) => {
  res.render("admin/products"); // Render the EJS file
});

// Rute untuk halaman tambah pengguna admin
app.get("/dashboard/admin/users/add", protect, restrictTo("admin"), (req, res) => {
  res.render("admin/add-user"); // Render the EJS file
});

// Rute untuk halaman edit pengguna admin
app.get("/dashboard/admin/users/:id/edit", protect, restrictTo("admin"), (req, res) => {
  res.render("admin/edit-user"); // Render the EJS file
});

// Rute untuk mengaktifkan/menonaktifkan pengguna oleh admin
app.put("/api/v1/admin/users/:id/toggle-status", protect, restrictTo("admin"), userController.updateUserStatus);

// --- SELLER ROUTES ---
app.use('/dashboard/seller', sellerRoutes);

// --- API ROUTES ---
const apiV1Router = express.Router();
apiV1Router.use("/users", userRoutes);
apiV1Router.use("/auth", authRoutes);
apiV1Router.use("/products", productRoutes);
apiV1Router.use("/cart", cartRoutes);

app.use("/api/v1", apiV1Router);

// --- ERROR HANDLING ---

// Handler untuk rute API yang tidak ditemukan (404)
app.all("/api/*", (req, res) => {
  res.status(404).json({
    status: "fail",
    message: `Rute ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

// --- START SERVER ---
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
