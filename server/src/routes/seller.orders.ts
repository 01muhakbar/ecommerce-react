import { Op } from "sequelize";
import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import {
  Order,
  Payment,
  PaymentProof,
  StorePaymentProfile,
  Suborder,
  SuborderItem,
  User,
} from "../models/index.js";

const router = Router();

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

const allowedPaymentStatuses = new Set([
  "UNPAID",
  "PENDING_CONFIRMATION",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

const allowedFulfillmentStatuses = new Set([
  "UNFULFILLED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

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
    reviewStatus: toUpper(getAttr(latest, "reviewStatus"), "PENDING"),
    senderName: String(getAttr(latest, "senderName") || ""),
    transferAmount: toNumber(getAttr(latest, "transferAmount")),
    transferTime: getAttr(latest, "transferTime") || null,
    createdAt: getAttr(latest, "createdAt") || null,
  };
};

const buildShippingSummary = (order: any) => {
  const shippingDetails = getAttr(order, "shippingDetails") || null;
  if (shippingDetails && typeof shippingDetails === "object") {
    const addressParts = [
      shippingDetails.streetName,
      shippingDetails.houseNumber,
      shippingDetails.building,
      shippingDetails.district,
      shippingDetails.city,
      shippingDetails.province,
      shippingDetails.postalCode,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean);

    return {
      fullName: String(shippingDetails.fullName || getAttr(order, "customerName") || "Customer"),
      phoneNumber: String(
        shippingDetails.phoneNumber || getAttr(order, "customerPhone") || ""
      ),
      addressLine: addressParts.join(", ") || null,
      markAs: shippingDetails.markAs ? String(shippingDetails.markAs) : null,
    };
  }

  return {
    fullName: String(getAttr(order, "customerName") || "Customer"),
    phoneNumber: getAttr(order, "customerPhone")
      ? String(getAttr(order, "customerPhone"))
      : null,
    addressLine: getAttr(order, "customerAddress")
      ? String(getAttr(order, "customerAddress"))
      : null,
    markAs: null,
  };
};

const listInclude = [
  {
    model: Order,
    as: "order",
    attributes: [
      "id",
      "invoiceNo",
      "userId",
      "customerName",
      "customerPhone",
      "shippingDetails",
      "paymentStatus",
      "status",
      "checkoutMode",
      "createdAt",
    ],
    include: [
      {
        model: User,
        as: "customer",
        attributes: ["id", "name", "email"],
        required: false,
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
      "qty",
      "priceSnapshot",
      "totalPrice",
    ],
    required: false,
  },
  {
    model: Payment,
    as: "payments",
    attributes: [
      "id",
      "internalReference",
      "amount",
      "status",
      "paymentChannel",
      "paymentType",
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
          "senderName",
          "transferAmount",
          "transferTime",
          "reviewStatus",
          "createdAt",
        ],
        required: false,
      },
    ],
  },
];

const detailInclude = [
  ...listInclude,
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
    ],
    required: false,
  },
];

