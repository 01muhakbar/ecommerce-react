import type { Request, Response } from "express";
import {
  deleteNotificationById,
  listNotifications,
  markNotificationRead,
} from "../../services/notification.service.js";

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

export const getAdminNotifications = async (req: Request, res: Response) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 20);
    const data = await listNotifications(limit);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("[admin.notifications][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
};

export const removeAdminNotification = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid notification id" });
    }
    const deleted = await deleteNotificationById(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("[admin.notifications][DELETE] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};

export const readAdminNotification = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid notification id" });
    }
    const updated = await markNotificationRead(id);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("[admin.notifications][PATCH] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update notification" });
  }
};
