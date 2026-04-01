import { Router } from "express";
import { Op } from "sequelize";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { OrderItem } from "../models/OrderItem.js";
import { Product } from "../models/Product.js";
import { Payment } from "../models/Payment.js";
import { Suborder } from "../models/Suborder.js";
import { createUserOrderStatusUpdatedNotification } from "../services/notification.service.js";
import {
  inspectParentOrderFinalizationEligibility,
  resolveParentOrderFulfillmentStatus,
  resolveParentPaymentStatus,
} from "../services/orderPaymentAggregation.service.js";
import { resolveBuyerFacingPaymentStatus } from "../services/paymentCheckoutView.service.js";
import {
  buildAction,
  buildAdminOrderContract,
  buildPaymentStatusMeta,
} from "../services/orderLifecycleContract.service.js";

const router = Router();
type UiOrderStatus = "pending" | "processing" | "shipping" | "complete" | "cancelled";
type DbOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
type CanonicalMethod = "cash" | "card" | "credit";

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ??
  row?.get?.(key) ??
  row?.dataValues?.[key] ??
  undefined;
const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};
const csvRow = (values: unknown[]) => values.map((value) => csvEscape(value)).join(",");

const normalizeStatusInput = (raw: unknown): DbOrderStatus | "" => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "";
  if (value === "shipping") return "shipped";
  if (value === "complete") return "delivered";
  if (value === "completed") return "delivered";
  if (value === "pending") return "pending";
  if (value === "processing") return "processing";
  if (value === "shipped") return "shipped";
  if (value === "delivered") return "delivered";
  if (value === "cancelled") return "cancelled";
  if (value === "cancel" || value === "canceled") return "cancelled";
  return "";
};

const toUiStatus = (raw: unknown) => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "pending";
  if (["pending_payment", "awaiting_payment", "unpaid"].includes(value)) {
    return "pending";
  }
  if (["processing", "process", "packed", "confirmed", "paid"].includes(value)) {
    return "processing";
  }
  if (["shipped", "shipping", "in_transit"].includes(value)) return "shipping";
  if (["delivered", "completed", "complete"].includes(value)) return "complete";
  if (["cancelled", "canceled", "cancel", "refunded", "failed"].includes(value)) {
    return "cancelled";
  }
  return "pending";
};

const toAdminActionStatus = (raw: unknown) => {
  const status = toUiStatus(raw);
  if (status === "shipping") return "shipping";
  if (status === "complete") return "delivered";
  if (status === "cancelled") return "cancel";
  return status;
};

const normalizeSuborderPaymentStatus = (raw: unknown) => {
  const value = String(raw || "UNPAID").toUpperCase().trim();
  return value || "UNPAID";
};

const normalizeSuborderFulfillmentStatus = (raw: unknown) => {
  const value = String(raw || "UNFULFILLED").toUpperCase().trim();
  return value || "UNFULFILLED";
};

const STARTED_FULFILLMENT_STATUSES = new Set(["PROCESSING", "SHIPPED", "DELIVERED"]);
const SHIPPED_COMPATIBLE_FULFILLMENT_STATUSES = new Set(["SHIPPED", "DELIVERED"]);
const CLOSED_NEGATIVE_PAYMENT_STATUSES = new Set(["FAILED", "CANCELLED", "EXPIRED"]);
const ADMIN_ACTION_OPTIONS = [
  { code: "pending", label: "Pending", normalizedStatus: "pending" as DbOrderStatus },
  { code: "processing", label: "Processing", normalizedStatus: "processing" as DbOrderStatus },
  { code: "shipping", label: "In Delivery", normalizedStatus: "shipped" as DbOrderStatus },
  { code: "delivered", label: "Delivered", normalizedStatus: "delivered" as DbOrderStatus },
  { code: "cancel", label: "Cancelled", normalizedStatus: "cancelled" as DbOrderStatus },
];

