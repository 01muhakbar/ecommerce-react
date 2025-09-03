import express, { Router } from 'express';
import * as cartController from '../controllers/cartController';
import { isAuth } from '../middleware/auth'; // Asumsi isAuth adalah named export

const router: Router = express.Router();

// Rute untuk menambahkan item ke keranjang (dilindungi)
router.post("/add", isAuth, cartController.addToCart);

// Rute untuk melihat isi keranjang (dilindungi)
router.get("/", isAuth, cartController.getCart);

// Rute untuk menghapus item dari keranjang (dilindungi)
router.delete("/remove/:productId", isAuth, cartController.removeFromCart);

// Rute untuk memperbarui kuantitas item di keranjang (dilindungi)
router.put("/update/:productId", isAuth, cartController.updateCartItem);

export default router;