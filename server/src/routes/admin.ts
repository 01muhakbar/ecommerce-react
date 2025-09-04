import express from "express";
import * as userController from "../controllers/userController";
import * as orderController from "../controllers/orderController";
import * as adminController from "../controllers/adminController";
import { protect, restrictTo } from "../middleware/authMiddleware";

const router = express.Router();

// Lindungi semua rute di file ini dengan otentikasi dan role check admin
router.use(protect, restrictTo("admin"));

// --- Dashboard Statistics ---
router.get("/dashboard/statistics", adminController.getDashboardStatistics);

// --- User Management ---
router.get("/users", userController.getAllUsers);
router.post("/users", userController.createUser);

router
  .route("/users/:id")
  .get(userController.getUserById)
  .patch(userController.updateUser) // Menggunakan updateUser untuk admin
  .delete(userController.deleteUser);

// --- Order Management ---
router.get("/orders", orderController.getAllOrders);
router.patch("/orders/:id/status", orderController.updateOrderStatus);

export default router;
