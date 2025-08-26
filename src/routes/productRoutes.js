const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect, restrictTo } = require("../middleware/authMiddleware");
const productController = require("../controllers/productController");

// Konfigurasi Multer untuk penyimpanan file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Simpan file di folder public/images/products
    cb(null, "public/images/products");
  },
  filename: function (req, file, cb) {
    // Buat nama file yang unik untuk menghindari konflik
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Inisialisasi Multer dengan konfigurasi storage
const upload = multer({ storage: storage });

// --- RUTE PRODUK ---

// Rute untuk mendapatkan semua produk (Akses Publik)
router.get("/", productController.getAllProducts);

// Rute untuk mendapatkan detail satu produk (Akses Publik)
router.get("/:id", productController.getProductById);

// Rute untuk membuat produk baru (Hanya Penjual/Admin)
// Middleware `upload.fields` akan memproses file sebelum masuk ke controller
router.post(
  "/",
  protect,
  restrictTo("penjual", "admin"),
  upload.fields([
    { name: "productImages", maxCount: 9 },
    { name: "promoProductImage", maxCount: 1 },
    { name: "productVideo", maxCount: 1 },
  ]),
  productController.createProduct
);

// Rute untuk menghapus produk (Hanya Admin)
router.delete("/:id", protect, restrictTo("admin"), productController.deleteProduct);

// Rute untuk memperbarui produk (Hanya Admin)
router.put("/:id", protect, restrictTo("admin"), productController.updateProduct);

module.exports = router;
