import { Order, OrderItem, Payment, PaymentProof, PaymentStatusLog, Shipment, Suborder, SuborderItem, TrackingEvent } from "../models/index.js";

const ALLOWED_ORDER_DELETE_STATUSES = new Set(["pending", "cancelled"]);
const BLOCKED_ORDER_PAYMENT_STATUSES = new Set(["PARTIALLY_PAID", "PAID"]);
const ALLOWED_SUBORDER_PAYMENT_STATUSES = new Set([
  "UNPAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);
const ALLOWED_SUBORDER_FULFILLMENT_STATUSES = new Set(["UNFULFILLED", "CANCELLED"]);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toLower = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toLowerCase();

const toUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const createOrderDeleteError = (code: string, message: string, statusCode = 409, data?: any) =>
  Object.assign(new Error(message), { code, statusCode, data });

export const loadOrderDeletionSnapshot = async (orderId: number, transaction?: any) => {
  const order = await Order.findByPk(orderId, {
    attributes: ["id", "invoiceNo", "status", "paymentStatus", "userId"],
    transaction,
  });

  if (!order) {
    throw createOrderDeleteError("ORDER_NOT_FOUND", "Order not found.", 404);
  }

  const suborders = await Suborder.findAll({
    where: { orderId },
    attributes: ["id", "orderId", "storeId", "suborderNumber", "paymentStatus", "fulfillmentStatus"],
    order: [["id", "ASC"]],
    transaction,
  });

  return { order, suborders };
};

export const assertAdminOrderDeletionAllowed = async (orderId: number, transaction?: any) => {
  const snapshot = await loadOrderDeletionSnapshot(orderId, transaction);
  const orderStatus = toLower(snapshot.order.get("status"), "pending");
  const orderPaymentStatus = toUpper(snapshot.order.get("paymentStatus"), "UNPAID");

  if (!ALLOWED_ORDER_DELETE_STATUSES.has(orderStatus)) {
    throw createOrderDeleteError(
      "ORDER_DELETE_STATUS_BLOCKED",
      "Only pending or cancelled orders can be deleted.",
      409,
      {
        orderId,
        orderStatus,
      }
    );
  }

  if (BLOCKED_ORDER_PAYMENT_STATUSES.has(orderPaymentStatus)) {
    throw createOrderDeleteError(
      "ORDER_DELETE_PAYMENT_BLOCKED",
      "Paid or partially paid orders cannot be deleted.",
      409,
      {
        orderId,
        orderPaymentStatus,
      }
    );
  }

  const blockingSuborder = snapshot.suborders.find((suborder) => {
    const paymentStatus = toUpper(suborder.get("paymentStatus"), "UNPAID");
    const fulfillmentStatus = toUpper(suborder.get("fulfillmentStatus"), "UNFULFILLED");
    return (
      !ALLOWED_SUBORDER_PAYMENT_STATUSES.has(paymentStatus) ||
      !ALLOWED_SUBORDER_FULFILLMENT_STATUSES.has(fulfillmentStatus)
    );
  });

  if (blockingSuborder) {
    throw createOrderDeleteError(
      "ORDER_DELETE_SUBORDER_BLOCKED",
      "This order still has store splits with active payment or fulfillment progress.",
      409,
      {
        orderId,
        suborderId: toNumber(blockingSuborder.get("id"), 0) || null,
        paymentStatus: toUpper(blockingSuborder.get("paymentStatus"), "UNPAID"),
        fulfillmentStatus: toUpper(blockingSuborder.get("fulfillmentStatus"), "UNFULFILLED"),
      }
    );
  }

  return snapshot;
};

export const assertSellerBulkOrderDeletionAllowed = async (input: {
  storeId: number;
  suborderIds: number[];
  transaction?: any;
}) => {
  const normalizedSuborderIds = Array.from(
    new Set((Array.isArray(input.suborderIds) ? input.suborderIds : []).map((value) => toNumber(value, 0)).filter((value) => value > 0))
  );

  if (normalizedSuborderIds.length === 0) {
    throw createOrderDeleteError("INVALID_SUBORDER_IDS", "Select at least one seller order.", 400);
  }

  const selectedSuborders = await Suborder.findAll({
    where: { id: normalizedSuborderIds, storeId: input.storeId },
    attributes: ["id", "orderId", "storeId"],
    transaction: input.transaction,
  });

  if (selectedSuborders.length !== normalizedSuborderIds.length) {
    throw createOrderDeleteError(
      "SUBORDER_NOT_FOUND",
      "One or more selected seller orders were not found for this store.",
      404
    );
  }

  const selectedIdSet = new Set(normalizedSuborderIds);
  const orderIds = Array.from(
    new Set(selectedSuborders.map((suborder) => toNumber(suborder.get("orderId"), 0)).filter((value) => value > 0))
  );
  const deletableOrders: Array<{ orderId: number; invoiceNo: string | null }> = [];

  for (const orderId of orderIds) {
    const snapshot = await assertAdminOrderDeletionAllowed(orderId, input.transaction);
    const orderSuborders = snapshot.suborders.map((suborder) => ({
      id: toNumber(suborder.get("id"), 0),
      storeId: toNumber(suborder.get("storeId"), 0),
    }));

    if (orderSuborders.some((suborder) => suborder.storeId !== input.storeId)) {
      throw createOrderDeleteError(
        "SELLER_ORDER_DELETE_CROSS_STORE_BLOCKED",
        "Seller delete is only allowed when the full order belongs to the active store.",
        409,
        {
          orderId,
        }
      );
    }

    if (orderSuborders.some((suborder) => !selectedIdSet.has(suborder.id))) {
      throw createOrderDeleteError(
        "SELLER_ORDER_DELETE_PARTIAL_SELECTION",
        "Select every seller row for the same order before deleting it.",
        409,
        {
          orderId,
        }
      );
    }

    deletableOrders.push({
      orderId,
      invoiceNo: String(snapshot.order.get("invoiceNo") || "").trim() || null,
    });
  }

  return deletableOrders;
};

export const deleteOrderCascade = async (orderId: number, transaction?: any) => {
  const suborders = await Suborder.findAll({
    where: { orderId },
    attributes: ["id"],
    transaction,
  });

  const suborderIds = suborders
    .map((suborder) => toNumber(suborder.get("id"), 0))
    .filter((value) => value > 0);

  if (suborderIds.length > 0) {
    const payments = await Payment.findAll({
      where: { suborderId: suborderIds },
      attributes: ["id"],
      transaction,
    });
    const paymentIds = payments
      .map((payment) => toNumber(payment.get("id"), 0))
      .filter((value) => value > 0);

    const shipments = await Shipment.findAll({
      where: { orderId },
      attributes: ["id"],
      transaction,
    });
    const shipmentIds = shipments
      .map((shipment) => toNumber(shipment.get("id"), 0))
      .filter((value) => value > 0);

    if (shipmentIds.length > 0) {
      await TrackingEvent.destroy({ where: { shipmentId: shipmentIds }, transaction });
    }

    await Shipment.destroy({ where: { orderId }, transaction });

    if (paymentIds.length > 0) {
      await PaymentProof.destroy({ where: { paymentId: paymentIds }, transaction });
      await PaymentStatusLog.destroy({ where: { paymentId: paymentIds }, transaction });
      await Payment.destroy({ where: { id: paymentIds }, transaction });
    }

    await SuborderItem.destroy({ where: { suborderId: suborderIds }, transaction });
    await Suborder.destroy({ where: { id: suborderIds }, transaction });
  }

  await OrderItem.destroy({ where: { orderId }, transaction });
  await Order.destroy({ where: { id: orderId }, transaction });
};
