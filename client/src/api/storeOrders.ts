import { api } from "./axios";
import type { StoreShippingDetails } from "./store.types.ts";

export type { StoreShippingDetails } from "./store.types.ts";

// Active storefront checkout must use preview/createMultiStoreCheckoutOrder from public/storeCheckout.ts.
// The legacy single-order createStoreOrder client has been removed to keep new consumers on the
// backend-driven checkout gate and shared order/payment contract.

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
      paymentEntry?: {
        visible?: boolean;
        label?: string | null;
        targetPath?: string | null;
        summaryStatus?: string;
        summaryLabel?: string | null;
      };
      contract?: {
        statusSummary?: {
          code?: string;
          label?: string;
          tone?: string;
          description?: string;
          isFinal?: boolean;
        };
        paymentStatusMeta?: {
          code?: string;
          label?: string;
          tone?: string;
          description?: string;
          isFinal?: boolean;
        };
        availableActions?: Array<{
          code?: string;
          label?: string;
          enabled?: boolean;
          reason?: string | null;
          targetPath?: string | null;
        }>;
      };
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
