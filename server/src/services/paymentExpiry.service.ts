import { Op } from "sequelize";
import { Order, Payment, Suborder, sequelize } from "../models/index.js";
import { recalculateParentOrderPaymentStatus } from "./orderPaymentAggregation.service.js";
import { appendPaymentStatusLog } from "./paymentStatusLog.service.js";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const expirePaymentRow = async (payment: any, transaction: any) => {
  const currentStatus = String(getAttr(payment, "status") || "").trim().toUpperCase();
  if (currentStatus !== "CREATED") {
    return false;
  }

  const paymentId = toNumber(getAttr(payment, "id"), 0);
  const suborderId = toNumber(getAttr(payment, "suborderId"), 0);
  const suborder =
    payment?.suborder ?? payment?.get?.("suborder") ?? (suborderId > 0
      ? await Suborder.findByPk(suborderId, {
          attributes: ["id", "orderId", "paymentStatus"],
          transaction,
        })
      : null);

  await payment.update(
    {
      status: "EXPIRED",
      paidAt: null,
    } as any,
    { transaction }
  );

  if (suborder) {
    const nextSuborderPaymentStatus = String(getAttr(suborder, "paymentStatus") || "UNPAID")
      .trim()
      .toUpperCase();
    if (nextSuborderPaymentStatus !== "PAID") {
      await suborder.update(
        {
          paymentStatus: "EXPIRED",
          paidAt: null,
        } as any,
        { transaction }
      );
    }
  }

  await appendPaymentStatusLog(
    {
      paymentId,
      oldStatus: currentStatus,
      newStatus: "EXPIRED",
      actorType: "SYSTEM",
      actorId: null,
      note: "Payment deadline expired before buyer confirmation was submitted.",
    },
    transaction
  );

  const orderId = toNumber(getAttr(suborder, "orderId"), 0);
  if (orderId > 0) {
    await recalculateParentOrderPaymentStatus(orderId, transaction);
  }

  return true;
};

export const expirePaymentIfNeeded = async (paymentId: number) => {
  if (!Number.isFinite(Number(paymentId)) || Number(paymentId) <= 0) {
    return false;
  }

  const tx = await sequelize.transaction();
  try {
    const now = new Date();
    const payment = await Payment.findOne({
      where: {
        id: Number(paymentId),
        status: "CREATED",
        expiresAt: {
          [Op.lte]: now,
        },
      } as any,
      attributes: ["id", "suborderId", "status", "expiresAt", "paidAt"],
      include: [
        {
          model: Suborder,
          as: "suborder",
          attributes: ["id", "orderId", "paymentStatus", "paidAt"],
        },
      ],
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!payment) {
      await tx.rollback();
      return false;
    }

    const changed = await expirePaymentRow(payment, tx);
    await tx.commit();
    return changed;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const expireOverduePaymentsForOrder = async (orderId: number) => {
  if (!Number.isFinite(Number(orderId)) || Number(orderId) <= 0) {
    return false;
  }

  const tx = await sequelize.transaction();
  try {
    const now = new Date();
    const payments = await Payment.findAll({
      where: {
        status: "CREATED",
        expiresAt: {
          [Op.lte]: now,
        },
      } as any,
      attributes: ["id", "suborderId", "status", "expiresAt", "paidAt"],
      include: [
        {
          model: Suborder,
          as: "suborder",
          attributes: ["id", "orderId", "paymentStatus", "paidAt"],
          where: { orderId: Number(orderId) },
          required: true,
        },
      ],
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    let changed = false;
    for (const payment of payments) {
      const expired = await expirePaymentRow(payment, tx);
      changed = changed || expired;
    }

    if (changed) {
      const order = await Order.findByPk(Number(orderId), {
        attributes: ["id", "status", "paymentStatus"],
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });
      if (order) {
        const orderStatus = String(getAttr(order, "status") || "pending").toLowerCase().trim();
        const orderPaymentStatus = String(getAttr(order, "paymentStatus") || "UNPAID")
          .toUpperCase()
          .trim();
        if (orderStatus === "processing" && orderPaymentStatus !== "PAID") {
          await order.update(
            {
              status: "pending",
            } as any,
            { transaction: tx }
          );
        }
      }
    }

    await tx.commit();
    return changed;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};
