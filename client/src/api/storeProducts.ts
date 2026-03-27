import { api } from "./axios";
import {
  normalizeStorefrontCategoriesResponse,
  normalizeStorefrontProductDetailResponse,
  normalizeStorefrontProductsResponse,
} from "../utils/storefrontCatalog.ts";
import type { StoreCategory, StoreProductDetail, StoreProductsResponse } from "./store.types.ts";

export type {
  StoreCategory,
  StoreProduct,
  StoreProductCategory,
  StoreProductDetail,
  StoreProductsResponse,
  StorefrontProductSellerInfo,
} from "./store.types.ts";

export const fetchStoreCategories = async () => {
  const { data } = await api.get<{ data: StoreCategory[] }>("/store/categories");
  return normalizeStorefrontCategoriesResponse(data);
};

export const fetchStoreProducts = async (params?: {
  search?: string;
  q?: string;
  category?: string | number;
  storeSlug?: string;
  page?: number;
  limit?: number;
}) => {
  const query = {
    search: params?.search ?? params?.q,
    category: params?.category,
    storeSlug: params?.storeSlug,
    page: params?.page,
    limit: params?.limit,
  };
  const { data } = await api.get<StoreProductsResponse>("/store/products", { params: query });
  return normalizeStorefrontProductsResponse(data);
};

export const fetchStoreProductById = async (
  id: string | number,
  params?: { storeSlug?: string }
) => {
  const query = params?.storeSlug ? { storeSlug: params.storeSlug } : undefined;
  const { data } = await api.get<{ data: StoreProductDetail }>(`/store/products/${id}`, {
    params: query,
  });
  return normalizeStorefrontProductDetailResponse(data);
};
