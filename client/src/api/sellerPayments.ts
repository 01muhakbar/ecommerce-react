import { api } from "./axios";

export type SellerReviewProofSummary = {
  id: number;
  proofImageUrl: string;
  senderName: string;
  senderBankOrWallet: string;
  transferAmount: number;
  transferTime: string | null;
  note?: string | null;
  reviewNote?: string | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewedByUserId?: number | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

export type SellerSuborderReviewItem = {
  suborderId: number;
  suborderNumber: string;
  orderId: number;
  orderNumber: string;
  storeId: number;
  storeName: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  paidAt?: string | null;
  createdAt?: string | null;
  buyer: {
    userId?: number | null;
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    qty: number;
    price: number;
    totalPrice: number;
  }>;
  payment?: {
    id: number;
    internalReference: string;
    paymentChannel: string;
    paymentType: string;
    amount: number;
    status: string;
    qrImageUrl?: string | null;
    expiresAt?: string | null;
    paidAt?: string | null;
    proofSubmitted?: boolean;
    proof?: SellerReviewProofSummary | null;
  } | null;
};

export type SellerSuborderListResponse = {
  success: boolean;
  data: {
    store: {
      id: number;
      name: string;
      slug: string;
      status: string;
    } | null;
    filters: string[];
    items: SellerSuborderReviewItem[];
  };
};

export const fetchSellerSuborders = async (paymentStatus: string) => {
  const { data } = await api.get<SellerSuborderListResponse>("/seller/suborders", {
    params: { paymentStatus },
  });
  return data?.data ?? { store: null, filters: [], items: [] };
};

export const reviewSellerPayment = async (
  paymentId: string | number,
  payload: { action: "APPROVE" | "REJECT"; note?: string | null }
) => {
  const { data } = await api.patch<{ success: boolean; data: SellerSuborderReviewItem }>(
    `/seller/payments/${encodeURIComponent(String(paymentId))}/review`,
    payload
  );
  return data?.data ?? null;
};
