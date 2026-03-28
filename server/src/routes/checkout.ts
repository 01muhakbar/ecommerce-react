import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import requireAuth from "../middleware/requireAuth.js";
import {
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
  Payment,
  PaymentProof,
  Product,
  Store,
  StorePaymentProfile,
  Suborder,
  SuborderItem,
  sequelize,
} from "../models/index.js";
import {
  createNewOrderNotification,
  createSellerNotificationsForStoreRecipients,
  createUserOrderPlacedNotification,
} from "../services/notification.service.js";
import {
  deriveLegacyPaymentStatus,
  recalculateParentOrderPaymentStatus,
} from "../services/orderPaymentAggregation.service.js";
import { appendPaymentStatusLog } from "../services/paymentStatusLog.service.js";
import { quoteCoupon } from "../services/coupon.service.js";
import {
  buildBuyerCancelActionability,
  buildBuyerProofActionability,
  resolveBuyerFacingPaymentStatus,
} from "../services/paymentCheckoutView.service.js";
import {
  resolvePreferredStorePaymentProfile,
  STORE_PAYMENT_PROFILE_CHECKOUT_ATTRIBUTES,
} from "../services/sharedContracts/storePaymentProfileCompat.js";
import { getDefaultAddressByUser } from "../services/userAddress.service.js";

const router = Router();

const previewRequestSchema = z.object({
  cartId: z.number().int().positive().optional(),
  shippingAddressId: z.number().int().positive().optional(),
});

const shippingDetailsSchema = z.object({
  fullName: z.string(),
  phoneNumber: z.string(),
  province: z.string(),
  city: z.string(),
  district: z.string(),
  postalCode: z.string(),
  streetName: z.string(),
  building: z.string().nullable().optional(),
  houseNumber: z.string(),
  otherDetails: z.string().nullable().optional(),
  markAs: z.enum(["HOME", "OFFICE"]).optional(),
});

const createMultiStoreSchema = z.object({
  cartId: z.number().int().positive().optional(),
  shippingAddressId: z.number().int().positive().optional(),
  useDefaultShipping: z.boolean().optional(),
  customer: z
    .object({
      name: z.string().trim().min(2).optional(),
      phone: z.string().trim().min(8).optional(),
      address: z.string().trim().min(8).optional(),
      notes: z.string().trim().optional(),
    })
    .optional(),
  shippingDetails: shippingDetailsSchema.nullable().optional(),
  couponCode: z.string().trim().min(1).optional().nullable(),
  groupCoupons: z
    .array(
      z.object({
        storeId: z.number().int().positive(),
        couponCode: z.string().trim().min(1),
      })
    )
    .max(20)
    .optional()
    .nullable(),
});

const SHIPPING_REQUIRED_FIELDS = [
  "fullName",
  "phoneNumber",
  "province",
  "city",
  "district",
  "postalCode",
  "streetName",
  "houseNumber",
] as const;

const SHIPPING_PER_STORE_FALLBACK = 0;
const PAYMENT_EXPIRY_MINUTES = 240;

type ShippingDetailsSnapshot = z.infer<typeof shippingDetailsSchema>;

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeUploadsUrl = (value?: string | null) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return text;
  return `/uploads/${text}`;
};

const normalizeShippingDetails = (raw: any): ShippingDetailsSnapshot | null => {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, any>;
  const normalized = {
    fullName: String(source.fullName || "").trim(),
    phoneNumber: String(source.phoneNumber || "").trim(),
    province: String(source.province || "").trim(),
    city: String(source.city || "").trim(),
    district: String(source.district || "").trim(),
    postalCode: String(source.postalCode || "").trim(),
    streetName: String(source.streetName || "").trim(),
    building: String(source.building || "").trim() || null,
    houseNumber: String(source.houseNumber || "").trim(),
    otherDetails: String(source.otherDetails || "").trim() || null,
    markAs: source.markAs === "OFFICE" ? "OFFICE" : "HOME",
  };
  const parsed = shippingDetailsSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
};

const getMissingShippingField = (
  details: ShippingDetailsSnapshot | null
): string | null => {
  if (!details) return "shippingDetails";
  for (const key of SHIPPING_REQUIRED_FIELDS) {
    if (!String(details[key] || "").trim()) return key;
  }
  if (!/^\d{5}$/.test(String(details.postalCode || "").trim())) return "postalCode";
  return null;
};

const toShippingAddressLine = (details: ShippingDetailsSnapshot) =>
  [
    `${details.streetName} ${details.houseNumber}`.trim(),
    details.building || "",
    details.district,
    details.city,
    details.province,
    details.postalCode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const getProductImage = (product: any) => {
  const promo = getAttr(product, "promoImagePath");
  if (promo) return normalizeUploadsUrl(String(promo));

  const rawImages = getAttr(product, "imagePaths");
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    return normalizeUploadsUrl(String(rawImages[0] || ""));
  }
  if (typeof rawImages === "string") {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeUploadsUrl(String(parsed[0] || ""));
      }
    } catch {
      // ignore malformed image payloads
    }
  }
  return null;
};

const getProductUnitPrice = (product: any) => {
  const rawSalePrice = toNumber(getAttr(product, "salePrice"), 0);
  const rawPrice = toNumber(getAttr(product, "price"), 0);
  return rawSalePrice > 0 && rawSalePrice < rawPrice ? rawSalePrice : rawPrice;
};

