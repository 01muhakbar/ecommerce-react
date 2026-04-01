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
  "PARTIALLY_PAID",
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

const asObject = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, any>) : null;

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

const normalizeStatusMeta = (value: unknown) => {
  const meta = asObject(value);
  if (!meta) return null;
  return {
    ...meta,
    code: normalizeText(meta.code) || null,
    label: normalizeText(meta.label) || null,
    tone: normalizeText(meta.tone) || "stone",
    description: normalizeText(meta.description) || null,
    isFinal: Boolean(meta.isFinal),
  };
};

const normalizeCheckoutModeMeta = (value: unknown, fallbackCode = "LEGACY") => {
  const meta = asObject(value);
  const code =
    normalizeText(meta?.code ?? fallbackCode)
      .toUpperCase()
      .trim() || "LEGACY";
  if (!meta) {
    return {
      code,
      label:
        code === "MULTI_STORE"
          ? "Multi-store"
          : code === "SINGLE_STORE"
            ? "Single-store"
            : "Legacy",
      description: null,
    };
  }
  return {
    ...meta,
    code,
    label: normalizeText(meta.label) || null,
    description: normalizeText(meta.description) || null,
  };
};

const normalizeProofReviewMeta = (value: unknown) => {
  const meta = asObject(value);
  if (!meta) return null;
  return {
    ...meta,
    code: normalizeText(meta.code).toUpperCase() || null,
    label: normalizeText(meta.label) || null,
  };
};

const normalizeProof = (proof: any) => {
  const source = asObject(proof);
  if (!source) return null;
  return {
    ...source,
    id: asNumber(source.id, 0),
    reviewStatus: normalizeText(source.reviewStatus).toUpperCase() || "PENDING",
    reviewMeta: normalizeProofReviewMeta(source.reviewMeta),
    senderName: normalizeText(source.senderName) || null,
    transferAmount: asNumber(source.transferAmount, 0),
    transferTime: source.transferTime || null,
    createdAt: source.createdAt || null,
  };
};

const normalizeFulfillmentAction = (action: unknown) => {
  const source = asObject(action);
  if (!source) return null;
  return {
    ...source,
    code: normalizeText(source.code).toUpperCase() || null,
    label: normalizeText(source.label) || null,
    nextStatus: normalizeText(source.nextStatus).toUpperCase() || null,
    allowedFrom: normalizeStringArray(source.allowedFrom).map((entry) => entry.toUpperCase()),
    description: normalizeText(source.description) || null,
    enabled: source.enabled !== false,
    reason: normalizeText(source.reason) || null,
    tone: normalizeText(source.tone) || null,
    scope: normalizeText(source.scope) || null,
  };
};

const normalizeFulfillmentGovernance = (governance: any) => {
  const source = asObject(governance);
  const fulfillment = asObject(source?.fulfillment);

  return {
    fulfillment: {
      entity: normalizeText(fulfillment?.entity) || null,
      scopeLabel: normalizeText(fulfillment?.scopeLabel) || null,
      permissionKey: normalizeText(fulfillment?.permissionKey) || null,
      actorHasManagePermission: Boolean(fulfillment?.actorHasManagePermission),
      currentMode: normalizeText(fulfillment?.currentMode) || null,
      mutationOpened: Boolean(fulfillment?.mutationOpened),
      currentStatus: normalizeText(fulfillment?.currentStatus).toUpperCase() || null,
      isFinal: Boolean(fulfillment?.isFinal),
      mutationBlockedReason: normalizeText(fulfillment?.mutationBlockedReason) || null,
      sellerCandidateActions: normalizeStringArray(fulfillment?.sellerCandidateActions),
      readOnlyActions: normalizeStringArray(fulfillment?.readOnlyActions),
      adminOnlyActions: normalizeStringArray(fulfillment?.adminOnlyActions),
      availableActions: Array.isArray(fulfillment?.availableActions)
        ? fulfillment.availableActions.map(normalizeFulfillmentAction).filter(Boolean)
        : [],
      auditRequired: Boolean(fulfillment?.auditRequired),
      parentOrderMutationAllowed: Boolean(fulfillment?.parentOrderMutationAllowed),
    },
  };
};

