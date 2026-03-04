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

const unwrap = (payload: any): AdminNotificationsPayload => {
  return payload?.data ?? payload;
};

export const fetchAdminNotifications = async (limit = 20) => {
  const { data } = await api.get("/admin/notifications", {
    params: { limit },
  });
  return unwrap(data);
};

export const deleteAdminNotification = async (id: number) => {
  const { data } = await api.delete(`/admin/notifications/${id}`);
  return data;
};

export const markAdminNotificationRead = async (id: number) => {
  const { data } = await api.patch(`/admin/notifications/${id}/read`);
  return data;
};