const loadAdminOrderTransitionSnapshot = async (orderId: number) => {
  const suborders = await Suborder.findAll({
    where: { orderId },
    attributes: ["id", "suborderNumber", "storeId", "paymentStatus", "fulfillmentStatus"],
  });

  const normalized = suborders.map((suborder: any) => ({
    id: Number(getAttr(suborder, "id") || 0),
    suborderNumber: String(getAttr(suborder, "suborderNumber") || "").trim() || null,
    storeId: Number(getAttr(suborder, "storeId") || 0) || null,
    paymentStatus: normalizeSuborderPaymentStatus(getAttr(suborder, "paymentStatus")),
    fulfillmentStatus: normalizeSuborderFulfillmentStatus(getAttr(suborder, "fulfillmentStatus")),
  }));

  const activeSuborders = normalized.filter(
    (suborder) => suborder.fulfillmentStatus !== "CANCELLED"
  );

  return {
    totalSuborders: normalized.length,
    allSuborders: normalized,
    activeSuborders,
    aggregatePaymentStatus: resolveParentPaymentStatus(
      activeSuborders.map((suborder) => suborder.paymentStatus)
    ),
    aggregateFulfillmentStatus: resolveParentOrderFulfillmentStatus(
      activeSuborders.map((suborder) => suborder.fulfillmentStatus)
    ),
  };
};

const loadAdminOrderLifecycleReadContext = async (orderId: number) => {
  const suborders = await Suborder.findAll({
    where: { orderId },
    attributes: ["id", "paymentStatus", "fulfillmentStatus"],
    include: [
      {
        model: Payment,
        as: "payments",
        attributes: ["id", "status", "expiresAt", "updatedAt"],
        required: false,
      } as any,
    ],
    order: [["id", "ASC"]],
  });

  const displayStatuses = suborders.map((suborder: any) => {
    const payment = Array.isArray(suborder?.payments)
      ? [...suborder.payments].sort((left: any, right: any) => {
          const leftTime = new Date(getAttr(left, "updatedAt") || 0).getTime();
          const rightTime = new Date(getAttr(right, "updatedAt") || 0).getTime();
          if (rightTime !== leftTime) return rightTime - leftTime;
          return Number(getAttr(right, "id") || 0) - Number(getAttr(left, "id") || 0);
        })[0]
      : null;
    return resolveBuyerFacingPaymentStatus({
      paymentStatus: getAttr(payment, "status") || "CREATED",
      suborderPaymentStatus: getAttr(suborder, "paymentStatus") || "UNPAID",
      expiresAt: getAttr(payment, "expiresAt") || null,
    });
  });

  const fulfillmentStatuses = suborders.map((suborder: any) =>
    normalizeSuborderFulfillmentStatus(getAttr(suborder, "fulfillmentStatus"))
  );

  return {
    displayStatuses,
    fulfillmentStatuses,
  };
};

const getStaticAdminActionDisabledReason = (
  currentStatus: string,
  paymentStatus: string,
  actionCode: string
) => {
  if (actionCode === currentStatus) {
    return "Order is already in this status.";
  }

  if (currentStatus === "cancel") {
    return actionCode === "cancel"
      ? "Order is already in this status."
      : "Order is already cancelled and cannot return to the active fulfillment flow.";
  }

  if (currentStatus === "delivered") {
    if (actionCode === "delivered") return "Order is already in this status.";
    if (actionCode === "cancel") {
      return "Order is already delivered and is now in a final operational state, so cancellation is no longer allowed.";
    }
    return "Order is already delivered, so earlier operational statuses are no longer relevant.";
  }

  if (
    CLOSED_NEGATIVE_PAYMENT_STATUSES.has(paymentStatus) &&
    ["processing", "shipping", "delivered"].includes(actionCode)
  ) {
    return `Parent payment is already ${paymentStatus.toLowerCase()}, so operational fulfillment cannot move forward from this snapshot.`;
  }

  return null;
};

const buildAdminTransitionActions = async (input: {
  orderId: number;
  currentStatus: string;
  paymentStatus: string;
}) => {
  const actions = [];

  for (const option of ADMIN_ACTION_OPTIONS) {
    const staticReason = getStaticAdminActionDisabledReason(
      input.currentStatus,
      input.paymentStatus,
      option.code
    );
    let reason = staticReason;

    if (!reason && (option.normalizedStatus === "processing" || option.normalizedStatus === "shipped")) {
      const eligibility = await inspectAdminOrderTransitionEligibility(
        input.orderId,
        option.normalizedStatus
      );
      if (!eligibility.allowed) {
        reason = eligibility.message || "This order cannot move to the requested status yet.";
      }
    }

    if (!reason && option.normalizedStatus === "delivered") {
      const precheck = await inspectAdminOrderTransitionEligibility(input.orderId, "delivered");
      if (!precheck.allowed) {
        reason = precheck.message || "This order cannot be finalized yet.";
      } else {
        const finalization = await inspectParentOrderFinalizationEligibility(input.orderId);
        if (!finalization.allowed) {
          reason = "This order cannot be finalized yet.";
        }
      }
    }

    actions.push(
      buildAction({
        code: option.code,
        label: option.label,
        enabled: !reason,
        reason,
        tone: !reason ? "emerald" : "stone",
        nextStatus: option.normalizedStatus,
        scope: "ADMIN_ORDER_STATUS",
      })
    );
  }

  return actions;
};

