import { Op, QueryTypes } from "sequelize";
import { Notification, sequelize } from "../models/index.js";

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
  status?: string;
  statusFrom?: string | null;
  statusTo?: string | null;
};

type AdminNotificationEventPayload = {
  type: string;
  notification: ReturnType<typeof toNotificationPayload>;
};

type UserNotificationEventPayload = {
  type: string;
  notification: ReturnType<typeof toNotificationPayload>;
  userId: number;
};

type NotificationPreferenceRow = {
  value: string;
};

const ADMIN_NOTIFICATION_PREFERENCE_KEY_PREFIX = "admin.notifications.preferences.";
const RETENTION_DAYS = Math.max(1, Number(process.env.NOTIFICATION_RETENTION_DAYS || 30));
const RETENTION_MAX = Math.max(50, Number(process.env.NOTIFICATION_RETENTION_MAX || 500));

const KNOWN_ADMIN_NOTIFICATION_TYPES = [
  "ORDER_CREATED",
  "ORDER_STATUS_CHANGED",
  "ORDER_STATUS_UPDATED",
] as const;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const idrCurrencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

let ensured = false;
const adminNotificationSubscribers = new Set<
  (payload: AdminNotificationEventPayload) => void | Promise<void>
>();
const userNotificationSubscribers = new Set<
  (payload: UserNotificationEventPayload) => void | Promise<void>
>();

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

const normalizeNotificationType = (value: unknown) =>
  String(value || "").trim().toUpperCase();

const sanitizeEnabledTypes = (value: unknown, fallbackToKnown = false): string[] => {
  if (!Array.isArray(value)) {
    return fallbackToKnown ? [...KNOWN_ADMIN_NOTIFICATION_TYPES] : [];
  }
  const unique = new Set<string>();
  value.forEach((entry) => {
    const normalized = normalizeNotificationType(entry);
    if (!normalized) return;
    unique.add(normalized);
  });
  const result = Array.from(unique);
  if (result.length === 0 && fallbackToKnown) {
    return [...KNOWN_ADMIN_NOTIFICATION_TYPES];
  }
  return result;
};

const ensureSettingsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(191) NOT NULL,
      \`value\` TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const toPreferenceKey = (adminId: number) =>
  `${ADMIN_NOTIFICATION_PREFERENCE_KEY_PREFIX}${Math.max(0, Math.floor(adminId))}`;

const parseEnabledTypesFromStoredValue = (raw: unknown): string[] => {
  if (typeof raw !== "string") return [...KNOWN_ADMIN_NOTIFICATION_TYPES];
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Object.prototype.hasOwnProperty.call(parsed, "enabledTypes")
    ) {
      return sanitizeEnabledTypes((parsed as { enabledTypes?: unknown }).enabledTypes, false);
    }
    return [...KNOWN_ADMIN_NOTIFICATION_TYPES];
  } catch {
    return [...KNOWN_ADMIN_NOTIFICATION_TYPES];
  }
};

const getAdminEnabledTypeSet = async (adminId: number) => {
  const preferences = await getAdminNotificationPreferences(adminId);
  return new Set(preferences.enabledTypes.map(normalizeNotificationType));
};

const isTypeEnabledForAdmin = (type: unknown, enabledTypes: Set<string> | null) => {
  if (!enabledTypes) return true;
  if (enabledTypes.size === 0) return false;
  return enabledTypes.has(normalizeNotificationType(type));
};

const applyNotificationRetentionPolicy = async () => {
  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await Notification.destroy({
    where: {
      createdAt: {
        [Op.lt]: cutoffDate,
      },
    },
  });

  const total = await Notification.count();
  const overflow = total - RETENTION_MAX;
  if (overflow <= 0) return;

  const oldestRows = await Notification.findAll({
    attributes: ["id"],
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
    limit: overflow,
  });
  const idsToDelete = oldestRows
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (idsToDelete.length === 0) return;
  await Notification.destroy({
    where: {
      id: idsToDelete,
    },
  });
};

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
  await ensureSettingsTable();
  ensured = true;
};

export const getKnownAdminNotificationTypes = () => [...KNOWN_ADMIN_NOTIFICATION_TYPES];

export const getAdminNotificationPreferences = async (adminId: number) => {
  await ensureNotificationStorage();
  const safeAdminId = toNumber(adminId, 0);
  if (!safeAdminId) {
    return { enabledTypes: [...KNOWN_ADMIN_NOTIFICATION_TYPES] };
  }

  const key = toPreferenceKey(safeAdminId);
  const rows = await sequelize.query<NotificationPreferenceRow>(
    "SELECT `value` FROM settings WHERE `key` = :key LIMIT 1",
    {
      replacements: { key },
      type: QueryTypes.SELECT,
    }
  );

  if (!rows[0]) {
    return { enabledTypes: [...KNOWN_ADMIN_NOTIFICATION_TYPES] };
  }

  return { enabledTypes: parseEnabledTypesFromStoredValue(rows[0].value) };
};

export const updateAdminNotificationPreferences = async (
  adminId: number,
  enabledTypes: string[]
) => {
  await ensureNotificationStorage();
  const safeAdminId = toNumber(adminId, 0);
  if (!safeAdminId) {
    return { enabledTypes: [...KNOWN_ADMIN_NOTIFICATION_TYPES] };
  }

  const sanitizedEnabledTypes = sanitizeEnabledTypes(enabledTypes, false);
  const key = toPreferenceKey(safeAdminId);
  const value = JSON.stringify({ enabledTypes: sanitizedEnabledTypes });

  await sequelize.query(
    `
      INSERT INTO settings (\`key\`, \`value\`, createdAt, updatedAt)
      VALUES (:key, :value, NOW(), NOW())
      ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)
    `,
    {
      replacements: { key, value },
    }
  );

  return { enabledTypes: sanitizedEnabledTypes };
};

