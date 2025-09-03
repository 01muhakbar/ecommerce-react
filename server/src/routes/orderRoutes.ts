
import express, { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { protect, restrictTo } from '../middleware/authMiddleware';

const router: Router = express.Router();

// Semua rute di bawah ini memerlukan login
router.use(protect);

// Rute untuk pengguna biasa
router.route('/')
    .post(orderController.createOrder)
    .get(orderController.getUserOrders);

router.get('/:id', orderController.getOrderById);

// --- RUTE KHUSUS ADMIN ---

// Rute untuk admin melihat semua pesanan
router.get('/admin/all', restrictTo('admin'), orderController.getAllOrders);

// Rute untuk admin mengubah status pesanan
router.patch('/admin/:id/status', restrictTo('admin'), orderController.updateOrderStatus);

export default router;
