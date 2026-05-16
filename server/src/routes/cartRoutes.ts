import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as cartController from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";
import { cartMutationRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.use(protect);

router.get("/", cartController.getCart);
router.post("/add", cartMutationRateLimit, cartController.addToCart);
router.put("/items/by-id/:itemId", cartMutationRateLimit, cartController.setCartItemQty);
router.delete("/items/by-id/:itemId", cartMutationRateLimit, cartController.removeFromCart);
router.put("/items/:productId", cartMutationRateLimit, cartController.setCartItemQty);
router.delete("/remove/:itemId", cartMutationRateLimit, cartController.removeFromCart);

export default router;
