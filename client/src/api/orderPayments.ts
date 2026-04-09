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
  instructionText?: string | null;
  merchantName?: string | null;
  accountName?: string | null;
  status:
    | "CREATED"
    | "PENDING_CONFIRMATION"
    | "PAID"
    | "FAILED"
    | "EXPIRED"
    | "REJECTED"
    | string;
  displayStatus?: string;
  expiresAt?: string | null;
  paidAt?: string | null;
  proofSubmitted?: boolean;
  proof?: GroupedPaymentProofSummary | null;
  proofActionability?: {
    canStartProof: boolean;
    reason?: string | null;
  };
  cancelability?: {
    canCancel: boolean;
    reason?: string | null;
  };
  readModel?: GroupedPaymentReadModel;
};

export type GroupedPaymentReadModel = {
  status: string;
  statusMeta?: {
    code?: string;
    label?: string;
    tone?: string;
    description?: string;
    isFinal?: boolean;
  };
  rawStatus?: string;
  rawStatusMeta?: {
    code?: string;
    label?: string;
    tone?: string;
    description?: string;
    isFinal?: boolean;
  };
  settlementStatus?: string;
  settlementStatusMeta?: {
    code?: string;
    label?: string;
    tone?: string;
    description?: string;
    isFinal?: boolean;
  };
  expiresAt?: string | null;
  proofActionability?: {
    canStartProof: boolean;
    reason?: string | null;
  };
  cancelability?: {
    canCancel: boolean;
    reason?: string | null;
  };
  isFinal?: boolean;
  isActionable?: boolean;
};

export type ShipmentTrackingEvent = {
  eventId?: number | null;
  status?: string | null;
  statusMeta?: GroupedPaymentReadModel["statusMeta"];
  note?: string | null;
  happenedAt?: string | null;
};

