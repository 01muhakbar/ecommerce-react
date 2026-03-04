import { Op } from "sequelize";
import { Notification } from "../models/index.js";

type NewOrderNotificationInput = {
  customerName?: string | null;
  amount: number;
  orderId: number;
  invoiceNo?: string | null;
};

type UserOrderNotificationInput = {
  userId: number;
  orderId: number;
  invoiceNo?: string | null;
};

type UserOrderStatusNotificationInput = {
  userId: number;
  orderId: number;
  invoiceNo?: string | null;
  status: string;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

let ensured = false;

const normalizeMeta = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null;
};

const toUserIdFromMeta = (meta: unknown) => {
  const parsed = normalizeMeta(meta);
  const userId = Number(parsed?.userId);
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
};

const isUserTargeted = (meta: unknown) => toUserIdFromMeta(meta) > 0;

const toNotificationPayload = (item: any) => ({
  id: item.id,
  type: item.type,
  title: item.title,
  isRead: Boolean(item.isRead),
  meta: normalizeMeta(item.meta),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const ensureNotificationStorage = async () => {
  if (ensured) return;
  await Notification.sync();
  ensured = true;
};

export const createNotification = async (input: {
  type: string;
  title: string;
  meta?: Record<string, unknown> | null;
}) => {
  await ensureNotificationStorage();
  return Notification.create({
    type: input.type,
    title: input.title,
    isRead: false,
    meta: input.meta ?? null,
  });
};

export const createNewOrderNotification = async (input: NewOrderNotificationInput) => {
  const customerName = String(input.customerName || "").trim() || "Customer";
  const amount = toNumber(input.amount, 0).toFixed(2);
  const orderId = toNumber(input.orderId, 0);
  const invoiceNo = String(input.invoiceNo || "").trim() || null;
  const title = `${customerName} placed an order of ${amount}!`;

  return createNotification({
    type: "NEW_ORDER",
    title,
    meta: {
      orderId,
      invoiceNo,
      amount: toNumber(input.amount, 0),
      customerName,
    },
  });
};

export const createUserOrderPlacedNotification = async (
  input: UserOrderNotificationInput
) => {
  const userId = toNumber(input.userId, 0);
  if (!userId) return null;
  const orderId = toNumber(input.orderId, 0);
  const invoiceNo = String(input.invoiceNo || "").trim() || `#${orderId}`;
  const title = `Your order ${invoiceNo} has been placed`;

  return createNotification({
    type: "ORDER_PLACED",
    title,
    meta: {
      userId,
      orderId,
      invoiceNo,
    },
  });
};

export const createUserOrderStatusUpdatedNotification = async (
  input: UserOrderStatusNotificationInput
) => {
  const userId = toNumber(input.userId, 0);
  if (!userId) return null;
  const orderId = toNumber(input.orderId, 0);
  const invoiceNo = String(input.invoiceNo || "").trim() || `#${orderId}`;
  const status = String(input.status || "").trim() || "updated";
  const title = `Order ${invoiceNo} status updated to ${status}`;

  return createNotification({
    type: "ORDER_STATUS_UPDATED",
    title,
    meta: {
      userId,
      orderId,
      invoiceNo,
      status,
    },
  });
};

export const listNotifications = async (limit = 20) => {
  await ensureNotificationStorage();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));

  const [items, unreadItems] = await Promise.all([
    Notification.findAll({
      order: [["createdAt", "DESC"]],
    }),
    Notification.findAll({
      where: { isRead: false },
      order: [["createdAt", "DESC"]],
    }),
  ]);

  const adminItems = items.filter((item) => !isUserTargeted(item.meta)).slice(0, safeLimit);
  const unreadCount = unreadItems.filter((item) => !isUserTargeted(item.meta)).length;

  return {
    unreadCount,
    items: adminItems.map(toNotificationPayload),
  };
};

export const listUserNotifications = async (userId: number, limit = 20) => {
  await ensureNotificationStorage();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const safeUserId = toNumber(userId, 0);
  if (!safeUserId) {
    return { unreadCount: 0, items: [] as ReturnType<typeof toNotificationPayload>[] };
  }

  const [items, unreadItems] = await Promise.all([
    Notification.findAll({
      order: [["createdAt", "DESC"]],
    }),
    Notification.findAll({
      where: { isRead: false },
      order: [["createdAt", "DESC"]],
    }),
  ]);

  const filteredItems = items
    .filter((item) => toUserIdFromMeta(item.meta) === safeUserId)
    .slice(0, safeLimit);
  const unreadCount = unreadItems.filter(
    (item) => toUserIdFromMeta(item.meta) === safeUserId
  ).length;

  return {
    unreadCount,
    items: filteredItems.map(toNotificationPayload),
  };
};

export const deleteNotificationById = async (id: number) => {
  await ensureNotificationStorage();
  const deleted = await Notification.destroy({
    where: { id: Number(id) || 0 },
  });
  return deleted > 0;
};

export const markNotificationRead = async (id: number) => {
  await ensureNotificationStorage();
  const [updated] = await Notification.update(
    { isRead: true },
    { where: { id: Number(id) || 0, isRead: { [Op.ne]: true } } }
  );
  return updated > 0;
};

export const markUserNotificationRead = async (id: number, userId: number) => {
  await ensureNotificationStorage();
  const safeId = toNumber(id, 0);
  const safeUserId = toNumber(userId, 0);
  if (!safeId || !safeUserId) return false;

  const item = await Notification.findByPk(safeId);
  if (!item) return false;
  if (toUserIdFromMeta(item.meta) !== safeUserId) return false;
  if (item.isRead) return true;
  await item.update({ isRead: true });
  return true;
};
