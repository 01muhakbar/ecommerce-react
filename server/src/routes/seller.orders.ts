import { Op } from "sequelize";
import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { sellerHasPermission } from "../services/seller/resolveSellerAccess.js";
import {
  Order,
  Payment,
  PaymentProof,
  StoreAuditLog,
  StorePaymentProfile,
  Suborder,
  SuborderItem,
  User,
} from "../models/index.js";

const router = Router();
const ORDER_FULFILLMENT_PERMISSION = "ORDER_FULFILLMENT_MANAGE";
const SELLER_FULFILLMENT_CANDIDATE_ACTIONS = [
  "MARK_PROCESSING",
  "MARK_SHIPPED",
  "MARK_DELIVERED",
];
const SELLER_FULFILLMENT_READ_ONLY_ACTIONS = [
  "VIEW_PAYMENT_PROOF",
  "VIEW_PARENT_ORDER_REFERENCE",
  "VIEW_PAYMENT_RECORD",
];
const SELLER_FULFILLMENT_ADMIN_ONLY_ACTIONS = [
  "UPDATE_PARENT_ORDER_STATUS",
  "UPDATE_PARENT_PAYMENT_STATUS",
  "REVIEW_PAYMENT_RECORD",
  "REFUND_OR_DISPUTE",
  "CANCEL_PARENT_ORDER",
];
const SELLER_FULFILLMENT_AUDIT_ACTIONS = {
  MARK_PROCESSING: "SELLER_SUBORDER_MARK_PROCESSING",
  MARK_SHIPPED: "SELLER_SUBORDER_MARK_SHIPPED",
  MARK_DELIVERED: "SELLER_SUBORDER_MARK_DELIVERED",
} as const;
const FULFILLMENT_ACTIONS = {
  MARK_PROCESSING: {
    code: "MARK_PROCESSING",
    label: "Mark processing",
    nextStatus: "PROCESSING",
    allowedFrom: ["UNFULFILLED"],
    description: "Move the suborder into seller processing or packing.",
    successMessage: "Suborder moved to processing.",
    auditAction: SELLER_FULFILLMENT_AUDIT_ACTIONS.MARK_PROCESSING,
  },
  MARK_SHIPPED: {
    code: "MARK_SHIPPED",
    label: "Mark shipped",
    nextStatus: "SHIPPED",
    allowedFrom: ["PROCESSING"],
    description: "Confirm the suborder has been dispatched from the store.",
    successMessage: "Suborder marked as shipped.",
    auditAction: SELLER_FULFILLMENT_AUDIT_ACTIONS.MARK_SHIPPED,
  },
  MARK_DELIVERED: {
    code: "MARK_DELIVERED",
    label: "Mark delivered",
    nextStatus: "DELIVERED",
    allowedFrom: ["SHIPPED"],
    description: "Confirm the seller-side delivery step is complete.",
    successMessage: "Suborder marked as delivered.",
    auditAction: SELLER_FULFILLMENT_AUDIT_ACTIONS.MARK_DELIVERED,
  },
} as const;

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .toUpperCase()
    .trim();