const normalizePaymentSummary = (summary: any) => {
  const source = asObject(summary);
  if (!source) return null;
  return {
    ...source,
    id: asNumber(source.id, 0),
    internalReference: normalizeText(source.internalReference) || null,
    paymentChannel: normalizeText(source.paymentChannel) || null,
    paymentType: normalizeText(source.paymentType) || null,
    status: normalizePaymentRecordStatus(source.status ?? source.statusMeta?.code),
    statusMeta: normalizeStatusMeta(source.statusMeta),
    amount: asNumber(source.amount, 0),
    expiresAt: source.expiresAt || null,
    paidAt: source.paidAt || null,
    proof: normalizeProof(source.proof),
  };
};

const normalizeContract = (contract: any) => {
  const source = asObject(contract);
  if (!source) return null;
  return {
    ...source,
    orderStatus: normalizeText(source.orderStatus) || null,
    orderStatusMeta: normalizeStatusMeta(source.orderStatusMeta),
    paymentStatus: normalizeText(source.paymentStatus) || null,
    paymentStatusMeta: normalizeStatusMeta(source.paymentStatusMeta),
    parentOrderStatus: normalizeText(source.parentOrderStatus) || null,
    parentOrderStatusMeta: normalizeStatusMeta(source.parentOrderStatusMeta),
    parentPaymentStatus: normalizeText(source.parentPaymentStatus) || null,
    parentPaymentStatusMeta: normalizeStatusMeta(source.parentPaymentStatusMeta),
    statusSummary: normalizeStatusMeta(source.statusSummary),
    paymentActionability:
      source.paymentActionability && typeof source.paymentActionability === "object"
        ? {
            ...source.paymentActionability,
            code: normalizeText(source.paymentActionability.code) || null,
            label: normalizeText(source.paymentActionability.label) || null,
            tone: normalizeText(source.paymentActionability.tone) || "stone",
            ctaLabel: normalizeText(source.paymentActionability.ctaLabel) || null,
            canPay: Boolean(source.paymentActionability.canPay),
            visible: Boolean(source.paymentActionability.visible),
            isFinal: Boolean(source.paymentActionability.isFinal),
            reason: normalizeText(source.paymentActionability.reason) || null,
          }
        : null,
    fulfillmentReadiness: normalizeStatusMeta(source.fulfillmentReadiness),
    availableActions: Array.isArray(source.availableActions)
      ? source.availableActions.map(normalizeFulfillmentAction).filter(Boolean)
      : [],
  };
};

const normalizeBuyer = (buyer: any) => {
  const source = asObject(buyer);
  return {
    userId: asNumber(source?.userId, 0) || null,
    name: normalizeText(source?.name) || "Customer",
    email: normalizeText(source?.email) || null,
    phone: normalizeText(source?.phone) || null,
  };
};

const normalizeOrderSummary = (order: any, fallback: any = {}, contract: any = null) => {
  const source = asObject(order) || {};
  const status = normalizeOrderStatus(source.status ?? fallback?.status);
  const paymentStatus = normalizeSuborderPaymentStatus(
    source.paymentStatus ?? fallback?.paymentStatus
  );
  const checkoutMode =
    normalizeText(source.checkoutMode ?? fallback?.checkoutMode)
      .toUpperCase()
      .trim() || "LEGACY";

  return {
    ...source,
    id: asNumber(source.id ?? fallback?.id, 0) || null,
    orderNumber: normalizeText(source.orderNumber ?? fallback?.orderNumber) || null,
    checkoutMode,
    checkoutModeMeta: normalizeCheckoutModeMeta(source.checkoutModeMeta, checkoutMode),
    status,
    statusMeta:
      normalizeStatusMeta(source.statusMeta) ?? normalizeStatusMeta(contract?.parentOrderStatusMeta),
    paymentStatus,
    paymentStatusMeta:
      normalizeStatusMeta(source.paymentStatusMeta) ??
      normalizeStatusMeta(contract?.parentPaymentStatusMeta),
    createdAt: source.createdAt ?? fallback?.createdAt ?? null,
    source: normalizeText(source.source) || null,
    note: normalizeText(source.note) || null,
  };
};

