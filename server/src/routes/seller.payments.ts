import { Op } from "sequelize";
import { Router } from "express";
import { z } from "zod";
import requireAuth from "../middleware/requireAuth.js";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
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
import { expireOverduePaymentsForOrder } from "../services/paymentExpiry.service.js";
import { getLatestTimelineRecord } from "../services/paymentReadModel.js";
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
const SELLER_PAYMENT_REVIEW_VIEW_REQUIRED_PERMISSIONS = [
  "ORDER_VIEW",
  "PAYMENT_STATUS_VIEW",
] as const;
const SELLER_PAYMENT_REVIEW_MUTATION_ALLOWED_ROLE_CODES = new Set([
  SELLER_ROLE_CODES.STORE_OWNER,
  SELLER_ROLE_CODES.STORE_ADMIN,
]);

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

const canViewSellerPaymentReview = (access: any) =>
  SELLER_PAYMENT_REVIEW_VIEW_REQUIRED_PERMISSIONS.every((permission) =>
    sellerHasPermission(access, permission)
  );

const canMutateSellerPaymentReview = (access: any) => {
  if (!canViewSellerPaymentReview(access)) return false;
  const roleCode = String(access?.roleCode || "").trim();
  if (Boolean(access?.isOwner)) return true;
  return SELLER_PAYMENT_REVIEW_MUTATION_ALLOWED_ROLE_CODES.has(roleCode as any);
};

const buildSellerPaymentReviewGovernance = (access: any) => ({
  canView: canViewSellerPaymentReview(access),
  canReview: canMutateSellerPaymentReview(access),
  activeStoreId: toNumber(access?.store?.id || access?.storeId, 0) || null,
  roleCode: String(access?.roleCode || ""),
  permissionKeys: Array.isArray(access?.permissionKeys) ? [...access.permissionKeys] : [],
  mutationAllowedRoleCodes: [...SELLER_PAYMENT_REVIEW_MUTATION_ALLOWED_ROLE_CODES],
  note: canMutateSellerPaymentReview(access)
    ? "Seller payment review mutation is active for this store scope."
    : "Seller payment review stays read-only for this role. Mutation remains limited to STORE_OWNER or STORE_ADMIN.",
});

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

    if (!canViewSellerPaymentReview(accessResult.data)) {
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
    requiredPermissions: [...SELLER_PAYMENT_REVIEW_VIEW_REQUIRED_PERMISSIONS],
  });
  const eligibleAccessContexts = accessContexts.filter(canViewSellerPaymentReview);

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
        canReview: canMutateSellerPaymentReview(access),
      })),
    },
  };
};

const normalizeProofSummary = (proofs: any[]) => {
  const latest = getLatestTimelineRecord(proofs);
  if (!latest) return null;
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

const expireOverduePaymentsForSellerSuborders = async (items: any[]) => {
  const orderIds = Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((suborder: any) => toNumber(getAttr(suborder, "orderId"), 0))
        .filter((orderId: number) => orderId > 0)
    )
  );

  let changed = false;
  for (const orderId of orderIds) {
    const expired = await expireOverduePaymentsForOrder(orderId);
    changed = changed || expired;
  }

  return changed;
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
  const payment = getLatestTimelineRecord(payments);
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

const resolveSellerPaymentReviewFilterStatus = (suborder: any) => {
  const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
  const latestPayment = getLatestTimelineRecord(payments);
  const paymentStatus = String(getAttr(latestPayment, "status") || "").trim().toUpperCase();
  const suborderStatus = String(getAttr(suborder, "paymentStatus") || "UNPAID")
    .trim()
    .toUpperCase();

  if (paymentStatus === "REJECTED") return "REJECTED";
  if (paymentStatus === "PENDING_CONFIRMATION") return "PENDING_CONFIRMATION";
  if (paymentStatus === "PAID") return "PAID";
  if (suborderStatus === "PENDING_CONFIRMATION") return "PENDING_CONFIRMATION";
  if (suborderStatus === "PAID") return "PAID";
  if (suborderStatus === "UNPAID") return "UNPAID";
  return paymentStatus || suborderStatus || "UNPAID";
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

const listSellerPaymentReviewSuborders = async (storeId: number, statuses: string[]) => {
  const items = await Suborder.findAll({
    where: {
      storeId,
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

  return items.filter((suborder) =>
    statuses.includes(resolveSellerPaymentReviewFilterStatus(suborder))
  );
};

const buildSellerPaymentReviewListPayload = (input: {
  access: any;
  filters: string[];
  items: any[];
}) => ({
  store: {
    id: toNumber(input.access?.store?.id || input.access?.storeId, 0) || null,
    name: String(input.access?.store?.name || ""),
    slug: String(input.access?.store?.slug || ""),
    status: String(input.access?.store?.status || "ACTIVE"),
  },
  filters: input.filters,
  items: input.items.map(serializeSellerSuborder),
  governance: buildSellerPaymentReviewGovernance(input.access),
});

const loadSellerPaymentReviewList = async (input: {
  access: any;
  paymentStatus: unknown;
}) => {
  const statuses = normalizeStatuses(input.paymentStatus);
  const scopedStoreId = Number(input.access?.store?.id || input.access?.storeId || 0);
  let items = await listSellerPaymentReviewSuborders(scopedStoreId, statuses);
  const expired = await expireOverduePaymentsForSellerSuborders(items);
  if (expired) {
    items = await listSellerPaymentReviewSuborders(scopedStoreId, statuses);
  }
  return buildSellerPaymentReviewListPayload({
    access: input.access,
    filters: statuses,
    items,
  });
};

const resolveSellerPaymentScope = (payment: any) => {
  const paymentStore = (payment as any)?.store ?? payment?.get?.("store") ?? null;
  const suborder = (payment as any)?.suborder ?? payment?.get?.("suborder") ?? null;
  const paymentStoreId = toNumber(getAttr(paymentStore, "id"), 0);
  const suborderStoreId = toNumber(getAttr(suborder, "storeId"), 0);
  const scopedStoreId = suborderStoreId || paymentStoreId;

  return {
    paymentStore,
    suborder,
    paymentStoreId,
    suborderStoreId,
    scopedStoreId,
  };
};

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

    return res.json({
      success: true,
      data: await loadSellerPaymentReviewList({
        access: accessResult.data,
        paymentStatus: req.query.paymentStatus,
      }),
    });
  } catch (error) {
    console.error("[seller/suborders] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load seller payments.",
    });
  }
});