const parsePositiveInt = (
  raw: unknown,
  fallback: number,
  min: number,
  max: number
) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const allowedPaymentStatuses = new Set([
  "UNPAID",
  "PARTIALLY_PAID",
  "PENDING_CONFIRMATION",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

const allowedFulfillmentStatuses = new Set([
  "UNFULFILLED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

const allowedPaymentRecordStatuses = new Set([
  "CREATED",
  "PENDING_CONFIRMATION",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REJECTED",
]);

const allowedOrderStatuses = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
]);

const normalizePaymentStatus = (value: unknown) => {
  const normalized = toUpper(value, "UNPAID");
  return allowedPaymentStatuses.has(normalized) ? normalized : "UNPAID";
};

const normalizeFulfillmentStatus = (value: unknown) => {
  const normalized = toUpper(value, "UNFULFILLED");
  return allowedFulfillmentStatuses.has(normalized) ? normalized : "UNFULFILLED";
};

const normalizePaymentRecordStatus = (value: unknown) => {
  const normalized = toUpper(value, "CREATED");
  return allowedPaymentRecordStatuses.has(normalized) ? normalized : "CREATED";
};

const normalizeOrderStatus = (value: unknown) => {
  const normalized = String(value || "pending").trim().toLowerCase();
  return allowedOrderStatuses.has(normalized) ? normalized : "pending";
};

const serializePaymentStatusMeta = (status: string) => ({
  code: status,
  label:
    status === "PENDING_CONFIRMATION"
      ? "Awaiting Review"
      : status === "UNPAID"
        ? "Unpaid"
        : status === "PARTIALLY_PAID"
          ? "Partially Paid"
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
        : status === "PARTIALLY_PAID"
          ? "At least one store split is settled, but the full parent payment is not complete yet."
        : status === "PAID"
          ? "The store split is settled."
          : status === "FAILED"
            ? "The latest payment attempt failed."
            : status === "EXPIRED"
              ? "The payment window expired before settlement."
              : "The store split was cancelled.",
});

const serializePaymentRecordStatusMeta = (status: string) => ({
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
        ? "Payment record exists but proof or settlement is not complete yet."
        : status === "PAID"
          ? "Payment record is settled."
          : status === "FAILED"
            ? "Payment record failed."
            : status === "EXPIRED"
              ? "Payment record expired."
              : "Payment proof or payment record was rejected.",
});

const serializeFulfillmentStatusMeta = (status: string) => ({
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

const serializeOrderStatusMeta = (status: string) => ({
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

const serializeCheckoutModeMeta = (mode: string) => ({
  code: mode,
  label:
    mode === "MULTI_STORE"
      ? "Multi-store"
      : mode === "SINGLE_STORE"
        ? "Single-store"
        : "Legacy",
  description:
    mode === "MULTI_STORE"
      ? "One parent order is split into multiple seller suborders."
      : mode === "SINGLE_STORE"
        ? "One parent order maps to a single seller suborder."
        : "Older order flow without the new split-payment structure.",
});

const serializeProofReviewMeta = (status: string) => ({
  code: status,
  label:
    status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Pending",
});

const normalizeProofSummary = (proofs: any[]) => {
  if (!Array.isArray(proofs) || proofs.length === 0) return null;
  const latest = [...proofs]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      return rightTime - leftTime;
    })[0];

  return {
    id: toNumber(getAttr(latest, "id")),
    reviewStatus: toUpper(getAttr(latest, "reviewStatus"), "PENDING"),
    reviewMeta: serializeProofReviewMeta(toUpper(getAttr(latest, "reviewStatus"), "PENDING")),
    senderName: String(getAttr(latest, "senderName") || ""),
    transferAmount: toNumber(getAttr(latest, "transferAmount")),
    transferTime: getAttr(latest, "transferTime") || null,
    createdAt: getAttr(latest, "createdAt") || null,
  };
};

const buildShippingSummary = (order: any) => {
  const shippingDetails = getAttr(order, "shippingDetails") || null;
  if (shippingDetails && typeof shippingDetails === "object") {
    const addressParts = [
      shippingDetails.streetName,
      shippingDetails.houseNumber,
      shippingDetails.building,
      shippingDetails.district,
      shippingDetails.city,
      shippingDetails.province,
      shippingDetails.postalCode,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean);

    return {
      fullName: String(shippingDetails.fullName || getAttr(order, "customerName") || "Customer"),
      phoneNumber: String(
        shippingDetails.phoneNumber || getAttr(order, "customerPhone") || ""
      ),
      addressLine: addressParts.join(", ") || null,
      markAs: shippingDetails.markAs ? String(shippingDetails.markAs) : null,
    };
  }

  return {
    fullName: String(getAttr(order, "customerName") || "Customer"),
    phoneNumber: getAttr(order, "customerPhone")
      ? String(getAttr(order, "customerPhone"))
      : null,
    addressLine: getAttr(order, "customerAddress")
      ? String(getAttr(order, "customerAddress"))
      : null,
    markAs: null,
  };
};

const countSuborderItems = (suborder: any) =>
  Array.isArray(suborder?.items)
    ? suborder.items.reduce((sum: number, item: any) => sum + toNumber(getAttr(item, "qty")), 0)
    : 0;

const buildSellerReadModel = (input: {
  suborder: any;
  order: any;
  fulfillmentStatus: string;
  paymentStatus: string;
  parentOrderStatus: string;
  parentPaymentStatus: string;
  checkoutMode: string;
}) => {
  const fulfillmentMeta = serializeFulfillmentStatusMeta(input.fulfillmentStatus);
  const paymentMeta = serializePaymentStatusMeta(input.paymentStatus);
  const parentOrderMeta = serializeOrderStatusMeta(input.parentOrderStatus);
  const parentPaymentMeta = serializePaymentStatusMeta(input.parentPaymentStatus);
  const checkoutModeMeta = serializeCheckoutModeMeta(input.checkoutMode);
  const itemCount = countSuborderItems(input.suborder);
  const subtotalAmount = toNumber(getAttr(input.suborder, "subtotalAmount"));
  const shippingAmount = toNumber(getAttr(input.suborder, "shippingAmount"));
  const serviceFeeAmount = toNumber(getAttr(input.suborder, "serviceFeeAmount"));
  const totalAmount = toNumber(getAttr(input.suborder, "totalAmount"));

  return {
    primaryStatus: {
      code: input.fulfillmentStatus,
      label: fulfillmentMeta.label,
      description: fulfillmentMeta.description,
      source: "SUBORDER.fulfillmentStatus",
      scope: "SELLER_SUBORDER",
    },
    paymentState: {
      code: input.paymentStatus,
      label: paymentMeta.label,
      description: paymentMeta.description,
      source: "SUBORDER.paymentStatus",
      scope: "SELLER_SUBORDER",
    },
    parentOrder: {
      orderNumber: String(getAttr(input.order, "invoiceNo") || ""),
      status: input.parentOrderStatus,
      statusMeta: parentOrderMeta,
      paymentStatus: input.parentPaymentStatus,
      paymentStatusMeta: parentPaymentMeta,
      checkoutMode: input.checkoutMode,
      checkoutModeMeta,
      source: "ORDER",
      note:
        input.checkoutMode === "MULTI_STORE"
          ? "Parent order lifecycle can differ from this store split because one checkout is shared across multiple seller suborders."
          : "Parent order lifecycle is a read-only reference. Seller operations stay scoped to this store suborder.",
    },
    sellerScope: {
      entity: "SUBORDER",
      itemCount,
      subtotalAmount,
      shippingAmount,
      serviceFeeAmount,
      totalAmount,
      itemScopeLabel: "Item counts and totals only include this store-owned suborder.",
      parentReferenceLabel:
        "Parent order lifecycle and parent payment remain read-only references in seller workspace.",
    },
    operationalNote:
      input.paymentStatus === "PAID"
        ? "Use seller fulfillment as the primary operational status for this store split. Payment for this suborder is already settled."
        : "Use suborder payment readiness and seller fulfillment as the operational truth. Parent order status can move on a separate global lane.",
  };
};

const serializeAuditState = (value?: Record<string, unknown> | null) =>
  value ? JSON.stringify(value) : null;

const resolveFulfillmentTransitionBlocker = (input: {
  orderStatus?: string | null;
  paymentStatus?: string | null;
}) => {
  if (input.orderStatus === "cancelled") {
    return {
      code: "PARENT_ORDER_CANCELLED",
      message: "Parent order is cancelled, so seller fulfillment can no longer move forward.",
    };
  }

  if (input.paymentStatus !== "PAID") {
    return {
      code: "SUBORDER_PAYMENT_NOT_SETTLED",
      message: "Seller fulfillment can move forward only after this store split is paid.",
    };
  }

  return null;
};

const buildAvailableFulfillmentActions = (
  currentStatus: string | null,
  sellerAccess: any,
  blockerCode?: string | null
) => {
  if (!currentStatus) return [];
  if (!sellerHasPermission(sellerAccess, ORDER_FULFILLMENT_PERMISSION)) return [];
  if (blockerCode) return [];

  return Object.values(FULFILLMENT_ACTIONS)
    .filter((definition) =>
      (definition.allowedFrom as readonly string[]).includes(currentStatus)
    )
    .map((definition) => ({
      code: definition.code,
      label: definition.label,
      nextStatus: definition.nextStatus,
      allowedFrom: [...definition.allowedFrom],
      description: definition.description,
    }));
};

const buildFulfillmentGovernance = (
  sellerAccess: any,
  currentStatus: string | null = null,
  options?: {
    blockerCode?: string | null;
    blockerMessage?: string | null;
  }
) => {
  const actorHasManagePermission = sellerHasPermission(
    sellerAccess,
    ORDER_FULFILLMENT_PERMISSION
  );
  const availableActions = buildAvailableFulfillmentActions(
    currentStatus,
    sellerAccess,
    options?.blockerCode
  );
  const isFinal = currentStatus === "DELIVERED" || currentStatus === "CANCELLED";

  return {
    entity: "SUBORDER",
    scopeLabel: "Fulfillment actions must stay scoped to the active store suborder.",
    permissionKey: ORDER_FULFILLMENT_PERMISSION,
    actorHasManagePermission,
    currentMode: actorHasManagePermission ? "PHASE_1_ACTIVE" : "READ_ONLY",
    mutationOpened: true,
    currentStatus,
    isFinal,
    availableActions,
    mutationBlockedReason: actorHasManagePermission
      ? isFinal
        ? "This suborder is already in a final fulfillment state for phase 1."
        : options?.blockerMessage
          ? options.blockerMessage
        : availableActions.length > 0
          ? "Phase 1 seller fulfillment allows only the next forward transition for this suborder."
          : currentStatus
            ? "No forward fulfillment transition is available from the current suborder status."
            : "Phase 1 seller fulfillment is active for suborder-scoped transitions only."
      : "This actor can view seller orders, but fulfillment mutations require ORDER_FULFILLMENT_MANAGE.",
    sellerCandidateActions: [...SELLER_FULFILLMENT_CANDIDATE_ACTIONS],
    readOnlyActions: [...SELLER_FULFILLMENT_READ_ONLY_ACTIONS],
    adminOnlyActions: [...SELLER_FULFILLMENT_ADMIN_ONLY_ACTIONS],
    auditRequired: true,
    parentOrderMutationAllowed: false,
  };
};

const recordSellerFulfillmentAudit = async (payload: {
  storeId: number;
  actorUserId?: number | null;
  targetUserId?: number | null;
  action: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}) =>
  StoreAuditLog.create({
    storeId: payload.storeId,
    actorUserId: payload.actorUserId ?? null,
    targetUserId: payload.targetUserId ?? null,
    targetMemberId: null,
    action: payload.action,
    beforeState: serializeAuditState(payload.beforeState),
    afterState: serializeAuditState(payload.afterState),
  } as any);

const listInclude = [
  {
    model: Order,
    as: "order",
    attributes: [
      "id",
      "invoiceNo",
      "userId",
      "customerName",
      "customerPhone",
      "shippingDetails",
      "paymentStatus",
      "status",
      "checkoutMode",
      "createdAt",
    ],
    include: [
      {
        model: User,
        as: "customer",
        attributes: ["id", "name", "email"],
        required: false,
      },
    ],
  },
  {
    model: SuborderItem,
    as: "items",
    attributes: [
      "id",
      "productId",
      "productNameSnapshot",
      "qty",
      "priceSnapshot",
      "totalPrice",
    ],
    required: false,
  },
  {
    model: Payment,
    as: "payments",
    attributes: [
      "id",
      "internalReference",
      "amount",
      "status",
      "paymentChannel",
      "paymentType",
      "expiresAt",
      "paidAt",
      "createdAt",
    ],
    required: false,
    include: [
      {
        model: PaymentProof,
        as: "proofs",
        attributes: [
          "id",
          "senderName",
          "transferAmount",
          "transferTime",
          "reviewStatus",
          "createdAt",
        ],
        required: false,
      },
    ],
  },
];

const detailInclude = [
  ...listInclude,
  {
    model: StorePaymentProfile,
    as: "paymentProfile",
    attributes: [
      "id",
      "storeId",
      "providerCode",
      "paymentType",
      "accountName",
      "merchantName",
      "merchantId",
      "isActive",
      "verificationStatus",
    ],
    required: false,
  },
];

const serializeListItem = (suborder: any, sellerAccess: any = null) => {
  const order = suborder?.order ?? suborder?.get?.("order") ?? null;
  const buyer = order?.customer ?? order?.get?.("customer") ?? null;
  const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
  const latestPayment = [...payments]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      return rightTime - leftTime;
    })[0];
  const paymentStatus = normalizePaymentStatus(getAttr(suborder, "paymentStatus"));
  const fulfillmentStatus = normalizeFulfillmentStatus(getAttr(suborder, "fulfillmentStatus"));
  const checkoutMode = toUpper(getAttr(order, "checkoutMode"), "LEGACY") || "LEGACY";
  const orderStatus = normalizeOrderStatus(getAttr(order, "status"));
  const parentPaymentStatus = normalizePaymentStatus(getAttr(order, "paymentStatus"));
  const fulfillmentBlocker = resolveFulfillmentTransitionBlocker({
    orderStatus,
    paymentStatus,
  });
  const readModel = buildSellerReadModel({
    suborder,
    order,
    fulfillmentStatus,
    paymentStatus,
    parentOrderStatus: orderStatus,
    parentPaymentStatus,
    checkoutMode,
  });

  return {
    suborderId: toNumber(getAttr(suborder, "id")),
    suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
    orderId: toNumber(getAttr(order, "id")),
    orderNumber: String(getAttr(order, "invoiceNo") || ""),
    checkoutMode,
    checkoutModeMeta: serializeCheckoutModeMeta(checkoutMode),
    paymentStatus,
    paymentStatusMeta: serializePaymentStatusMeta(paymentStatus),
    fulfillmentStatus,
    fulfillmentStatusMeta: serializeFulfillmentStatusMeta(fulfillmentStatus),
    totalAmount: readModel.sellerScope.totalAmount,
    itemCount: readModel.sellerScope.itemCount,
    createdAt: getAttr(suborder, "createdAt") || null,
    order: {
      id: toNumber(getAttr(order, "id")),
      orderNumber: String(getAttr(order, "invoiceNo") || ""),
      checkoutMode,
      checkoutModeMeta: serializeCheckoutModeMeta(checkoutMode),
      status: orderStatus,
      statusMeta: serializeOrderStatusMeta(orderStatus),
      paymentStatus: parentPaymentStatus,
      paymentStatusMeta: serializePaymentStatusMeta(parentPaymentStatus),
      createdAt: getAttr(order, "createdAt") || null,
    },
    scope: {
      storeId: toNumber(getAttr(suborder, "storeId")),
      relationLabel: "Seller suborder for the active store only.",
    },
    readModel,
    governance: {
      fulfillment: buildFulfillmentGovernance(sellerAccess, fulfillmentStatus, {
        blockerCode: fulfillmentBlocker?.code,
        blockerMessage: fulfillmentBlocker?.message,
      }),
    },
    buyer: {
      userId: toNumber(getAttr(order, "userId"), 0) || null,
      name: String(
        getAttr(buyer, "name") || getAttr(order, "customerName") || "Customer"
      ),
      email: getAttr(buyer, "email") ? String(getAttr(buyer, "email")) : null,
      phone: getAttr(order, "customerPhone") ? String(getAttr(order, "customerPhone")) : null,
    },
    paymentSummary: latestPayment
      ? {
          id: toNumber(getAttr(latestPayment, "id")),
          internalReference: String(getAttr(latestPayment, "internalReference") || ""),
          status: normalizePaymentRecordStatus(getAttr(latestPayment, "status")),
          statusMeta: serializePaymentRecordStatusMeta(
            normalizePaymentRecordStatus(getAttr(latestPayment, "status"))
          ),
          amount: toNumber(getAttr(latestPayment, "amount")),
          paidAt: getAttr(latestPayment, "paidAt") || null,
          proof: normalizeProofSummary(latestPayment?.proofs ?? []),
        }
      : null,
  };
};

const serializeDetail = (suborder: any, sellerAccess: any = null) => {
  const order = suborder?.order ?? suborder?.get?.("order") ?? null;
  const buyer = order?.customer ?? order?.get?.("customer") ?? null;
  const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
  const latestPayment = [...payments]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      return rightTime - leftTime;
    })[0];
  const paymentProfile = suborder?.paymentProfile ?? suborder?.get?.("paymentProfile") ?? null;
  const paymentStatus = normalizePaymentStatus(getAttr(suborder, "paymentStatus"));
  const fulfillmentStatus = normalizeFulfillmentStatus(getAttr(suborder, "fulfillmentStatus"));
  const orderStatus = normalizeOrderStatus(getAttr(order, "status"));
  const parentPaymentStatus = normalizePaymentStatus(getAttr(order, "paymentStatus"));
  const checkoutMode = toUpper(getAttr(order, "checkoutMode"), "LEGACY") || "LEGACY";
  const fulfillmentBlocker = resolveFulfillmentTransitionBlocker({
    orderStatus,
    paymentStatus,
  });
  const readModel = buildSellerReadModel({
    suborder,
    order,
    fulfillmentStatus,
    paymentStatus,
    parentOrderStatus: orderStatus,
    parentPaymentStatus,
    checkoutMode,
  });

  return {
    suborderId: toNumber(getAttr(suborder, "id")),
    suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
    storeId: toNumber(getAttr(suborder, "storeId")),
    order: {
      id: toNumber(getAttr(order, "id")),
      orderNumber: String(getAttr(order, "invoiceNo") || ""),
      status: orderStatus,
      statusMeta: serializeOrderStatusMeta(orderStatus),
      paymentStatus: parentPaymentStatus,
      paymentStatusMeta: serializePaymentStatusMeta(parentPaymentStatus),
      checkoutMode,
      checkoutModeMeta: serializeCheckoutModeMeta(checkoutMode),
      createdAt: getAttr(order, "createdAt") || null,
    },
    scope: {
      storeId: toNumber(getAttr(suborder, "storeId")),
      relationLabel: "This seller detail is scoped to one store-owned suborder.",
    },
    readModel,
    governance: {
      fulfillment: buildFulfillmentGovernance(sellerAccess, fulfillmentStatus, {
        blockerCode: fulfillmentBlocker?.code,
        blockerMessage: fulfillmentBlocker?.message,
      }),
    },
    buyer: {
      userId: toNumber(getAttr(order, "userId"), 0) || null,
      name: String(
        getAttr(buyer, "name") || getAttr(order, "customerName") || "Customer"
      ),
      email: getAttr(buyer, "email") ? String(getAttr(buyer, "email")) : null,
      phone: getAttr(order, "customerPhone") ? String(getAttr(order, "customerPhone")) : null,
    },
    shipping: buildShippingSummary(order),
    paymentStatus,
    paymentStatusMeta: serializePaymentStatusMeta(paymentStatus),
    fulfillmentStatus,
    fulfillmentStatusMeta: serializeFulfillmentStatusMeta(fulfillmentStatus),
    totals: {
      subtotalAmount: readModel.sellerScope.subtotalAmount,
      shippingAmount: readModel.sellerScope.shippingAmount,
      serviceFeeAmount: readModel.sellerScope.serviceFeeAmount,
      totalAmount: readModel.sellerScope.totalAmount,
    },
    paidAt: getAttr(suborder, "paidAt") || null,
    createdAt: getAttr(suborder, "createdAt") || null,
    items: (Array.isArray(suborder?.items) ? suborder.items : []).map((item: any) => ({
      id: toNumber(getAttr(item, "id")),
      productId: toNumber(getAttr(item, "productId")),
      productName: String(
        getAttr(item, "productNameSnapshot") || `Product #${getAttr(item, "productId")}`
      ),
      qty: toNumber(getAttr(item, "qty")),
      price: toNumber(getAttr(item, "priceSnapshot")),
      totalPrice: toNumber(getAttr(item, "totalPrice")),
    })),
    paymentSummary: latestPayment
      ? {
          id: toNumber(getAttr(latestPayment, "id")),
          internalReference: String(getAttr(latestPayment, "internalReference") || ""),
          paymentChannel: String(getAttr(latestPayment, "paymentChannel") || "QRIS"),
          paymentType: String(getAttr(latestPayment, "paymentType") || "QRIS_STATIC"),
          status: normalizePaymentRecordStatus(getAttr(latestPayment, "status")),
          statusMeta: serializePaymentRecordStatusMeta(
            normalizePaymentRecordStatus(getAttr(latestPayment, "status"))
          ),
          amount: toNumber(getAttr(latestPayment, "amount")),
          expiresAt: getAttr(latestPayment, "expiresAt") || null,
          paidAt: getAttr(latestPayment, "paidAt") || null,
          proof: normalizeProofSummary(latestPayment?.proofs ?? []),
        }
      : null,
    paymentProfileSummary: paymentProfile
      ? {
          id: toNumber(getAttr(paymentProfile, "id")),
          accountName: String(getAttr(paymentProfile, "accountName") || ""),
          merchantName: String(getAttr(paymentProfile, "merchantName") || ""),
          verificationStatus: String(
            getAttr(paymentProfile, "verificationStatus") || "PENDING"
          ),
          isActive: Boolean(getAttr(paymentProfile, "isActive")),
        }
      : null,
  };
};

