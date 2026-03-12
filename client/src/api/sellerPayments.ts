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
    governance?: {
      canView: boolean;
      canReview: boolean;
      activeStoreId: number | null;
      roleCode: string;
      permissionKeys: string[];
      mutationAllowedRoleCodes: string[];
      note: string;
    } | null;
    filters: string[];
    items: SellerSuborderReviewItem[];
  };
};

export const fetchSellerSuborders = async (
  paymentStatus: string,
  options: { storeId?: number | string | null } = {}
) => {
  const storeId = options.storeId != null ? String(options.storeId).trim() : "";
  const endpoint = storeId
    ? `/seller/stores/${encodeURIComponent(storeId)}/payment-review/suborders`
    : "/seller/suborders";
  const params = storeId ? { paymentStatus } : { paymentStatus, storeId: storeId || undefined };
  const { data } = await api.get<SellerSuborderListResponse>(endpoint, {
    params,
  });
  return data?.data ?? { store: null, governance: null, filters: [], items: [] };
};

export const getSellerPaymentReviewSuborders = async (
  storeId: number | string,
  paymentStatus: string
) => {
  const { data } = await api.get<SellerSuborderListResponse>(
    `/seller/stores/${encodeURIComponent(String(storeId))}/payment-review/suborders`,
    {
      params: { paymentStatus },
    }
  );
  return data?.data ?? { store: null, governance: null, filters: [], items: [] };
};

export const reviewSellerPayment = async (
  paymentId: string | number,
  payload: { action: "APPROVE" | "REJECT"; note?: string | null },
  options: { storeId?: number | string | null } = {}
) => {
  const storeId = options.storeId != null ? String(options.storeId).trim() : "";
  const endpoint = storeId
    ? `/seller/stores/${encodeURIComponent(storeId)}/payments/${encodeURIComponent(String(paymentId))}/review`
    : `/seller/payments/${encodeURIComponent(String(paymentId))}/review`;
  const { data } = await api.patch<{ success: boolean; data: SellerSuborderReviewItem }>(
    endpoint,
    payload
  );
  return data?.data ?? null;
};

export const reviewSellerStorePayment = async (
  storeId: number | string,
  paymentId: string | number,
  payload: { action: "APPROVE" | "REJECT"; note?: string | null }
) => {
  const { data } = await api.patch<{ success: boolean; data: SellerSuborderReviewItem }>(
    `/seller/stores/${encodeURIComponent(String(storeId))}/payments/${encodeURIComponent(String(paymentId))}/review`,
    payload
  );
  return data?.data ?? null;
};
