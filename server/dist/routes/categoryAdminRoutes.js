import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as categoryAdminController from "../controllers/categoryAdminController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
const router = Router();
router.use(protect, restrictTo("admin"));
router
    .route("/")
    .get(categoryAdminController.getAllCategories)
    .post(categoryAdminController.createCategory);
router
    .route("/:id")
    .patch(categoryAdminController.updateCategory)
    .delete(categoryAdminController.deleteCategory);
export default router;
