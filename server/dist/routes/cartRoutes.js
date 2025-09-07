import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as cartController from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";
const router = Router();
router.use(protect);
router.get("/", cartController.getCart);
router.post("/add", cartController.addToCart);
router.delete("/remove/:itemId", cartController.removeFromCart);
export default router;
