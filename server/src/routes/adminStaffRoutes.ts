import { Router } from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  toggleActive,
  togglePublished,
} from "../controllers/adminStaffController.js";

const router = Router();

// All routes here require login and an admin role
router.use(protect, restrictTo("Admin", "Super Admin"));

router.get("/", getStaff);
router.post("/", createStaff);
router.patch("/:id", updateStaff);
router.delete("/:id", deleteStaff);
router.post("/:id/toggle-active", toggleActive);
router.post("/:id/toggle-published", togglePublished);

export default router;