const buildAdminContractForOrder = async (input: {
  orderId: number;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod?: string | null;
}) => {
  const lifecycleContext = await loadAdminOrderLifecycleReadContext(input.orderId);
  const currentActionStatus = toAdminActionStatus(input.orderStatus);
  const availableActions = await buildAdminTransitionActions({
    orderId: input.orderId,
    currentStatus: currentActionStatus,
    paymentStatus: input.paymentStatus,
  });

  return buildAdminOrderContract({
    orderStatus: input.orderStatus,
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
    displayStatuses: lifecycleContext.displayStatuses,
    fulfillmentStatuses: lifecycleContext.fulfillmentStatuses,
    availableActions,
  });
};

const inspectAdminOrderTransitionEligibility = async (
  orderId: number,
  targetStatus: DbOrderStatus
) => {
  const snapshot = await loadAdminOrderTransitionSnapshot(orderId);
  const baseData = {
    targetStatus,
    totalSuborders: snapshot.totalSuborders,
    activeSuborders: snapshot.activeSuborders.length,
    aggregatePaymentStatus: snapshot.aggregatePaymentStatus,
    aggregateFulfillmentStatus: snapshot.aggregateFulfillmentStatus,
  };

  if (snapshot.totalSuborders === 0) {
    return {
      allowed: true,
      code: null,
      message: null,
      data: {
        ...baseData,
        reason: "LEGACY_ORDER_WITHOUT_SUBORDERS",
        blockingSuborders: [],
      },
    };
  }

  if (snapshot.activeSuborders.length === 0) {
    return {
      allowed: false,
      code: "PARENT_ORDER_HAS_NO_ACTIVE_SUBORDERS",
      message:
        "Cannot move parent order forward because every linked suborder is already cancelled.",
      data: {
        ...baseData,
        reason: "NO_ACTIVE_SUBORDERS",
        blockingSuborders: [],
      },
    };
  }

  if (targetStatus === "processing") {
    const hasStartedFulfillment = snapshot.activeSuborders.some((suborder) =>
      STARTED_FULFILLMENT_STATUSES.has(suborder.fulfillmentStatus)
    );
    const hasFullySettledPayment = snapshot.aggregatePaymentStatus === "PAID";

    if (hasStartedFulfillment || hasFullySettledPayment) {
      return {
        allowed: true,
        code: null,
        message: null,
        data: {
          ...baseData,
          reason: hasStartedFulfillment
            ? "SUBORDER_FULFILLMENT_ALREADY_STARTED"
            : "ALL_ACTIVE_SUBORDERS_PAID",
          blockingSuborders: [],
        },
      };
    }

    const blockingSuborders = snapshot.activeSuborders.filter(
      (suborder) =>
        suborder.paymentStatus !== "PAID" &&
        !STARTED_FULFILLMENT_STATUSES.has(suborder.fulfillmentStatus)
    );

    return {
      allowed: false,
      code: "PARENT_PROCESSING_BLOCKED_BY_SUBORDER_STATE",
      message:
        "Cannot move parent order to processing while active suborders are still unpaid or not yet started by the seller.",
      data: {
        ...baseData,
        reason: "ACTIVE_SUBORDERS_NOT_READY_FOR_PROCESSING",
        blockingSuborders,
      },
    };
  }

  if (targetStatus === "shipped") {
    const blockingSuborders = snapshot.activeSuborders.filter(
      (suborder) =>
        !SHIPPED_COMPATIBLE_FULFILLMENT_STATUSES.has(suborder.fulfillmentStatus)
    );

    if (blockingSuborders.length === 0) {
      return {
        allowed: true,
        code: null,
        message: null,
        data: {
          ...baseData,
          reason: "ALL_ACTIVE_SUBORDERS_SHIPPED_OR_DELIVERED",
          blockingSuborders: [],
        },
      };
    }

    return {
      allowed: false,
      code: "PARENT_SHIPPING_BLOCKED_BY_SUBORDER_FULFILLMENT",
      message:
        "Cannot move parent order to shipped while active suborders are still unfulfilled or processing.",
      data: {
        ...baseData,
        reason: "ACTIVE_SUBORDERS_NOT_READY_FOR_SHIPPING",
        blockingSuborders,
      },
    };
  }

  return {
    allowed: true,
    code: null,
    message: null,
    data: {
      ...baseData,
      reason: "NO_EXTRA_GUARD_REQUIRED",
      blockingSuborders: [],
    },
  };
};

