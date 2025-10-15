import { Router } from "express";
import multer from "multer";
// FIX: Added .js extension to all relative imports
import { createProduct, deleteProduct, getAllProducts, getProductById, togglePublishStatus, updateProduct, } from "../controllers/adminProductController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
const router = Router();
const upload = multer({ dest: "public/uploads/products" });
router
    .route("/")
    .get(protect, 
// Middleware debug untuk logging
(req, res, next) => {
    // @ts-ignore
    const user = req.user;
    console.log("[ADMIN/PRODUCTS] Cek Akses Rute", {
        hasAuthHeader: !!req.headers.authorization,
        cookie: req.headers.cookie,
        user: user ? { id: user.id, email: user.email, role: user.role } : null,
    });
    next();
}, restrictTo("Super Admin", "Admin"), getAllProducts)
    .post(protect, restrictTo("Super Admin", "Admin"), upload.array("images"), createProduct);
router
    .route("/:id")
    .get(protect, restrictTo("Super Admin", "Admin"), getProductById)
    .put(protect, restrictTo("Super Admin", "Admin"), updateProduct)
    .delete(protect, restrictTo("Super Admin", "Admin"), deleteProduct);
router.patch("/:id/toggle-publish", protect, restrictTo("Super Admin", "Admin"), togglePublishStatus);
export default router;