router.get(
  "/stores/:storeId/suborders",
  requireSellerStoreAccess(["ORDER_VIEW"]),
  async (req: any, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const page = parsePositiveInt(req.query.page, 1, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 20, 1, 50);
      const offset = (page - 1) * limit;
      const keyword = String(req.query.keyword || "").trim();
      const paymentStatus = toUpper(req.query.paymentStatus);
      const fulfillmentStatus = toUpper(req.query.fulfillmentStatus);

      const where: any = { storeId };

      if (allowedPaymentStatuses.has(paymentStatus)) {
        where.paymentStatus = paymentStatus;
      }

      if (allowedFulfillmentStatuses.has(fulfillmentStatus)) {
        where.fulfillmentStatus = fulfillmentStatus;
      }

      if (keyword) {
        const likeKeyword = `%${keyword}%`;
        where[Op.or] = [
          { suborderNumber: { [Op.like]: likeKeyword } },
          { "$order.invoiceNo$": { [Op.like]: likeKeyword } },
          { "$order.customerName$": { [Op.like]: likeKeyword } },
          { "$order.customerPhone$": { [Op.like]: likeKeyword } },
        ];
      }

      const result = await Suborder.findAndCountAll({
        where,
        attributes: [
          "id",
          "orderId",
          "suborderNumber",
          "storeId",
          "subtotalAmount",
          "shippingAmount",
          "serviceFeeAmount",
          "totalAmount",
          "paymentStatus",
          "fulfillmentStatus",
          "paidAt",
          "createdAt",
        ],
        include: listInclude,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
        distinct: true,
        subQuery: false,
      });

      return res.json({
        success: true,
        data: {
          items: result.rows.map((suborder) => serializeListItem(suborder, req.sellerAccess)),
          governance: {
            fulfillment: buildFulfillmentGovernance(req.sellerAccess),
          },
          filters: {
            paymentStatus: allowedPaymentStatuses.has(paymentStatus) ? paymentStatus : "",
            fulfillmentStatus: allowedFulfillmentStatuses.has(fulfillmentStatus)
              ? fulfillmentStatus
              : "",
            keyword,
          },
          pagination: {
            page,
            limit,
            total: result.count,
          },
        },
      });
    } catch (error) {
      console.error("[seller/orders/list] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller suborders.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/suborders/:suborderId",
  requireSellerStoreAccess(["ORDER_VIEW"]),
  async (req: any, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const suborderId = Number(req.params.suborderId);
      if (!Number.isInteger(suborderId) || suborderId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid suborder id.",
        });
      }

      const suborder = await Suborder.findOne({
        where: { id: suborderId, storeId },
        attributes: [
          "id",
          "orderId",
          "suborderNumber",
          "storeId",
          "storePaymentProfileId",
          "subtotalAmount",
          "shippingAmount",
          "serviceFeeAmount",
          "totalAmount",
          "paymentStatus",
          "fulfillmentStatus",
          "paidAt",
          "createdAt",
        ],
        include: detailInclude,
      });

      if (!suborder) {
        return res.status(404).json({
          success: false,
          message: "Suborder not found.",
        });
      }

      const serializedDetail = serializeDetail(suborder, req.sellerAccess);

      return res.json({
        success: true,
        data: serializedDetail,
      });
    } catch (error) {
      console.error("[seller/orders/detail] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller suborder detail.",
      });
    }
  }
);