const methodPatternMap: Record<CanonicalMethod, string[]> = {
  cash: ["cod", "cash"],
  card: ["card", "debit", "credit card", "credit_card", "visa", "master"],
  credit: ["credit", "paylater", "installment"],
};

const normalizeMethodInput = (raw: unknown): CanonicalMethod | "" => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "";
  if (value === "cash" || value === "cod") return "cash";
  if (value === "card") return "card";
  if (value === "credit") return "credit";
  return "";
};

const normalizeMethodOutput = (raw: unknown): CanonicalMethod => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "cash";
  if (value.includes("qris")) return "card";
  if (value.includes("cod") || value.includes("cash")) return "cash";
  if (value.includes("credit card") || value.includes("credit_card")) return "card";
  if (value.includes("card") || value.includes("debit") || value.includes("visa")) {
    return "card";
  }
  if (
    value.includes("credit") ||
    value.includes("paylater") ||
    value.includes("installment")
  ) {
    return "credit";
  }
  return "cash";
};

const toMethodLabel = (method: CanonicalMethod) => {
  if (method === "card") return "Card";
  if (method === "credit") return "Credit";
  return "Cash";
};

const allowedStatuses: string[] = [
  "pending",
  "processing",
  "shipping",
  "complete",
  "delivered",
  "cancelled",
  "cancel",
];
const isUiOrderStatus = (value: string) => allowedStatuses.includes(value);

const parseDateAtBoundary = (raw: unknown, endOfDay: boolean): Date | null => {
  const value = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

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

const parseLimitDays = (raw: unknown) => {
  const parsed = Number(raw);
  if (![5, 7, 15, 30].includes(parsed)) return 0;
  return parsed;
};

const buildOrdersWhere = (filters: {
  search: string;
  status: DbOrderStatus | "";
  method: CanonicalMethod | "";
  limitDays: number;
  startDate: Date | null;
  endDate: Date | null;
  userId: number | null;
}) => {
  const where: any = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.search) {
    const likeSearch = `%${filters.search}%`;
    where[Op.or] = [
      { invoiceNo: { [Op.like]: likeSearch } },
      { customerName: { [Op.like]: likeSearch } },
      { customerPhone: { [Op.like]: likeSearch } },
      { "$customer.name$": { [Op.like]: likeSearch } },
    ];
  }

  if (filters.status) {
    where.status = filters.status as string;
  }

  if (filters.method) {
    const patterns = methodPatternMap[filters.method] || [];
    if (patterns.length > 0) {
      const methodWhere = {
        [Op.or]: patterns.map((pattern) => ({
          paymentMethod: { [Op.like]: `%${pattern}%` },
        })),
      };
      where[Op.and] = [...(where[Op.and] || []), methodWhere];
    }
  }

  // Rule: explicit startDate/endDate overrides limitDays.
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt[Op.gte] = filters.startDate;
    if (filters.endDate) where.createdAt[Op.lte] = filters.endDate;
  } else if (filters.limitDays > 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - filters.limitDays);
    where.createdAt = { [Op.gte]: start };
  }

  return where;
};

