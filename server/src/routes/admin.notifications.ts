import { Router } from "express";
import {
  clearAllNotifications,
  getAdminNotifications,
  getAdminNotificationPreferenceSettings,
  getAdminUnreadCount,
  readAllAdminNotifications,
  readAdminNotification,
  removeAdminNotification,
  streamAdminNotifications,
  updateAdminNotificationPreferenceSettings,
} from "../controllers/admin/adminNotificationsController.js";

const router = Router();

router.get("/stream", streamAdminNotifications);
router.get("/", getAdminNotifications);
router.get("/unread-count", getAdminUnreadCount);
router.get("/preferences", getAdminNotificationPreferenceSettings);
router.put("/preferences", updateAdminNotificationPreferenceSettings);
router.patch("/read-all", readAllAdminNotifications);
router.delete("/", clearAllNotifications);
router.delete("/:id", removeAdminNotification);
router.patch("/:id/read", readAdminNotification);

export default router;
