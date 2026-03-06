import type { Request, Response } from "express";
import {
  clearAllAdminNotifications,
  countAdminUnreadNotifications,
  deleteNotificationById,
  getAdminNotificationPreferences,
  getKnownAdminNotificationTypes,
  isAdminNotificationTypeEnabled,
  listNotifications,
  markAllAdminNotificationsRead,
  markNotificationRead,
  subscribeAdminNotificationEvents,
  updateAdminNotificationPreferences,
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

const getCurrentAdminId = (req: Request) => {
  const rawId = Number((req as any)?.user?.id);
  return Number.isFinite(rawId) && rawId > 0 ? rawId : null;
};

export const getAdminNotifications = async (req: Request, res: Response) => {
  try {
    const adminId = getCurrentAdminId(req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const limit = parsePositiveInt(req.query.limit, 20);
    const offset = parseNonNegativeInt(req.query.offset, 0);
    const data = await listNotifications(limit, offset, adminId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("[admin.notifications][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
};

export const getAdminUnreadCount = async (_req: Request, res: Response) => {
  try {
    const adminId = getCurrentAdminId(_req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const count = await countAdminUnreadNotifications(adminId);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    console.error("[admin.notifications][GET unread-count] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load unread count" });
  }
};

export const readAllAdminNotifications = async (_req: Request, res: Response) => {
  try {
    const adminId = getCurrentAdminId(_req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const updated = await markAllAdminNotificationsRead(adminId);
    return res.json({ success: true, data: { updated } });
  } catch (error) {
    console.error("[admin.notifications][PATCH read-all] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to mark all notifications as read" });
  }
};

export const clearAllNotifications = async (_req: Request, res: Response) => {
  try {
    const deleted = await clearAllAdminNotifications();
    return res.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error("[admin.notifications][DELETE all] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to clear notifications" });
  }
};

export const streamAdminNotifications = async (req: Request, res: Response) => {
  const adminId = getCurrentAdminId(req);
  if (!adminId) {
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
    const unreadCount = await countAdminUnreadNotifications(adminId);
    writeEvent("hello", { unreadCount });
  } catch {
    writeEvent("hello", { unreadCount: 0 });
  }

  const unsubscribe = subscribeAdminNotificationEvents(async (payload) => {
    const isEnabled = await isAdminNotificationTypeEnabled(adminId, payload.type);
    if (!isEnabled) return;
    const unreadCount = await countAdminUnreadNotifications(adminId);
    writeEvent("notification:new", {
      type: payload.type,
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

export const getAdminNotificationPreferenceSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = getCurrentAdminId(req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const data = await getAdminNotificationPreferences(adminId);
    return res.json({
      success: true,
      data: {
        enabledTypes: data.enabledTypes,
        availableTypes: getKnownAdminNotificationTypes(),
      },
    });
  } catch (error) {
    console.error("[admin.notifications][GET preferences] failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load notification preferences" });
  }
};

export const updateAdminNotificationPreferenceSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = getCurrentAdminId(req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const enabledTypes = req.body?.enabledTypes;
    if (!Array.isArray(enabledTypes)) {
      return res.status(400).json({
        success: false,
        message: "enabledTypes must be an array of strings",
      });
    }
    if (enabledTypes.some((entry) => typeof entry !== "string")) {
      return res.status(400).json({
        success: false,
        message: "enabledTypes must be an array of strings",
      });
    }

    const data = await updateAdminNotificationPreferences(adminId, enabledTypes);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("[admin.notifications][PUT preferences] failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update notification preferences" });
  }
};