const parseOrdersQuery = (query: any) => {
  const page = parsePositiveInt(asSingle(query.page), 1, 1, 1_000_000);
  const pageSize = parsePositiveInt(
    asSingle(query.pageSize) ?? asSingle(query.limit),
    10,
    1,
    100
  );

  const search = String(asSingle(query.search) ?? asSingle(query.q) ?? "").trim();
  const status = normalizeStatusInput(asSingle(query.status));
  const method = normalizeMethodInput(asSingle(query.method));
  const limitDays = parseLimitDays(asSingle(query.limitDays));
  const startDate = parseDateAtBoundary(asSingle(query.startDate), false);
  const endDate = parseDateAtBoundary(asSingle(query.endDate), true);
  const userIdRaw = Number(asSingle(query.userId));
  const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;

  const where = buildOrdersWhere({
    search,
    status,
    method,
    limitDays,
    startDate,
    endDate,
    userId,
  });

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    where,
    filters: {
      search,
      status,
      method,
      limitDays,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      dateSource: startDate || endDate ? "dateRange" : limitDays > 0 ? "limitDays" : "none",
    },
  };
};

const resolveOrderWhere = (idOrRef: string) => {
  const trimmed = String(idOrRef || "").trim();
  const isNumeric = /^\d+$/.test(trimmed);
  if (isNumeric) {
    return { id: Number(trimmed) };
  }
  return { invoiceNo: trimmed };
};

const orderDetailInclude: any[] = [
  { model: User, as: "customer", attributes: ["name", "email"] },
  {
    model: OrderItem,
    as: "items",
    attributes: ["id", "quantity", "price", ["product_id", "productId"]],
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["id", "name"],
      },
    ],
  },
];

const toOrderDetailPayload = (orderItem: any) => {
  const items = ((orderItem as any).items ?? []).map((item: any) => ({
    id: getAttr(item, "id"),
    productId:
      getAttr(item, "productId") ?? item.get?.("productId") ?? item.product_id,
    quantity: getAttr(item, "quantity"),
    price: Number(getAttr(item, "price") || 0),
    lineTotal:
      Number(getAttr(item, "price") || 0) *
      Number(getAttr(item, "quantity") || 0),
    product: item.product
      ? {
          id: getAttr(item.product, "id"),
          name: getAttr(item.product, "name"),
        }
      : null,
  }));

  const customer = (orderItem as any).customer ?? null;

  const computedSubtotal = items.reduce((sum: number, item: any) => {
    return sum + Number(item.lineTotal || 0);
  }, 0);
  const subtotalSnapshot = Number(getAttr(orderItem, "subtotalAmount"));
  const shippingSnapshot = Number(
    getAttr(orderItem, "shippingAmount") ?? getAttr(orderItem, "shippingCost") ?? 0
  );
  const serviceFeeAmount = Number(getAttr(orderItem, "serviceFeeAmount") || 0);
  const discount = Number(getAttr(orderItem, "discountAmount") || 0);
  const subtotal = Number.isFinite(subtotalSnapshot) ? subtotalSnapshot : computedSubtotal;
  const shipping = Number.isFinite(shippingSnapshot) ? shippingSnapshot : 0;
  const totalSnapshot = Number(getAttr(orderItem, "totalAmount"));
  const totalAmount = Number.isFinite(totalSnapshot)
    ? totalSnapshot
    : Math.max(0, subtotal + shipping + serviceFeeAmount - discount);

  return {
    id: getAttr(orderItem, "id"),
    ref: getAttr(orderItem, "invoiceNo") ?? String(getAttr(orderItem, "id") ?? ""),
    invoiceNo: getAttr(orderItem, "invoiceNo"),
    checkoutMode:
      String(getAttr(orderItem, "checkoutMode") || "").toUpperCase().trim() || "LEGACY",
    rawStatus: String(getAttr(orderItem, "status") || "pending"),
    status: toUiStatus(getAttr(orderItem, "status")),
    paymentStatus:
      String(getAttr(orderItem, "paymentStatus") || "").toUpperCase().trim() || "UNPAID",
    paymentStatusMeta: buildPaymentStatusMeta(
      String(getAttr(orderItem, "paymentStatus") || "").toUpperCase().trim() || "UNPAID"
    ),
    totalAmount,
    subtotal,
    subtotalAmount: subtotal,
    discount,
    shipping,
    shippingCost: shipping,
    serviceFeeAmount,
    total: totalAmount,
    grandTotal: totalAmount,
    createdAt: getAttr(orderItem, "createdAt"),
    updatedAt: getAttr(orderItem, "updatedAt"),
    customerName: getAttr(orderItem, "customerName") ?? customer?.name ?? null,
    customerPhone: getAttr(orderItem, "customerPhone") ?? null,
    customerAddress: getAttr(orderItem, "customerAddress") ?? null,
    customerNotes: getAttr(orderItem, "customerNotes") ?? null,
    paymentMethod: getAttr(orderItem, "paymentMethod") ?? "COD",
    method: getAttr(orderItem, "paymentMethod") ?? "COD",
    items,
  };
};

