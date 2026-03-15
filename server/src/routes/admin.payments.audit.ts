import { Op } from "sequelize";
import { Router } from "express";
import {
  Order,
  OrderItem,
  Payment,
  PaymentProof,
  PaymentStatusLog,
  Product,
  Store,
  StorePaymentProfile,
  Suborder,
  SuborderItem,
  User,
} from "../models/index.js";
import { deriveLegacyPaymentStatus, serializeSplitOrder } from "./checkout.js";

const router = Router();

const asSingle = (value: unknown) => (Array.isArray(value) ? value[0] : value);
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

const allowedParentPaymentStatuses = new Set(["UNPAID", "PARTIALLY_PAID", "PAID"]);
const allowedReviewStatuses = new Set(["PENDING", "APPROVED", "REJECTED"]);
const allowedCheckoutModes = new Set(["LEGACY", "SINGLE_STORE", "MULTI_STORE"]);

const normalizeProofSummary = (proofs: any[]) => {
  if (!Array.isArray(proofs) || proofs.length === 0) return null;
  const latest = [...proofs]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      if (rightTime !== leftTime) return rightTime - leftTime;
      return toNumber(getAttr(right, "id")) - toNumber(getAttr(left, "id"));
    })[0];
  const uploadedBy = latest?.uploadedByUser ?? latest?.get?.("uploadedByUser") ?? null;
  const reviewedBy = latest?.reviewedByUser ?? latest?.get?.("reviewedByUser") ?? null;
  return {
    id: toNumber(getAttr(latest, "id")),
    proofImageUrl: String(getAttr(latest, "proofImageUrl") || ""),
    senderName: String(getAttr(latest, "senderName") || ""),
    senderBankOrWallet: String(getAttr(latest, "senderBankOrWallet") || ""),
    transferAmount: toNumber(getAttr(latest, "transferAmount")),
    transferTime: getAttr(latest, "transferTime") || null,
    note: getAttr(latest, "note") ? String(getAttr(latest, "note")) : null,
    reviewNote: getAttr(latest, "reviewNote") ? String(getAttr(latest, "reviewNote")) : null,
    reviewStatus: toUpper(getAttr(latest, "reviewStatus"), "PENDING"),
    reviewedByUserId: toNumber(getAttr(latest, "reviewedByUserId"), 0) || null,
    reviewedByName: getAttr(reviewedBy, "name") ? String(getAttr(reviewedBy, "name")) : null,
    uploadedByUserId: toNumber(getAttr(latest, "uploadedByUserId"), 0) || null,
    uploadedByName: getAttr(uploadedBy, "name") ? String(getAttr(uploadedBy, "name")) : null,
    reviewedAt: getAttr(latest, "reviewedAt") || null,
    createdAt: getAttr(latest, "createdAt") || null,
  };
};

const normalizePaymentStatusLogs = (logs: any[]) => {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  return [...logs]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      return leftTime - rightTime;
    })
    .map((log: any) => {
      const actorUser = log?.actorUser ?? log?.get?.("actorUser") ?? null;
      return {
        id: toNumber(getAttr(log, "id")),
        oldStatus: getAttr(log, "oldStatus") ? String(getAttr(log, "oldStatus")) : null,
        newStatus: toUpper(getAttr(log, "newStatus"), ""),
        actorType: toUpper(getAttr(log, "actorType"), "SYSTEM"),
        actorId: toNumber(getAttr(log, "actorId"), 0) || null,
        actorName: getAttr(actorUser, "name") ? String(getAttr(actorUser, "name")) : null,
        note: getAttr(log, "note") ? String(getAttr(log, "note")) : null,
        createdAt: getAttr(log, "createdAt") || null,
      };
    });
};

