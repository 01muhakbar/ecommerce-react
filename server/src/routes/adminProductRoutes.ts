import { Router } from "express";
import multer from "multer";

// FIX: Added .js extension to all relative imports
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  togglePublishStatus,
  updateProduct,
} from "../controllers/adminProductController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";

const router = Router();
const upload = multer({ dest: "public/uploads/products" });

router
  .route("/")
  .get(protect, restrictTo("admin"), getAllProducts)
  .post(protect, restrictTo("admin"), upload.array("images"), createProduct);

router
  .route("/:id")
  .get(protect, restrictTo("admin"), getProductById)
  .put(protect, restrictTo("admin"), updateProduct)
  .delete(protect, restrictTo("admin"), deleteProduct);

router.patch(
  "/:id/toggle-publish",
  protect,
  restrictTo("admin"),
  togglePublishStatus
);

export default router;