const isStorefrontProductVisible = (product: any) => {
  const status = String(getAttr(product, "status") || "").trim().toLowerCase();
  const isPublished = Boolean(
    getAttr(product, "isPublished") ?? getAttr(product, "published")
  );
  const submissionStatus = String(getAttr(product, "sellerSubmissionStatus") || "none")
    .trim()
    .toLowerCase();
  const store = product?.store ?? product?.get?.("store") ?? null;
  const storeStatus = String(store?.status || "").trim().toUpperCase();
  return (
    status === "active" &&
    isPublished &&
    submissionStatus === "none" &&
    Boolean(getAttr(product, "storeId")) &&
    storeStatus === "ACTIVE"
  );
};

const buildPublicProductWhere = (extraWhere: Record<string, any> = {}) => ({
  ...extraWhere,
  status: "active",
  isPublished: true,
  sellerSubmissionStatus: "none",
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

const buildInvoiceNo = () =>
  `STORE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const buildSuborderNumber = (invoiceNo: string, index: number) =>
  `${invoiceNo}-S${String(index + 1).padStart(2, "0")}`;

const buildInternalPaymentReference = (suborderNumber: string) =>
  `${suborderNumber}-PAY`;

const buildAppliedCouponAttribution = (
  quoted: Awaited<ReturnType<typeof quoteCoupon>> | null | undefined
) => {
  if (!quoted?.valid || !quoted.code) {
    return {
      appliedCouponId: null,
      appliedCouponCode: null,
      appliedCouponScopeType: null,
    };
  }

  return {
    appliedCouponId:
      Number.isFinite(Number(quoted.couponId)) && Number(quoted.couponId) > 0
        ? Number(quoted.couponId)
        : null,
    appliedCouponCode: String(quoted.code).trim().toUpperCase() || null,
    appliedCouponScopeType:
      quoted.scopeType === "PLATFORM" || quoted.scopeType === "STORE" ? quoted.scopeType : null,
  };
};

const buildPaymentExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + PAYMENT_EXPIRY_MINUTES);
  return expiresAt;
};

const buildCartInclude = (includePaymentMedia = false) => [
  {
    model: Product,
    as: "Products",
    attributes: [
      "id",
      "name",
      "slug",
      "sku",
      "price",
      "salePrice",
      "promoImagePath",
      "imagePaths",
      "storeId",
      "stock",
      "status",
      "isPublished",
      "sellerSubmissionStatus",
      "userId",
      "categoryId",
    ],
    through: { attributes: ["quantity"] },
    include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name", "code"],
      },
      {
        model: Store,
        as: "store",
        attributes: ["id", "activeStorePaymentProfileId", "name", "slug", "status"],
        include: [
          {
            model: StorePaymentProfile,
            as: "paymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_CHECKOUT_ATTRIBUTES],
            required: false,
          },
          {
            model: StorePaymentProfile,
            as: "activePaymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_CHECKOUT_ATTRIBUTES],
            required: false,
          },
        ],
      },
    ],
  },
];

const findCartForUser = async (
  userId: number,
  cartId?: number,
  transaction?: any,
  includePaymentMedia = false
) => {
  const where: Record<string, any> = { userId };
  if (cartId) where.id = cartId;
  return Cart.findOne({
    where,
    include: buildCartInclude(includePaymentMedia),
    transaction,
  });
};

const serializePreviewGroup = (group: any) => ({
  storeId: group.storeId,
  storeName: group.storeName,
  storeSlug: group.storeSlug,
  subtotalAmount: group.subtotalAmount,
  shippingAmount: group.shippingAmount,
  totalAmount: group.totalAmount,
  paymentAvailable: group.paymentAvailable,
  paymentMethod: group.paymentMethod,
  paymentProfileStatus: group.paymentProfileStatus,
  merchantName: group.merchantName,
  accountName: group.accountName,
  qrisImageUrl: group.qrisImageUrl,
  qrisPayload: group.qrisPayload,
  paymentInstruction: group.paymentInstruction,
  warning: group.warning,
  items: group.items.map((item: any) => ({
    productId: item.productId,
    productName: item.productName,
    slug: item.slug,
    qty: item.qty,
    price: item.price,
    lineTotal: item.lineTotal,
    image: item.image,
    stock: item.stock,
    category: item.category,
  })),
});

const buildInvalidCheckoutItem = (
  product: any,
  reason: string,
  extras: { available?: number | null; requested?: number | null } = {}
) => {
  const productId = toNumber(getAttr(product, "id"));
  return {
    productId,
    productName: String(getAttr(product, "name") || `Product #${productId}`),
    reason,
    available:
      extras.available == null ? null : Math.max(0, Number(extras.available) || 0),
    requested:
      extras.requested == null ? null : Math.max(0, Number(extras.requested) || 0),
  };
};

