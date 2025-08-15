// src/routes/cartRoutes.js

const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { isAuth } = require("../middleware/auth");

// Rute untuk menambahkan item ke keranjang (dilindungi)
router.post("/add", isAuth, cartController.addToCart);

// Rute untuk melihat isi keranjang (dilindungi)
router.get("/", isAuth, cartController.getCart);

// Rute untuk menghapus item dari keranjang (dilindungi)
router.delete("/remove/:productId", isAuth, cartController.removeFromCart);

// Rute untuk memperbarui kuantitas item di keranjang (dilindungi)
router.put("/update/:productId", isAuth, cartController.updateCartItem);

module.exports = router;
