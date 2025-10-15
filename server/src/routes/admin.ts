import { Router, Request, Response, NextFunction } from "express";
// FIX: Added .js extension to all relative imports
import * as userController from "../controllers/userController.js";
import * as orderController from "../controllers/orderController.js";
import * as adminController from "../controllers/adminController.js";
import { getAdminStats } from "../controllers/adminStats.controller.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

// Dummy routes to satisfy imports from app.ts
router.get(
  "/dashboard/statistics",
  protect,
  restrictTo("Admin", "Super Admin"),
  // TEMP DEBUG MIDDLEWARE
  (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const u = req.user;
    console.log('[ADMIN/DASH] incoming',
      {
        hasAuthHeader: !!req.headers.authorization,
        cookie: req.headers.cookie,
        userId: u?.id, email: u?.email, role: u?.role
      });
    next();
  },
  adminController.getDashboardStatistics
);
router.get("/users", protect, restrictTo("Admin", "Super Admin"), userController.getAllUsers);
router.get(
  "/orders",
  protect,
  restrictTo("Admin", "Super Admin"),
  orderController.getAllOrders
);

// Route for the new admin statistics endpoint
router.get("/stats", protect, restrictTo("Super Admin"), getAdminStats);

export default router;