const normalizeReadModelStatus = (value: unknown, fallbackMeta: unknown = null) => {
  const source = asObject(value);
  const fallback = asObject(fallbackMeta);
  if (!source && !fallback) return null;
  return {
    ...(source || fallback || {}),
    code: normalizeText(source?.code ?? fallback?.code) || null,
    label: normalizeText(source?.label ?? fallback?.label) || null,
    description: normalizeText(source?.description ?? fallback?.description) || null,
    source: normalizeText(source?.source ?? fallback?.source) || null,
    scope: normalizeText(source?.scope ?? fallback?.scope) || null,
    tone: normalizeText(source?.tone ?? fallback?.tone) || null,
    isFinal: Boolean(source?.isFinal ?? fallback?.isFinal),
  };
};

const normalizeReadModel = (readModel: any, fallback: any = {}, contract: any = null) => {
  const source = asObject(readModel);
  const fallbackOrder = fallback?.order ?? null;
  const sellerScope = asObject(source?.sellerScope);

  return {
    primaryStatus: normalizeReadModelStatus(source?.primaryStatus, contract?.orderStatusMeta),
    paymentState: normalizeReadModelStatus(source?.paymentState, contract?.paymentStatusMeta),
    parentOrder: normalizeOrderSummary(source?.parentOrder, fallbackOrder, contract),
    sellerScope: {
      entity: normalizeText(sellerScope?.entity) || "SUBORDER",
      itemCount: asNumber(sellerScope?.itemCount, asNumber(fallback?.itemCount, 0)),
      subtotalAmount: asNumber(
        sellerScope?.subtotalAmount,
        asNumber(fallback?.totals?.subtotalAmount, 0)
      ),
      shippingAmount: asNumber(
        sellerScope?.shippingAmount,
        asNumber(fallback?.totals?.shippingAmount, 0)
      ),
      serviceFeeAmount: asNumber(
        sellerScope?.serviceFeeAmount,
        asNumber(fallback?.totals?.serviceFeeAmount, 0)
      ),
      totalAmount: asNumber(
        sellerScope?.totalAmount,
        asNumber(fallback?.totalAmount ?? fallback?.totals?.totalAmount, 0)
      ),
      itemScopeLabel: normalizeText(sellerScope?.itemScopeLabel) || null,
      parentReferenceLabel: normalizeText(sellerScope?.parentReferenceLabel) || null,
    },
    operationalNote: normalizeText(source?.operationalNote) || null,
  };
};

const normalizeScope = (scope: unknown, fallbackStoreId: unknown, fallbackLabel: string) => {
  const source = asObject(scope);
  return {
    storeId: asNumber(source?.storeId ?? fallbackStoreId, 0) || null,
    relationLabel: normalizeText(source?.relationLabel) || fallbackLabel,
  };
};

const normalizeListItem = (item: any) => {
  const source = asObject(item);
  if (!source) return null;

  const contract = normalizeContract(source.contract);
  const paymentStatus = normalizeSuborderPaymentStatus(
    source.paymentStatus ?? source.paymentStatusMeta?.code ?? contract?.paymentStatus
  );
  const fulfillmentStatus = normalizeFulfillmentStatus(
    source.fulfillmentStatus ?? source.fulfillmentStatusMeta?.code ?? contract?.orderStatus
  );
  const order = normalizeOrderSummary(
    source.order,
    {
      id: source.orderId,
      orderNumber: source.orderNumber,
      checkoutMode: source.checkoutMode,
      createdAt: source.createdAt,
    },
    contract
  );
  const readModel = normalizeReadModel(
    source.readModel,
    {
      fulfillmentStatus,
      paymentStatus,
      order,
      itemCount: source.itemCount,
      totalAmount: source.totalAmount,
      totals: source.totals,
    },
    contract
  );

  return {
    ...source,
    suborderId: asNumber(source.suborderId, 0),
    suborderNumber: normalizeText(source.suborderNumber) || "-",
    orderId: order.id,
    orderNumber: order.orderNumber || "-",
    checkoutMode: order.checkoutMode,
    checkoutModeMeta: order.checkoutModeMeta,
    paymentStatus,
    paymentStatusMeta:
      normalizeStatusMeta(source.paymentStatusMeta) ?? normalizeStatusMeta(contract?.paymentStatusMeta),
    fulfillmentStatus,
    fulfillmentStatusMeta:
      normalizeStatusMeta(source.fulfillmentStatusMeta) ??
      normalizeStatusMeta(contract?.orderStatusMeta),
    totalAmount: readModel.sellerScope.totalAmount,
    itemCount: readModel.sellerScope.itemCount,
    createdAt: source.createdAt || null,
    buyer: normalizeBuyer(source.buyer),
    order,
    readModel,
    scope: normalizeScope(
      source.scope,
      source.storeId,
      "Seller suborder for the active store only."
    ),
    governance: normalizeFulfillmentGovernance(source.governance),
    paymentSummary: normalizePaymentSummary(source.paymentSummary),
    contract,
  };
};

