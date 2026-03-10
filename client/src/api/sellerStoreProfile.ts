import { api } from "./axios.ts";

export const getSellerStoreProfile = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/profile`);
  return data?.data ?? null;
};

export const updateSellerStoreProfile = async (
  storeId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.patch(`/seller/stores/${storeId}/profile`, payload);
  return data?.data ?? null;
};
