import { Router } from 'express';
import { getOrders, updateOrderStatus } from '../controllers/adminOrderController';
import { protect, restrictTo } from '../middleware/authMiddleware';

const router = Router();

// Base path is /api/v1/admin/orders, so these routes are relative to that
router.get('/', protect, restrictTo('admin'), getOrders);
router.put('/:id/status', protect, restrictTo('admin'), updateOrderStatus);

export default router;
