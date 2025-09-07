import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as productController from "../controllers/productController.js";
import { isAuth } from "../middleware/auth.js";

const router = Router();

// Dummy routes to satisfy imports
router.get("/products", productController.getAllProducts);

export default router;
