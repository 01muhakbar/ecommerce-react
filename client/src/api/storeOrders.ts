import { api } from "./axios";
// Active storefront checkout must use preview/createMultiStoreCheckoutOrder from public/storeCheckout.ts.
// The legacy single-order createStoreOrder client has been removed to keep new consumers on the
// backend-driven checkout gate and shared order/payment contract.

export const fetchStoreOrder = async (ref: string) => {
  const { data } = await api.get<{
    data: {
      ref: string;
      invoiceNo?: string | null;
      status: string;
      paymentStatus?: string | null;
      shipmentCount?: number;
      shippingStatus?: string | null;
      shippingStatusMeta?: {
        code?: string;
        label?: string;
        tone?: string;
        description?: string | null;
        isFinal?: boolean;
      } | null;
      latestTrackingEvent?: {
        status?: string | null;
        statusMeta?: {
          code?: string;
          label?: string;
          tone?: string;
          description?: string | null;
          isFinal?: boolean;
        } | null;
        note?: string | null;
        happenedAt?: string | null;
      } | null;
      hasActiveShipment?: boolean;
      hasTrackingNumber?: boolean;
      shipments?: Array<{
        suborderNumber?: string | null;
        storeName?: string | null;
        shipmentStatus?: string | null;
        shipmentStatusMeta?: {
          code?: string;
          label?: string;
          tone?: string;
          description?: string | null;
          isFinal?: boolean;
        } | null;
        courierCode?: string | null;
        courierService?: string | null;
        trackingNumber?: string | null;
        estimatedDelivery?: string | null;
        shippingFee?: number;
        shipmentItems?: Array<{
          productName?: string;
          qty?: number;
          price?: number;
          lineTotal?: number;
        }>;
        trackingEvents?: Array<{
          status?: string | null;
          statusMeta?: {
            code?: string;
            label?: string;
            tone?: string;
            description?: string | null;
            isFinal?: boolean;
          } | null;
          note?: string | null;
          happenedAt?: string | null;
        }>;
      }>;
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
        paymentActionability?: {
          code?: string;
          label?: string;
          tone?: string;
          description?: string;
          isFinal?: boolean;
          canPay?: boolean;
          visible?: boolean;
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
      createdAt: string;
      customer?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        masked?: boolean;
      } | null;
      items: Array<{
        id?: number | null;
        productId?: number | null;
        name: string;
        imageUrl?: string | null;
        image?: string | null;
        quantity: number;
        price: number;
        lineTotal: number;
        variantKey?: string | null;
        variantLabel?: string | null;
        variantSelections?: Array<{
          attributeId?: number;
          attributeName?: string;
          valueId?: number | null;
          value?: string;
        }>;
        sku?: string | null;
        barcode?: string | null;
        product?: {
          id?: number | null;
          name?: string | null;
          slug?: string | null;
        } | null;
      }>;
      storeSplits?: Array<{
        suborderId?: number | null;
        storeId?: number | null;
        suborderNumber?: string | null;
        storeName?: string | null;
        storeSlug?: string | null;
        storeLogoUrl?: string | null;
        totalAmount?: number;
        paymentStatus?: string | null;
        fulfillmentStatus?: string | null;
        shipmentCount?: number;
        shippingStatus?: string | null;
        shippingStatusMeta?: {
          code?: string;
          label?: string;
          tone?: string;
          description?: string | null;
        } | null;
        latestTrackingEvent?: {
          status?: string | null;
          statusMeta?: {
            code?: string;
            label?: string;
            tone?: string;
            description?: string | null;
          } | null;
          note?: string | null;
          happenedAt?: string | null;
        } | null;
        hasActiveShipment?: boolean;
        hasTrackingNumber?: boolean;
        operationalTruth?: Record<string, any> | null;
        paymentReadModel?: {
          status?: string | null;
          statusMeta?: Record<string, any> | null;
          settlementStatus?: string | null;
          settlementStatusMeta?: Record<string, any> | null;
        } | null;
        items?: Array<{
          id?: number | null;
          productId?: number | null;
          productName?: string | null;
          slug?: string | null;
          qty?: number;
          price?: number;
          lineTotal?: number;
          image?: string | null;
          variantKey?: string | null;
          variantLabel?: string | null;
          variantSelections?: Array<{
            attributeId?: number;
            attributeName?: string;
            valueId?: number | null;
            value?: string;
          }>;
          sku?: string | null;
          barcode?: string | null;
        }>;
        payment?: {
          status?: string | null;
          statusMeta?: Record<string, any> | null;
          displayStatus?: string | null;
          displayStatusMeta?: Record<string, any> | null;
          expiresAt?: string | null;
          paidAt?: string | null;
        } | null;
        contract?: {
          orderStatus?: string | null;
          paymentStatus?: string | null;
          statusSummary?: Record<string, any> | null;
          paymentStatusMeta?: Record<string, any> | null;
        } | null;
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
