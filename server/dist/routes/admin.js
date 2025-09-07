import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as userController from "../controllers/userController.js";
import * as orderController from "../controllers/orderController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
const router = Router();
// Dummy routes to satisfy imports from app.ts
router.get("/dashboard/statistics", protect, restrictTo("admin"), (req, res) => res.json({ data: {} }));
router.get("/users", protect, restrictTo("admin"), userController.getAllUsers);
router.get("/orders", protect, restrictTo("admin"), orderController.getAllOrders);
export default router;
