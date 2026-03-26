import { Order, Suborder } from "../models/index.js";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PAID_SUBORDER_STATUSES = new Set(["PAID"]);
const SUBORDER_FULFILLMENT_STATUSES = new Set([
  "UNFULFILLED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
const FINAL_COMPATIBLE_SUBORDER_FULFILLMENT_STATUSES = new Set(["DELIVERED"]);
const FINAL_ORDER_STATUSES = new Set(["delivered", "completed", "cancelled"]);
const ORDER_STATUS_PROGRESS_RANK: Record<string, number> = {
  pending: 1,
  paid: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  completed: 4,
  cancelled: 99,
};

const normalizeSuborderFulfillmentStatus = (value: unknown) => {
  const normalized = String(value || "UNFULFILLED").toUpperCase().trim();
  return SUBORDER_FULFILLMENT_STATUSES.has(normalized) ? normalized : "UNFULFILLED";
};

const normalizeOrderStatus = (value: unknown) => {
  const normalized = String(value || "pending").toLowerCase().trim();
  return ORDER_STATUS_PROGRESS_RANK[normalized] ? normalized : "pending";
};

export const resolveParentPaymentStatus = (suborderStatuses: string[]) => {
  const normalized = suborderStatuses
    .map((status) => String(status || "").toUpperCase().trim())
    .filter(Boolean);

  if (normalized.length === 0) return null;

  const paidCount = normalized.filter((status) => PAID_SUBORDER_STATUSES.has(status)).length;
  if (paidCount === 0) return "UNPAID" as const;
  if (paidCount === normalized.length) return "PAID" as const;
  return "PARTIALLY_PAID" as const;
};

export const resolveParentOrderFulfillmentStatus = (suborderStatuses: string[]) => {
  const normalized = suborderStatuses
    .map((status) => normalizeSuborderFulfillmentStatus(status))
    .filter(Boolean);

  if (normalized.length === 0) return null;

  const activeStatuses = normalized.filter((status) => status !== "CANCELLED");
  if (activeStatuses.length === 0) return "cancelled" as const;

  if (activeStatuses.every((status) => status === "DELIVERED")) {
    return "delivered" as const;
  }

  if (
    activeStatuses.every((status) => status === "SHIPPED" || status === "DELIVERED") &&
    activeStatuses.some((status) => status === "SHIPPED")
  ) {
    return "shipped" as const;
  }

  if (
    activeStatuses.some((status) =>
      ["PROCESSING", "SHIPPED", "DELIVERED"].includes(status)
    )
  ) {
    return "processing" as const;
  }

  return "pending" as const;
};

export const inspectParentOrderFinalizationEligibility = async (
  orderId: number,
  transaction?: any
) => {
  if (!Number.isFinite(Number(orderId)) || Number(orderId) <= 0) {
    return {
      allowed: true,
      totalSuborders: 0,
      activeSuborders: 0,
      blockingSuborders: [],
      requiredFulfillmentStatus: "DELIVERED" as const,
    };
  }

  const suborders = await Suborder.findAll({
    where: { orderId: Number(orderId) },
    attributes: ["id", "suborderNumber", "storeId", "fulfillmentStatus"],
    transaction,
  });

  if (!Array.isArray(suborders) || suborders.length === 0) {
    return {
      allowed: true,
      totalSuborders: 0,
      activeSuborders: 0,
      blockingSuborders: [],
      requiredFulfillmentStatus: "DELIVERED" as const,
    };
  }

  const activeSuborders = suborders
    .map((suborder: any) => ({
      id: toNumber(getAttr(suborder, "id"), 0),
      suborderNumber: String(getAttr(suborder, "suborderNumber") || "").trim() || null,
      storeId: toNumber(getAttr(suborder, "storeId"), 0) || null,
      fulfillmentStatus: normalizeSuborderFulfillmentStatus(
        getAttr(suborder, "fulfillmentStatus")
      ),
    }))
    .filter((suborder) => suborder.fulfillmentStatus !== "CANCELLED");

  const blockingSuborders = activeSuborders.filter(
    (suborder) =>
      !FINAL_COMPATIBLE_SUBORDER_FULFILLMENT_STATUSES.has(suborder.fulfillmentStatus)
  );

  return {
    allowed: blockingSuborders.length === 0,
    totalSuborders: suborders.length,
    activeSuborders: activeSuborders.length,
    blockingSuborders,
    requiredFulfillmentStatus: "DELIVERED" as const,
  };
};

export const recalculateParentOrderPaymentStatus = async (
  orderId: number,
  transaction?: any
) => {
  if (!Number.isFinite(Number(orderId)) || Number(orderId) <= 0) {
    return null;
  }

  const order = await Order.findByPk(orderId, {
    attributes: ["id", "paymentStatus", "status"],
    transaction,
  });
  if (!order) return null;

  const suborders = await Suborder.findAll({
    where: { orderId: Number(orderId) },
    attributes: ["id", "paymentStatus"],
    transaction,
  });

  if (!Array.isArray(suborders) || suborders.length === 0) {
    return String(getAttr(order, "paymentStatus") || "").toUpperCase().trim() || null;
  }

  const nextStatus = resolveParentPaymentStatus(
    suborders.map((suborder: any) => String(getAttr(suborder, "paymentStatus") || "UNPAID"))
  );
  if (!nextStatus) {
    return String(getAttr(order, "paymentStatus") || "").toUpperCase().trim() || null;
  }

  const currentStatus =
    String(getAttr(order, "paymentStatus") || "").toUpperCase().trim() || "UNPAID";

  if (currentStatus !== nextStatus) {
    await order.update(
      {
        paymentStatus: nextStatus,
      } as any,
      { transaction }
    );
  }

  return nextStatus;
};

export const recalculateParentOrderFulfillmentStatus = async (
  orderId: number,
  transaction?: any
) => {
  if (!Number.isFinite(Number(orderId)) || Number(orderId) <= 0) {
    return null;
  }

  const order = await Order.findByPk(orderId, {
    attributes: ["id", "invoiceNo", "status", "userId"],
    transaction,
  });
  if (!order) return null;

  const currentStatus = normalizeOrderStatus(getAttr(order, "status"));
  if (FINAL_ORDER_STATUSES.has(currentStatus)) {
    return {
      changed: false,
      previousStatus: currentStatus,
      nextStatus: currentStatus,
      userId: toNumber(getAttr(order, "userId"), 0) || null,
      invoiceNo: String(getAttr(order, "invoiceNo") || "").trim() || null,
    };
  }

  const suborders = await Suborder.findAll({
    where: { orderId: Number(orderId) },
    attributes: ["id", "fulfillmentStatus"],
    transaction,
  });

  if (!Array.isArray(suborders) || suborders.length === 0) {
    return {
      changed: false,
      previousStatus: currentStatus,
      nextStatus: currentStatus,
      userId: toNumber(getAttr(order, "userId"), 0) || null,
      invoiceNo: String(getAttr(order, "invoiceNo") || "").trim() || null,
    };
  }

  const derivedStatus = resolveParentOrderFulfillmentStatus(
    suborders.map((suborder: any) =>
      String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED")
    )
  );

  if (!derivedStatus) {
    return {
      changed: false,
      previousStatus: currentStatus,
      nextStatus: currentStatus,
      userId: toNumber(getAttr(order, "userId"), 0) || null,
      invoiceNo: String(getAttr(order, "invoiceNo") || "").trim() || null,
    };
  }

  const currentRank = ORDER_STATUS_PROGRESS_RANK[currentStatus] ?? 0;
  const derivedRank = ORDER_STATUS_PROGRESS_RANK[derivedStatus] ?? 0;
  const nextStatus = derivedRank > currentRank ? derivedStatus : currentStatus;

  if (nextStatus !== currentStatus) {
    await order.update(
      {
        status: nextStatus,
      } as any,
      { transaction }
    );
  }

  return {
    changed: nextStatus !== currentStatus,
    previousStatus: currentStatus,
    nextStatus,
    userId: toNumber(getAttr(order, "userId"), 0) || null,
    invoiceNo: String(getAttr(order, "invoiceNo") || "").trim() || null,
  };
};

export const deriveLegacyPaymentStatus = (order: any) => {
  const paymentStatus = String(getAttr(order, "paymentStatus") || "").toUpperCase().trim();
  if (paymentStatus === "PAID" || paymentStatus === "PARTIALLY_PAID") {
    return paymentStatus;
  }
  const status = String(getAttr(order, "status") || "").toLowerCase().trim();
  if (["paid", "processing", "shipped", "delivered", "completed"].includes(status)) {
    return "PAID";
  }
  const totalAmount = toNumber(getAttr(order, "totalAmount"), 0);
  if (totalAmount <= 0) return "UNPAID";
  return "UNPAID";
};
