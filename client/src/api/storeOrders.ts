import { api } from "./axios";
import type { StoreShippingDetails } from "./store.types.ts";

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

export type { StoreShippingDetails } from "./store.types.ts";

export const fetchStoreOrder = async (ref: string) => {
  const { data } = await api.get<{
    data: {
      id: number;
      ref: string;
      invoiceNo?: string | null;
      status: string;
      paymentStatus?: string | null;
      totalAmount: number;
      paymentMethod?: string | null;
      subtotal?: number;
      discount?: number;
      tax?: number;
      shipping?: number;
      couponCode?: string | null;
      createdAt: string;
      customerName?: string | null;
      customerPhone?: string | null;
      customerAddress?: string | null;
      shippingDetails?: StoreShippingDetails | null;
      items: Array<{
        id: number;
        productId: number;
        name: string;
        quantity: number;
        price: number;
        lineTotal: number;
      }>;
    };
  }>(`/store/orders/${encodeURIComponent(ref)}`);
  return data;
};

export const fetchStoreMyOrders = async (params?: { page?: number; limit?: number }) => {
  const { data } = await api.get("/store/my/orders", { params });
  return data;
};

export const createStoreOrder = async (payload: {
  customer: { name: string; phone: string; address: string; notes?: string };
  paymentMethod: "COD" | "STRIPE";
  items: { productId: number; qty: number }[];
  couponCode?: string;
  useDefaultShipping?: boolean;
  shippingDetails?: StoreShippingDetails;
}) => {
  const url = "/store/orders";
  if (isDev) {
    console.log("[createStoreOrder] url", url);
  }
  const { data } = await api.post<{
    data: {
      id: number;
      ref: string;
      invoiceNo?: string | null;
      status: string;
      totalAmount: number;
      createdAt: string;
      items: Array<{
        productId: number;
        name: string;
        quantity: number;
        price: number;
        lineTotal: number;
      }>;
      subtotal?: number;
      discount?: number;
      tax?: number;
      shipping?: number;
      total: number;
      useDefaultShipping?: boolean;
      shippingDetails?: StoreShippingDetails | null;
      paymentMethod: "COD" | "STRIPE";
      paymentStatus?: string;
      checkoutRedirectMode?: "HOSTED" | null;
      checkoutRedirectUrl?: string | null;
      checkoutSessionId?: string | null;
    };
  }>(url, payload, { withCredentials: true });
  return data;
};

export const verifyStoreStripeCheckoutSession = async (ref: string, sessionId: string) => {
  const { data } = await api.get<{
    data: {
      orderRef: string;
      sessionId: string;
      sessionStatus?: string | null;
      sessionPaymentStatus?: string | null;
      paymentStatus: string;
      orderStatus: string;
      paid: boolean;
      checkoutUrl?: string | null;
    };
  }>(`/store/orders/${encodeURIComponent(ref)}/stripe/session`, {
    params: { sessionId },
    withCredentials: true,
  });
  return data;
};

export const createStoreStripeCheckoutSession = async (ref: string) => {
  const { data } = await api.post<{
    data: {
      orderRef: string;
      checkoutRedirectMode: "HOSTED";
      checkoutRedirectUrl: string;
      checkoutSessionId: string;
    };
  }>(`/store/orders/${encodeURIComponent(ref)}/stripe/session`, undefined, {
    withCredentials: true,
  });
  return data;
};
