import express from "express";
import { getMe, updateMe } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateUpdateProfile } from "../middleware/validators.js";
const router = express.Router();
// All routes below are protected
router.use(protect);
router.get("/me", getMe);
router.patch("/updateMe", validateUpdateProfile, updateMe);
export default router;
