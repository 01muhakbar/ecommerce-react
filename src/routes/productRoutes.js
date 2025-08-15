const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");

// Placeholder untuk controller produk
const getProducts = (req, res) => res.json({ message: "Menampilkan semua produk (Akses Publik)" });
const addProduct = (req, res) => res.status(201).json({ message: `Produk '${req.body.name}' berhasil ditambahkan (Akses Penjual)` });
const deleteProduct = (req, res) => res.json({ message: `Produk dengan ID ${req.params.id} berhasil dihapus (Akses Admin)` });

// Rute ini bisa diakses oleh siapa saja
router.get("/", getProducts);

// Rute ini hanya bisa diakses oleh pengguna yang sudah login DAN memiliki peran 'penjual'.
router.post("/", protect, authorize("penjual"), addProduct);

// Rute ini hanya bisa diakses oleh pengguna yang sudah login DAN memiliki peran 'admin'.
// Middleware dijalankan secara berurutan:
// 1. `protect`: Memastikan ada token yang valid dan melampirkan data user (termasuk role) ke `req.user`.
// 2. `authorize('admin')`: Memeriksa apakah `req.user.role` adalah 'admin'.
router.delete("/:id", protect, authorize("admin"), deleteProduct);

module.exports = router;