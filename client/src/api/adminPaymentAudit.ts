import { api } from "./axios";

type StatusMeta = {
  code?: string;
  label?: string;
  tone?: string;
  description?: string | null;
  isFinal?: boolean;
};

type ReviewMeta = {
  code?: string;
  label?: string;
  tone?: string;
};

export type AdminPaymentAuditListItem = {
  orderId: number;
  orderNumber: string;
  invoiceNo: string;
  checkoutMode: string;
  buyerName: string;
  buyerEmail?: string | null;
  totalStores: number;
  grandTotal: number;
  orderStatus: string;
  orderStatusMeta?: StatusMeta;
  paymentStatus: string;
  paymentStatusMeta?: StatusMeta;
  createdAt?: string | null;
  counts: {
    paidSuborders: number;
    pendingSuborders: number;
    unpaidSuborders: number;
    rejectedPayments: number;
  };
  operationalCounts?: {
    paidSuborders: number;
    pendingSuborders: number;
    unpaidSuborders: number;
    rejectedPayments: number;
    shipmentLaneSuborders?: number;
    finalNegativeSuborders?: number;
  };
};

export type AdminPaymentAuditListResponse = {
  success: boolean;
  data: {
    items: AdminPaymentAuditListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    filters: {
      search?: string;
      paymentStatus?: string;
      reviewStatus?: string;
      checkoutMode?: string;
      storeId?: number | null;
    };
  };
};

export type AdminPaymentAuditDetailResponse = {
  success: boolean;
  data: {
    parent: {
      orderId: number;
      orderNumber: string;
      invoiceNo: string;
      checkoutMode: string;
      paymentStatus: string;
      paymentStatusMeta?: StatusMeta;
      orderStatus: string;
      orderStatusMeta?: StatusMeta;
      paymentMethod?: string | null;
      customerName: string;
      customerPhone?: string | null;
      customerAddress?: string | null;
      buyer?: {
        id?: number | null;
        name: string;
        email?: string | null;
        role?: string | null;
      } | null;
      summary: {
        totalItems: number;
        subtotalAmount: number;
        shippingAmount: number;
        serviceFeeAmount: number;
        grandTotal: number;
      };
      createdAt?: string | null;
      updatedAt?: string | null;
    };
    counts: {
      paidSuborders: number;
      pendingSuborders: number;
      unpaidSuborders: number;
      rejectedPayments: number;
    };
    split: {
      orderId: number;
      ref: string;
      invoiceNo: string;
      checkoutMode: string;
      paymentStatus: string;
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
        payment?: {
          id: number;
          internalReference: string;
          externalReference?: string | null;
          paymentChannel: string;
          paymentType: string;
          amount: number;
          qrImageUrl?: string | null;
          qrPayload?: string | null;
          status: string;
          expiresAt?: string | null;
          paidAt?: string | null;
          proofSubmitted?: boolean;
          proof?: {
            id: number;
            proofImageUrl: string;
            senderName: string;
            senderBankOrWallet: string;
            transferAmount: number;
            transferTime?: string | null;
            note?: string | null;
            reviewNote?: string | null;
            reviewStatus: string;
            reviewedByUserId?: number | null;
            reviewedByName?: string | null;
            uploadedByUserId?: number | null;
            uploadedByName?: string | null;
            reviewedAt?: string | null;
            createdAt?: string | null;
          } | null;
        } | null;
      }>;
    };
    suborders: Array<{
      suborderId: number;
      suborderNumber: string;
      store: {
        id?: number | null;
        ownerUserId?: number | null;
        name: string;
        slug?: string | null;
        status?: string | null;
      };
      subtotalAmount: number;
      shippingAmount: number;
      serviceFeeAmount: number;
      totalAmount: number;
      paymentMethod: string;
      paymentStatus: string;
      paymentStatusMeta?: StatusMeta;
      fulfillmentStatus: string;
      fulfillmentStatusMeta?: StatusMeta;
      paidAt?: string | null;
      shippingStatus?: string | null;
      shippingStatusMeta?: StatusMeta;
      latestTrackingEvent?: {
        status?: string | null;
        statusMeta?: StatusMeta | null;
        note?: string | null;
        happenedAt?: string | null;
      } | null;
      operationalTruth?: {
        payment?: {
          status?: string;
          statusMeta?: StatusMeta;
          settlementStatus?: string;
          settlementStatusMeta?: StatusMeta;
        };
        shipment?: {
          status?: string;
          statusMeta?: StatusMeta;
          blockedReason?: string | null;
          isBlockedByPayment?: boolean;
        };
        bridge?: {
          currentLane?: string;
          paymentToShipment?: string;
          shipmentBlocked?: boolean;
          shipmentBlockedReason?: string | null;
        };
        finality?: {
          isFinal?: boolean;
          isFinalNegative?: boolean;
        };
        statusSummary?: StatusMeta & {
          lane?: string;
        };
      } | null;
      paymentProfile?: {
        id: number;
        providerCode: string;
        paymentType: string;
        accountName: string;
        merchantName: string;
        merchantId?: string | null;
        isActive: boolean;
        verificationStatus: string;
        instructionText?: string | null;
      } | null;
      items: Array<{
        id: number;
        productId: number;
        productName: string;
        slug?: string;
        sku?: string | null;
        qty: number;
        price: number;
        totalPrice: number;
      }>;
      payments: Array<{
        id: number;
        internalReference: string;
        externalReference?: string | null;
        paymentChannel: string;
        paymentType: string;
        amount: number;
        status: string;
        statusMeta?: StatusMeta;
        qrImageUrl?: string | null;
        qrPayload?: string | null;
        expiresAt?: string | null;
        paidAt?: string | null;
        proofSubmitted?: boolean;
        proof?: {
          id: number;
          proofImageUrl: string;
          senderName: string;
          senderBankOrWallet: string;
          transferAmount: number;
          transferTime?: string | null;
          note?: string | null;
          reviewNote?: string | null;
          reviewStatus: string;
          reviewMeta?: ReviewMeta;
          reviewedByUserId?: number | null;
          reviewedByName?: string | null;
          uploadedByUserId?: number | null;
          uploadedByName?: string | null;
          reviewedAt?: string | null;
          createdAt?: string | null;
        } | null;
        logs?: Array<{
          id: number;
          oldStatus?: string | null;
          oldStatusMeta?: StatusMeta | null;
          newStatus: string;
          newStatusMeta?: StatusMeta | null;
          actorType: string;
          actorId?: number | null;
          actorName?: string | null;
          note?: string | null;
          createdAt?: string | null;
        }>;
      }>;
    }>;
  };
};

export const fetchAdminPaymentAudit = async (params: Record<string, unknown>) => {
  const { data } = await api.get<AdminPaymentAuditListResponse>("/admin/payments/audit", {
    params,
  });
  return data?.data ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1, filters: {} };
};

export const fetchAdminPaymentAuditDetail = async (orderId: string | number) => {
  const { data } = await api.get<AdminPaymentAuditDetailResponse>(
    `/admin/payments/audit/${encodeURIComponent(String(orderId))}`
  );
  return data?.data ?? null;
};
