import { Op } from "sequelize";
import { Router } from "express";
import { z } from "zod";
import requireAuth from "../middleware/requireAuth.js";
import {
  Order,
  Payment,
  PaymentProof,
  Store,
  Suborder,
  SuborderItem,
  User,
  sequelize,
} from "../models/index.js";
import { recalculateParentOrderPaymentStatus } from "../services/orderPaymentAggregation.service.js";
import { appendPaymentStatusLog } from "../services/paymentStatusLog.service.js";
import { SELLER_ROLE_CODES } from "../services/seller/permissionMap.js";
import {
  listSellerAccessContexts,
  resolveSellerAccess,
  sellerHasPermission,
} from "../services/seller/resolveSellerAccess.js";

const router = Router();

const reviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(2_000).optional().nullable(),
});

const ALLOWED_PAYMENT_FILTERS = new Set([
  "PENDING_CONFIRMATION",
  "PAID",
  "REJECTED",
  "UNPAID",
]);
const LEGACY_PAYMENT_REVIEW_REQUIRED_PERMISSIONS = [
  "ORDER_VIEW",
  "PAYMENT_STATUS_VIEW",
] as const;

const getAuthUser = (req: any) => {
  const userId = Number(req?.user?.id);
  return {
    id: Number.isFinite(userId) ? userId : null,
    role: String(req?.user?.role || "").toLowerCase().trim(),
  };
};

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidPositiveInt = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0;

const sendSellerAccessError = (
  res: any,
  payload: {
    status: number;
    code: string;
    message: string;
    extras?: Record<string, unknown>;
  }
) =>
  res.status(payload.status).json({
    success: false,
    code: payload.code,
    message: payload.message,
    ...(payload.extras || {}),
  });

const canAccessLegacySellerPaymentReview = (access: any) => {
  const hasRequiredPermissions = LEGACY_PAYMENT_REVIEW_REQUIRED_PERMISSIONS.every((permission) =>
    sellerHasPermission(access, permission)
  );

  if (!hasRequiredPermissions) return false;
  return (
    Boolean(access?.isOwner) || String(access?.roleCode || "") === SELLER_ROLE_CODES.STORE_ADMIN
  );
};

const resolveLegacySellerPaymentReviewAccess = async (input: {
  userId: number | null;
  requestedStoreId?: unknown;
}) => {
  const userId = Number(input.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return {
      ok: false as const,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    };
  }

  if (input.requestedStoreId !== undefined && input.requestedStoreId !== null && input.requestedStoreId !== "") {
    const requestedStoreId = Number(input.requestedStoreId);
    if (!Number.isInteger(requestedStoreId) || requestedStoreId <= 0) {
      return {
        ok: false as const,
        status: 400,
        code: "INVALID_STORE_ID",
        message: "Invalid store id.",
      };
    }

    const accessResult = await resolveSellerAccess({
      storeId: requestedStoreId,
      userId,
    });
    if (!accessResult.ok) {
      return accessResult;
    }

    if (!canAccessLegacySellerPaymentReview(accessResult.data)) {
      return {
        ok: false as const,
        status: 403,
        code: "SELLER_PAYMENT_REVIEW_FORBIDDEN",
        message: "You do not have permission to access seller payment review for this store.",
      };
    }

    return {
      ok: true as const,
      data: accessResult.data,
    };
  }

  const accessContexts = await listSellerAccessContexts({
    userId,
    requiredPermissions: [...LEGACY_PAYMENT_REVIEW_REQUIRED_PERMISSIONS],
  });
  const eligibleAccessContexts = accessContexts.filter(canAccessLegacySellerPaymentReview);

  if (eligibleAccessContexts.length === 0) {
    return {
      ok: false as const,
      status: 403,
      code: "SELLER_PAYMENT_REVIEW_FORBIDDEN",
      message: "You do not have permission to access seller payment review.",
    };
  }

  const ownerAccess = eligibleAccessContexts.find((access) => access.isOwner);
  if (ownerAccess) {
    return {
      ok: true as const,
      data: ownerAccess,
    };
  }

  if (eligibleAccessContexts.length === 1) {
    return {
      ok: true as const,
      data: eligibleAccessContexts[0],
    };
  }

  return {
    ok: false as const,
    status: 409,
    code: "SELLER_STORE_SCOPE_REQUIRED",
    message:
      "Multiple seller stores are available for this account. Select one store scope before opening this legacy payment review route.",
    extras: {
      stores: eligibleAccessContexts.map((access) => ({
        id: Number(access.store?.id || access.storeId || 0) || null,
        name: String(access.store?.name || ""),
        slug: String(access.store?.slug || ""),
        roleCode: String(access.roleCode || ""),
        isOwner: Boolean(access.isOwner),
      })),
    },
  };
};

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
    proofImageUrl: String(getAttr(latest, "proofImageUrl") || ""),
    senderName: String(getAttr(latest, "senderName") || ""),
    senderBankOrWallet: String(getAttr(latest, "senderBankOrWallet") || ""),
    transferAmount: toNumber(getAttr(latest, "transferAmount")),
    transferTime: getAttr(latest, "transferTime") || null,
    note: getAttr(latest, "note") ? String(getAttr(latest, "note")) : null,
    reviewNote: getAttr(latest, "reviewNote") ? String(getAttr(latest, "reviewNote")) : null,
    reviewStatus: String(getAttr(latest, "reviewStatus") || "PENDING"),
    reviewedByUserId: toNumber(getAttr(latest, "reviewedByUserId"), 0) || null,
    reviewedAt: getAttr(latest, "reviewedAt") || null,
    uploadedByUserId: toNumber(getAttr(latest, "uploadedByUserId"), 0) || null,
    createdAt: getAttr(latest, "createdAt") || null,
  };
};

