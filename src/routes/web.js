// src/routes/web.js
const express = require("express");
const router = express.Router();

// Impor semua controller dan middleware yang dibutuhkan
const productController = require("../controllers/productController");
const userController = require("../controllers/userController");
const { isAuth, isPenjualOrAdmin } = require("../middleware/auth"); // Gunakan middleware yang sudah dirapikan
const cartController = require("../controllers/cartController");

// =================================
// RUTE UTAMA & AUTENTIKASI
// =================================

// Rute Halaman Utama (jika ada)
// router.get('/', ...);

// Rute untuk Registrasi (Publik)
router.get("/register", userController.showRegisterForm);
router.post("/register", userController.registerUser);

// Rute untuk Login (Publik)
router.get("/login", userController.showLoginForm);
router.post("/login", userController.loginUser);

// Rute untuk Logout (Harus login)
router.post("/logout", isAuth, userController.logoutUser);

// Rute untuk Registrasi Penjual (Publik, tapi terpisah)
router.get("/register-seller", userController.showSellerRegisterForm);
router.post("/register-seller", userController.registerSeller);

// RUTE DASHBOARD
// =================================
router.get(
  "/dashboard/seller",
  isAuth,
  isPenjualOrAdmin,
  userController.showSellerDashboard
);

// =================================
// RUTE PRODUK
// =================================

// Rute untuk melihat semua produk (hanya perlu login)
router.get("/products", isAuth, productController.getAllProducts);

// Rute untuk menampilkan form tambah produk (hanya penjual/admin)
// PENTING: Rute '/add' harus sebelum '/:id'
router.get(
  "/products/add",
  isAuth,
  isPenjualOrAdmin,
  productController.showAddForm
);

// Rute untuk menampilkan detail satu produk (hanya perlu login)
router.get("/products/:id", isAuth, productController.getProductById);

// Rute untuk memproses data dari form tambah produk (hanya penjual/admin)
router.post(
  "/products",
  isAuth,
  isPenjualOrAdmin,
  productController.createProduct
);

// Rute untuk menampilkan form edit produk (hanya penjual/admin)
router.get(
  "/products/edit/:id",
  isAuth,
  isPenjualOrAdmin,
  productController.showEditForm
);

// Rute untuk memproses data dari form edit (hanya penjual/admin)
router.put(
  "/products/:id",
  isAuth,
  isPenjualOrAdmin,
  productController.updateProduct
);

// Rute untuk memproses penghapusan produk (hanya penjual/admin)
router.delete(
  "/products/:id",
  isAuth,
  isPenjualOrAdmin,
  productController.deleteProduct
);

// =================================
// RUTE KERANJANG BELANJA
// =================================
router.post("/cart/add/:id", isAuth, cartController.addToCart);
router.post("/cart/remove/:id", isAuth, cartController.removeFromCart);

// Jangan lupa ekspor router di akhir
module.exports = router;