router.get(
  "/stores/:storeId/payment-review/suborders",
  requireSellerStoreAccess([...SELLER_PAYMENT_REVIEW_VIEW_REQUIRED_PERMISSIONS]),
  async (req: any, res) => {
    try {
      return res.json({
        success: true,
        data: await loadSellerPaymentReviewList({
          access: req.sellerAccess,
          paymentStatus: req.query.paymentStatus,
        }),
      });
    } catch (error) {
      console.error("[seller/stores/payment-review/suborders] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller payments.",
      });
    }
  }
);

const handleSellerPaymentReview = async (req: any, res: any, options: { requireRouteStoreScope: boolean }) => {
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

    const { suborder, paymentStoreId, suborderStoreId, scopedStoreId } =
      resolveSellerPaymentScope(payment);

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

    const routeStoreId =
      options.requireRouteStoreScope || isValidPositiveInt(req.params?.storeId)
        ? Number(req.params?.storeId)
        : null;

    if (options.requireRouteStoreScope) {
      if (!isValidPositiveInt(routeStoreId)) {
        return sendSellerAccessError(res, {
          status: 400,
          code: "INVALID_STORE_ID",
          message: "Invalid store id.",
        });
      }

      if (Number(routeStoreId) !== scopedStoreId) {
        return sendSellerAccessError(res, {
          status: 404,
          code: "SELLER_PAYMENT_OUTSIDE_STORE_SCOPE",
          message: "Payment not found for the requested seller store scope.",
        });
      }
    }

    const access = req.sellerAccess
      ? req.sellerAccess
      : await (async () => {
          const accessResult = await resolveSellerAccess({
            storeId: scopedStoreId,
            userId: authUser.id,
          });
          if (!accessResult.ok) {
            return accessResult;
          }
          return accessResult.data;
        })();

    if ("ok" in (access as any) && !(access as any).ok) {
      return sendSellerAccessError(res, access as any);
    }

    if (!canMutateSellerPaymentReview(access)) {
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

    const latestProofRow = getLatestTimelineRecord(paymentProofs);

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
              fulfillmentStatus: "PROCESSING",
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
        const nextParentPaymentStatus = await recalculateParentOrderPaymentStatus(orderId, tx);
        if (parsed.data.action === "APPROVE" && String(nextParentPaymentStatus || "").toUpperCase() === "PAID") {
          const parentOrder = await Order.findByPk(orderId, {
            attributes: ["id", "status"],
            transaction: tx,
          });
          const parentStatus = String(getAttr(parentOrder, "status") || "pending").toLowerCase().trim();
          if (parentOrder && parentStatus === "pending") {
            await parentOrder.update(
              {
                status: "processing",
              } as any,
              { transaction: tx }
            );
          }
        }
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
};

router.patch("/payments/:paymentId/review", async (req, res) =>
  handleSellerPaymentReview(req, res, { requireRouteStoreScope: false })
);

router.patch(
  "/stores/:storeId/payments/:paymentId/review",
  requireSellerStoreAccess([...SELLER_PAYMENT_REVIEW_VIEW_REQUIRED_PERMISSIONS]),
  async (req, res) => handleSellerPaymentReview(req, res, { requireRouteStoreScope: true })
);

export default router;