const normalizeStatuses = (rawStatus: any) => {
  const values = Array.isArray(rawStatus) ? rawStatus : [rawStatus];
  const normalized = values
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim().toUpperCase())
    .filter((value) => ALLOWED_PAYMENT_FILTERS.has(value));
  return normalized.length > 0 ? normalized : ["PENDING_CONFIRMATION"];
};

const sellerListInclude = [
  {
    model: Store,
    as: "store",
    attributes: ["id", "ownerUserId", "name", "slug", "status"],
  },
  {
    model: Order,
    as: "order",
    attributes: [
      "id",
      "invoiceNo",
      "userId",
      "customerName",
      "customerPhone",
      "customerAddress",
      "paymentStatus",
      "status",
      "createdAt",
    ],
    include: [
      {
        model: User,
        as: "customer",
        attributes: ["id", "name", "email", "role"],
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
      "priceSnapshot",
      "qty",
      "totalPrice",
    ],
  },
  {
    model: Payment,
    as: "payments",
    attributes: [
      "id",
      "suborderId",
      "storeId",
      "paymentChannel",
      "paymentType",
      "internalReference",
      "amount",
      "status",
      "qrImageUrl",
      "expiresAt",
      "paidAt",
      "createdAt",
    ],
    include: [
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
        required: false,
      },
    ],
  },
];

const serializeSellerSuborder = (suborder: any) => {
  const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
  const payment = payments[0] ?? null;
  const proof = normalizeProofSummary(payment?.proofs ?? []);
  const buyer = suborder?.order?.customer ?? suborder?.order?.get?.("customer") ?? null;
  return {
    suborderId: toNumber(getAttr(suborder, "id")),
    suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
    orderId: toNumber(getAttr(suborder?.order, "id")),
    orderNumber: String(getAttr(suborder?.order, "invoiceNo") || ""),
    storeId: toNumber(getAttr(suborder, "storeId")),
    storeName: String(getAttr(suborder?.store, "name") || `Store #${getAttr(suborder, "storeId")}`),
    paymentStatus: String(getAttr(suborder, "paymentStatus") || "UNPAID"),
    fulfillmentStatus: String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED"),
    totalAmount: toNumber(getAttr(suborder, "totalAmount")),
    paidAt: getAttr(suborder, "paidAt") || null,
    createdAt: getAttr(suborder, "createdAt") || null,
    buyer: {
      userId: toNumber(getAttr(suborder?.order, "userId"), 0) || null,
      name: String(
        getAttr(buyer, "name") || getAttr(suborder?.order, "customerName") || "Customer"
      ),
      email: getAttr(buyer, "email") ? String(getAttr(buyer, "email")) : null,
      phone: getAttr(suborder?.order, "customerPhone")
        ? String(getAttr(suborder?.order, "customerPhone"))
        : null,
    },
    items: (Array.isArray(suborder?.items) ? suborder.items : []).map((item: any) => ({
      id: toNumber(getAttr(item, "id")),
      productId: toNumber(getAttr(item, "productId")),
      productName: String(getAttr(item, "productNameSnapshot") || `Product #${getAttr(item, "productId")}`),
      qty: toNumber(getAttr(item, "qty")),
      price: toNumber(getAttr(item, "priceSnapshot")),
      totalPrice: toNumber(getAttr(item, "totalPrice")),
    })),
    payment: payment
      ? {
          id: toNumber(getAttr(payment, "id")),
          internalReference: String(getAttr(payment, "internalReference") || ""),
          paymentChannel: String(getAttr(payment, "paymentChannel") || "QRIS"),
          paymentType: String(getAttr(payment, "paymentType") || "QRIS_STATIC"),
          amount: toNumber(getAttr(payment, "amount")),
          status: String(getAttr(payment, "status") || "CREATED"),
          qrImageUrl: getAttr(payment, "qrImageUrl") ? String(getAttr(payment, "qrImageUrl")) : null,
          expiresAt: getAttr(payment, "expiresAt") || null,
          paidAt: getAttr(payment, "paidAt") || null,
          proofSubmitted: Boolean(proof),
          proof,
        }
      : null,
  };
};