// GET list with pagination, search, status/method/date filters.
router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const parsed = parseOrdersQuery(req.query || {});
    const { page, pageSize, offset, where } = parsed;

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "customer",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      attributes: [
        "id",
        "invoiceNo",
        "checkoutMode",
        "status",
        "paymentStatus",
        "createdAt",
        "totalAmount",
        "customerName",
        "customerPhone",
        "paymentMethod",
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
      distinct: true,
      col: "id",
    });

    const items = await Promise.all(
      rows.map(async (orderRow: any) => {
        const customer =
          orderRow?.customer ??
          orderRow?.get?.("customer") ??
          orderRow?.dataValues?.customer ??
          null;
        const id = Number(getAttr(orderRow, "id") || 0);
        const invoiceNo = getAttr(orderRow, "invoiceNo");
        const amount = Number(
          getAttr(orderRow, "totalAmount") ??
            getAttr(orderRow, "total") ??
            getAttr(orderRow, "grandTotal") ??
            0
        );
        const methodRaw = getAttr(orderRow, "paymentMethod") ?? "COD";
        const method = normalizeMethodOutput(methodRaw);
        const customerName =
          getAttr(orderRow, "customerName") ??
          getAttr(orderRow, "shippingName") ??
          customer?.name ??
          "Guest";
        const rawOrderStatus = String(getAttr(orderRow, "status") || "pending");
        const paymentStatus =
          String(getAttr(orderRow, "paymentStatus") || "").toUpperCase().trim() || "UNPAID";
        const contract = await buildAdminContractForOrder({
          orderId: id,
          orderStatus: rawOrderStatus,
          paymentStatus,
          paymentMethod: String(methodRaw || "COD"),
        });

        return {
          id,
          ref: invoiceNo ?? String(id ?? ""),
          orderId: id,
          invoiceNo,
          checkoutMode:
            String(getAttr(orderRow, "checkoutMode") || "").toUpperCase().trim() || "LEGACY",
          orderTime: getAttr(orderRow, "createdAt"),
          createdAt: getAttr(orderRow, "createdAt"),
          customerName,
          customerPhone:
            getAttr(orderRow, "customerPhone") ??
            getAttr(orderRow, "shippingPhone") ??
            customer?.phone ??
            null,
          method,
          paymentMethod: method,
          amount,
          totalAmount: amount,
          rawStatus: rawOrderStatus,
          status: toUiStatus(rawOrderStatus),
          paymentStatus,
          paymentStatusMeta: buildPaymentStatusMeta(paymentStatus),
          contract,
        };
      })
    );

    const totalPages = Math.max(1, Math.ceil(count / pageSize));

    return res.json({
      success: true,
      data: {
        items,
        total: count,
        page,
        pageSize,
        totalPages,
        // Backward compatibility for existing admin client consumers.
        limit: pageSize,
        totalItems: count,
        filters: parsed.filters,
      },
    });
  } catch (error) {
    console.error("[admin.orders list] error", error);
    return res.status(500).json({ message: "Failed to load orders." });
  }
});

