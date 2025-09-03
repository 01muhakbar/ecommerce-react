import express from "express";
import { register, login, logout } from "../controllers/authController";
import { getMe, updateMe } from "../controllers/userController";
import { protect } from "../middleware/authMiddleware";
import {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
} from "../middleware/validators";

const router = express.Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.get("/logout", logout);

router.use(protect); // Middleware untuk melindungi rute di bawah ini

router.get("/me", getMe);
router.patch("/updateMe", validateUpdateProfile, updateMe);

export default router;
