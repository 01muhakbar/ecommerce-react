import { Router } from "express";
// FIX: Added .js extension to all relative imports
import * as authController from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
// FIX: `validateRegister` is removed as it's not available in `validators.ts`.
import { validateLogin } from "../middleware/validators.js";

const router = Router();

// Public routes
router.post("/login", validateLogin, authController.login);
router.post("/admin/login", authController.loginAdmin);
router.post("/admin/forgot-password", authController.forgotPasswordAdmin);
router.post("/admin/reset-password/:token", authController.resetPasswordAdmin);

// FIX: `validateRegister` middleware removed.
router.post("/register", authController.register);

// Protected routes
router.post("/logout", protect, authController.logout);

export default router;
