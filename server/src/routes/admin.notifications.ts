import { Router } from "express";
import {
  getAdminNotifications,
  readAdminNotification,
  removeAdminNotification,
} from "../controllers/admin/adminNotificationsController.js";

const router = Router();

router.get("/", getAdminNotifications);
router.delete("/:id", removeAdminNotification);
router.patch("/:id/read", readAdminNotification);

export default router;
