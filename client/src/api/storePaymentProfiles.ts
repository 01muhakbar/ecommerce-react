import { api } from "./axios.ts";

export const getMyStore = async () => {
  const { data } = await api.get("/stores/mine");
  return data?.data ?? null;
};

export const getStorePaymentProfile = async (storeId: number | string) => {
  const { data } = await api.get(`/stores/${storeId}/payment-profile`);
  return data?.data ?? null;
};

export const upsertStorePaymentProfile = async (
  storeId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.post(`/stores/${storeId}/payment-profile`, payload);
  return data?.data ?? null;
};

export const fetchAdminStorePaymentProfiles = async () => {
  const { data } = await api.get("/admin/stores/payment-profiles");
  return Array.isArray(data?.data) ? data.data : [];
};

export const reviewAdminStorePaymentProfile = async (
  storeId: number | string,
  payload: { verificationStatus: string; adminReviewNote?: string | null }
) => {
  const { data } = await api.patch(`/admin/stores/${storeId}/payment-profile/review`, payload);
  return data?.data ?? null;
};