const buildAuditWhere = async (query: any) => {
  const where: any = {};
  const search = String(asSingle(query.search) ?? asSingle(query.q) ?? "").trim();
  const paymentStatus = toUpper(asSingle(query.paymentStatus));
  const reviewStatus = toUpper(asSingle(query.reviewStatus));
  const checkoutMode = toUpper(asSingle(query.checkoutMode));
  const storeId = toNumber(asSingle(query.storeId), 0);

  if (search) {
    const likeSearch = `%${search}%`;
    where[Op.or] = [
      { invoiceNo: { [Op.like]: likeSearch } },
      { customerName: { [Op.like]: likeSearch } },
      { "$customer.name$": { [Op.like]: likeSearch } },
      { "$customer.email$": { [Op.like]: likeSearch } },
    ];
  }

  if (allowedParentPaymentStatuses.has(paymentStatus)) {
    where.paymentStatus = paymentStatus;
  }

  if (allowedCheckoutModes.has(checkoutMode)) {
    where.checkoutMode = checkoutMode;
  }

  if (storeId > 0) {
    const matchedSuborders = await Suborder.findAll({
      where: { storeId },
      attributes: ["orderId"],
      raw: true,
    });
    const orderIds = Array.from(
      new Set(
        matchedSuborders
          .map((row: any) => toNumber(row.orderId, 0))
          .filter((orderId: number) => orderId > 0)
      )
    );
    where.id = { [Op.in]: orderIds.length > 0 ? orderIds : [0] };
  }

  if (allowedReviewStatuses.has(reviewStatus)) {
    const matchedProofs = await PaymentProof.findAll({
      where: { reviewStatus },
      attributes: [],
      include: [
        {
          model: Payment,
          as: "payment",
          attributes: [],
          required: true,
          include: [
            {
              model: Suborder,
              as: "suborder",
              attributes: ["orderId"],
              required: true,
            },
          ],
        },
      ],
      raw: true,
    });
    const reviewOrderIds = Array.from(
      new Set(
        matchedProofs
          .map((row: any) => toNumber(row["payment.suborder.orderId"], 0))
          .filter((orderId: number) => orderId > 0)
      )
    );
    const currentIds = where.id?.[Op.in];
    const mergedIds = Array.isArray(currentIds)
      ? currentIds.filter((orderId) => reviewOrderIds.includes(orderId))
      : reviewOrderIds;
    where.id = { [Op.in]: mergedIds.length > 0 ? mergedIds : [0] };
  }

  return {
    where,
    filters: {
      search,
      paymentStatus: allowedParentPaymentStatuses.has(paymentStatus) ? paymentStatus : "",
      reviewStatus: allowedReviewStatuses.has(reviewStatus) ? reviewStatus : "",
      checkoutMode: allowedCheckoutModes.has(checkoutMode) ? checkoutMode : "",
      storeId: storeId > 0 ? storeId : null,
    },
  };
};

const auditListInclude = [
  {
    model: User,
    as: "customer",
    attributes: ["id", "name", "email"],
    required: false,
  },
  {
    model: Suborder,
    as: "suborders",
    attributes: ["id", "storeId", "paymentStatus"],
    required: false,
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "name", "slug"],
        required: false,
      },
      {
        model: Payment,
        as: "payments",
        attributes: ["id", "status"],
        required: false,
        include: [
          {
            model: PaymentProof,
            as: "proofs",
            attributes: ["id", "reviewStatus", "createdAt"],
            required: false,
          },
        ],
      },
    ],
  },
];

const detailInclude = [
  {
    model: User,
    as: "customer",
    attributes: ["id", "name", "email", "role"],
    required: false,
  },
  {
    model: OrderItem,
    as: "items",
    attributes: ["id", "productId", "quantity", "price"],
    required: false,
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["id", "name", "slug"],
        required: false,
      },
    ],
  },
  {
    model: Suborder,
    as: "suborders",
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
      "paymentMethod",
      "paymentStatus",
      "fulfillmentStatus",
      "expiresAt",
      "paidAt",
      "createdAt",
    ],
    required: false,
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "ownerUserId", "name", "slug", "status"],
        required: false,
      },
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
          "instructionText",
        ],
        required: false,
      },
      {
        model: SuborderItem,
        as: "items",
        attributes: [
          "id",
          "productId",
          "storeId",
          "productNameSnapshot",
          "skuSnapshot",
          "priceSnapshot",
          "qty",
          "totalPrice",
        ],
        required: false,
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "slug"],
            required: false,
          },
        ],
      },
      {
        model: Payment,
        as: "payments",
        attributes: [
          "id",
          "suborderId",
          "storeId",
          "storePaymentProfileId",
          "paymentChannel",
          "paymentType",
          "externalReference",
          "internalReference",
          "amount",
          "qrImageUrl",
          "qrPayload",
          "status",
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
            include: [
              {
                model: User,
                as: "uploadedByUser",
                attributes: ["id", "name", "email"],
                required: false,
              },
              {
                model: User,
                as: "reviewedByUser",
                attributes: ["id", "name", "email"],
                required: false,
              },
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
        ],
      },
    ],
  },
];

