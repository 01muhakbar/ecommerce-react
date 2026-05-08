import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as categoryController from "../controllers/categoryController.js";

const router = Router();

router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);

export default router;