const serializeListItem = (suborder: any) => {
  const order = suborder?.order ?? suborder?.get?.("order") ?? null;
  const buyer = order?.customer ?? order?.get?.("customer") ?? null;
  const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
  const latestPayment = [...payments]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      return rightTime - leftTime;
    })[0];

  return {
    suborderId: toNumber(getAttr(suborder, "id")),
    suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
    orderId: toNumber(getAttr(order, "id")),
    orderNumber: String(getAttr(order, "invoiceNo") || ""),
    checkoutMode: String(getAttr(order, "checkoutMode") || "LEGACY"),
    paymentStatus: String(getAttr(suborder, "paymentStatus") || "UNPAID"),
    fulfillmentStatus: String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED"),
    totalAmount: toNumber(getAttr(suborder, "totalAmount")),
    itemCount: Array.isArray(suborder?.items)
      ? suborder.items.reduce((sum: number, item: any) => sum + toNumber(getAttr(item, "qty")), 0)
      : 0,
    createdAt: getAttr(suborder, "createdAt") || null,
    buyer: {
      userId: toNumber(getAttr(order, "userId"), 0) || null,
      name: String(
        getAttr(buyer, "name") || getAttr(order, "customerName") || "Customer"
      ),
      email: getAttr(buyer, "email") ? String(getAttr(buyer, "email")) : null,
      phone: getAttr(order, "customerPhone") ? String(getAttr(order, "customerPhone")) : null,
    },
    paymentSummary: latestPayment
      ? {
          id: toNumber(getAttr(latestPayment, "id")),
          internalReference: String(getAttr(latestPayment, "internalReference") || ""),
          status: String(getAttr(latestPayment, "status") || "CREATED"),
          amount: toNumber(getAttr(latestPayment, "amount")),
          paidAt: getAttr(latestPayment, "paidAt") || null,
          proof: normalizeProofSummary(latestPayment?.proofs ?? []),
        }
      : null,
  };
};

const serializeDetail = (suborder: any) => {
  const order = suborder?.order ?? suborder?.get?.("order") ?? null;
  const buyer = order?.customer ?? order?.get?.("customer") ?? null;
  const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
  const latestPayment = [...payments]
    .sort((left, right) => {
      const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
      const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
      return rightTime - leftTime;
    })[0];
  const paymentProfile = suborder?.paymentProfile ?? suborder?.get?.("paymentProfile") ?? null;

  return {
    suborderId: toNumber(getAttr(suborder, "id")),
    suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
    storeId: toNumber(getAttr(suborder, "storeId")),
    order: {
      id: toNumber(getAttr(order, "id")),
      orderNumber: String(getAttr(order, "invoiceNo") || ""),
      status: String(getAttr(order, "status") || "pending"),
      paymentStatus: String(getAttr(order, "paymentStatus") || "UNPAID"),
      checkoutMode: String(getAttr(order, "checkoutMode") || "LEGACY"),
      createdAt: getAttr(order, "createdAt") || null,
    },
    buyer: {
      userId: toNumber(getAttr(order, "userId"), 0) || null,
      name: String(
        getAttr(buyer, "name") || getAttr(order, "customerName") || "Customer"
      ),
      email: getAttr(buyer, "email") ? String(getAttr(buyer, "email")) : null,
      phone: getAttr(order, "customerPhone") ? String(getAttr(order, "customerPhone")) : null,
    },
    shipping: buildShippingSummary(order),
    paymentStatus: String(getAttr(suborder, "paymentStatus") || "UNPAID"),
    fulfillmentStatus: String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED"),
    totals: {
      subtotalAmount: toNumber(getAttr(suborder, "subtotalAmount")),
      shippingAmount: toNumber(getAttr(suborder, "shippingAmount")),
      serviceFeeAmount: toNumber(getAttr(suborder, "serviceFeeAmount")),
      totalAmount: toNumber(getAttr(suborder, "totalAmount")),
    },
    paidAt: getAttr(suborder, "paidAt") || null,
    createdAt: getAttr(suborder, "createdAt") || null,
    items: (Array.isArray(suborder?.items) ? suborder.items : []).map((item: any) => ({
      id: toNumber(getAttr(item, "id")),
      productId: toNumber(getAttr(item, "productId")),
      productName: String(
        getAttr(item, "productNameSnapshot") || `Product #${getAttr(item, "productId")}`
      ),
      qty: toNumber(getAttr(item, "qty")),
      price: toNumber(getAttr(item, "priceSnapshot")),
      totalPrice: toNumber(getAttr(item, "totalPrice")),
    })),
    paymentSummary: latestPayment
      ? {
          id: toNumber(getAttr(latestPayment, "id")),
          internalReference: String(getAttr(latestPayment, "internalReference") || ""),
          paymentChannel: String(getAttr(latestPayment, "paymentChannel") || "QRIS"),
          paymentType: String(getAttr(latestPayment, "paymentType") || "QRIS_STATIC"),
          status: String(getAttr(latestPayment, "status") || "CREATED"),
          amount: toNumber(getAttr(latestPayment, "amount")),
          expiresAt: getAttr(latestPayment, "expiresAt") || null,
          paidAt: getAttr(latestPayment, "paidAt") || null,
          proof: normalizeProofSummary(latestPayment?.proofs ?? []),
        }
      : null,
    paymentProfileSummary: paymentProfile
      ? {
          id: toNumber(getAttr(paymentProfile, "id")),
          accountName: String(getAttr(paymentProfile, "accountName") || ""),
          merchantName: String(getAttr(paymentProfile, "merchantName") || ""),
          verificationStatus: String(
            getAttr(paymentProfile, "verificationStatus") || "PENDING"
          ),
          isActive: Boolean(getAttr(paymentProfile, "isActive")),
        }
      : null,
  };
};