const prepareCartGroups = (cartItems: any[]) => {
  const groupsMap = new Map<number, any>();
  const invalidItems: any[] = [];
  let totalItems = 0;
  let subtotalAmount = 0;

  for (const product of cartItems) {
    const productId = toNumber(getAttr(product, "id"));
    const storeId = toNumber(getAttr(product, "storeId"));
    const quantity = toNumber(product?.CartItem?.quantity, 0);
    const stock = toNumber(getAttr(product, "stock"));
    const unitPrice = getProductUnitPrice(product);
    const lineTotal = unitPrice * quantity;

    if (!isStorefrontProductVisible(product)) {
      invalidItems.push({
        productId,
        productName: String(getAttr(product, "name") || `Product #${productId}`),
        reason: "PRODUCT_NOT_PUBLIC",
      });
      continue;
    }

    if (!storeId) {
      invalidItems.push(buildInvalidCheckoutItem(product, "PRODUCT_STORE_UNMAPPED"));
      continue;
    }

    if (stock <= 0) {
      invalidItems.push(
        buildInvalidCheckoutItem(product, "PRODUCT_OUT_OF_STOCK", {
          available: stock,
          requested: quantity,
        })
      );
      continue;
    }

    if (stock < quantity) {
      invalidItems.push(
        buildInvalidCheckoutItem(product, "PRODUCT_STOCK_REDUCED", {
          available: stock,
          requested: quantity,
        })
      );
      continue;
    }

    totalItems += quantity;
    subtotalAmount += lineTotal;

    const store = product?.store ?? product?.get?.("store") ?? null;
    const paymentProfile = resolvePreferredStorePaymentProfile(store);
    const paymentAvailable =
      Boolean(paymentProfile?.isActive) &&
      String(paymentProfile?.verificationStatus || "").toUpperCase() === "ACTIVE";
    const paymentProfileStatus = paymentProfile
      ? String(paymentProfile.verificationStatus || "PENDING").toUpperCase()
      : "MISSING";

    if (!groupsMap.has(storeId)) {
      groupsMap.set(storeId, {
        storeId,
        storeName: String(store?.name || `Store #${storeId}`),
        storeSlug: String(store?.slug || ""),
        store,
        paymentProfile,
        subtotalAmount: 0,
        shippingAmount: SHIPPING_PER_STORE_FALLBACK,
        totalAmount: 0,
        paymentAvailable,
        paymentMethod: paymentAvailable ? "QRIS" : null,
        paymentProfileStatus,
        merchantName: paymentProfile?.merchantName ? String(paymentProfile.merchantName) : null,
        accountName: paymentProfile?.accountName ? String(paymentProfile.accountName) : null,
        qrisImageUrl: paymentProfile?.qrisImageUrl ? String(paymentProfile.qrisImageUrl) : null,
        qrisPayload: paymentProfile?.qrisPayload ? String(paymentProfile.qrisPayload) : null,
        paymentInstruction: paymentProfile?.instructionText
          ? String(paymentProfile.instructionText)
          : null,
        warning: paymentAvailable
          ? null
          : paymentProfile
            ? "Store payment profile is not active yet."
            : "Store payment profile is not configured.",
        items: [],
      });
    }

    const group = groupsMap.get(storeId);
    group.subtotalAmount += lineTotal;
    group.items.push({
      product,
      productId,
      productName: String(getAttr(product, "name") || `Product #${productId}`),
      slug: String(getAttr(product, "slug") || ""),
      sku: getAttr(product, "sku") ? String(getAttr(product, "sku")) : null,
      qty: quantity,
      price: unitPrice,
      lineTotal,
      image: getProductImage(product),
      stock,
      category: product?.category
        ? {
            id: toNumber(product.category.id),
            name: String(product.category.name || ""),
            slug: String(product.category.code || ""),
          }
        : null,
    });

    group.paymentAvailable = group.paymentAvailable && paymentAvailable;
    if (!group.paymentAvailable) {
      group.paymentMethod = null;
      group.paymentProfileStatus = paymentProfileStatus;
      group.merchantName = paymentProfile?.merchantName ? String(paymentProfile.merchantName) : null;
      group.accountName = paymentProfile?.accountName ? String(paymentProfile.accountName) : null;
      group.qrisImageUrl = paymentProfile?.qrisImageUrl ? String(paymentProfile.qrisImageUrl) : null;
      group.qrisPayload = paymentProfile?.qrisPayload ? String(paymentProfile.qrisPayload) : null;
    }
  }

  const groups = Array.from(groupsMap.values()).map((group) => ({
    ...group,
    totalAmount: group.subtotalAmount + group.shippingAmount,
  }));
  const shippingAmount = groups.reduce(
    (sum, group) => sum + toNumber(group.shippingAmount),
    0
  );
  const grandTotal = groups.reduce((sum, group) => sum + toNumber(group.totalAmount), 0);

  return {
    checkoutMode: groups.length > 1 ? "MULTI_STORE" : "SINGLE_STORE",
    summary: {
      totalItems,
      subtotalAmount,
      shippingAmount,
      grandTotal,
      invalidItemCount: invalidItems.length,
    },
    groups,
    invalidItems,
  };
};

