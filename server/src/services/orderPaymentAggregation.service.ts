import { Order, Suborder } from "../models/index.js";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PAID_SUBORDER_STATUSES = new Set(["PAID"]);

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