const loadSellerPayment = async (paymentId: number) =>
  Payment.findByPk(paymentId, {
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "ownerUserId", "name", "slug", "status"],
      },
      {
        model: Suborder,
        as: "suborder",
        attributes: [
          "id",
          "orderId",
          "suborderNumber",
          "storeId",
          "totalAmount",
          "paymentStatus",
          "fulfillmentStatus",
          "paidAt",
          "createdAt",
        ],
        include: sellerListInclude.filter((entry) => (entry as any).as !== "store"),
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
        required: false,
      },
    ],
  });

router.use(requireAuth);

router.get("/suborders", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return sendSellerAccessError(res, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      });
    }

    const accessResult = await resolveLegacySellerPaymentReviewAccess({
      userId: authUser.id,
      requestedStoreId: req.query.storeId,
    });
    if (!accessResult.ok) {
      return sendSellerAccessError(res, accessResult);
    }

    const statuses = normalizeStatuses(req.query.paymentStatus);
    const scopedStoreId = Number(accessResult.data.store.id);
    const items = await Suborder.findAll({
      where: {
        storeId: scopedStoreId,
        paymentStatus: { [Op.in]: statuses },
      },
      attributes: [
        "id",
        "orderId",
        "suborderNumber",
        "storeId",
        "totalAmount",
        "paymentStatus",
        "fulfillmentStatus",
        "paidAt",
        "createdAt",
      ],
      include: sellerListInclude,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      data: {
        store: {
          id: toNumber(accessResult.data.store.id),
          name: String(accessResult.data.store.name || ""),
          slug: String(accessResult.data.store.slug || ""),
          status: String(accessResult.data.store.status || "ACTIVE"),
        },
        filters: statuses,
        items: items.map(serializeSellerSuborder),
      },
    });
  } catch (error) {
    console.error("[seller/suborders] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load seller payments.",
    });
  }
});

