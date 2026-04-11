import { api } from "./axios";
import type { StoreCheckoutPreviewResponse, StoreShippingDetails } from "./store.types.ts";

export type {
  StoreCheckoutPreviewGroup,
  StoreCheckoutPreviewItem,
  StoreCheckoutPreviewResponse,
  StoreShippingDetails,
} from "./store.types.ts";

export const createMultiStoreCheckoutOrder = async (payload?: {
  cartId?: number;
  shippingAddressId?: number;
  checkoutRequestKey?: string | null;
  useDefaultShipping?: boolean;
  customer?: { name?: string; phone?: string; address?: string; notes?: string };
  shippingDetails?: StoreShippingDetails;
  couponCode?: string | null;
  groupCoupons?: Array<{
    storeId: number;
    couponCode: string;
  }> | null;
}) => {
  const { data } = await api.post("/checkout/create-multi-store", payload ?? {}, {
    withCredentials: true,
  });
  return data;
};

export const previewCheckoutByStore = async (payload?: {
  cartId?: number;
  shippingAddressId?: number;
}) => {
  const { data } = await api.post<StoreCheckoutPreviewResponse>(
    "/checkout/preview",
    payload ?? {},
    { withCredentials: true }
  );
  return data;
};
