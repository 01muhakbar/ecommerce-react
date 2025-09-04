import express from "express";
import multer from "multer";
import path from "path";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  togglePublishStatus,
  updateProduct,
} from "../controllers/adminProductController";
import { protect, restrictTo } from "../middleware/authMiddleware";
import validate from "../middleware/validate";
import { createProductSchema } from "@ecommerce/schemas";

const router = express.Router();

// Konfigurasi Multer untuk upload gambar produk
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/products/");
  },
  filename: function (req, file, cb) {
    cb(null, `product-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage: storage });

// Semua rute di bawah ini dilindungi dan hanya untuk admin
router.use(protect, restrictTo("admin"));

router
  .route("/")
  .get(getAllProducts)
  .post(
    upload.array("images", 5),
    validate(createProductSchema),
    createProduct
  );
router
  .route("/:id")
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);
router.patch("/:id/toggle-publish", togglePublishStatus);

export default router;
