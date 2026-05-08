import { api } from "./axios";

export type UserNotification = {
  id: number;
  type: string;
  title: string;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  meta?: Record<string, unknown> | null;
};

export type UserNotificationsPayload = {
  unreadCount: number;
  items: UserNotification[];
};

const unwrap = (payload: any): UserNotificationsPayload => payload?.data ?? payload;

export const fetchUserNotifications = async (params?: {
  limit?: number;
  offset?: number;
}) => {
  const limit = Number(params?.limit) || 20;
  const offset = Number(params?.offset) || 0;
  const { data } = await api.get("/user/notifications", {
    params: { limit, offset },
  });
  return unwrap(data);
};

export const fetchUserUnreadNotificationCount = async () => {
  const { data } = await api.get("/user/notifications/unread-count");
  const payload = data?.data ?? data;
  return Number(payload?.count || 0);
};

export const markUserNotificationRead = async (id: number) => {
  const { data } = await api.patch(`/user/notifications/${id}/read`);
  return data;
};

export const markAllUserNotificationsRead = async () => {
  const { data } = await api.patch("/user/notifications/read-all");
  const payload = data?.data ?? data;
  return { updated: Number(payload?.updated || 0) };
};

export const deleteUserNotification = async (id: number) => {
  const { data } = await api.delete(`/user/notifications/${id}`);
  return data?.data ?? data;
};

export const clearAllUserNotifications = async () => {
  const { data } = await api.delete("/user/notifications");
  const payload = data?.data ?? data;
  return { deleted: Number(payload?.deleted || 0) };
};