const summarizeAuditRow = (order: any) => {
  const suborders = Array.isArray(order?.suborders) ? order.suborders : [];
  const paymentStatus = toUpper(
    getAttr(order, "paymentStatus"),
    suborders.length > 0 ? "UNPAID" : deriveLegacyPaymentStatus(order)
  );

  let paidSuborders = 0;
  let pendingSuborders = 0;
  let unpaidSuborders = 0;
  let rejectedPayments = 0;

  suborders.forEach((suborder: any) => {
    const suborderStatus = toUpper(getAttr(suborder, "paymentStatus"), "UNPAID");
    if (suborderStatus === "PAID") paidSuborders += 1;
    else if (suborderStatus === "PENDING_CONFIRMATION") pendingSuborders += 1;
    else unpaidSuborders += 1;

    const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
    payments.forEach((payment: any) => {
      const latestProof = normalizeProofSummary(payment?.proofs ?? []);
      const paymentState = toUpper(getAttr(payment, "status"), "CREATED");
      if (paymentState === "REJECTED" || latestProof?.reviewStatus === "REJECTED") {
        rejectedPayments += 1;
      }
    });
  });

  const uniqueStoreIds = Array.from(
    new Set(
      suborders
        .map((suborder: any) => toNumber(getAttr(suborder, "storeId"), 0))
        .filter((storeId: number) => storeId > 0)
    )
  );

  const customer = order?.customer ?? order?.get?.("customer") ?? null;
  return {
    orderId: toNumber(getAttr(order, "id")),
    orderNumber: String(getAttr(order, "invoiceNo") || getAttr(order, "id") || ""),
    invoiceNo: String(getAttr(order, "invoiceNo") || ""),
    checkoutMode:
      toUpper(getAttr(order, "checkoutMode"), suborders.length > 1 ? "MULTI_STORE" : "LEGACY") ||
      "LEGACY",
    buyerName: String(getAttr(order, "customerName") || getAttr(customer, "name") || "Guest"),
    buyerEmail: getAttr(customer, "email") ? String(getAttr(customer, "email")) : null,
    totalStores: uniqueStoreIds.length,
    grandTotal: toNumber(getAttr(order, "totalAmount")),
    paymentStatus,
    createdAt: getAttr(order, "createdAt") || null,
    counts: {
      paidSuborders,
      pendingSuborders,
      unpaidSuborders,
      rejectedPayments,
    },
  };
};

