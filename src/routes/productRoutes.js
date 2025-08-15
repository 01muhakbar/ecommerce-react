// src/routes/productRoutes.js

const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { isAuth, hasRole } = require("../middleware/auth");

// Rute untuk membuat produk baru
// POST /api/products
// 1. `isAuth` akan memverifikasi token.
// 2. `hasRole('penjual')` akan memastikan hanya user dengan peran 'penjual' yang bisa lanjut.
// 3. Jika keduanya lolos, `productController.createProduct` akan dijalankan.
router.post("/", isAuth, hasRole("penjual"), productController.createProduct);

// Rute untuk melihat semua produk (Publik)
// GET /api/products
router.get("/", productController.getAllProducts);

// Rute untuk melihat detail satu produk berdasarkan ID (Publik)
// GET /api/products/:id
router.get("/:id", productController.getProductById);

module.exports = router;
