import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as userController from "../controllers/userController.js";
import * as orderController from "../controllers/orderController.js";
import * as adminController from "../controllers/adminController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
const router = Router();
// Dummy routes to satisfy imports from app.ts
router.get("/dashboard/statistics", protect, restrictTo("admin"), adminController.getDashboardStatistics);
router.get("/users", protect, restrictTo("admin"), userController.getAllUsers);
router.get("/orders", protect, restrictTo("admin"), orderController.getAllOrders);
export default router;