const lockVisibleProductsForCheckout = async (
  productIds: number[],
  transaction: any
) => {
  if (!Array.isArray(productIds) || productIds.length === 0) return new Map<number, any>();

  const rows = await Product.findAll({
    where: buildPublicProductWhere({
      id: { [Op.in]: productIds },
    }),
    attributes: [
      "id",
      "name",
      "slug",
      "sku",
      "price",
      "salePrice",
      "promoImagePath",
      "imagePaths",
      "storeId",
      "stock",
      "status",
      "isPublished",
      "sellerSubmissionStatus",
      "userId",
      "categoryId",
    ],
    include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name", "code"],
      },
      {
        model: Store,
        as: "store",
        attributes: ["id", "activeStorePaymentProfileId", "name", "slug", "status"],
        required: true,
        where: { status: "ACTIVE" } as any,
        include: [
          {
            model: StorePaymentProfile,
            as: "paymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_CHECKOUT_ATTRIBUTES],
            required: false,
          },
          {
            model: StorePaymentProfile,
            as: "activePaymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_CHECKOUT_ATTRIBUTES],
            required: false,
          },
        ],
      },
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  return new Map(
    rows.map((product: any) => [toNumber(getAttr(product, "id")), product])
  );
};

const serializeCheckoutPreview = (prepared: any) => ({
  checkoutMode: prepared.checkoutMode,
  summary: prepared.summary,
  groups: prepared.groups.map(serializePreviewGroup),
  invalidItems: prepared.invalidItems,
});

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

const loadOrderWithSplitRelations = async (lookup: string | number, transaction?: any) => {
  const trimmed = String(lookup || "").trim();
  const where = /^\d+$/.test(trimmed)
    ? { id: Number(trimmed) }
    : { invoiceNo: trimmed };

  return Order.findOne({
    where,
    include: [
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "productId", "quantity", "price"],
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
        include: [
          {
            model: Store,
            as: "store",
            attributes: ["id", "name", "slug", "status"],
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
              "qrisImageUrl",
              "qrisPayload",
              "instructionText",
              "isActive",
              "verificationStatus",
            ],
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
        ],
      },
    ],
    transaction,
  });
};

