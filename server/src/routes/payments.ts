import { Router } from "express";
import { z } from "zod";
import requireAuth from "../middleware/requireAuth.js";
import {
  Order,
  Payment,
  PaymentProof,
  PaymentStatusLog,
  Store,
  StorePaymentProfile,
  Suborder,
  User,
  sequelize,
} from "../models/index.js";
import { recalculateParentOrderPaymentStatus } from "../services/orderPaymentAggregation.service.js";
import { expirePaymentIfNeeded } from "../services/paymentExpiry.service.js";
import { appendPaymentStatusLog } from "../services/paymentStatusLog.service.js";
import {
  buildBuyerCancelActionability,
  buildBuyerProofActionability,
  resolveBuyerFacingPaymentStatus,
} from "../services/paymentCheckoutView.service.js";

const router = Router();

const proofPayloadSchema = z.object({
  proofImageUrl: z.string().trim().min(5).max(2_000_000),
  senderName: z.string().trim().min(2).max(160),
  senderBankOrWallet: z.string().trim().min(2).max(160),
  transferAmount: z.number().positive(),
  transferTime: z.string().datetime({ offset: true }),
  note: z.string().trim().max(2_000).optional().nullable(),
});

const getAuthUser = (req: any) => {
  const userId = Number(req?.user?.id);
  return {
    id: Number.isFinite(userId) ? userId : null,
    role: String(req?.user?.role || "").toLowerCase().trim(),
  };
};

const isAdminRole = (role: string) =>
  role === "admin" || role === "super_admin" || role === "staff";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProofSummary = (proofs: any[]) => {
  if (!Array.isArray(proofs) || proofs.length === 0) return null;
  const latest = [...proofs]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      if (rightTime !== leftTime) return rightTime - leftTime;
      return toNumber(getAttr(right, "id")) - toNumber(getAttr(left, "id"));
    })[0];
  return {
    id: toNumber(getAttr(latest, "id")),
    proofImageUrl: String(getAttr(latest, "proofImageUrl") || ""),
    senderName: String(getAttr(latest, "senderName") || ""),
    senderBankOrWallet: String(getAttr(latest, "senderBankOrWallet") || ""),
    transferAmount: toNumber(getAttr(latest, "transferAmount")),
    transferTime: getAttr(latest, "transferTime") || null,
    note: getAttr(latest, "note") ? String(getAttr(latest, "note")) : null,
    reviewNote: getAttr(latest, "reviewNote") ? String(getAttr(latest, "reviewNote")) : null,
    reviewStatus: String(getAttr(latest, "reviewStatus") || "PENDING"),
    uploadedByUserId: toNumber(getAttr(latest, "uploadedByUserId"), 0) || null,
    reviewedByUserId: toNumber(getAttr(latest, "reviewedByUserId"), 0) || null,
    reviewedAt: getAttr(latest, "reviewedAt") || null,
    createdAt: getAttr(latest, "createdAt") || null,
  };
};

const serializePaymentStatusLogs = (logs: any[]) => {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  return [...logs]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      return leftTime - rightTime;
    })
    .map((log) => {
      const actorUser = log?.actorUser ?? log?.get?.("actorUser") ?? null;
      return {
        id: toNumber(getAttr(log, "id")),
        oldStatus: getAttr(log, "oldStatus") ? String(getAttr(log, "oldStatus")) : null,
        newStatus: String(getAttr(log, "newStatus") || ""),
        actorType: String(getAttr(log, "actorType") || "SYSTEM"),
        actorId: toNumber(getAttr(log, "actorId"), 0) || null,
        actorName: getAttr(actorUser, "name") ? String(getAttr(actorUser, "name")) : null,
        note: getAttr(log, "note") ? String(getAttr(log, "note")) : null,
        createdAt: getAttr(log, "createdAt") || null,
      };
    });
};