const normalizeDetail = (detail: any) => {
  const source = asObject(detail);
  if (!source) return null;

  const contract = normalizeContract(source.contract);
  const paymentStatus = normalizeSuborderPaymentStatus(
    source.paymentStatus ?? source.paymentStatusMeta?.code ?? contract?.paymentStatus
  );
  const fulfillmentStatus = normalizeFulfillmentStatus(
    source.fulfillmentStatus ?? source.fulfillmentStatusMeta?.code ?? contract?.orderStatus
  );
  const order = normalizeOrderSummary(source.order, {}, contract);
  const readModel = normalizeReadModel(
    source.readModel,
    {
      fulfillmentStatus,
      paymentStatus,
      order,
      totals: source.totals,
    },
    contract
  );

  return {
    ...source,
    suborderId: asNumber(source.suborderId, 0),
    suborderNumber: normalizeText(source.suborderNumber) || "-",
    storeId: asNumber(source.storeId, 0),
    order,
    readModel,
    scope: normalizeScope(
      source.scope,
      source.storeId,
      "This seller detail is scoped to one store-owned suborder."
    ),
    governance: normalizeFulfillmentGovernance(source.governance),
    buyer: normalizeBuyer(source.buyer),
    shipping: {
      fullName: normalizeText(source.shipping?.fullName) || "Customer",
      phoneNumber: normalizeText(source.shipping?.phoneNumber) || null,
      addressLine: normalizeText(source.shipping?.addressLine) || null,
      markAs: normalizeText(source.shipping?.markAs) || null,
    },
    paymentStatus,
    paymentStatusMeta:
      normalizeStatusMeta(source.paymentStatusMeta) ?? normalizeStatusMeta(contract?.paymentStatusMeta),
    fulfillmentStatus,
    fulfillmentStatusMeta:
      normalizeStatusMeta(source.fulfillmentStatusMeta) ??
      normalizeStatusMeta(contract?.orderStatusMeta),
    totals: {
      subtotalAmount: readModel.sellerScope.subtotalAmount,
      shippingAmount: readModel.sellerScope.shippingAmount,
      serviceFeeAmount: readModel.sellerScope.serviceFeeAmount,
      totalAmount: readModel.sellerScope.totalAmount,
    },
    paidAt: source.paidAt || null,
    createdAt: source.createdAt || null,
    items: Array.isArray(source.items)
      ? source.items.map((item: any) => ({
          ...item,
          id: asNumber(item.id, 0),
          productId: asNumber(item.productId, 0),
          productName: normalizeText(item.productName) || `Product #${asNumber(item.productId, 0)}`,
          qty: asNumber(item.qty, 0),
          price: asNumber(item.price, 0),
          totalPrice: asNumber(item.totalPrice, 0),
        }))
      : [],
    paymentSummary: normalizePaymentSummary(source.paymentSummary),
    contract,
    paymentProfileSummary: source.paymentProfileSummary
      ? {
          ...source.paymentProfileSummary,
          id: asNumber(source.paymentProfileSummary.id, 0),
          accountName: normalizeText(source.paymentProfileSummary.accountName) || null,
          merchantName: normalizeText(source.paymentProfileSummary.merchantName) || null,
          verificationStatus:
            normalizeText(source.paymentProfileSummary.verificationStatus).toUpperCase() ||
            "PENDING",
          isActive: Boolean(source.paymentProfileSummary.isActive),
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