const serializeSplitOrder = (order: any) => {
  const suborders = Array.isArray((order as any)?.suborders) ? (order as any).suborders : [];
  const legacyItems = Array.isArray((order as any)?.items) ? (order as any).items : [];
  const checkoutMode =
    String(getAttr(order, "checkoutMode") || "").toUpperCase() ||
    (suborders.length > 1 ? "MULTI_STORE" : suborders.length === 1 ? "SINGLE_STORE" : "LEGACY");
  const paymentStatus =
    String(getAttr(order, "paymentStatus") || "").toUpperCase() ||
    deriveLegacyPaymentStatus(order);
  const summary = {
    totalItems: suborders.length
      ? suborders.reduce(
          (sum: number, suborder: any) =>
            sum +
            ((suborder?.items ?? []) as any[]).reduce(
              (inner: number, item: any) => inner + toNumber(getAttr(item, "qty")),
              0
            ),
          0
        )
      : legacyItems.reduce((sum: number, item: any) => sum + toNumber(getAttr(item, "quantity")), 0),
    subtotalAmount: toNumber(getAttr(order, "subtotalAmount"), 0),
    shippingAmount: toNumber(getAttr(order, "shippingAmount"), 0),
    serviceFeeAmount: toNumber(getAttr(order, "serviceFeeAmount"), 0),
    grandTotal: toNumber(getAttr(order, "totalAmount"), 0),
  };

  if (suborders.length === 0) {
    return {
      orderId: toNumber(getAttr(order, "id")),
      ref: String(getAttr(order, "invoiceNo") || getAttr(order, "id") || ""),
      invoiceNo: String(getAttr(order, "invoiceNo") || ""),
      checkoutMode: checkoutMode === "LEGACY" ? "LEGACY" : "SINGLE_STORE",
      paymentStatus,
      orderStatus: String(getAttr(order, "status") || "pending"),
      paymentMethod: getAttr(order, "paymentMethod") ? String(getAttr(order, "paymentMethod")) : null,
      createdAt: getAttr(order, "createdAt") || null,
      summary,
      groups: [
        {
          legacy: true,
          storeId: null,
          storeName: "Legacy Order",
          storeSlug: null,
          suborderId: null,
          suborderNumber: null,
          subtotalAmount: summary.grandTotal,
          shippingAmount: 0,
          serviceFeeAmount: 0,
          totalAmount: summary.grandTotal,
          paymentMethod: getAttr(order, "paymentMethod") ? String(getAttr(order, "paymentMethod")) : null,
          paymentStatus,
          fulfillmentStatus: String(getAttr(order, "status") || "pending"),
          paymentProfileStatus: "LEGACY",
          paymentAvailable: false,
          warning: "This order was created before multi-store payment split was enabled.",
          items: legacyItems.map((item: any) => ({
            id: toNumber(getAttr(item, "id")),
            productId: toNumber(getAttr(item, "productId")),
            productName: String(
              getAttr(item?.product, "name") || `Product #${getAttr(item, "productId")}`
            ),
            slug: String(getAttr(item?.product, "slug") || ""),
            qty: toNumber(getAttr(item, "quantity")),
            price: toNumber(getAttr(item, "price")),
            lineTotal: toNumber(getAttr(item, "price")) * toNumber(getAttr(item, "quantity")),
          })),
          payment: null,
        },
      ],
    };
  }

  return {
    orderId: toNumber(getAttr(order, "id")),
    ref: String(getAttr(order, "invoiceNo") || getAttr(order, "id") || ""),
    invoiceNo: String(getAttr(order, "invoiceNo") || ""),
    checkoutMode,
    paymentStatus,
    orderStatus: String(getAttr(order, "status") || "pending"),
    paymentMethod: getAttr(order, "paymentMethod") ? String(getAttr(order, "paymentMethod")) : null,
    createdAt: getAttr(order, "createdAt") || null,
    summary,
    groups: suborders.map((suborder: any) => {
      const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
      const payment = payments[0] ?? null;
      const items = Array.isArray(suborder?.items) ? suborder.items : [];
      const proof = normalizeProofSummary(payment?.proofs ?? []);
      const displayStatus = resolveBuyerFacingPaymentStatus({
        paymentStatus: getAttr(payment, "status") || "CREATED",
        suborderPaymentStatus: getAttr(suborder, "paymentStatus") || "UNPAID",
        expiresAt: getAttr(payment, "expiresAt") || null,
      });
      const proofActionability = buildBuyerProofActionability(displayStatus);
      const cancelability = buildBuyerCancelActionability(displayStatus);
      return {
        suborderId: toNumber(getAttr(suborder, "id")),
        suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
        storeId: toNumber(getAttr(suborder, "storeId")),
        storeName: String(getAttr(suborder?.store, "name") || `Store #${getAttr(suborder, "storeId")}`),
        storeSlug: getAttr(suborder?.store, "slug")
          ? String(getAttr(suborder?.store, "slug"))
          : null,
        subtotalAmount: toNumber(getAttr(suborder, "subtotalAmount")),
        shippingAmount: toNumber(getAttr(suborder, "shippingAmount")),
        serviceFeeAmount: toNumber(getAttr(suborder, "serviceFeeAmount")),
        totalAmount: toNumber(getAttr(suborder, "totalAmount")),
        paymentMethod: String(getAttr(suborder, "paymentMethod") || "QRIS"),
        paymentStatus: String(getAttr(suborder, "paymentStatus") || "UNPAID"),
        fulfillmentStatus: String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED"),
        paymentProfileStatus: getAttr(suborder?.paymentProfile, "verificationStatus")
          ? String(getAttr(suborder?.paymentProfile, "verificationStatus"))
          : "ACTIVE",
        paymentAvailable: Boolean(payment),
        warning: payment ? null : "Payment record not found for this suborder.",
        paymentInstruction: getAttr(suborder?.paymentProfile, "instructionText")
          ? String(getAttr(suborder?.paymentProfile, "instructionText"))
          : null,
        merchantName: getAttr(suborder?.paymentProfile, "merchantName")
          ? String(getAttr(suborder?.paymentProfile, "merchantName"))
          : null,
        accountName: getAttr(suborder?.paymentProfile, "accountName")
          ? String(getAttr(suborder?.paymentProfile, "accountName"))
          : null,
        items: items.map((item: any) => ({
          id: toNumber(getAttr(item, "id")),
          productId: toNumber(getAttr(item, "productId")),
          productName: String(
            getAttr(item, "productNameSnapshot") ||
              getAttr(item?.product, "name") ||
              `Product #${getAttr(item, "productId")}`
          ),
          slug: getAttr(item?.product, "slug") ? String(getAttr(item?.product, "slug")) : "",
          qty: toNumber(getAttr(item, "qty")),
          price: toNumber(getAttr(item, "priceSnapshot")),
          lineTotal: toNumber(getAttr(item, "totalPrice")),
        })),
        payment: payment
          ? {
              id: toNumber(getAttr(payment, "id")),
              internalReference: String(getAttr(payment, "internalReference") || ""),
              externalReference: getAttr(payment, "externalReference")
                ? String(getAttr(payment, "externalReference"))
                : null,
              paymentChannel: String(getAttr(payment, "paymentChannel") || "QRIS"),
              paymentType: String(getAttr(payment, "paymentType") || "QRIS_STATIC"),
              amount: toNumber(getAttr(payment, "amount")),
              qrImageUrl: getAttr(payment, "qrImageUrl")
                ? String(getAttr(payment, "qrImageUrl"))
                : null,
              qrPayload: getAttr(payment, "qrPayload")
                ? String(getAttr(payment, "qrPayload"))
                : null,
              instructionText: getAttr(suborder?.paymentProfile, "instructionText")
                ? String(getAttr(suborder?.paymentProfile, "instructionText"))
                : null,
              merchantName: getAttr(suborder?.paymentProfile, "merchantName")
                ? String(getAttr(suborder?.paymentProfile, "merchantName"))
                : null,
              accountName: getAttr(suborder?.paymentProfile, "accountName")
                ? String(getAttr(suborder?.paymentProfile, "accountName"))
                : null,
              status: String(getAttr(payment, "status") || "CREATED"),
              displayStatus,
              expiresAt: getAttr(payment, "expiresAt") || null,
              paidAt: getAttr(payment, "paidAt") || null,
              proofSubmitted:
                Array.isArray(payment?.proofs) && payment.proofs.length > 0,
              proof,
              proofActionability,
              cancelability,
            }
          : null,
      };
    }),
  };
};

router.use(requireAuth);

router.post("/preview", async (req, res) => {
  try {
    const parsed = previewRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid preview payload.",
        errors: parsed.error.flatten(),
      });
    }

    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const cart = await findCartForUser(authUser.id, parsed.data.cartId);
    const cartItems = Array.isArray((cart as any)?.Products) ? (cart as any).Products : [];
    if (!cart || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    const prepared = prepareCartGroups(cartItems);
    return res.json({
      success: true,
      data: serializeCheckoutPreview(prepared),
    });
  } catch (error) {
    console.error("[checkout/preview] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to build checkout preview.",
    });
  }
});

