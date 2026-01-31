import { Router } from "express";
import * as productController from "../controllers/productController.js";
import { requireAdmin } from "../middleware/requireRole.js";

const router = Router();

// Dummy routes to satisfy imports
router.get("/products", productController.getAllProducts);

export default router;

