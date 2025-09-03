import express, { Router, Request, Response } from "express";
import path from "path";
import * as authController from "../controllers/authController";
import { validateRegister, validateLogin } from "../middleware/validators";
import validate from "../middleware/validate";
import {
  loginAdminSchema,
  forgotPasswordAdminSchema,
  resetPasswordAdminSchema,
} from "@ecommerce/schemas";

const router: Router = express.Router();

// --- User Auth ---
router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.post("/logout", authController.logout);

// --- User Password Management ---
router.post("/forgot-password", authController.forgotPassword);

router
  .route("/reset-password/:token")
  .get((req: Request, res: Response) => {
    // Menyajikan halaman statis untuk form reset password
    res.sendFile(
      path.join(__dirname, "..", "..", "public", "reset-password.html")
    );
  })
  .patch(authController.resetPassword);
// --- Admin Auth & Password ---
router.post(
  "/admin/login",
  validate(loginAdminSchema),
  authController.loginAdmin
);
router.post(
  "/admin/forgot-password",
  validate(forgotPasswordAdminSchema),
  authController.forgotPasswordAdmin
);
router.post(
  "/admin/reset-password/:token",
  validate(resetPasswordAdminSchema),
  authController.resetPasswordAdmin
);

export default router;
