import { api } from "./axios";
import type { StoreCoupon, StoreCouponQuoteResponse } from "./store.types.ts";

export type { StoreCoupon, StoreCouponQuoteResponse } from "./store.types.ts";

export const fetchStoreCoupons = async (params?: { storeId?: number; storeSlug?: string }) => {
  const query = {
    storeId: params?.storeId,
    storeSlug: params?.storeSlug,
  };
  const { data } = await api.get<{ data: StoreCoupon[] }>("/store/coupons", { params: query });
  return data;
};

export const validateStoreCoupon = async (payload: {
  code: string;
  subtotal: number;
  storeId?: number;
  storeSlug?: string;
}) => {
  const response = await api.post<{
    data: {
      valid: boolean;
      code: string | null;
      discountAmount: number;
      scopeType?: "PLATFORM" | "STORE" | null;
      storeId?: number | null;
      message: string;
    };
  }>("/store/coupons/validate", payload);
  return response;
};

export const quoteStoreCoupon = async (payload: {
  code: string;
  subtotal: number;
  shipping?: number;
  storeId?: number;
  storeSlug?: string;
}) => {
  const { data } = await api.post<StoreCouponQuoteResponse>("/store/coupons/quote", payload);
  return data;
};
