import { api } from "./axios";

export type AdminNotification = {
  id: number;
  type: string;
  title: string;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  meta?: Record<string, unknown> | null;
};

export type AdminNotificationsPayload = {
  unreadCount: number;
  items: AdminNotification[];
};

export type AdminNotificationPreferencesPayload = {
  enabledTypes: string[];
  availableTypes?: string[];
};

const unwrap = (payload: any): AdminNotificationsPayload => {
  return payload?.data ?? payload;
};

export const fetchAdminNotifications = async (params?: {
  limit?: number;
  offset?: number;
}) => {
  const limit = Number(params?.limit) || 20;
  const offset = Number(params?.offset) || 0;
  const { data } = await api.get("/admin/notifications", {
    params: { limit, offset },
  });
  return unwrap(data);
};

export const fetchAdminUnreadCount = async () => {
  const { data } = await api.get("/admin/notifications/unread-count");
  const payload = data?.data ?? data;
  return Number(payload?.count || 0);
};

export const deleteAdminNotification = async (id: number) => {
  const { data } = await api.delete(`/admin/notifications/${id}`);
  return data;
};

export const markAdminNotificationRead = async (id: number) => {
  const { data } = await api.patch(`/admin/notifications/${id}/read`);
  return data;
};

export const markAllAdminNotificationsRead = async () => {
  const { data } = await api.patch("/admin/notifications/read-all");
  const payload = data?.data ?? data;
  return { updated: Number(payload?.updated || 0) };
};

export const clearAllAdminNotifications = async () => {
  const { data } = await api.delete("/admin/notifications");
  const payload = data?.data ?? data;
  return { deleted: Number(payload?.deleted || 0) };
};

const normalizeEnabledTypes = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  value.forEach((entry) => {
    const normalized = String(entry || "").trim().toUpperCase();
    if (!normalized) return;
    unique.add(normalized);
  });
  return Array.from(unique);
};

export const fetchAdminNotificationPreferences = async () => {
  const { data } = await api.get("/admin/notifications/preferences");
  const payload = data?.data ?? data;
  return {
    enabledTypes: normalizeEnabledTypes(payload?.enabledTypes),
    availableTypes: normalizeEnabledTypes(payload?.availableTypes),
  } as AdminNotificationPreferencesPayload;
};

export const updateAdminNotificationPreferences = async (input: {
  enabledTypes: string[];
}) => {
  const safeEnabledTypes = normalizeEnabledTypes(input?.enabledTypes);
  const { data } = await api.put("/admin/notifications/preferences", {
    enabledTypes: safeEnabledTypes,
  });
  const payload = data?.data ?? data;
  return {
    enabledTypes: normalizeEnabledTypes(payload?.enabledTypes),
  } as AdminNotificationPreferencesPayload;
};
