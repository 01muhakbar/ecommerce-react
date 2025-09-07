import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as orderController from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";
const router = Router();
router.use(protect);
router.post("/", orderController.createOrder);
router.get("/", orderController.getUserOrders);
router.get("/:id", orderController.getOrderById);
export default router;