router.get(
  "/stores/:storeId/suborders",
  requireSellerStoreAccess(["ORDER_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const page = parsePositiveInt(req.query.page, 1, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 20, 1, 50);
      const offset = (page - 1) * limit;
      const keyword = String(req.query.keyword || "").trim();
      const paymentStatus = toUpper(req.query.paymentStatus);
      const fulfillmentStatus = toUpper(req.query.fulfillmentStatus);

      const where: any = { storeId };

      if (allowedPaymentStatuses.has(paymentStatus)) {
        where.paymentStatus = paymentStatus;
      }

      if (allowedFulfillmentStatuses.has(fulfillmentStatus)) {
        where.fulfillmentStatus = fulfillmentStatus;
      }

      if (keyword) {
        const likeKeyword = `%${keyword}%`;
        where[Op.or] = [
          { suborderNumber: { [Op.like]: likeKeyword } },
          { "$order.invoiceNo$": { [Op.like]: likeKeyword } },
          { "$order.customerName$": { [Op.like]: likeKeyword } },
          { "$order.customerPhone$": { [Op.like]: likeKeyword } },
        ];
      }

      const result = await Suborder.findAndCountAll({
        where,
        attributes: [
          "id",
          "orderId",
          "suborderNumber",
          "storeId",
          "subtotalAmount",
          "shippingAmount",
          "serviceFeeAmount",
          "totalAmount",
          "paymentStatus",
          "fulfillmentStatus",
          "paidAt",
          "createdAt",
        ],
        include: listInclude,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
        distinct: true,
        subQuery: false,
      });

      return res.json({
        success: true,
        data: {
          items: result.rows.map(serializeListItem),
          filters: {
            paymentStatus: allowedPaymentStatuses.has(paymentStatus) ? paymentStatus : "",
            fulfillmentStatus: allowedFulfillmentStatuses.has(fulfillmentStatus)
              ? fulfillmentStatus
              : "",
            keyword,
          },
          pagination: {
            page,
            limit,
            total: result.count,
          },
        },
      });
    } catch (error) {
      console.error("[seller/orders/list] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller suborders.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/suborders/:suborderId",
  requireSellerStoreAccess(["ORDER_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const suborderId = Number(req.params.suborderId);
      if (!Number.isInteger(suborderId) || suborderId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid suborder id.",
        });
      }

      const suborder = await Suborder.findOne({
        where: { id: suborderId, storeId },
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
          "paymentStatus",
          "fulfillmentStatus",
          "paidAt",
          "createdAt",
        ],
        include: detailInclude,
      });

      if (!suborder) {
        return res.status(404).json({
          success: false,
          message: "Suborder not found.",
        });
      }

      return res.json({
        success: true,
        data: serializeDetail(suborder),
      });
    } catch (error) {
      console.error("[seller/orders/detail] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller suborder detail.",
      });
    }
  }
);

export default router;
