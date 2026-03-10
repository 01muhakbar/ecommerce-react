import { api } from "./axios.ts";

export const getSellerPaymentProfile = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/payment-profile`);
  return data?.data ?? null;
};