router.patch(
  "/stores/:storeId/suborders/:suborderId/fulfillment",
  requireSellerStoreAccess(["ORDER_VIEW", "ORDER_FULFILLMENT_MANAGE"]),
  async (req: any, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const suborderId = Number(req.params.suborderId);
      const actorUserId = Number(req.user?.id || 0) || null;
      const actionCode = toUpper(req.body?.action);
      const actionDefinition =
        FULFILLMENT_ACTIONS[actionCode as keyof typeof FULFILLMENT_ACTIONS] ?? null;

      if (!Number.isInteger(suborderId) || suborderId <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_SUBORDER_ID",
          message: "Invalid suborder id.",
        });
      }

      if (!actionDefinition) {
        return res.status(400).json({
          success: false,
          code: "INVALID_FULFILLMENT_ACTION",
          message: "Invalid seller fulfillment action.",
        });
      }

      const suborder = await Suborder.findOne({
        where: { id: suborderId, storeId },
        attributes: [
          "id",
          "orderId",
          "suborderNumber",
          "storeId",
          "storePaymentProfileId",
          "subtotalAmount",
          "shippingAmount",
          "serviceFeeAmount",
          "totalAmount",
          "paymentStatus",
          "fulfillmentStatus",
          "paidAt",
          "createdAt",
          "updatedAt",
        ],
        include: detailInclude,
      });

      if (!suborder) {
        return res.status(404).json({
          success: false,
          code: "SUBORDER_NOT_FOUND",
          message: "Suborder not found.",
        });
      }

      const currentFulfillmentStatus = normalizeFulfillmentStatus(
        getAttr(suborder, "fulfillmentStatus")
      );

      if (currentFulfillmentStatus === actionDefinition.nextStatus) {
        return res.status(409).json({
          success: false,
          code: "FULFILLMENT_STATUS_ALREADY_SET",
          message: `Suborder is already ${serializeFulfillmentStatusMeta(currentFulfillmentStatus).label.toLowerCase()}.`,
        });
      }

      if (
        !(actionDefinition.allowedFrom as readonly string[]).includes(
          currentFulfillmentStatus
        )
      ) {
        return res.status(409).json({
          success: false,
          code: "INVALID_FULFILLMENT_TRANSITION",
          message: `Cannot ${actionDefinition.label.toLowerCase()} from ${serializeFulfillmentStatusMeta(currentFulfillmentStatus).label.toLowerCase()}.`,
        });
      }

      const hydratedSuborder: any = suborder;
      const order = hydratedSuborder?.order ?? hydratedSuborder?.get?.("order") ?? null;
      const latestPayment = Array.isArray(hydratedSuborder?.payments)
        ? [...hydratedSuborder.payments].sort((left, right) => {
            const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
            const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
            return rightTime - leftTime;
          })[0]
        : null;

      const beforeState = {
        suborderId: toNumber(getAttr(suborder, "id")),
        suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
        fulfillmentStatus: currentFulfillmentStatus,
        paymentStatus: normalizePaymentStatus(getAttr(suborder, "paymentStatus")),
        paymentRecordStatus: latestPayment
          ? normalizePaymentRecordStatus(getAttr(latestPayment, "status"))
          : null,
        orderStatus: normalizeOrderStatus(getAttr(order, "status")),
        orderPaymentStatus: normalizePaymentStatus(getAttr(order, "paymentStatus")),
      };
      const transitionBlocker = resolveFulfillmentTransitionBlocker({
        orderStatus: beforeState.orderStatus,
        paymentStatus: beforeState.paymentStatus,
      });

      if (transitionBlocker) {
        return res.status(409).json({
          success: false,
          code: transitionBlocker.code,
          message: transitionBlocker.message,
        });
      }

      await (suborder as any).update({
        fulfillmentStatus: actionDefinition.nextStatus,
      });

      const refreshed = await Suborder.findOne({
        where: { id: suborderId, storeId },
        attributes: [
          "id",
          "orderId",
          "suborderNumber",
          "storeId",
          "storePaymentProfileId",
          "subtotalAmount",
          "shippingAmount",
          "serviceFeeAmount",
          "totalAmount",
          "paymentStatus",
          "fulfillmentStatus",
          "paidAt",
          "createdAt",
          "updatedAt",
        ],
        include: detailInclude,
      });

      if (!refreshed) {
        return res.status(500).json({
          success: false,
          message: "Seller fulfillment was updated, but the refreshed suborder could not be loaded.",
        });
      }

      const hydratedRefreshed: any = refreshed;
      const refreshedOrder =
        hydratedRefreshed?.order ?? hydratedRefreshed?.get?.("order") ?? null;
      const refreshedLatestPayment = Array.isArray(hydratedRefreshed?.payments)
        ? [...hydratedRefreshed.payments].sort((left, right) => {
            const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
            const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
            return rightTime - leftTime;
          })[0]
        : null;

      const afterState = {
        suborderId: toNumber(getAttr(refreshed, "id")),
        suborderNumber: String(getAttr(refreshed, "suborderNumber") || ""),
        fulfillmentStatus: normalizeFulfillmentStatus(getAttr(refreshed, "fulfillmentStatus")),
        paymentStatus: normalizePaymentStatus(getAttr(refreshed, "paymentStatus")),
        paymentRecordStatus: refreshedLatestPayment
          ? normalizePaymentRecordStatus(getAttr(refreshedLatestPayment, "status"))
          : null,
        orderStatus: normalizeOrderStatus(getAttr(refreshedOrder, "status")),
        orderPaymentStatus: normalizePaymentStatus(getAttr(refreshedOrder, "paymentStatus")),
      };

      const auditLog = await recordSellerFulfillmentAudit({
        storeId,
        actorUserId,
        targetUserId: toNumber(getAttr(refreshedOrder, "userId"), 0) || null,
        action: actionDefinition.auditAction,
        beforeState,
        afterState,
      });

      return res.json({
        success: true,
        message: actionDefinition.successMessage,
        data: {
          action: actionDefinition.code,
          transition: {
            from: currentFulfillmentStatus,
            to: actionDefinition.nextStatus,
          },
          auditLogId: toNumber(getAttr(auditLog, "id"), 0) || null,
          suborder: serializeDetail(refreshed, req.sellerAccess),
        },
      });
    } catch (error) {
      console.error("[seller/orders:fulfillment] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update seller fulfillment status.",
      });
    }
  }
);

export default router;
