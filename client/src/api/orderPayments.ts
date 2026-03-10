import { api } from "./axios";

export type GroupedPaymentProofSummary = {
  id: number;
  proofImageUrl: string;
  senderName: string;
  senderBankOrWallet: string;
  transferAmount: number;
  transferTime: string | null;
  note?: string | null;
  reviewNote?: string | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | string;
  uploadedByUserId?: number | null;
  reviewedByUserId?: number | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

export type GroupedPaymentDetail = {
  id: number;
  internalReference: string;
  externalReference?: string | null;
  paymentChannel: "QRIS" | string;
  paymentType: "QRIS_STATIC" | string;
  amount: number;
  qrImageUrl?: string | null;
  qrPayload?: string | null;
  status:
    | "CREATED"
    | "PENDING_CONFIRMATION"
    | "PAID"
    | "FAILED"
    | "EXPIRED"
    | "REJECTED"
    | string;
  expiresAt?: string | null;
  paidAt?: string | null;
  proofSubmitted?: boolean;
  proof?: GroupedPaymentProofSummary | null;
};

export type GroupedOrderPaymentResponse = {
  success: boolean;
  data: {
    orderId: number;
    ref: string;
    invoiceNo: string;
    checkoutMode: "LEGACY" | "SINGLE_STORE" | "MULTI_STORE" | string;
    paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | string;
    orderStatus: string;
    paymentMethod?: string | null;
    createdAt?: string | null;
    summary: {
      totalItems: number;
      subtotalAmount: number;
      shippingAmount: number;
      serviceFeeAmount: number;
      grandTotal: number;
    };
    groups: Array<{
      legacy?: boolean;
      storeId?: number | null;
      storeName: string;
      storeSlug?: string | null;
      suborderId?: number | null;
      suborderNumber?: string | null;
      subtotalAmount: number;
      shippingAmount: number;
      serviceFeeAmount: number;
      totalAmount: number;
      paymentMethod?: string | null;
      paymentStatus: string;
      fulfillmentStatus: string;
      paymentProfileStatus: string;
      paymentAvailable: boolean;
      warning?: string | null;
      items: Array<{
        id?: number | null;
        productId: number;
        productName: string;
        slug?: string;
        qty: number;
        price: number;
        lineTotal: number;
      }>;
      payment?: GroupedPaymentDetail | null;
    }>;
  };
};

export type PaymentDetailResponse = {
  success: boolean;
  data: {
    paymentId: number;
    suborderId: number;
    orderId?: number | null;
    orderRef?: string | null;
    storeId: number;
    storeName: string;
    amount: number;
    paymentChannel: string;
    paymentType: string;
    status: string;
    qrImageUrl?: string | null;
    qrPayload?: string | null;
    internalReference: string;
    expiresAt?: string | null;
    paidAt?: string | null;
    proofSubmitted?: boolean;
    proof?: GroupedPaymentProofSummary | null;
    logs?: Array<{
      id: number;
      oldStatus?: string | null;
      newStatus: string;
      actorType: string;
      actorId?: number | null;
      actorName?: string | null;
      note?: string | null;
      createdAt?: string | null;
    }>;
  };
};

export const fetchOrderCheckoutPayment = async (orderId: string | number) => {
  const { data } = await api.get<GroupedOrderPaymentResponse>(
    `/orders/${encodeURIComponent(String(orderId))}/checkout-payment`
  );
  return data;
};

export const fetchPaymentDetail = async (paymentId: string | number) => {
  const { data } = await api.get<PaymentDetailResponse>(
    `/payments/${encodeURIComponent(String(paymentId))}`
  );
  return data;
};

export const submitPaymentProof = async (
  paymentId: string | number,
  payload: {
    proofImageUrl: string;
    senderName: string;
    senderBankOrWallet: string;
    transferAmount: number;
    transferTime: string;
    note?: string;
  }
) => {
  const { data } = await api.post<PaymentDetailResponse>(
    `/payments/${encodeURIComponent(String(paymentId))}/proof`,
    payload
  );
  return data;
};
