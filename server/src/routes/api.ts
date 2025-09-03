import express, { Router } from 'express';
import * as productController from '../controllers/productController';
import { isAuth } from '../middleware/auth'; // Menggunakan isAuth dari auth.ts

const router: Router = express.Router();

// Endpoint untuk mendapatkan detail produk untuk preview (membutuhkan otentikasi)
// GET /api/products/:id
router.get('/products/:id', isAuth, productController.getProductDetailsForPreview);

export default router;