router.patch("/payments/:paymentId/review", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return sendSellerAccessError(res, {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      });
    }

    const paymentId = Number(req.params.paymentId);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return sendSellerAccessError(res, {
        status: 400,
        code: "INVALID_PAYMENT_ID",
        message: "Invalid payment id.",
      });
    }

    const parsed = reviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_REVIEW_PAYLOAD",
        message: "Invalid review payload.",
        errors: parsed.error.flatten(),
      });
    }

    const payment = await loadSellerPayment(paymentId);
    if (!payment) {
      return sendSellerAccessError(res, {
        status: 404,
        code: "PAYMENT_NOT_FOUND",
        message: "Payment not found.",
      });
    }

    const paymentStore = (payment as any)?.store ?? payment?.get?.("store") ?? null;
    const suborder = (payment as any)?.suborder ?? payment?.get?.("suborder") ?? null;
    const paymentStoreId = toNumber(getAttr(paymentStore, "id"), 0);
    const suborderStoreId = toNumber(getAttr(suborder, "storeId"), 0);
    const scopedStoreId = suborderStoreId || paymentStoreId;

    if (!isValidPositiveInt(scopedStoreId)) {
      return sendSellerAccessError(res, {
        status: 404,
        code: "SELLER_PAYMENT_SCOPE_NOT_FOUND",
        message: "This payment is not linked to a valid seller store scope.",
      });
    }

    if (
      isValidPositiveInt(paymentStoreId) &&
      isValidPositiveInt(suborderStoreId) &&
      paymentStoreId !== suborderStoreId
    ) {
      return sendSellerAccessError(res, {
        status: 409,
        code: "SELLER_PAYMENT_SCOPE_MISMATCH",
        message: "Payment scope is inconsistent and cannot be reviewed safely.",
      });
    }

    const accessResult = await resolveSellerAccess({
      storeId: scopedStoreId,
      userId: authUser.id,
    });
    if (!accessResult.ok) {
      return sendSellerAccessError(res, accessResult);
    }

    if (!canAccessLegacySellerPaymentReview(accessResult.data)) {
      return sendSellerAccessError(res, {
        status: 403,
        code: "SELLER_PAYMENT_REVIEW_FORBIDDEN",
        message: "You do not have permission to review seller payments for this store.",
      });
    }

    const currentStatus = String(getAttr(payment, "status") || "CREATED").toUpperCase();
    if (currentStatus !== "PENDING_CONFIRMATION") {
      return sendSellerAccessError(res, {
        status: 409,
        code: "PAYMENT_REVIEW_STATUS_INVALID",
        message: "Payment review can only be processed while status is PENDING_CONFIRMATION.",
      });
    }

    const paymentProofs = ((payment as any)?.proofs ?? payment?.get?.("proofs") ?? []) as any[];
    const latestProof = normalizeProofSummary(paymentProofs);
    if (!latestProof) {
      return sendSellerAccessError(res, {
        status: 409,
        code: "PAYMENT_PROOF_REQUIRED",
        message: "Payment proof is required before review.",
      });
    }
    if (String(latestProof.reviewStatus || "PENDING").toUpperCase() !== "PENDING") {
      return sendSellerAccessError(res, {
        status: 409,
        code: "PAYMENT_PROOF_ALREADY_REVIEWED",
        message: "This payment proof has already been reviewed.",
      });
    }

    const latestProofRow = [...paymentProofs]
      .sort((left, right) => {
        const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
        const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
        return rightTime - leftTime;
      })[0];

    const orderId = toNumber(getAttr(suborder, "orderId"), 0);
    const now = new Date();
    const reviewNote = String(parsed.data.note || "").trim() || null;

    const tx = await sequelize.transaction();
    try {
      if (parsed.data.action === "APPROVE") {
        await payment.update(
          {
            status: "PAID",
            paidAt: now,
          } as any,
          { transaction: tx }
        );
        if (suborder) {
          await suborder.update(
            {
              paymentStatus: "PAID",
              paidAt: now,
            } as any,
            { transaction: tx }
          );
        }
        await latestProofRow.update(
          {
            reviewStatus: "APPROVED",
            reviewNote,
            reviewedByUserId: authUser.id,
            reviewedAt: now,
          } as any,
          { transaction: tx }
        );
        await appendPaymentStatusLog(
          {
            paymentId,
            oldStatus: currentStatus,
            newStatus: "PAID",
            actorType: "SELLER",
            actorId: authUser.id,
            note: reviewNote || "Seller approved payment proof.",
          },
          tx
        );
      } else {
        await payment.update(
          {
            status: "REJECTED",
            paidAt: null,
          } as any,
          { transaction: tx }
        );
        if (suborder) {
          await suborder.update(
            {
              paymentStatus: "UNPAID",
              paidAt: null,
            } as any,
            { transaction: tx }
          );
        }
        await latestProofRow.update(
          {
            reviewStatus: "REJECTED",
            reviewNote,
            reviewedByUserId: authUser.id,
            reviewedAt: now,
          } as any,
          { transaction: tx }
        );
        await appendPaymentStatusLog(
          {
            paymentId,
            oldStatus: currentStatus,
            newStatus: "REJECTED",
            actorType: "SELLER",
            actorId: authUser.id,
            note: reviewNote || "Seller rejected payment proof.",
          },
          tx
        );
      }

      if (orderId > 0) {
        await recalculateParentOrderPaymentStatus(orderId, tx);
      }

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    const refreshed = await loadSellerPayment(paymentId);
    const refreshedSuborder =
      (refreshed as any)?.suborder ?? refreshed?.get?.("suborder") ?? null;

    return res.json({
      success: true,
      data: serializeSellerSuborder(refreshedSuborder),
    });
  } catch (error) {
    console.error("[seller/payments/review] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to review seller payment.",
    });
  }
});

export default router;
