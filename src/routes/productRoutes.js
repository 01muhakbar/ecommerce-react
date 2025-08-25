const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const productController = require("../controllers/productController");

const path = require("path");

// Rute untuk mendapatkan semua produk (Akses Publik)
router.get("/", productController.getAllProducts);

// Rute untuk menampilkan halaman tambah produk (Hanya Penjual/Admin)


// Rute untuk mendapatkan detail satu produk (Akses Publik)
router.get("/:id", productController.getProductById);

// Rute untuk membuat produk baru (Hanya Penjual/Admin)
router.post(
  "/",
  protect,
  restrictTo("penjual", "admin"),
  productController.createProduct
);

// Rute untuk menghapus produk (Hanya Admin)
router.delete("/:id", protect, restrictTo("admin"), productController.deleteProduct);

// Rute untuk memperbarui produk (Hanya Admin)
router.put("/:id", protect, restrictTo("admin"), productController.updateProduct);

module.exports = router;