const serializePaymentDetail = (payment: any) => {
  const suborder = payment?.suborder ?? payment?.get?.("suborder") ?? null;
  const store = payment?.store ?? payment?.get?.("store") ?? suborder?.store ?? null;
  const paymentProfile =
    payment?.paymentProfile ?? payment?.get?.("paymentProfile") ?? suborder?.paymentProfile ?? null;
  const proofs = payment?.proofs ?? payment?.get?.("proofs") ?? [];
  const proof = normalizeProofSummary(proofs);
  const displayStatus = resolveBuyerFacingPaymentStatus({
    paymentStatus: getAttr(payment, "status") || "CREATED",
    suborderPaymentStatus: getAttr(suborder, "paymentStatus") || "UNPAID",
    expiresAt: getAttr(payment, "expiresAt") || null,
  });
  return {
    paymentId: toNumber(getAttr(payment, "id")),
    suborderId: toNumber(getAttr(payment, "suborderId")),
    orderId: toNumber(getAttr(suborder?.order, "id"), 0) || null,
    orderRef: getAttr(suborder?.order, "invoiceNo")
      ? String(getAttr(suborder?.order, "invoiceNo"))
      : null,
    storeId: toNumber(getAttr(payment, "storeId")),
    storeName: String(getAttr(store, "name") || `Store #${getAttr(payment, "storeId")}`),
    amount: toNumber(getAttr(payment, "amount")),
    paymentChannel: String(getAttr(payment, "paymentChannel") || "QRIS"),
    paymentType: String(getAttr(payment, "paymentType") || "QRIS_STATIC"),
    status: String(getAttr(payment, "status") || "CREATED"),
    qrImageUrl: getAttr(payment, "qrImageUrl") ? String(getAttr(payment, "qrImageUrl")) : null,
    qrPayload: getAttr(payment, "qrPayload") ? String(getAttr(payment, "qrPayload")) : null,
    instructionText: getAttr(paymentProfile, "instructionText")
      ? String(getAttr(paymentProfile, "instructionText"))
      : null,
    merchantName: getAttr(paymentProfile, "merchantName")
      ? String(getAttr(paymentProfile, "merchantName"))
      : null,
    accountName: getAttr(paymentProfile, "accountName")
      ? String(getAttr(paymentProfile, "accountName"))
      : null,
    internalReference: String(getAttr(payment, "internalReference") || ""),
    displayStatus,
    expiresAt: getAttr(payment, "expiresAt") || null,
    paidAt: getAttr(payment, "paidAt") || null,
    proofSubmitted: Array.isArray(proofs) && proofs.length > 0,
    proof,
    proofActionability: buildBuyerProofActionability(displayStatus),
    cancelability: buildBuyerCancelActionability(displayStatus),
    logs: serializePaymentStatusLogs(payment?.statusLogs ?? payment?.get?.("statusLogs") ?? []),
  };
};

const loadPaymentForActor = async (paymentId: number) =>
  Payment.findByPk(paymentId, {
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "name", "slug", "status", "ownerUserId"],
      },
      {
        model: StorePaymentProfile,
        as: "paymentProfile",
        attributes: [
          "id",
          "storeId",
          "providerCode",
          "paymentType",
          "verificationStatus",
          "instructionText",
          "merchantName",
          "accountName",
        ],
      },
      {
        model: PaymentProof,
        as: "proofs",
        attributes: [
          "id",
          "paymentId",
          "uploadedByUserId",
          "proofImageUrl",
          "senderName",
          "senderBankOrWallet",
          "transferAmount",
          "transferTime",
          "note",
          "reviewNote",
          "reviewStatus",
          "reviewedByUserId",
          "reviewedAt",
          "createdAt",
        ],
      },
      {
        model: PaymentStatusLog,
        as: "statusLogs",
        attributes: ["id", "paymentId", "oldStatus", "newStatus", "actorType", "actorId", "note", "createdAt"],
        required: false,
        include: [
          {
            model: User,
            as: "actorUser",
            attributes: ["id", "name", "email"],
            required: false,
          },
        ],
      },
      {
        model: Suborder,
        as: "suborder",
        attributes: ["id", "orderId", "storeId", "paymentStatus"],
        include: [
          {
            model: Order,
            as: "order",
            attributes: ["id", "invoiceNo", "userId", "paymentStatus", "status"],
          },
          {
            model: Store,
            as: "store",
            attributes: ["id", "name", "slug", "status"],
          },
        ],
      },
    ],
  });

router.use(requireAuth);

router.get("/:paymentId", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const paymentId = Number(req.params.paymentId);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payment id." });
    }

    const payment = await loadPaymentForActor(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const suborder = (payment as any)?.suborder ?? payment?.get?.("suborder") ?? null;
    const ownerUserId = Number(getAttr(suborder?.order, "userId") || 0);
    const paymentStore = (payment as any)?.store ?? payment?.get?.("store") ?? null;
    const storeOwnerUserId = Number(getAttr(paymentStore, "ownerUserId") || 0);
    const canAccess =
      ownerUserId === authUser.id ||
      storeOwnerUserId === authUser.id ||
      isAdminRole(authUser.role);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this payment.",
      });
    }

    const expired = await expirePaymentIfNeeded(paymentId);
    const resolvedPayment = expired ? await loadPaymentForActor(paymentId) : payment;

    return res.json({
      success: true,
      data: serializePaymentDetail(resolvedPayment),
    });
  } catch (error) {
    console.error("[payments/detail] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load payment detail.",
    });
  }
});