const emitAdminNotificationEvent = (payload: AdminNotificationEventPayload) => {
  adminNotificationSubscribers.forEach((handler) => {
    try {
      Promise.resolve(handler(payload)).catch(() => {
        // ignore one bad subscriber and keep broadcasting
      });
    } catch {
      // ignore one bad subscriber and keep broadcasting
    }
  });
};

const emitUserNotificationEvent = (payload: UserNotificationEventPayload) => {
  userNotificationSubscribers.forEach((handler) => {
    try {
      Promise.resolve(handler(payload)).catch(() => {
        // ignore one bad subscriber and keep broadcasting
      });
    } catch {
      // ignore one bad subscriber and keep broadcasting
    }
  });
};

export const subscribeAdminNotificationEvents = (
  handler: (payload: AdminNotificationEventPayload) => void | Promise<void>
) => {
  adminNotificationSubscribers.add(handler);
  return () => {
    adminNotificationSubscribers.delete(handler);
  };
};

export const subscribeUserNotificationEvents = (
  handler: (payload: UserNotificationEventPayload) => void | Promise<void>
) => {
  userNotificationSubscribers.add(handler);
  return () => {
    userNotificationSubscribers.delete(handler);
  };
};

export const createNotification = async (input: {
  type: string;
  title: string;
  meta?: Record<string, unknown> | null;
}) => {
  await ensureNotificationStorage();
  const created = await Notification.create({
    type: input.type,
    title: input.title,
    isRead: false,
    meta: input.meta ?? null,
  });

  try {
    await applyNotificationRetentionPolicy();
  } catch {
    // retention cleanup should never break notification creation
  }

  if (!isUserTargeted(input.meta ?? null)) {
    try {
      emitAdminNotificationEvent({
        type: String(created.type || input.type || "NOTIFICATION_CREATED"),
        notification: toNotificationPayload(created),
      });
    } catch {
      // never fail main flow because realtime broadcast failed
    }
  }
  if (isUserTargeted(input.meta ?? null)) {
    try {
      const userId = toUserIdFromMeta(created.meta ?? input.meta ?? null);
      if (userId > 0) {
        emitUserNotificationEvent({
          type: String(created.type || input.type || "NOTIFICATION_CREATED"),
          notification: toNotificationPayload(created),
          userId,
        });
      }
    } catch {
      // never fail main flow because realtime broadcast failed
    }
  }

  return created;
};

