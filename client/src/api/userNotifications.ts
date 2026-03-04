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

export const fetchUserNotifications = async (limit = 20) => {
  const { data } = await api.get("/user/notifications", {
    params: { limit },
  });
  return unwrap(data);
};

export const markUserNotificationRead = async (id: number) => {
  const { data } = await api.patch(`/user/notifications/${id}/read`);
  return data;
};
