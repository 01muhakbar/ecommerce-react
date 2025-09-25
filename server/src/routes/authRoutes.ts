import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateLogin } from "../middleware/validators.js";

const router = Router();

// Public routes
router.post("/login", validateLogin, authController.login);
router.post("/admin/login", authController.adminLogin);
router.post("/admin/forgot-password", authController.forgotPasswordAdmin);
router.post("/admin/reset-password/:token", authController.resetPasswordAdmin);
router.post("/register", authController.register);

// Protected routes
router.get("/me", protect, authController.getMe);
router.post("/logout", protect, authController.logout);

export default router;
