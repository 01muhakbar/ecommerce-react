import { Router } from "express";
import * as productController from "../controllers/productController";
import { requireAdmin } from "../middleware/requireRole";

const router = Router();

// Dummy routes to satisfy imports
router.get("/products", productController.getAllProducts);

export default router;
