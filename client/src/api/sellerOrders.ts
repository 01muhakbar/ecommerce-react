import { api } from "./axios.ts";

const ORDER_STATUSES = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
]);

const SUBORDER_PAYMENT_STATUSES = new Set([
  "UNPAID",
  "PENDING_CONFIRMATION",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

const PAYMENT_RECORD_STATUSES = new Set([
  "CREATED",
  "PENDING_CONFIRMATION",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REJECTED",
]);

const FULFILLMENT_STATUSES = new Set([
  "UNFULFILLED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();
const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];

const normalizeSuborderPaymentStatus = (value: unknown) => {
  const status = normalizeText(value).toUpperCase() || "UNPAID";
  return SUBORDER_PAYMENT_STATUSES.has(status) ? status : "UNPAID";
};

const normalizePaymentRecordStatus = (value: unknown) => {
  const status = normalizeText(value).toUpperCase() || "CREATED";
  return PAYMENT_RECORD_STATUSES.has(status) ? status : "CREATED";
};

const normalizeFulfillmentStatus = (value: unknown) => {
  const status = normalizeText(value).toUpperCase() || "UNFULFILLED";
  return FULFILLMENT_STATUSES.has(status) ? status : "UNFULFILLED";
};

const normalizeOrderStatus = (value: unknown) => {
  const status = normalizeText(value).toLowerCase() || "pending";
  return ORDER_STATUSES.has(status) ? status : "pending";
};

const buildSuborderPaymentMeta = (status: string) => ({
  code: status,
  label:
    status === "PENDING_CONFIRMATION"
      ? "Awaiting Review"
      : status === "UNPAID"
        ? "Unpaid"
        : status === "PAID"
          ? "Paid"
          : status === "FAILED"
            ? "Failed"
            : status === "EXPIRED"
              ? "Expired"
              : "Cancelled",
  description:
    status === "PENDING_CONFIRMATION"
      ? "Payment proof exists and is waiting for review."
      : status === "UNPAID"
        ? "The store split has not been settled yet."
        : status === "PAID"
          ? "The store split is settled."
          : status === "FAILED"
            ? "The latest payment attempt failed."
            : status === "EXPIRED"
              ? "The payment window expired before settlement."
              : "The store split was cancelled.",
});

const buildPaymentRecordMeta = (status: string) => ({
  code: status,
  label:
    status === "PENDING_CONFIRMATION"
      ? "Awaiting Review"
      : status === "CREATED"
        ? "Created"
        : status === "PAID"
          ? "Paid"
          : status === "FAILED"
            ? "Failed"
            : status === "EXPIRED"
              ? "Expired"
              : "Rejected",
  description:
    status === "PENDING_CONFIRMATION"
      ? "Proof was submitted and is still waiting for approval."
      : status === "CREATED"
        ? "Payment record exists but settlement is not complete yet."
        : status === "PAID"
          ? "Payment record is settled."
          : status === "FAILED"
            ? "Payment record failed."
            : status === "EXPIRED"
              ? "Payment record expired."
              : "Payment record or proof was rejected.",
});

const buildFulfillmentMeta = (status: string) => ({
  code: status,
  label:
    status === "UNFULFILLED"
      ? "Unfulfilled"
      : status === "PROCESSING"
        ? "Processing"
        : status === "SHIPPED"
          ? "Shipped"
          : status === "DELIVERED"
            ? "Delivered"
            : "Cancelled",
  description:
    status === "UNFULFILLED"
      ? "The seller has not started fulfillment yet."
      : status === "PROCESSING"
        ? "The seller is preparing or packing the suborder."
        : status === "SHIPPED"
          ? "The suborder is already in delivery."
          : status === "DELIVERED"
            ? "The suborder reached the buyer."
            : "The suborder fulfillment was cancelled.",
});

const buildOrderStatusMeta = (status: string) => ({
  code: status,
  label:
    status === "pending"
      ? "Pending"
      : status === "paid"
        ? "Paid"
        : status === "processing"
          ? "Processing"
          : status === "shipped"
            ? "Shipped"
            : status === "delivered"
              ? "Delivered"
              : status === "completed"
                ? "Completed"
                : "Cancelled",
  description:
    status === "pending"
      ? "Parent order is still waiting for the next lifecycle transition."
      : status === "paid"
        ? "Parent order is paid at order level."
        : status === "processing"
          ? "Parent order is being processed."
          : status === "shipped"
            ? "Parent order has been shipped."
            : status === "delivered"
              ? "Parent order was delivered."
              : status === "completed"
                ? "Parent order is completed."
                : "Parent order was cancelled.",
});

const normalizeProof = (proof: any) => {
  if (!proof || typeof proof !== "object") return null;
  const reviewStatus = normalizeText(proof.reviewStatus).toUpperCase() || "PENDING";
  return {
    ...proof,
    id: asNumber(proof.id, 0),
    reviewStatus,
    reviewMeta: {
      code: reviewStatus,
      label:
        reviewStatus === "APPROVED"
          ? "Approved"
          : reviewStatus === "REJECTED"
            ? "Rejected"
            : "Pending",
    },
    senderName: normalizeText(proof.senderName) || null,
    transferAmount: asNumber(proof.transferAmount, 0),
    transferTime: proof.transferTime || null,
    createdAt: proof.createdAt || null,
  };
};

const normalizeFulfillmentGovernance = (governance: any) => {
  const fulfillment = governance?.fulfillment;
  if (!fulfillment || typeof fulfillment !== "object") {
    return {
      fulfillment: {
        entity: "SUBORDER",
        scopeLabel: "Fulfillment actions must stay scoped to the active store suborder.",
        permissionKey: "ORDER_FULFILLMENT_MANAGE",
        actorHasManagePermission: false,
        currentMode: "READ_ONLY",
        mutationOpened: false,
        currentStatus: null,
        isFinal: false,
        mutationBlockedReason:
          "Seller fulfillment mutations are still closed in the current workspace phase.",
        sellerCandidateActions: ["MARK_PROCESSING", "MARK_SHIPPED", "MARK_DELIVERED"],
        readOnlyActions: [
          "VIEW_PAYMENT_PROOF",
          "VIEW_PARENT_ORDER_REFERENCE",
          "VIEW_PAYMENT_RECORD",
        ],
        adminOnlyActions: [
          "UPDATE_PARENT_ORDER_STATUS",
          "UPDATE_PARENT_PAYMENT_STATUS",
          "REVIEW_PAYMENT_RECORD",
          "REFUND_OR_DISPUTE",
          "CANCEL_PARENT_ORDER",
        ],
        availableActions: [],
        auditRequired: true,
        parentOrderMutationAllowed: false,
      },
    };
  }

  return {
    fulfillment: {
      entity: normalizeText(fulfillment.entity) || "SUBORDER",
      scopeLabel:
        normalizeText(fulfillment.scopeLabel) ||
        "Fulfillment actions must stay scoped to the active store suborder.",
      permissionKey:
        normalizeText(fulfillment.permissionKey) || "ORDER_FULFILLMENT_MANAGE",
      actorHasManagePermission: Boolean(fulfillment.actorHasManagePermission),
      currentMode: normalizeText(fulfillment.currentMode) || "READ_ONLY",
      mutationOpened: Boolean(fulfillment.mutationOpened),
      currentStatus: normalizeText(fulfillment.currentStatus).toUpperCase() || null,
      isFinal: Boolean(fulfillment.isFinal),
      mutationBlockedReason:
        normalizeText(fulfillment.mutationBlockedReason) ||
        "Seller fulfillment mutations are still closed in the current workspace phase.",
      sellerCandidateActions: normalizeStringArray(fulfillment.sellerCandidateActions),
      readOnlyActions: normalizeStringArray(fulfillment.readOnlyActions),
      adminOnlyActions: normalizeStringArray(fulfillment.adminOnlyActions),
      availableActions: Array.isArray(fulfillment.availableActions)
        ? fulfillment.availableActions
            .map((item: any) => ({
              code: normalizeText(item?.code).toUpperCase() || null,
              label: normalizeText(item?.label) || null,
              nextStatus: normalizeText(item?.nextStatus).toUpperCase() || null,
              allowedFrom: normalizeStringArray(item?.allowedFrom).map((entry) =>
                entry.toUpperCase()
              ),
              description: normalizeText(item?.description) || null,
            }))
            .filter((item: any) => item.code && item.nextStatus)
        : [],
      auditRequired: Boolean(fulfillment.auditRequired),
      parentOrderMutationAllowed: Boolean(fulfillment.parentOrderMutationAllowed),
    },
  };
};

const normalizePaymentSummary = (summary: any) => {
  if (!summary || typeof summary !== "object") return null;
  const status = normalizePaymentRecordStatus(summary.status ?? summary.statusMeta?.code);
  return {
    ...summary,
    id: asNumber(summary.id, 0),
    internalReference: normalizeText(summary.internalReference) || null,
    paymentChannel: normalizeText(summary.paymentChannel) || null,
    paymentType: normalizeText(summary.paymentType) || null,
    status,
    statusMeta: buildPaymentRecordMeta(status),
    amount: asNumber(summary.amount, 0),
    expiresAt: summary.expiresAt || null,
    paidAt: summary.paidAt || null,
    proof: normalizeProof(summary.proof),
  };
};

const normalizeBuyer = (buyer: any) => ({
  userId: asNumber(buyer?.userId, 0) || null,
  name: normalizeText(buyer?.name) || "Customer",
  email: normalizeText(buyer?.email) || null,
  phone: normalizeText(buyer?.phone) || null,
});

const normalizeOrderSummary = (order: any, fallback: any = {}) => {
  const orderStatus = normalizeOrderStatus(order?.status ?? fallback?.status);
  const paymentStatus = normalizeSuborderPaymentStatus(
    order?.paymentStatus ?? fallback?.paymentStatus
  );
  const checkoutMode = normalizeText(order?.checkoutMode ?? fallback?.checkoutMode).toUpperCase() || "LEGACY";
  return {
    id: asNumber(order?.id ?? fallback?.id, 0) || null,
    orderNumber: normalizeText(order?.orderNumber ?? fallback?.orderNumber) || null,
    checkoutMode,
    checkoutModeMeta:
      order?.checkoutModeMeta ?? {
        code: checkoutMode,
        label:
          checkoutMode === "MULTI_STORE"
            ? "Multi-store"
            : checkoutMode === "SINGLE_STORE"
              ? "Single-store"
              : "Legacy",
        description:
          checkoutMode === "MULTI_STORE"
            ? "One parent order is split into multiple seller suborders."
            : checkoutMode === "SINGLE_STORE"
              ? "One parent order maps to a single seller suborder."
              : "Older order flow without the new split-payment structure.",
      },
    status: orderStatus,
    statusMeta: buildOrderStatusMeta(orderStatus),
    paymentStatus,
    paymentStatusMeta: buildSuborderPaymentMeta(paymentStatus),
    createdAt: order?.createdAt ?? fallback?.createdAt ?? null,
  };
};

const normalizeListItem = (item: any) => {
  if (!item || typeof item !== "object") return null;
  const paymentStatus = normalizeSuborderPaymentStatus(item.paymentStatus ?? item.paymentStatusMeta?.code);
  const fulfillmentStatus = normalizeFulfillmentStatus(
    item.fulfillmentStatus ?? item.fulfillmentStatusMeta?.code
  );
  const order = normalizeOrderSummary(item.order, {
    id: item.orderId,
    orderNumber: item.orderNumber,
    checkoutMode: item.checkoutMode,
  });

  return {
    ...item,
    suborderId: asNumber(item.suborderId, 0),
    suborderNumber: normalizeText(item.suborderNumber) || "-",
    orderId: order.id,
    orderNumber: order.orderNumber || "-",
    checkoutMode: order.checkoutMode,
    checkoutModeMeta: order.checkoutModeMeta,
    paymentStatus,
    paymentStatusMeta: buildSuborderPaymentMeta(paymentStatus),
    fulfillmentStatus,
    fulfillmentStatusMeta: buildFulfillmentMeta(fulfillmentStatus),
    totalAmount: asNumber(item.totalAmount, 0),
    itemCount: asNumber(item.itemCount, 0),
    createdAt: item.createdAt || null,
    buyer: normalizeBuyer(item.buyer),
    order,
    scope: {
      storeId: asNumber(item.scope?.storeId ?? item.storeId, 0) || null,
      relationLabel:
        normalizeText(item.scope?.relationLabel) ||
        "Seller suborder for the active store only.",
    },
    governance: normalizeFulfillmentGovernance(item.governance),
    paymentSummary: normalizePaymentSummary(item.paymentSummary),
  };
};

const normalizeDetail = (detail: any) => {
  if (!detail || typeof detail !== "object") return null;
  const paymentStatus = normalizeSuborderPaymentStatus(
    detail.paymentStatus ?? detail.paymentStatusMeta?.code
  );
  const fulfillmentStatus = normalizeFulfillmentStatus(
    detail.fulfillmentStatus ?? detail.fulfillmentStatusMeta?.code
  );

  return {
    ...detail,
    suborderId: asNumber(detail.suborderId, 0),
    suborderNumber: normalizeText(detail.suborderNumber) || "-",
    storeId: asNumber(detail.storeId, 0),
    order: normalizeOrderSummary(detail.order),
    scope: {
      storeId: asNumber(detail.scope?.storeId ?? detail.storeId, 0) || null,
      relationLabel:
        normalizeText(detail.scope?.relationLabel) ||
        "This seller detail is scoped to one store-owned suborder.",
    },
    governance: normalizeFulfillmentGovernance(detail.governance),
    buyer: normalizeBuyer(detail.buyer),
    shipping: {
      fullName: normalizeText(detail.shipping?.fullName) || "Customer",
      phoneNumber: normalizeText(detail.shipping?.phoneNumber) || null,
      addressLine: normalizeText(detail.shipping?.addressLine) || null,
      markAs: normalizeText(detail.shipping?.markAs) || null,
    },
    paymentStatus,
    paymentStatusMeta: buildSuborderPaymentMeta(paymentStatus),
    fulfillmentStatus,
    fulfillmentStatusMeta: buildFulfillmentMeta(fulfillmentStatus),
    totals: {
      subtotalAmount: asNumber(detail.totals?.subtotalAmount, 0),
      shippingAmount: asNumber(detail.totals?.shippingAmount, 0),
      serviceFeeAmount: asNumber(detail.totals?.serviceFeeAmount, 0),
      totalAmount: asNumber(detail.totals?.totalAmount, 0),
    },
    paidAt: detail.paidAt || null,
    createdAt: detail.createdAt || null,
    items: Array.isArray(detail.items)
      ? detail.items.map((item: any) => ({
          ...item,
          id: asNumber(item.id, 0),
          productId: asNumber(item.productId, 0),
          productName: normalizeText(item.productName) || `Product #${asNumber(item.productId, 0)}`,
          qty: asNumber(item.qty, 0),
          price: asNumber(item.price, 0),
          totalPrice: asNumber(item.totalPrice, 0),
        }))
      : [],
    paymentSummary: normalizePaymentSummary(detail.paymentSummary),
    paymentProfileSummary: detail.paymentProfileSummary
      ? {
          ...detail.paymentProfileSummary,
          id: asNumber(detail.paymentProfileSummary.id, 0),
          accountName: normalizeText(detail.paymentProfileSummary.accountName) || null,
          merchantName: normalizeText(detail.paymentProfileSummary.merchantName) || null,
          verificationStatus:
            normalizeText(detail.paymentProfileSummary.verificationStatus).toUpperCase() ||
            "PENDING",
          isActive: Boolean(detail.paymentProfileSummary.isActive),
        }
      : null,
  };
};

export const getSellerSuborders = async (
  storeId: number | string,
  params: {
    page?: number;
    limit?: number;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    keyword?: string;
  } = {}
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/suborders`, { params });
  const payload = data?.data ?? null;
  if (!payload || typeof payload !== "object") {
    return { items: [], pagination: { page: 1, limit: 20, total: 0 } };
  }

  return {
    ...payload,
    items: Array.isArray(payload.items)
      ? payload.items.map(normalizeListItem).filter(Boolean)
      : [],
    governance: normalizeFulfillmentGovernance(payload.governance),
    pagination: {
      page: asNumber(payload.pagination?.page, asNumber(params.page, 1)),
      limit: asNumber(payload.pagination?.limit, asNumber(params.limit, 20)),
      total: asNumber(payload.pagination?.total, 0),
    },
  };
};

export const getSellerSuborderDetail = async (
  storeId: number | string,
  suborderId: number | string
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/suborders/${suborderId}`);
  return normalizeDetail(data?.data ?? null);
};

export const updateSellerSuborderFulfillment = async (
  storeId: number | string,
  suborderId: number | string,
  payload: { action: "MARK_PROCESSING" | "MARK_SHIPPED" | "MARK_DELIVERED" }
) => {
  const { data } = await api.patch(
    `/seller/stores/${storeId}/suborders/${suborderId}/fulfillment`,
    payload
  );

  return {
    ...data,
    data: data?.data
      ? {
          ...data.data,
          action: normalizeText(data.data.action).toUpperCase() || null,
          transition: {
            from: normalizeText(data.data.transition?.from).toUpperCase() || null,
            to: normalizeText(data.data.transition?.to).toUpperCase() || null,
          },
          auditLogId: asNumber(data.data.auditLogId, 0) || null,
          suborder: normalizeDetail(data.data.suborder),
        }
      : null,
  };
};