const exportOrdersCsv = async (req: any, res: any) => {
  try {
    const parsed = parseOrdersQuery(req.query || {});
    const rows = await Order.findAll({
      where: parsed.where,
      attributes: [
        "id",
        "invoiceNo",
        "checkoutMode",
        "status",
        "paymentStatus",
        "createdAt",
        "totalAmount",
        "customerName",
        "paymentMethod",
      ],
      include: [
        {
          model: User,
          as: "customer",
          attributes: ["name", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const header = csvRow([
      "Invoice No",
      "Order Time",
      "Customer Name",
      "Method",
      "Amount",
      "Status",
    ]);

    const lines = rows.map((orderRow: any) => {
      const customer =
        orderRow?.customer ??
        orderRow?.get?.("customer") ??
        orderRow?.dataValues?.customer ??
        null;

      const invoiceNo =
        getAttr(orderRow, "invoiceNo") ?? String(getAttr(orderRow, "id") ?? "");
      const createdAt = getAttr(orderRow, "createdAt")
        ? new Date(getAttr(orderRow, "createdAt")).toISOString().replace("T", " ").slice(0, 19)
        : "";
      const customerName =
        getAttr(orderRow, "customerName") ?? customer?.name ?? customer?.email ?? "Guest";
      const method = toMethodLabel(
        normalizeMethodOutput(getAttr(orderRow, "paymentMethod") ?? "COD")
      );
      const amount = Number(getAttr(orderRow, "totalAmount") ?? 0);
      const status = toUiStatus(getAttr(orderRow, "status"));

      return csvRow([invoiceNo, createdAt, customerName, method, amount, status]);
    });

    const now = new Date();
    const stampDate = now.toISOString().slice(0, 10).replace(/-/g, "");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const filename = `orders-${stampDate}-${hh}${mm}.csv`;
    const csv = [header, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("[admin.orders export] error", error);
    return res.status(500).json({ message: "Failed to export orders." });
  }
};

router.get("/export", requireStaffOrAdmin, exportOrdersCsv);
router.get("/export.csv", requireStaffOrAdmin, exportOrdersCsv);

const findOrderDetail = async (lookup: string, preferInvoiceLookup = false) => {
  if (!lookup) return null;
  if (!preferInvoiceLookup) {
    return Order.findOne({
      where: resolveOrderWhere(lookup),
      include: orderDetailInclude,
    });
  }

  let orderItem = await Order.findOne({
    where: { invoiceNo: lookup },
    include: orderDetailInclude,
  });
  if (!orderItem && /^\d+$/.test(lookup)) {
    // Backward-compat fallback for legacy numeric links.
    orderItem = await Order.findOne({
      where: { id: Number(lookup) },
      include: orderDetailInclude,
    });
  }
  return orderItem;
};

const sendOrderDetail = async (res: any, lookup: string, preferInvoiceLookup = false) => {
  const orderItem = await findOrderDetail(lookup, preferInvoiceLookup);
  if (!orderItem) {
    return res.status(404).json({ message: "Not found" });
  }
  const payload = toOrderDetailPayload(orderItem);
  const contract = await buildAdminContractForOrder({
    orderId: Number(payload.id || 0),
    orderStatus: payload.rawStatus || payload.status || "pending",
    paymentStatus: payload.paymentStatus || "UNPAID",
    paymentMethod: String(payload.paymentMethod || payload.method || "COD"),
  });
  return res.json({
    success: true,
    data: {
      ...payload,
      contract,
    },
  });
};

router.get("/by-invoice/:invoiceNo", requireStaffOrAdmin, async (req, res) => {
  const invoiceNo = String(asSingle(req.params.invoiceNo) ?? "").trim();
  if (!invoiceNo) {
    return res.status(400).json({ message: "Invalid invoice no" });
  }
  return sendOrderDetail(res, invoiceNo, true);
});

router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  const idStr = String(asSingle(req.params.id) ?? "").trim();
  if (!idStr) {
    return res.status(400).json({ message: "Invalid id" });
  }
  return sendOrderDetail(res, idStr, false);
});

router.patch("/:id/status", requireStaffOrAdmin, async (req, res) => {
  const idStr = String(asSingle(req.params.id) ?? "");
  if (!idStr) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const rawStatus = String(req.body?.status ?? "").toLowerCase().trim();
  if (!rawStatus || !isUiOrderStatus(rawStatus)) {
    return res.status(400).json({
      message: `Status tidak valid. Gunakan salah satu dari: ${allowedStatuses.join(
        ", "
      )}`,
    });
  }

  const normalizedStatus = normalizeStatusInput(rawStatus);
  if (!normalizedStatus) {
    return res.status(400).json({
      message: `Status tidak valid. Gunakan salah satu dari: ${allowedStatuses.join(
        ", "
      )}`,
    });
  }
  const existingOrder = await Order.findOne({
    where: resolveOrderWhere(idStr),
    attributes: ["id", "status", "invoiceNo", "userId"],
  });

  if (!existingOrder) {
    return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  }

  const previousStatus = toUiStatus(getAttr(existingOrder, "status"));

  if (normalizedStatus === "cancelled" && previousStatus === "complete") {
    return res.status(409).json({
      success: false,
      code: "PARENT_ORDER_FINALIZED",
      message:
        "Parent order is already in a final delivered state, so it cannot be cancelled.",
      data: {
        currentStatus: previousStatus,
        targetStatus: "cancelled",
      },
    });
  }

  if (normalizedStatus === "processing" || normalizedStatus === "shipped") {
    const transitionCheck = await inspectAdminOrderTransitionEligibility(
      Number(getAttr(existingOrder, "id")),
      normalizedStatus
    );

    if (!transitionCheck.allowed) {
      return res.status(409).json({
        success: false,
        code: transitionCheck.code,
        message: transitionCheck.message,
        data: transitionCheck.data,
      });
    }
  }

  if (normalizedStatus === "delivered") {
    const precheck = await inspectAdminOrderTransitionEligibility(
      Number(getAttr(existingOrder, "id")),
      normalizedStatus
    );
    if (!precheck.allowed) {
      return res.status(409).json({
        success: false,
        code: precheck.code,
        message: precheck.message,
        data: precheck.data,
      });
    }

    const finalizationCheck = await inspectParentOrderFinalizationEligibility(
      Number(getAttr(existingOrder, "id"))
    );

    if (!finalizationCheck.allowed) {
      const blockingStatuses = Array.from(
        new Set(
          finalizationCheck.blockingSuborders.map((suborder: any) => suborder.fulfillmentStatus)
        )
      );
      const blockingCount = finalizationCheck.blockingSuborders.length;
      const suborderLabel = blockingCount === 1 ? "suborder" : "suborders";
      const verb = blockingCount === 1 ? "is" : "are";
      const statusSummary = blockingStatuses.length > 0 ? blockingStatuses.join(", ") : "UNKNOWN";

      return res.status(409).json({
        success: false,
        code: "PARENT_FINALIZATION_BLOCKED_BY_SUBORDER_FULFILLMENT",
        message: `Cannot finalize parent order while ${blockingCount} active ${suborderLabel} ${verb} still not delivered (${statusSummary}).`,
        data: finalizationCheck,
      });
    }
  }

  const [updatedRows] = await Order.update(
    { status: normalizedStatus, updatedAt: new Date() },
    { where: resolveOrderWhere(idStr) }
  );

  if (updatedRows === 0) {
    return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  }

  const updatedOrder = await Order.findOne({
    where: resolveOrderWhere(idStr),
    attributes: [
      "id",
      "invoiceNo",
      "status",
      "paymentStatus",
      "paymentMethod",
      "totalAmount",
      "createdAt",
      "updatedAt",
      "userId",
    ],
  });
  const updatedPaymentStatus =
    String(getAttr(updatedOrder, "paymentStatus") || "").toUpperCase().trim() || "UNPAID";
  const updatedContract = await buildAdminContractForOrder({
    orderId: Number(getAttr(updatedOrder, "id") || 0),
    orderStatus: String(getAttr(updatedOrder, "status") || "pending"),
    paymentStatus: updatedPaymentStatus,
    paymentMethod: String(getAttr(updatedOrder, "paymentMethod") || "COD"),
  });

  try {
    const userId = Number(getAttr(updatedOrder, "userId"));
    if (Number.isFinite(userId) && userId > 0) {
      await createUserOrderStatusUpdatedNotification({
        userId,
        orderId: Number(getAttr(updatedOrder, "id") || 0),
        invoiceNo: String(getAttr(updatedOrder, "invoiceNo") || ""),
        statusFrom: previousStatus,
        statusTo: toUiStatus(getAttr(updatedOrder, "status")),
      });
    }
  } catch (notifyError) {
    console.warn("[admin.orders] failed to create user status notification", notifyError);
  }

  return res.json({
    success: true,
    message: `Status pesanan berhasil diperbarui menjadi ${rawStatus}.`,
    data: {
      id: getAttr(updatedOrder, "id"),
      invoiceNo: getAttr(updatedOrder, "invoiceNo"),
      status: toUiStatus(getAttr(updatedOrder, "status")),
      rawStatus: String(getAttr(updatedOrder, "status") || "pending"),
      paymentStatus: updatedPaymentStatus,
      paymentStatusMeta: buildPaymentStatusMeta(updatedPaymentStatus),
      totalAmount: Number(getAttr(updatedOrder, "totalAmount") || 0),
      createdAt: getAttr(updatedOrder, "createdAt"),
      updatedAt: getAttr(updatedOrder, "updatedAt"),
      contract: updatedContract,
    },
  });
});

// Other CRUD endpoints for Orders can be added here following the same pattern as Customers

export default router;
