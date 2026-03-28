import { api } from "./axios.ts";

export type SellerNotificationMeta = {
  audience?: string | null;
  userId?: number | null;
  storeId?: number | null;
  orderId?: number | null;
  suborderId?: number | null;
  paymentId?: number | null;
  route?: string | null;
  actionCode?: string | null;
  message?: string | null;
  [key: string]: unknown;
};

export type SellerNotificationItem = {
  id: number;
  type: string;
  title: string;
  isRead: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  meta?: SellerNotificationMeta | null;
};

type SellerNotificationListPayload = {
  unreadCount: number;
  items: SellerNotificationItem[];
};

const normalizeSellerNotificationPayload = (payload: any): SellerNotificationListPayload => {
  const data = payload?.data ?? payload ?? {};
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
      ? data
      : [];
  const unreadCount = Number(data?.unreadCount ?? payload?.unreadCount ?? 0) || 0;
  return {
    unreadCount,
    items,
  };
};

export const getSellerNotifications = async (
  storeId: number,
  params: Record<string, unknown> = {}
): Promise<SellerNotificationListPayload> => {
  const { data } = await api.get(`/seller/stores/${storeId}/notifications`, {
    params,
  });
  return normalizeSellerNotificationPayload(data);
};

export const getSellerNotificationUnreadCount = async (
  storeId: number
): Promise<{ count: number }> => {
  const { data } = await api.get(`/seller/stores/${storeId}/notifications/unread-count`);
  return {
    count: Number(data?.data?.count ?? data?.count ?? 0) || 0,
  };
};

export const markSellerNotificationRead = async (
  storeId: number,
  notificationId: number
) => {
  const { data } = await api.patch(
    `/seller/stores/${storeId}/notifications/${notificationId}/read`
  );
  return data;
};

export const markAllSellerNotificationsRead = async (storeId: number) => {
  const { data } = await api.patch(`/seller/stores/${storeId}/notifications/read-all`);
  return data;
};
