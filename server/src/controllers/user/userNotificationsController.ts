import type { Request, Response } from "express";
import {
  clearAllUserNotifications,
  countUserUnreadNotifications,
  deleteUserNotification,
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  subscribeUserNotificationEvents,
} from "../../services/notification.service.js";

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
    const offset = parseNonNegativeInt(req.query.offset, 0);
    const data = await listUserNotifications(userId, limit, offset);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("[user.notifications][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
};

export const getUserUnreadNotificationCount = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const count = await countUserUnreadNotifications(userId);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    console.error("[user.notifications][GET unread-count] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load unread count" });
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

export const readAllUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const updated = await markAllUserNotificationsRead(userId);
    return res.json({ success: true, data: { updated } });
  } catch (error) {
    console.error("[user.notifications][PATCH read-all] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update notifications" });
  }
};

export const removeUserNotification = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid notification id" });
    }

    const deleted = await deleteUserNotification(id, userId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, data: { deleted: 1 } });
  } catch (error) {
    console.error("[user.notifications][DELETE] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};

export const clearUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const deleted = await clearAllUserNotifications(userId);
    return res.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error("[user.notifications][DELETE all] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to clear notifications" });
  }
};

export const streamUserNotifications = async (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const writeEvent = (eventName: string, payload: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const unreadCount = await countUserUnreadNotifications(userId);
    writeEvent("hello", { unreadCount });
  } catch {
    writeEvent("hello", { unreadCount: 0 });
  }

  const unsubscribe = subscribeUserNotificationEvents(async (payload) => {
    if (Number(payload.userId) !== userId) return;
    const unreadCount = await countUserUnreadNotifications(userId);
    writeEvent("notification:new", {
      notification: payload.notification,
      unreadCount,
    });
  });

  const heartbeat = setInterval(() => {
    writeEvent("ping", {});
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
};