const serializeAuditDetail = (order: any) => {
  const split = serializeSplitOrder(order);
  const customer = order?.customer ?? order?.get?.("customer") ?? null;
  const suborders = Array.isArray(order?.suborders) ? order.suborders : [];

  return {
    parent: {
      orderId: toNumber(getAttr(order, "id")),
      orderNumber: String(getAttr(order, "invoiceNo") || getAttr(order, "id") || ""),
      invoiceNo: String(getAttr(order, "invoiceNo") || ""),
      checkoutMode: split.checkoutMode,
      paymentStatus: split.paymentStatus,
      orderStatus: String(getAttr(order, "status") || "pending"),
      paymentMethod: getAttr(order, "paymentMethod")
        ? String(getAttr(order, "paymentMethod"))
        : null,
      customerName: String(getAttr(order, "customerName") || getAttr(customer, "name") || "Guest"),
      customerPhone: getAttr(order, "customerPhone")
        ? String(getAttr(order, "customerPhone"))
        : null,
      customerAddress: getAttr(order, "customerAddress")
        ? String(getAttr(order, "customerAddress"))
        : null,
      buyer: customer
        ? {
            id: toNumber(getAttr(customer, "id"), 0) || null,
            name: String(getAttr(customer, "name") || ""),
            email: getAttr(customer, "email") ? String(getAttr(customer, "email")) : null,
            role: getAttr(customer, "role") ? String(getAttr(customer, "role")) : null,
          }
        : null,
      summary: split.summary,
      createdAt: getAttr(order, "createdAt") || null,
      updatedAt: getAttr(order, "updatedAt") || null,
    },
    counts: summarizeAuditRow(order).counts,
    split,
    suborders: suborders.map((suborder: any) => {
      const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
      return {
        suborderId: toNumber(getAttr(suborder, "id")),
        suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
        store: {
          id: toNumber(getAttr(suborder?.store, "id"), 0) || null,
          ownerUserId: toNumber(getAttr(suborder?.store, "ownerUserId"), 0) || null,
          name: String(
            getAttr(suborder?.store, "name") || `Store #${getAttr(suborder, "storeId")}`
          ),
          slug: getAttr(suborder?.store, "slug")
            ? String(getAttr(suborder?.store, "slug"))
            : null,
          status: getAttr(suborder?.store, "status")
            ? String(getAttr(suborder?.store, "status"))
            : null,
        },
        subtotalAmount: toNumber(getAttr(suborder, "subtotalAmount")),
        shippingAmount: toNumber(getAttr(suborder, "shippingAmount")),
        serviceFeeAmount: toNumber(getAttr(suborder, "serviceFeeAmount")),
        totalAmount: toNumber(getAttr(suborder, "totalAmount")),
        paymentMethod: String(getAttr(suborder, "paymentMethod") || "QRIS"),
        paymentStatus: String(getAttr(suborder, "paymentStatus") || "UNPAID"),
        fulfillmentStatus: String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED"),
        paidAt: getAttr(suborder, "paidAt") || null,
        paymentProfile: getAttr(suborder?.paymentProfile, "id")
          ? {
              id: toNumber(getAttr(suborder?.paymentProfile, "id")),
              providerCode: String(getAttr(suborder?.paymentProfile, "providerCode") || ""),
              paymentType: String(getAttr(suborder?.paymentProfile, "paymentType") || ""),
              accountName: String(getAttr(suborder?.paymentProfile, "accountName") || ""),
              merchantName: String(getAttr(suborder?.paymentProfile, "merchantName") || ""),
              merchantId: getAttr(suborder?.paymentProfile, "merchantId")
                ? String(getAttr(suborder?.paymentProfile, "merchantId"))
                : null,
              isActive: Boolean(getAttr(suborder?.paymentProfile, "isActive")),
              verificationStatus: String(
                getAttr(suborder?.paymentProfile, "verificationStatus") || "INACTIVE"
              ),
              instructionText: getAttr(suborder?.paymentProfile, "instructionText")
                ? String(getAttr(suborder?.paymentProfile, "instructionText"))
                : null,
            }
          : null,
        items: (Array.isArray(suborder?.items) ? suborder.items : []).map((item: any) => ({
          id: toNumber(getAttr(item, "id")),
          productId: toNumber(getAttr(item, "productId")),
          productName: String(
            getAttr(item, "productNameSnapshot") ||
              getAttr(item?.product, "name") ||
              `Product #${getAttr(item, "productId")}`
          ),
          slug: getAttr(item?.product, "slug") ? String(getAttr(item?.product, "slug")) : "",
          sku: getAttr(item, "skuSnapshot") ? String(getAttr(item, "skuSnapshot")) : null,
          qty: toNumber(getAttr(item, "qty")),
          price: toNumber(getAttr(item, "priceSnapshot")),
          totalPrice: toNumber(getAttr(item, "totalPrice")),
        })),
        payments: payments.map((payment: any) => ({
          id: toNumber(getAttr(payment, "id")),
          internalReference: String(getAttr(payment, "internalReference") || ""),
          externalReference: getAttr(payment, "externalReference")
            ? String(getAttr(payment, "externalReference"))
            : null,
          paymentChannel: String(getAttr(payment, "paymentChannel") || "QRIS"),
          paymentType: String(getAttr(payment, "paymentType") || "QRIS_STATIC"),
          amount: toNumber(getAttr(payment, "amount")),
          status: String(getAttr(payment, "status") || "CREATED"),
          qrImageUrl: getAttr(payment, "qrImageUrl")
            ? String(getAttr(payment, "qrImageUrl"))
            : null,
          qrPayload: getAttr(payment, "qrPayload")
            ? String(getAttr(payment, "qrPayload"))
            : null,
          expiresAt: getAttr(payment, "expiresAt") || null,
          paidAt: getAttr(payment, "paidAt") || null,
          proofSubmitted: Array.isArray(payment?.proofs) && payment.proofs.length > 0,
          proof: normalizeProofSummary(payment?.proofs ?? []),
          logs: normalizePaymentStatusLogs(payment?.statusLogs ?? []),
        })),
      };
    }),
  };
};

router.get("/", async (req, res) => {
  try {
    const page = parsePositiveInt(asSingle(req.query.page), 1, 1, 1_000_000);
    const pageSize = parsePositiveInt(
      asSingle(req.query.pageSize) ?? asSingle(req.query.limit),
      10,
      1,
      100
    );
    const offset = (page - 1) * pageSize;
    const parsed = await buildAuditWhere(req.query || {});

    const { rows, count } = await Order.findAndCountAll({
      where: parsed.where,
      include: auditListInclude,
      attributes: [
        "id",
        "invoiceNo",
        "checkoutMode",
        "customerName",
        "paymentStatus",
        "totalAmount",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
      distinct: true,
      col: "id",
      subQuery: false,
    });

    return res.json({
      success: true,
      data: {
        items: rows.map(summarizeAuditRow),
        total: count,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(count / pageSize)),
        filters: parsed.filters,
      },
    });
  } catch (error) {
    console.error("[admin/payments/audit:list] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load payment audit list.",
    });
  }
});

router.get("/:orderId", async (req, res) => {
  try {
    const lookup = String(req.params.orderId || "").trim();
    const where = /^\d+$/.test(lookup) ? { id: Number(lookup) } : { invoiceNo: lookup };
    const order = await Order.findOne({
      where,
      include: detailInclude,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Audit order not found.",
      });
    }

    return res.json({
      success: true,
      data: serializeAuditDetail(order),
    });
  } catch (error) {
    console.error("[admin/payments/audit:detail] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load payment audit detail.",
    });
  }
});

export default router;