router.post("/:paymentId/proof", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const paymentId = Number(req.params.paymentId);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payment id." });
    }

    const parsed = proofPayloadSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid proof payload.",
        errors: parsed.error.flatten(),
      });
    }

    const payment = await loadPaymentForActor(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const suborder = (payment as any)?.suborder ?? payment?.get?.("suborder") ?? null;
    const ownerUserId = Number(getAttr(suborder?.order, "userId") || 0);
    if (ownerUserId !== authUser.id) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to submit proof for this payment.",
      });
    }

    const expired = await expirePaymentIfNeeded(paymentId);
    const paymentForSubmit = expired ? await loadPaymentForActor(paymentId) : payment;
    if (!paymentForSubmit) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }
    const currentStatus = String(getAttr(paymentForSubmit, "status") || "CREATED").toUpperCase();
    if (currentStatus === "EXPIRED") {
      return res.status(409).json({
        success: false,
        message: "Payment deadline has expired. Create a new order if you still want to pay this store.",
      });
    }
    const canSubmitProof = currentStatus === "CREATED" || currentStatus === "REJECTED";
    if (!canSubmitProof) {
      return res.status(409).json({
        success: false,
        message:
          "Payment proof can only be submitted while payment is waiting for first proof or after a rejected proof.",
      });
    }

    const tx = await sequelize.transaction();
    try {
      await PaymentProof.create(
        {
          paymentId,
          uploadedByUserId: authUser.id,
          proofImageUrl: parsed.data.proofImageUrl,
          senderName: parsed.data.senderName,
          senderBankOrWallet: parsed.data.senderBankOrWallet,
          transferAmount: parsed.data.transferAmount,
          transferTime: new Date(parsed.data.transferTime),
          note: parsed.data.note || null,
          reviewStatus: "PENDING",
          reviewedByUserId: null,
          reviewedAt: null,
        } as any,
        { transaction: tx }
      );

      await paymentForSubmit.update(
        {
          status: "PENDING_CONFIRMATION",
        } as any,
        { transaction: tx }
      );

      const suborder =
        (paymentForSubmit as any)?.suborder ?? paymentForSubmit?.get?.("suborder") ?? null;
      if (suborder) {
        await suborder.update(
          {
            paymentStatus: "PENDING_CONFIRMATION",
          } as any,
          { transaction: tx }
        );
        const orderId = Number(getAttr(suborder, "orderId") || 0);
        if (orderId > 0) {
          await recalculateParentOrderPaymentStatus(orderId, tx);
        }
      }

      await appendPaymentStatusLog(
        {
          paymentId,
          oldStatus: currentStatus,
          newStatus: "PENDING_CONFIRMATION",
          actorType: "BUYER",
          actorId: authUser.id,
          note: `Proof submitted by ${parsed.data.senderName} for ${parsed.data.transferAmount}.`,
        },
        tx
      );

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    const refreshed = await loadPaymentForActor(paymentId);
    return res.status(201).json({
      success: true,
      data: serializePaymentDetail(refreshed),
    });
  } catch (error) {
    console.error("[payments/proof] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit payment proof.",
    });
  }
});

router.post("/:paymentId/cancel", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const paymentId = Number(req.params.paymentId);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payment id." });
    }

    const payment = await loadPaymentForActor(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const suborder = (payment as any)?.suborder ?? payment?.get?.("suborder") ?? null;
    const ownerUserId = Number(getAttr(suborder?.order, "userId") || 0);
    if (ownerUserId !== authUser.id) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to cancel this payment.",
      });
    }

    const expired = await expirePaymentIfNeeded(paymentId);
    const paymentForCancel = expired ? await loadPaymentForActor(paymentId) : payment;
    if (!paymentForCancel) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const activeSuborder =
      (paymentForCancel as any)?.suborder ?? paymentForCancel?.get?.("suborder") ?? null;
    const displayStatus = resolveBuyerFacingPaymentStatus({
      paymentStatus: getAttr(paymentForCancel, "status") || "CREATED",
      suborderPaymentStatus: getAttr(activeSuborder, "paymentStatus") || "UNPAID",
      expiresAt: getAttr(paymentForCancel, "expiresAt") || null,
    });
    const cancelability = buildBuyerCancelActionability(displayStatus);
    if (!cancelability.canCancel) {
      return res.status(409).json({
        success: false,
        code: "PAYMENT_CANCEL_NOT_ALLOWED",
        message: cancelability.reason || "This payment can no longer be cancelled.",
      });
    }

    const currentStatus = String(getAttr(paymentForCancel, "status") || "CREATED").toUpperCase();
    const orderId = Number(getAttr(activeSuborder, "orderId") || 0);
    const tx = await sequelize.transaction();
    try {
      await paymentForCancel.update(
        {
          status: "FAILED",
          paidAt: null,
        } as any,
        { transaction: tx }
      );

      if (activeSuborder) {
        await activeSuborder.update(
          {
            paymentStatus: "CANCELLED",
            paidAt: null,
          } as any,
          { transaction: tx }
        );
      }

      await appendPaymentStatusLog(
        {
          paymentId,
          oldStatus: currentStatus,
          newStatus: "CANCELLED",
          actorType: "BUYER",
          actorId: authUser.id,
          note: "Buyer cancelled this payment before final confirmation.",
        },
        tx
      );

      if (orderId > 0) {
        await recalculateParentOrderPaymentStatus(orderId, tx);
      }

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    const refreshed = await loadPaymentForActor(paymentId);
    return res.json({
      success: true,
      message: "Transaction cancelled successfully.",
      data: serializePaymentDetail(refreshed),
    });
  } catch (error) {
    console.error("[payments/cancel] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel payment transaction.",
    });
  }
});

export default router;
