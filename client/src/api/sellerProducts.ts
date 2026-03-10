import { api } from "./axios.ts";

type SellerProductsQuery = {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: string;
  published?: "" | "true" | "false";
};

export const getSellerProducts = async (
  storeId: number | string,
  query: SellerProductsQuery = {}
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/products`, {
    params: {
      page: query.page,
      limit: query.limit,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      published: query.published || undefined,
    },
  });
  return data?.data ?? null;
};

export const getSellerProductDetail = async (
  storeId: number | string,
  productId: number | string
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/products/${productId}`);
  return data?.data ?? null;
};
