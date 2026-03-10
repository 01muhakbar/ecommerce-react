import { api } from "./axios.ts";

export const getSellerSuborders = async (
  storeId: number | string,
  params: {
    page?: number;
    limit?: number;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    keyword?: string;
  } = {}
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/suborders`, { params });
  return data?.data ?? { items: [], pagination: { page: 1, limit: 20, total: 0 } };
};

export const getSellerSuborderDetail = async (
  storeId: number | string,
  suborderId: number | string
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/suborders/${suborderId}`);
  return data?.data ?? null;
};