export const createNewOrderNotification = async (input: NewOrderNotificationInput) => {
  const customerName = String(input.customerName || "").trim() || "Customer";
  const amount = idrCurrencyFormatter.format(toNumber(input.amount, 0));
  const orderId = toNumber(input.orderId, 0);
  const invoiceNo = String(input.invoiceNo || "").trim() || null;
  const title = `${customerName} placed an order of ${amount}!`;

  return createNotification({
    type: "ORDER_CREATED",
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
  const statusFrom = String(input.statusFrom || "").trim();
  const statusTo = String(input.statusTo || input.status || "").trim() || "updated";
  const title = statusFrom
    ? `Order ${invoiceNo} status changed: ${statusFrom} -> ${statusTo}`
    : `Order ${invoiceNo} status updated to ${statusTo}`;

  return createNotification({
    type: "ORDER_STATUS_UPDATED",
    title,
    meta: {
      userId,
      orderId,
      invoiceNo,
      statusFrom: statusFrom || null,
      statusTo,
    },
  });
};

export const countAdminUnreadNotifications = async (adminId?: number) => {
  await ensureNotificationStorage();
  const enabledTypes =
    typeof adminId === "number" && adminId > 0
      ? await getAdminEnabledTypeSet(adminId)
      : null;
  const unreadItems = await Notification.findAll({
    where: { isRead: false },
    order: [["createdAt", "DESC"]],
  });

  return unreadItems.filter(
    (item) =>
      !isUserTargeted(item.meta) && isTypeEnabledForAdmin(item.type, enabledTypes)
  ).length;
};

export const listNotifications = async (limit = 20, offset = 0, adminId?: number) => {
  await ensureNotificationStorage();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const enabledTypes =
    typeof adminId === "number" && adminId > 0
      ? await getAdminEnabledTypeSet(adminId)
      : null;

  const [items, unreadCount] = await Promise.all([
    Notification.findAll({
      order: [["createdAt", "DESC"]],
    }),
    countAdminUnreadNotifications(adminId),
  ]);

  const adminItems = items
    .filter(
      (item) =>
        !isUserTargeted(item.meta) && isTypeEnabledForAdmin(item.type, enabledTypes)
    )
    .slice(safeOffset, safeOffset + safeLimit);

  return {
    unreadCount,
    items: adminItems.map(toNotificationPayload),
  };
};

export const countUserUnreadNotifications = async (userId: number) => {
  await ensureNotificationStorage();
  const safeUserId = toNumber(userId, 0);
  if (!safeUserId) {
    return 0;
  }

  const unreadItems = await Notification.findAll({
    where: { isRead: false },
    order: [["createdAt", "DESC"]],
  });
  return unreadItems.filter(
    (item) => toUserIdFromMeta(item.meta) === safeUserId
  ).length;
};

export const listUserNotifications = async (userId: number, limit = 20, offset = 0) => {
  await ensureNotificationStorage();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
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
    .slice(safeOffset, safeOffset + safeLimit);
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
  const safeId = Number(id) || 0;
  if (!safeId) return false;
  const item = await Notification.findByPk(safeId);
  if (!item) return false;
  if (!item.isRead) {
    await item.update({ isRead: true });
  }
  return true;
};

export const markAllAdminNotificationsRead = async (adminId?: number) => {
  await ensureNotificationStorage();
  const enabledTypes =
    typeof adminId === "number" && adminId > 0
      ? await getAdminEnabledTypeSet(adminId)
      : null;
  const unreadItems = await Notification.findAll({
    where: { isRead: false },
    order: [["createdAt", "DESC"]],
  });
  const targetItems = unreadItems.filter(
    (item) =>
      !isUserTargeted(item.meta) && isTypeEnabledForAdmin(item.type, enabledTypes)
  );
  if (targetItems.length === 0) return 0;

  await Promise.all(
    targetItems.map((item) => item.update({ isRead: true }))
  );
  return targetItems.length;
};

export const clearAllAdminNotifications = async () => {
  await ensureNotificationStorage();
  const items = await Notification.findAll({
    order: [["createdAt", "DESC"]],
  });
  const targetItems = items.filter((item) => !isUserTargeted(item.meta));
  if (targetItems.length === 0) return 0;

  await Promise.all(targetItems.map((item) => item.destroy()));
  return targetItems.length;
};

export const isAdminNotificationTypeEnabled = async (
  adminId: number,
  type: string
) => {
  await ensureNotificationStorage();
  const safeAdminId = toNumber(adminId, 0);
  if (!safeAdminId) return false;
  const enabledTypes = await getAdminEnabledTypeSet(safeAdminId);
  return isTypeEnabledForAdmin(type, enabledTypes);
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

export const markAllUserNotificationsRead = async (userId: number) => {
  await ensureNotificationStorage();
  const safeUserId = toNumber(userId, 0);
  if (!safeUserId) return 0;

  const unreadItems = await Notification.findAll({
    where: { isRead: false },
    order: [["createdAt", "DESC"]],
  });
  const targetItems = unreadItems.filter(
    (item) => toUserIdFromMeta(item.meta) === safeUserId
  );
  if (targetItems.length === 0) return 0;

  await Promise.all(targetItems.map((item) => item.update({ isRead: true })));
  return targetItems.length;
};

export const deleteUserNotification = async (id: number, userId: number) => {
  await ensureNotificationStorage();
  const safeId = toNumber(id, 0);
  const safeUserId = toNumber(userId, 0);
  if (!safeId || !safeUserId) return false;

  const item = await Notification.findByPk(safeId);
  if (!item) return false;
  if (toUserIdFromMeta(item.meta) !== safeUserId) return false;
  await item.destroy();
  return true;
};

export const clearAllUserNotifications = async (userId: number) => {
  await ensureNotificationStorage();
  const safeUserId = toNumber(userId, 0);
  if (!safeUserId) return 0;

  const items = await Notification.findAll({
    order: [["createdAt", "DESC"]],
  });
  const targetItems = items.filter(
    (item) => toUserIdFromMeta(item.meta) === safeUserId
  );
  if (targetItems.length === 0) return 0;

  await Promise.all(targetItems.map((item) => item.destroy()));
  return targetItems.length;
};