export type ShipmentSummary = {
  shipmentId?: number | null;
  suborderId?: number | null;
  suborderNumber?: string | null;
  storeId?: number | null;
  storeName?: string | null;
  storeSlug?: string | null;
  shipmentStatus: string;
  shipmentStatusMeta?: GroupedPaymentReadModel["statusMeta"];
  courierCode?: string | null;
  courierService?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: string | null;
  shippingFee?: number;
  shipmentItems: Array<{
    id?: number | null;
    productId?: number | null;
    productName: string;
    qty: number;
    price: number;
    lineTotal: number;
  }>;
  trackingEvents: ShipmentTrackingEvent[];
  latestTrackingEvent?: ShipmentTrackingEvent | null;
  hasTrackingNumber?: boolean;
  hasActiveShipment?: boolean;
  usedLegacyFallback?: boolean;
  persistenceState?: "LEGACY_FALLBACK" | "PERSISTED" | string | null;
  compatibilityFulfillmentStatus?: string | null;
  compatibilityFulfillmentStatusMeta?: GroupedPaymentReadModel["statusMeta"];
  storedFulfillmentStatus?: string | null;
  storedFulfillmentStatusMeta?: GroupedPaymentReadModel["statusMeta"];
  compatibilityMatchesStorage?: boolean | null;
  trackingEventCount?: number;
  missingTrackingTimeline?: boolean;
  incompleteTrackingData?: boolean;
  canUploadTracking?: boolean;
  canMarkPacked?: boolean;
  canMarkShipped?: boolean;
  canCancelShipment?: boolean;
  canConfirmDelivery?: boolean;
  availableShippingActions?: Array<{
    code?: string;
    label?: string;
    enabled?: boolean;
    reason?: string | null;
  }>;
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
    paymentStatusMeta?: GroupedPaymentReadModel["settlementStatusMeta"];
    shipmentCount?: number;
    shippingStatus?: string;
    shippingStatusMeta?: GroupedPaymentReadModel["statusMeta"];
    latestTrackingEvent?: ShipmentTrackingEvent | null;
    hasActiveShipment?: boolean;
    hasTrackingNumber?: boolean;
    usedLegacyFallback?: boolean;
    shipmentAuditMeta?: {
      totalSuborders?: number;
      persistedShipmentCount?: number;
      legacyFallbackSuborderCount?: number;
      compatibilityMismatchCount?: number;
      missingTrackingTimelineCount?: number;
      incompleteTrackingDataCount?: number;
      usedLegacyFallback?: boolean;
      persistedCoverage?: string;
    } | null;
    suborderShipmentSummary?: Array<{
      suborderId?: number | null;
      shipmentCount?: number;
      shippingStatus?: string | null;
      shippingStatusMeta?: GroupedPaymentReadModel["statusMeta"];
      latestTrackingEvent?: ShipmentTrackingEvent | null;
      hasActiveShipment?: boolean;
      hasTrackingNumber?: boolean;
      usedLegacyFallback?: boolean;
      hasPersistedShipment?: boolean;
      compatibilityFulfillmentStatus?: string | null;
      compatibilityFulfillmentStatusMeta?: GroupedPaymentReadModel["statusMeta"];
      storedFulfillmentStatus?: string | null;
      storedFulfillmentStatusMeta?: GroupedPaymentReadModel["statusMeta"];
      compatibilityMatchesStorage?: boolean | null;
      trackingEventCount?: number;
      missingTrackingTimeline?: boolean;
      incompleteTrackingData?: boolean;
    }>;
    shipments?: ShipmentSummary[];
    paymentEntry?: {
      visible?: boolean;
      label?: string | null;
      targetPath?: string | null;
      summaryStatus?: string;
      summaryLabel?: string | null;
      actionableCount?: number;
      reviewCount?: number;
      paidCount?: number;
      failedCount?: number;
      cancelledCount?: number;
      expiredCount?: number;
      totalGroups?: number;
    };
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
      paymentStatusMeta?: GroupedPaymentReadModel["settlementStatusMeta"];
      paymentReadModel?: GroupedPaymentReadModel;
      fulfillmentStatus: string;
      shipmentCount?: number;
      shippingStatus?: string;
      shippingStatusMeta?: GroupedPaymentReadModel["statusMeta"];
      latestTrackingEvent?: ShipmentTrackingEvent | null;
      hasActiveShipment?: boolean;
      hasTrackingNumber?: boolean;
      usedLegacyFallback?: boolean;
      hasPersistedShipment?: boolean;
      compatibilityFulfillmentStatus?: string | null;
      compatibilityFulfillmentStatusMeta?: GroupedPaymentReadModel["statusMeta"];
      storedFulfillmentStatus?: string | null;
      storedFulfillmentStatusMeta?: GroupedPaymentReadModel["statusMeta"];
      compatibilityMatchesStorage?: boolean | null;
      trackingEventCount?: number;
      missingTrackingTimeline?: boolean;
      incompleteTrackingData?: boolean;
      shipments?: ShipmentSummary[];
      paymentProfileStatus: string;
      paymentAvailable: boolean;
      paymentInstruction?: string | null;
      merchantName?: string | null;
      accountName?: string | null;
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
    displayStatus?: string;
    qrImageUrl?: string | null;
    qrPayload?: string | null;
    instructionText?: string | null;
    merchantName?: string | null;
    accountName?: string | null;
    internalReference: string;
    expiresAt?: string | null;
    paidAt?: string | null;
    proofSubmitted?: boolean;
    proof?: GroupedPaymentProofSummary | null;
    proofActionability?: {
      canStartProof: boolean;
      reason?: string | null;
    };
    cancelability?: {
      canCancel: boolean;
      reason?: string | null;
    };
    readModel?: GroupedPaymentReadModel;
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

export const cancelPaymentTransaction = async (paymentId: string | number) => {
  const { data } = await api.post<PaymentDetailResponse>(
    `/payments/${encodeURIComponent(String(paymentId))}/cancel`
  );
  return data;
};

export const uploadPaymentProofImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ data?: { url?: string } }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = data?.data?.url ? String(data.data.url).trim() : "";
  if (!url) {
    throw new Error("Upload succeeded without URL.");
  }
  return url;
};
