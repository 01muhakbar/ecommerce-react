import express, { Router, Request } from "express";
import multer, { StorageEngine } from "multer";
import path from "path";
import { protect, restrictTo } from "../middleware/authMiddleware";
import * as productController from "../controllers/productController";
import validate from "../middleware/validate";
import { createProductSchema } from "@ecommerce/schemas";

const router: Router = express.Router();

// Konfigurasi Multer untuk penyimpanan file
const storage: StorageEngine = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, "public/images/products");
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// --- RUTE PRODUK ---

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.get(
  "/:id/preview",
  protect,
  restrictTo("admin", "penjual"),
  productController.getProductDetailsForPreview
);

// Rute untuk membuat produk baru
router.post(
  "/",
  protect,
  restrictTo("penjual", "admin"),
  upload.fields([
    { name: "productImages", maxCount: 9 },
    { name: "promoProductImage", maxCount: 1 },
    { name: "productVideo", maxCount: 1 },
  ]),
  validate(createProductSchema), // Pindahkan validasi ke sini setelah multer
  productController.createProduct
);

// Rute untuk menghapus produk
router.delete(
  "/:id",
  protect,
  restrictTo("admin"),
  productController.deleteProduct
);

// Rute untuk memperbarui produk
router.put(
  "/:id",
  protect,
  restrictTo("admin", "penjual"),
  productController.updateProduct
);

export default router;
