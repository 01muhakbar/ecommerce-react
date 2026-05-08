import { Router } from "express";
// FIX: Added .js extension to all relative imports
import {
  getOrders,
  updateOrderStatus,
} from "../controllers/adminOrderController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

// Base path is /api/v1/admin/orders, so these routes are relative to that
router.get("/", protect, restrictTo("Super Admin", "Admin"), getOrders);
router.put("/:id/status", protect, restrictTo("Super Admin", "Admin"), updateOrderStatus);

export default router;
