const express = require("express");
const router = express.Router();
const { isAuth, hasRole } = require("../middleware/auth");
const productController = require("../controllers/productController");

const path = require("path");

// Rute untuk mendapatkan semua produk (Akses Publik)
router.get("/", productController.getAllProducts);

// Rute untuk menampilkan halaman tambah produk (Hanya Penjual/Admin)
router.get("/add", isAuth, hasRole("penjual", "admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "public", "add-product.html"));
});

// Rute untuk mendapatkan detail satu produk (Akses Publik)
router.get("/:id", productController.getProductById);

// Rute untuk membuat produk baru (Hanya Penjual/Admin)
router.post(
  "/",
  isAuth,
  hasRole("penjual", "admin"),
  productController.createProduct
);

// Catatan: Anda perlu membuat fungsi deleteProduct di dalam productController.js
// router.delete("/:id", isAuth, hasRole("admin"), productController.deleteProduct);

module.exports = router;