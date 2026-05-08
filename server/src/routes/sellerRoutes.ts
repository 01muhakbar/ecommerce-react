import express, { Router } from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import * as productController from '../controllers/productController.js';

const router: Router = express.Router();

// Semua rute di file ini dilindungi dan dibatasi untuk penjual
router.use(protect, restrictTo('penjual'));

// Melihat semua produk untuk penjual yang sedang login
router.get('/products', productController.getSellerProducts);

// Mendapatkan data produk untuk halaman edit
router.get('/products/:id/edit', productController.getEditProductPage);

// Menangani pembaruan produk (RESTful: PUT)
router.put('/products/:id', productController.updateProduct);

// Menangani penghapusan produk (RESTful: DELETE)
router.delete('/products/:id', productController.deleteProduct);

export default router;
