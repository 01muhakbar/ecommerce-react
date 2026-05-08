import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import {
  countSellerUnreadNotifications,
  listSellerNotifications,
  markAllSellerNotificationsRead,
  markSellerNotificationRead,
} from "../services/notification.service.js";

const router = Router();

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const parseNonNegativeInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const getAuthUserId = (req: any) => {
  const userId = Number(req?.user?.id);
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
};

const getStoreId = (req: any) => {
  const storeId = Number(req?.params?.storeId);
  return Number.isFinite(storeId) && storeId > 0 ? storeId : 0;
};

router.get(
  "/stores/:storeId/notifications",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const storeId = getStoreId(req);
      if (!userId || !storeId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const limit = parsePositiveInt(req.query.limit, 10);
      const offset = parseNonNegativeInt(req.query.offset, 0);
      const data = await listSellerNotifications(userId, storeId, limit, offset);
      return res.json({ success: true, data });
    } catch (error) {
      console.error("[seller.notifications][GET] failed:", error);
      return res.status(500).json({ success: false, message: "Failed to load seller notifications" });
    }
  }
);

router.get(
  "/stores/:storeId/notifications/unread-count",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const storeId = getStoreId(req);
      if (!userId || !storeId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const count = await countSellerUnreadNotifications(userId, storeId);
      return res.json({ success: true, data: { count } });
    } catch (error) {
      console.error("[seller.notifications][GET unread-count] failed:", error);
      return res.status(500).json({ success: false, message: "Failed to load unread count" });
    }
  }
);

router.patch(
  "/stores/:storeId/notifications/read-all",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const storeId = getStoreId(req);
      if (!userId || !storeId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const updated = await markAllSellerNotificationsRead(userId, storeId);
      return res.json({ success: true, data: { updated } });
    } catch (error) {
      console.error("[seller.notifications][PATCH read-all] failed:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to mark seller notifications as read" });
    }
  }
);

router.patch(
  "/stores/:storeId/notifications/:id/read",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const storeId = getStoreId(req);
      const notificationId = Number(req.params.id);
      if (!userId || !storeId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      if (!Number.isFinite(notificationId) || notificationId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid notification id" });
      }

      const updated = await markSellerNotificationRead(notificationId, userId, storeId);
      if (!updated) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("[seller.notifications][PATCH read] failed:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update seller notification" });
    }
  }
);

export default router;