router.post("/create-multi-store", async (req, res) => {
  try {
    const parsed = createMultiStoreSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload.",
        errors: parsed.error.flatten(),
      });
    }

    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const normalizedCouponCode = String(parsed.data.couponCode || "").trim().toUpperCase();
    const normalizedGroupCoupons = Array.from(
      new Map(
        (Array.isArray(parsed.data.groupCoupons) ? parsed.data.groupCoupons : [])
          .map((entry) => ({
            storeId: toNumber(entry?.storeId, 0),
            couponCode: String(entry?.couponCode || "").trim().toUpperCase(),
          }))
          .filter(
            (entry) =>
              Number.isFinite(entry.storeId) && entry.storeId > 0 && entry.couponCode.length > 0
          )
          .map((entry) => [entry.storeId, entry] as const)
      ).values()
    );

    const useDefaultShipping = parsed.data.useDefaultShipping === true;
    let shippingDetails = normalizeShippingDetails(parsed.data.shippingDetails);
    if (useDefaultShipping) {
      const defaultAddress = await getDefaultAddressByUser(authUser.id);
      if (!defaultAddress) {
        return res.status(400).json({
          success: false,
          message: "Default shipping address not set.",
        });
      }
      shippingDetails = normalizeShippingDetails(defaultAddress);
    }
    const missingShippingField = getMissingShippingField(shippingDetails);
    if (missingShippingField) {
      return res.status(400).json({
        success: false,
        message: `Invalid shipping details: ${missingShippingField}`,
      });
    }

    const customer = parsed.data.customer ?? {};
    const resolvedCustomer = {
      name: shippingDetails?.fullName || String(customer.name || "").trim(),
      phone: shippingDetails?.phoneNumber || String(customer.phone || "").trim(),
      address: shippingDetails
        ? toShippingAddressLine(shippingDetails)
        : String(customer.address || "").trim(),
      notes: customer.notes ? String(customer.notes).trim() : null,
    };
    if (
      !resolvedCustomer.name.trim() ||
      !resolvedCustomer.phone.trim() ||
      !resolvedCustomer.address.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer shipping information is incomplete.",
      });
    }

    const tx = await sequelize.transaction();
    try {
      const cart = await findCartForUser(authUser.id, parsed.data.cartId, tx, true);
      const cartItems = Array.isArray((cart as any)?.Products) ? (cart as any).Products : [];
      if (!cart || cartItems.length === 0) {
        await tx.rollback();
        return res.status(400).json({
          success: false,
          message: "Cart is empty.",
        });
      }

      const requestedProductIds = Array.from(
        new Set(
          cartItems
            .map((item: any) => toNumber(getAttr(item, "id"), 0))
            .filter((id: number): id is number => Number.isFinite(id) && id > 0)
        )
      ) as number[];
      const lockedProductsById = await lockVisibleProductsForCheckout(
        requestedProductIds,
        tx
      );
      const missingLockedItems: any[] = [];
      const lockedCartItems = cartItems
        .map((item: any) => {
          const productId = toNumber(getAttr(item, "id"), 0);
          const lockedProduct = lockedProductsById.get(productId);
          if (!lockedProduct) {
            missingLockedItems.push(buildInvalidCheckoutItem(item, "PRODUCT_NOT_PUBLIC"));
            return null;
          }
          lockedProduct.setDataValue?.("CartItem", item?.CartItem ?? null);
          (lockedProduct as any).CartItem = item?.CartItem ?? null;
          return lockedProduct;
        })
        .filter(Boolean);

      const prepared = prepareCartGroups(lockedCartItems);
      if (missingLockedItems.length > 0) {
        prepared.invalidItems.unshift(...missingLockedItems);
        prepared.summary.invalidItemCount = prepared.invalidItems.length;
      }
      if (prepared.invalidItems.length > 0) {
        await tx.rollback();
        return res.status(409).json({
          success: false,
          message: "Some cart items are no longer eligible for checkout.",
          data: {
            invalidItems: prepared.invalidItems,
          },
        });
      }
      if (prepared.groups.length === 0) {
        await tx.rollback();
        return res.status(400).json({
          success: false,
          message: "No valid store groups were found in the cart.",
        });
      }

      const inactiveGroups = prepared.groups.filter((group: any) => !group.paymentAvailable);
      if (inactiveGroups.length > 0) {
        await tx.rollback();
        return res.status(409).json({
          success: false,
          message: "One or more stores do not have an active payment profile.",
          data: {
            groups: inactiveGroups.map(serializePreviewGroup),
          },
        });
      }

      for (const group of prepared.groups) {
        for (const item of group.items) {
          if (item.stock < item.qty) {
            await tx.rollback();
            return res.status(409).json({
              success: false,
              message: "Insufficient stock",
              data: {
                productId: item.productId,
                name: item.productName,
                available: item.stock,
                requested: item.qty,
              },
            });
          }
        }
      }

      if (normalizedCouponCode && normalizedGroupCoupons.length > 0) {
        await tx.rollback();
        return res.status(400).json({
          success: false,
          message: "Use either an order-level coupon or store-group coupons, not both.",
        });
      }

      let appliedCouponQuote: Awaited<ReturnType<typeof quoteCoupon>> | null = null;
      const groupCouponQuotes = new Map<number, Awaited<ReturnType<typeof quoteCoupon>>>();
      if (normalizedCouponCode) {
        if (prepared.groups.length !== 1) {
          await tx.rollback();
          return res.status(400).json({
            success: false,
            message:
              "Order-level coupon only supports single-store checkout. Use store-group coupons instead.",
          });
        }

        const scopedGroup = prepared.groups[0];
        appliedCouponQuote = await quoteCoupon(
          normalizedCouponCode,
          prepared.summary.subtotalAmount,
          prepared.summary.shippingAmount,
          { storeId: scopedGroup.storeId }
        );

        if (!appliedCouponQuote.valid) {
          await tx.rollback();
          return res.status(409).json({
            success: false,
            message:
              appliedCouponQuote.message ||
              "Coupon is not valid for the current single-store checkout.",
            data: {
              coupon: appliedCouponQuote,
            },
          });
        }
      }

      if (normalizedGroupCoupons.length > 0) {
        const groupsByStoreId = new Map(
          prepared.groups.map((group: any) => [toNumber(group.storeId), group] as const)
        );

        for (const groupCoupon of normalizedGroupCoupons) {
          const scopedGroup = groupsByStoreId.get(groupCoupon.storeId);
          if (!scopedGroup) {
            await tx.rollback();
            return res.status(400).json({
              success: false,
              message: `Coupon store #${groupCoupon.storeId} is not part of this checkout.`,
            });
          }

          const quoted = await quoteCoupon(
            groupCoupon.couponCode,
            scopedGroup.subtotalAmount,
            scopedGroup.shippingAmount,
            { storeId: scopedGroup.storeId }
          );

          if (!quoted.valid) {
            await tx.rollback();
            return res.status(409).json({
              success: false,
              message:
                quoted.message ||
                `Coupon is not valid for store ${scopedGroup.storeName || scopedGroup.storeId}.`,
              data: {
                storeId: scopedGroup.storeId,
                coupon: quoted,
              },
            });
          }

          if (String(quoted.scopeType || "").toUpperCase() !== "STORE") {
            await tx.rollback();
            return res.status(409).json({
              success: false,
              message:
                "Store-group coupons must be store-scoped. Platform coupons are not open in split checkout yet.",
              data: {
                storeId: scopedGroup.storeId,
                coupon: quoted,
              },
            });
          }

          groupCouponQuotes.set(scopedGroup.storeId, quoted);
        }
      }

      const orderLevelDiscountAmount = Math.max(0, Number(appliedCouponQuote?.discount || 0));
      const groupDiscountAmount = Array.from(groupCouponQuotes.values()).reduce(
        (sum, quoted) => sum + Math.max(0, Number(quoted?.discount || 0)),
        0
      );
      const discountAmount = orderLevelDiscountAmount + groupDiscountAmount;
      const discountedGrandTotal = Math.max(0, prepared.summary.grandTotal - discountAmount);
      const invoiceNo = buildInvoiceNo();
      const parentOrder = await Order.create(
        {
          invoiceNo,
          userId: authUser.id,
          checkoutMode: prepared.checkoutMode,
          subtotalAmount: prepared.summary.subtotalAmount,
          shippingAmount: prepared.summary.shippingAmount,
          serviceFeeAmount: 0,
          paymentStatus: "UNPAID",
          shippingDetails: shippingDetails ?? null,
          customerName: resolvedCustomer.name,
          customerPhone: resolvedCustomer.phone,
          customerAddress: resolvedCustomer.address,
          customerNotes: resolvedCustomer.notes,
          paymentMethod: "QRIS",
          totalAmount: discountedGrandTotal,
          couponCode:
            appliedCouponQuote?.code ||
            (groupCouponQuotes.size === 1 && prepared.groups.length === 1
              ? Array.from(groupCouponQuotes.values())[0]?.code || null
              : null),
          discountAmount,
          status: "pending",
        } as any,
        { transaction: tx }
      );

      const flatOrderItems = prepared.groups.flatMap((group: any) =>
        group.items.map((item: any) => ({
          orderId: parentOrder.id,
          productId: item.productId,
          quantity: item.qty,
          price: item.price,
        }))
      );
      await OrderItem.bulkCreate(flatOrderItems as any, { transaction: tx });
      const createdSellerSuborders: Array<{
        storeId: number;
        storeName: string;
        storeSlug: string | null;
        suborderId: number;
        suborderNumber: string;
        totalAmount: number;
      }> = [];

      for (let index = 0; index < prepared.groups.length; index += 1) {
        const group = prepared.groups[index];
        const paymentProfile = group.paymentProfile;
        const suborderNumber = buildSuborderNumber(invoiceNo, index);
        const orderLevelGroupDiscount =
          appliedCouponQuote && prepared.groups.length === 1 ? orderLevelDiscountAmount : 0;
        const appliedGroupCouponQuote =
          appliedCouponQuote && prepared.groups.length === 1
            ? appliedCouponQuote
            : groupCouponQuotes.get(group.storeId) || null;
        const appliedCouponAttribution = buildAppliedCouponAttribution(appliedGroupCouponQuote);
        const scopedGroupDiscount = Math.max(
          0,
          Number(groupCouponQuotes.get(group.storeId)?.discount || 0)
        );
        const totalGroupDiscount = orderLevelGroupDiscount + scopedGroupDiscount;
        const discountedGroupTotal = Math.max(0, group.totalAmount - totalGroupDiscount);
        const suborder = await Suborder.create(
          {
            orderId: parentOrder.id,
            suborderNumber,
            storeId: group.storeId,
            storePaymentProfileId: paymentProfile?.id ? Number(paymentProfile.id) : null,
            appliedCouponId: appliedCouponAttribution.appliedCouponId,
            appliedCouponCode: appliedCouponAttribution.appliedCouponCode,
            appliedCouponScopeType: appliedCouponAttribution.appliedCouponScopeType,
            subtotalAmount: group.subtotalAmount,
            shippingAmount: group.shippingAmount,
            serviceFeeAmount: 0,
            totalAmount: discountedGroupTotal,
            paymentMethod: "QRIS",
            paymentStatus: "UNPAID",
            fulfillmentStatus: "UNFULFILLED",
            expiresAt: buildPaymentExpiry(),
            paidAt: null,
          } as any,
          { transaction: tx }
        );

        await SuborderItem.bulkCreate(
          group.items.map((item: any) => ({
            suborderId: suborder.id,
            productId: item.productId,
            storeId: group.storeId,
            productNameSnapshot: item.productName,
            skuSnapshot: item.sku,
            priceSnapshot: item.price,
            qty: item.qty,
            totalPrice: item.lineTotal,
          })) as any,
          { transaction: tx }
        );

        const payment = await Payment.create(
          {
            suborderId: suborder.id,
            storeId: group.storeId,
            storePaymentProfileId: paymentProfile?.id ? Number(paymentProfile.id) : null,
            paymentChannel: "QRIS",
            paymentType: "QRIS_STATIC",
            internalReference: buildInternalPaymentReference(suborderNumber),
            amount: discountedGroupTotal,
            qrImageUrl: String(paymentProfile?.qrisImageUrl || ""),
            qrPayload: paymentProfile?.qrisPayload ? String(paymentProfile.qrisPayload) : null,
            status: "CREATED",
            expiresAt: buildPaymentExpiry(),
            paidAt: null,
          } as any,
          { transaction: tx }
        );
        await appendPaymentStatusLog(
          {
            paymentId: Number(payment.id),
            oldStatus: null,
            newStatus: "CREATED",
            actorType: "SYSTEM",
            actorId: null,
            note: "Payment record created during multi-store checkout.",
          },
          tx
        );

        createdSellerSuborders.push({
          storeId: Number(group.storeId || 0),
          storeName: String(group.storeName || `Store #${group.storeId}`),
          storeSlug: group.storeSlug ? String(group.storeSlug) : null,
          suborderId: Number((suborder as any).id || 0),
          suborderNumber,
          totalAmount: discountedGroupTotal,
        });
      }

      for (const group of prepared.groups) {
        for (const item of group.items) {
          const product = item.product;
          const currentStock = toNumber(getAttr(product, "stock"), 0);
          product.set("stock", currentStock - item.qty);
          await product.save({ transaction: tx });
        }
      }

      const cartId = toNumber(getAttr(cart, "id"), 0);
      if (cartId > 0) {
        await CartItem.destroy({
          where: { cartId },
          transaction: tx,
        });
      }

      await recalculateParentOrderPaymentStatus(Number(parentOrder.id), tx);
      await tx.commit();

      try {
        await Promise.allSettled([
          createNewOrderNotification({
            customerName: resolvedCustomer.name ?? null,
            amount: discountedGrandTotal,
            orderId: Number(parentOrder.id || 0),
            invoiceNo,
          }),
          createUserOrderPlacedNotification({
            userId: authUser.id,
            orderId: Number(parentOrder.id || 0),
            invoiceNo,
          }),
          ...createdSellerSuborders.map((suborder) =>
            createSellerNotificationsForStoreRecipients({
              storeId: suborder.storeId,
              type: "SELLER_SUBORDER_CREATED",
              title: `New suborder ${suborder.suborderNumber} is ready for seller review`,
              actionCode: "SELLER_SUBORDER_CREATED",
              orderId: Number(parentOrder.id || 0),
              suborderId: suborder.suborderId,
              route:
                suborder.storeSlug && suborder.suborderId
                  ? `/seller/stores/${encodeURIComponent(suborder.storeSlug)}/orders/${suborder.suborderId}`
                  : null,
              message: `${suborder.storeName} received a new suborder from checkout ${invoiceNo}.`,
              meta: {
                invoiceNo,
                amount: suborder.totalAmount,
                suborderNumber: suborder.suborderNumber,
              },
            })
          ),
        ]);
      } catch (notifyError) {
        console.warn("[checkout/create-multi-store] failed to create notification", notifyError);
      }

      const createdOrder = await loadOrderWithSplitRelations(parentOrder.id);
      return res.status(201).json({
        success: true,
        data: createdOrder
          ? serializeSplitOrder(createdOrder)
          : {
              orderId: parentOrder.id,
              ref: invoiceNo,
              invoiceNo,
              checkoutMode: prepared.checkoutMode,
              paymentStatus: "UNPAID",
              orderStatus: "pending",
              paymentMethod: "QRIS",
            },
      });
    } catch (error) {
      await tx.rollback();
      console.error("[checkout/create-multi-store] error", error);
      return res.status(500).json({
        success: false,
        message: (error as any)?.message || "Failed to create multi-store checkout.",
      });
    }
  } catch (error) {
    console.error("[checkout/create-multi-store] fatal error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create multi-store checkout.",
    });
  }
});

export { loadOrderWithSplitRelations, serializeSplitOrder, deriveLegacyPaymentStatus };

export default router;
