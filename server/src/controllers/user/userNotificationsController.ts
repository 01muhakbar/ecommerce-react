import type { Request, Response } from "express";
import {
  listUserNotifications,
  markUserNotificationRead,
} from "../../services/notification.service.js";

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const getAuthUserId = (req: Request) => {
  const userId = Number((req as any)?.user?.id);
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
};

export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const limit = parsePositiveInt(req.query.limit, 20);
    const data = await listUserNotifications(userId, limit);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("[user.notifications][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
};

export const readUserNotification = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid notification id" });
    }

    const updated = await markUserNotificationRead(id, userId);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("[user.notifications][PATCH] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update notification" });
  }
};
