import { createHash } from "node:crypto";
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
  Shipment,
  Store,
  StorePaymentProfile,
  Suborder,
  SuborderItem,
  TrackingEvent,
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
  buildBuyerOrderPaymentEntry,
} from "../services/paymentCheckoutView.service.js";
import { buildGroupedPaymentReadModel } from "../services/groupedPaymentReadModel.service.js";
import {
  buildAdminOrderContract,
  buildFulfillmentStatusMeta,
  buildPaymentStatusMeta,
  buildSellerSuborderContract,
} from "../services/orderLifecycleContract.service.js";
import {
  buildOrderShippingReadModel,
  buildShipmentStatusMeta,
} from "../services/orderShippingReadModel.service.js";
import { createCheckoutShipmentForSuborder } from "../services/shipmentPersistence.service.js";
import {
  getLatestTimelineRecord,
  sortTimelineDesc,
} from "../services/paymentReadModel.js";
import {
  resolvePreferredStorePaymentProfile,
  STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES,
  STORE_PAYMENT_PROFILE_CHECKOUT_ATTRIBUTES,
} from "../services/sharedContracts/storePaymentProfileCompat.js";
import { buildPublicStoreOperationalReadiness } from "../services/sharedContracts/publicStoreIdentity.js";
import {
  buildBuyerAggregateStatusSummary,
  buildSplitOperationalTruth,
} from "../services/splitOperationalTruth.service.js";
import {
  buildStorePaymentProfileActivityMeta,
  buildStorePaymentProfileVerificationMeta,
} from "../services/sharedContracts/storePaymentProfileState.js";
import { getDefaultAddressByUser } from "../services/userAddress.service.js";
import {
  appendAuditNote,
  fingerprintAuditValue,
  getRequestTraceId,
  logOperationalAuditEvent,
} from "../services/operationalAudit.service.js";

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

const CHECKOUT_REQUEST_KEY_SOURCE = "CHECKOUT_REQUEST_KEY";
const CHECKOUT_REQUEST_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const CHECKOUT_IDEMPOTENCY_RETRY_AFTER_SECONDS = 2;

const createMultiStoreSchema = z.object({
  cartId: z.number().int().positive().optional(),
  shippingAddressId: z.number().int().positive().optional(),
  checkoutRequestKey: z
    .string()
    .trim()
    .min(8)
    .max(120)
    .regex(CHECKOUT_REQUEST_KEY_PATTERN)
    .optional()
    .nullable(),
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

const buildMissingCheckoutPaymentProfileStatusMeta = () => ({
  code: "MISSING",
  label: "Not configured",
  tone: "neutral",
  description: "No store payment profile snapshot is configured for this store yet.",
});

const buildCheckoutPaymentProfileStatusMeta = (paymentProfile: any) => {
  if (!paymentProfile) return buildMissingCheckoutPaymentProfileStatusMeta();

  const verificationMeta = buildStorePaymentProfileVerificationMeta(
    String(paymentProfile?.verificationStatus || "PENDING").toUpperCase()
  );

  return {
    code: String(verificationMeta.code || "PENDING").toUpperCase(),
    label: String(verificationMeta.label || "Pending review"),
    tone: String(verificationMeta.tone || "warning"),
    description: String(verificationMeta.description || "").trim() || null,
  };
};

const buildCheckoutPaymentAvailabilityMeta = (paymentProfile: any) => {
  const profileStatusMeta = buildCheckoutPaymentProfileStatusMeta(paymentProfile);
  const activityMeta = paymentProfile
    ? buildStorePaymentProfileActivityMeta(Boolean(paymentProfile?.isActive))
    : null;
  const isAvailable =
    Boolean(paymentProfile?.isActive) &&
    String(paymentProfile?.verificationStatus || "").toUpperCase() === "ACTIVE";

  if (isAvailable) {
    return {
      code: "AVAILABLE",
      label: "Payment ready",
      reason:
        "This store has an active approved payment setup and can accept checkout.",
      isAvailable: true,
    };
  }

  if (!paymentProfile) {
    return {
      code: "NOT_CONFIGURED",
      label: "Payment setup missing",
      reason:
        "No store payment profile snapshot is configured yet for this store.",
      isAvailable: false,
    };
  }

  const verificationCode = String(profileStatusMeta.code || "").toUpperCase();
  const isActive = Boolean(paymentProfile?.isActive);

  if (verificationCode === "REJECTED") {
    return {
      code: "REJECTED",
      label: "Payment setup rejected",
      reason:
        "The latest store payment setup was rejected and must be revised before checkout can continue.",
      isAvailable: false,
    };
  }

  if (verificationCode === "ACTIVE" && !isActive) {
    return {
      code: "INACTIVE",
      label: "Payment setup inactive",
      reason:
        activityMeta?.description ||
        "The store payment setup exists, but it is not active for checkout yet.",
      isAvailable: false,
    };
  }

  if (verificationCode === "INACTIVE" || !isActive) {
    return {
      code: "INACTIVE",
      label: "Payment setup inactive",
      reason:
        activityMeta?.description ||
        "The store payment setup exists, but it is not active for checkout yet.",
      isAvailable: false,
    };
  }

  return {
    code: "PENDING_REVIEW",
    label: "Payment review pending",
    reason:
      profileStatusMeta.description ||
      "The store payment setup exists, but admin review has not approved it yet.",
    isAvailable: false,
  };
};
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
  const operationalReadiness = store ? buildPublicStoreOperationalReadiness(store) : null;
  return (
    status === "active" &&
    isPublished &&
    submissionStatus === "none" &&
    Boolean(getAttr(product, "storeId")) &&
    Boolean(operationalReadiness?.isReady)
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

const buildIdempotentInvoiceNo = (userId: number, requestKey: string) => {
  const digest = createHash("sha256")
    .update(`${userId}:${requestKey}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
  return `STORE-IDEMP-${digest}`;
};

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
            attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
            required: false,
          },
          {
            model: StorePaymentProfile,
            as: "activePaymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
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

const loadCheckoutStoreSnapshots = async (storeIds: number[], transaction?: any) => {
  const normalizedIds = Array.from(
    new Set(storeIds.map((value) => toNumber(value, 0)).filter((value) => value > 0))
  );
  if (!normalizedIds.length) {
    return new Map<number, any>();
  }

  const stores = await Store.findAll({
    where: { id: { [Op.in]: normalizedIds } } as any,
    attributes: ["id", "ownerUserId", "activeStorePaymentProfileId", "name", "slug", "status"],
    include: [
      {
        model: StorePaymentProfile,
        as: "paymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
      {
        model: StorePaymentProfile,
        as: "activePaymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
    ],
    transaction,
  });

  return new Map<number, any>(stores.map((store: any) => [toNumber(getAttr(store, "id")), store]));
};

const attachStoreSnapshotsToProducts = async (products: any[], transaction?: any) => {
  const storeSnapshots = await loadCheckoutStoreSnapshots(
    (Array.isArray(products) ? products : []).map((product: any) =>
      toNumber(getAttr(product, "storeId"), 0)
    ),
    transaction
  );

  for (const product of Array.isArray(products) ? products : []) {
    const storeId = toNumber(getAttr(product, "storeId"), 0);
    const store = storeSnapshots.get(storeId);
    if (!store) continue;
    product.setDataValue?.("store", store);
    (product as any).store = store;
  }

  return products;
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
  paymentProfileStatusMeta: group.paymentProfileStatusMeta || null,
  paymentAvailabilityMeta: group.paymentAvailabilityMeta || null,
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
    const paymentProfileStatusMeta = buildCheckoutPaymentProfileStatusMeta(paymentProfile);
    const paymentAvailabilityMeta = buildCheckoutPaymentAvailabilityMeta(paymentProfile);

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
        paymentProfileStatusMeta,
        paymentAvailabilityMeta,
        merchantName: paymentProfile?.merchantName ? String(paymentProfile.merchantName) : null,
        accountName: paymentProfile?.accountName ? String(paymentProfile.accountName) : null,
        qrisImageUrl: paymentProfile?.qrisImageUrl ? String(paymentProfile.qrisImageUrl) : null,
        qrisPayload: paymentProfile?.qrisPayload ? String(paymentProfile.qrisPayload) : null,
        paymentInstruction: paymentProfile?.instructionText
          ? String(paymentProfile.instructionText)
          : null,
        warning: paymentAvailable ? null : paymentAvailabilityMeta.reason,
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
      group.paymentProfileStatusMeta = paymentProfileStatusMeta;
      group.paymentAvailabilityMeta = paymentAvailabilityMeta;
      group.merchantName = paymentProfile?.merchantName ? String(paymentProfile.merchantName) : null;
      group.accountName = paymentProfile?.accountName ? String(paymentProfile.accountName) : null;
      group.qrisImageUrl = paymentProfile?.qrisImageUrl ? String(paymentProfile.qrisImageUrl) : null;
      group.qrisPayload = paymentProfile?.qrisPayload ? String(paymentProfile.qrisPayload) : null;
      group.warning = paymentAvailabilityMeta.reason;
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

const buildCheckoutProductRequestMap = (groups: any[]) => {
  const requestedByProductId = new Map<
    number,
    {
      product: any;
      requested: number;
      productName: string;
    }
  >();

  for (const group of Array.isArray(groups) ? groups : []) {
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      const productId = toNumber(item?.productId, 0);
      if (!Number.isFinite(productId) || productId <= 0) continue;
      const current = requestedByProductId.get(productId);
      requestedByProductId.set(productId, {
        product: item?.product ?? current?.product ?? null,
        requested: toNumber(current?.requested, 0) + Math.max(0, toNumber(item?.qty, 0)),
        productName: String(item?.productName || current?.productName || `Product #${productId}`),
      });
    }
  }

  return requestedByProductId;
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
            attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
            required: false,
          },
          {
            model: StorePaymentProfile,
            as: "activePaymentProfile",
            attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
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
            model: Shipment,
            as: "shipment",
            attributes: [
              "id",
              "orderId",
              "suborderId",
              "storeId",
              "sellerUserId",
              "status",
              "courierCode",
              "courierService",
              "trackingNumber",
              "estimatedDelivery",
              "shippingFee",
              "shippingAddressSnapshot",
              "shippingRateSnapshot",
              "createdAt",
              "updatedAt",
            ],
            required: false,
            include: [
              {
                model: TrackingEvent,
                as: "trackingEvents",
                attributes: [
                  "id",
                  "shipmentId",
                  "eventType",
                  "eventLabel",
                  "eventDescription",
                  "occurredAt",
                  "source",
                  "actorType",
                  "actorId",
                  "metadata",
                  "createdAt",
                ],
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
  const shippingReadModel = buildOrderShippingReadModel(suborders);
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
  const orderStatus = String(getAttr(order, "status") || "pending");

  if (suborders.length === 0) {
    const contract = buildAdminOrderContract({
      orderStatus,
      paymentStatus,
      paymentMethod: getAttr(order, "paymentMethod"),
      displayStatuses: [],
      fulfillmentStatuses: [orderStatus],
      availableActions: [],
    });
    const operationalTruth = buildSplitOperationalTruth({
      paymentStatus,
      shipmentReadModel: {
        shippingStatus: "WAITING_PAYMENT",
        shippingStatusMeta: buildShipmentStatusMeta("WAITING_PAYMENT"),
        usedLegacyFallback: true,
        hasPersistedShipment: false,
        shipments: [],
      },
    });
    return {
      orderId: toNumber(getAttr(order, "id")),
      ref: String(getAttr(order, "invoiceNo") || getAttr(order, "id") || ""),
      invoiceNo: String(getAttr(order, "invoiceNo") || ""),
      checkoutMode: checkoutMode === "LEGACY" ? "LEGACY" : "SINGLE_STORE",
      paymentStatus,
      orderStatus,
      paymentMethod: getAttr(order, "paymentMethod") ? String(getAttr(order, "paymentMethod")) : null,
      createdAt: getAttr(order, "createdAt") || null,
      shipmentCount: 0,
      shippingStatus: "WAITING_PAYMENT",
      shippingStatusMeta: buildShipmentStatusMeta("WAITING_PAYMENT"),
      latestTrackingEvent: null,
      hasActiveShipment: false,
      hasTrackingNumber: false,
      usedLegacyFallback: true,
      shipmentAuditMeta: {
        totalSuborders: 0,
        persistedShipmentCount: 0,
        legacyFallbackSuborderCount: 0,
        compatibilityMismatchCount: 0,
        missingTrackingTimelineCount: 0,
        incompleteTrackingDataCount: 0,
        usedLegacyFallback: true,
        persistedCoverage: "NO_SUBORDERS",
      },
      suborderShipmentSummary: [],
      shipments: [],
      summary,
      contract,
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
          paymentStatusMeta: buildPaymentStatusMeta(paymentStatus),
          fulfillmentStatusMeta: buildFulfillmentStatusMeta(orderStatus),
          shipmentCount: 0,
          shippingStatus: "WAITING_PAYMENT",
          shippingStatusMeta: buildShipmentStatusMeta("WAITING_PAYMENT"),
          latestTrackingEvent: null,
          hasActiveShipment: false,
          hasTrackingNumber: false,
          operationalTruth,
          shipments: [],
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
          contract: buildSellerSuborderContract({
            orderStatus,
            paymentStatus,
            parentOrderStatus: orderStatus,
            parentPaymentStatus: paymentStatus,
            availableActions: [],
          }),
        },
      ],
    };
  }

  const groups = suborders.map((suborder: any) => {
    const payments = sortTimelineDesc(Array.isArray(suborder?.payments) ? suborder.payments : []);
    const payment = payments[0] ?? null;
    const items = Array.isArray(suborder?.items) ? suborder.items : [];
    const proof = normalizeProofSummary(payment?.proofs ?? []);
    const suborderPaymentStatus = String(getAttr(suborder, "paymentStatus") || "UNPAID");
    const fulfillmentStatus = String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED");
    const paymentReadModel = buildGroupedPaymentReadModel({
      paymentStatus: getAttr(payment, "status") || "CREATED",
      suborderPaymentStatus,
      expiresAt: getAttr(payment, "expiresAt") || null,
      hasPaymentRecord: Boolean(payment),
      missingPaymentReason: "Payment record not found for this suborder.",
    });
    const displayStatus = paymentReadModel.status;
    const proofActionability = paymentReadModel.proofActionability;
    const cancelability = paymentReadModel.cancelability;
    const shippingSummary =
      shippingReadModel.suborders.get(toNumber(getAttr(suborder, "id"))) ?? null;
    const operationalTruth = buildSplitOperationalTruth({
      paymentStatus: suborderPaymentStatus,
      paymentReadModel,
      shipmentReadModel: shippingSummary,
    });

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
      paymentStatus: suborderPaymentStatus,
      paymentStatusMeta: buildPaymentStatusMeta(suborderPaymentStatus),
      fulfillmentStatus,
      fulfillmentStatusMeta: buildFulfillmentStatusMeta(fulfillmentStatus),
      paymentProfileStatus: getAttr(suborder?.paymentProfile, "verificationStatus")
        ? String(getAttr(suborder?.paymentProfile, "verificationStatus"))
        : "ACTIVE",
      paymentAvailable: Boolean(payment),
      warning: payment ? null : "Payment record not found for this suborder.",
      paymentReadModel,
      paymentInstruction: getAttr(suborder?.paymentProfile, "instructionText")
        ? String(getAttr(suborder?.paymentProfile, "instructionText"))
        : null,
      merchantName: getAttr(suborder?.paymentProfile, "merchantName")
        ? String(getAttr(suborder?.paymentProfile, "merchantName"))
        : null,
      accountName: getAttr(suborder?.paymentProfile, "accountName")
        ? String(getAttr(suborder?.paymentProfile, "accountName"))
        : null,
       shipmentCount: shippingSummary?.shipmentCount ?? 0,
       shippingStatus:
         shippingSummary?.shippingStatus ??
         String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED").toUpperCase(),
      shippingStatusMeta:
        shippingSummary?.shippingStatusMeta ??
        buildFulfillmentStatusMeta(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED"),
       latestTrackingEvent: shippingSummary?.latestTrackingEvent ?? null,
       hasActiveShipment: Boolean(shippingSummary?.hasActiveShipment),
       hasTrackingNumber: Boolean(shippingSummary?.hasTrackingNumber),
       usedLegacyFallback: Boolean(shippingSummary?.usedLegacyFallback),
       hasPersistedShipment: Boolean(shippingSummary?.hasPersistedShipment),
       compatibilityFulfillmentStatus:
         shippingSummary?.compatibilityFulfillmentStatus ?? fulfillmentStatus,
       compatibilityFulfillmentStatusMeta:
         shippingSummary?.compatibilityFulfillmentStatusMeta ??
         buildFulfillmentStatusMeta(fulfillmentStatus),
       storedFulfillmentStatus:
         shippingSummary?.storedFulfillmentStatus ?? fulfillmentStatus,
       storedFulfillmentStatusMeta:
         shippingSummary?.storedFulfillmentStatusMeta ??
         buildFulfillmentStatusMeta(fulfillmentStatus),
       compatibilityMatchesStorage:
         typeof shippingSummary?.compatibilityMatchesStorage === "boolean"
           ? shippingSummary.compatibilityMatchesStorage
           : true,
      trackingEventCount: Number(shippingSummary?.trackingEventCount || 0),
      missingTrackingTimeline: Boolean(shippingSummary?.missingTrackingTimeline),
      incompleteTrackingData: Boolean(shippingSummary?.incompleteTrackingData),
      shipments: Array.isArray(shippingSummary?.shipments) ? shippingSummary.shipments : [],
      operationalTruth,
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
            statusMeta: buildPaymentStatusMeta(getAttr(payment, "status") || "CREATED"),
            displayStatus,
            displayStatusMeta: buildPaymentStatusMeta(displayStatus),
            readModel: paymentReadModel,
            expiresAt: getAttr(payment, "expiresAt") || null,
            paidAt: getAttr(payment, "paidAt") || null,
            proofSubmitted:
              Array.isArray(payment?.proofs) && payment.proofs.length > 0,
            proof,
            proofActionability,
            cancelability,
          }
        : null,
      contract: buildSellerSuborderContract({
        orderStatus: fulfillmentStatus,
        paymentStatus: suborderPaymentStatus,
        parentOrderStatus: orderStatus,
        parentPaymentStatus: paymentStatus,
        availableActions: [],
      }),
    };
  });

  const contract = buildAdminOrderContract({
    orderStatus,
    paymentStatus,
    paymentMethod: getAttr(order, "paymentMethod"),
    displayStatuses: groups.map((group: any) => group.payment?.displayStatus || group.paymentStatus),
    fulfillmentStatuses: groups.map((group: any) => group.fulfillmentStatus),
    availableActions: [],
  });
  const aggregateStatusSummary = buildBuyerAggregateStatusSummary(groups, contract.statusSummary);
  const orderId = toNumber(getAttr(order, "id"));
  const paymentEntryBase = buildBuyerOrderPaymentEntry(
    groups.map((group: any) => group.paymentReadModel?.status || group.paymentStatus)
  );
  const paymentEntry = {
    ...paymentEntryBase,
    targetPath: paymentEntryBase.visible ? `/user/my-orders/${orderId}/payment` : null,
  };

  return {
    orderId,
    ref: String(getAttr(order, "invoiceNo") || getAttr(order, "id") || ""),
    invoiceNo: String(getAttr(order, "invoiceNo") || ""),
    checkoutMode,
    paymentStatus,
    paymentStatusMeta: buildPaymentStatusMeta(paymentStatus),
    orderStatus,
    paymentMethod: getAttr(order, "paymentMethod") ? String(getAttr(order, "paymentMethod")) : null,
    createdAt: getAttr(order, "createdAt") || null,
    shipmentCount: shippingReadModel.shipmentCount,
    shippingStatus: shippingReadModel.shippingStatus,
    shippingStatusMeta: shippingReadModel.shippingStatusMeta,
    latestTrackingEvent: shippingReadModel.latestTrackingEvent,
    hasActiveShipment: shippingReadModel.hasActiveShipment,
    hasTrackingNumber: shippingReadModel.hasTrackingNumber,
    usedLegacyFallback: shippingReadModel.usedLegacyFallback,
    shipmentAuditMeta: shippingReadModel.shipmentAuditMeta,
    suborderShipmentSummary: shippingReadModel.suborderShipmentSummary,
    shipments: shippingReadModel.shipments,
    summary,
    contract: aggregateStatusSummary
      ? {
          ...contract,
          statusSummary: aggregateStatusSummary,
        }
      : contract,
    paymentEntry,
    groups,
  };
};

const serializeIdempotentCheckoutOrder = (order: any, replayed: boolean) => ({
  ...serializeSplitOrder(order),
  idempotency: {
    replayed,
    source: CHECKOUT_REQUEST_KEY_SOURCE,
  },
});

const loadIdempotentCheckoutOrder = async (invoiceNo: string, userId: number) => {
  const order = await loadOrderWithSplitRelations(invoiceNo);
  if (!order) return null;
  return toNumber(getAttr(order, "userId"), 0) === userId ? order : null;
};

const waitForIdempotentCheckoutOrder = async (invoiceNo: string, userId: number) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existingOrder = await loadIdempotentCheckoutOrder(invoiceNo, userId);
    if (existingOrder) return existingOrder;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
};

const isRecoverableIdempotencyRaceError = (error: any) => {
  const name = String(error?.name || "");
  const code = String(error?.parent?.code || error?.original?.code || error?.code || "");
  return (
    name === "SequelizeUniqueConstraintError" ||
    code === "ER_DUP_ENTRY" ||
    code === "SQLITE_CONSTRAINT" ||
    code === "SQLITE_BUSY" ||
    code === "ER_LOCK_DEADLOCK" ||
    code === "ER_LOCK_WAIT_TIMEOUT"
  );
};

const resolveCheckoutRequestKey = (req: any, bodyKey: unknown) => {
  const bodyRequestKey = String(bodyKey || "").trim();
  if (bodyRequestKey) return { key: bodyRequestKey, invalidHeader: false, source: "body" };

  const headerRequestKey = String(
    req.get?.("Idempotency-Key") || req.get?.("X-Idempotency-Key") || ""
  ).trim();
  if (!headerRequestKey) return { key: "", invalidHeader: false, source: null };

  return {
    key: headerRequestKey,
    invalidHeader: !CHECKOUT_REQUEST_KEY_PATTERN.test(headerRequestKey),
    source: "header",
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

    const prepared = prepareCartGroups(await attachStoreSnapshotsToProducts(cartItems));
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

    const resolvedCheckoutRequestKey = resolveCheckoutRequestKey(
      req,
      parsed.data.checkoutRequestKey
    );
    const traceId = getRequestTraceId(req);
    if (resolvedCheckoutRequestKey.invalidHeader) {
      logOperationalAuditEvent("checkout.idempotency.invalid_key", {
        traceId,
        userId: authUser.id,
        idempotencySource: resolvedCheckoutRequestKey.source || "header",
      });
      return res.status(400).json({
        success: false,
        message:
          "Invalid idempotency key. Use 8-120 characters: letters, numbers, dot, underscore, colon, or dash.",
        code: "CHECKOUT_IDEMPOTENCY_KEY_INVALID",
      });
    }
    const checkoutRequestKey = resolvedCheckoutRequestKey.key;
    const idempotencyKeyFingerprint = fingerprintAuditValue(checkoutRequestKey);
    const idempotentInvoiceNo = checkoutRequestKey
      ? buildIdempotentInvoiceNo(authUser.id, checkoutRequestKey)
      : null;
    if (idempotentInvoiceNo) {
      const existingOrder = await loadIdempotentCheckoutOrder(idempotentInvoiceNo, authUser.id);
      if (existingOrder) {
        logOperationalAuditEvent("checkout.idempotency.replay", {
          traceId,
          userId: authUser.id,
          orderId: toNumber(getAttr(existingOrder, "id"), 0),
          invoiceNo: getAttr(existingOrder, "invoiceNo"),
          idempotencyKeyFingerprint,
          idempotencySource: resolvedCheckoutRequestKey.source,
        });
        return res.status(200).json({
          success: true,
          data: serializeIdempotentCheckoutOrder(existingOrder, true),
        });
      }
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

      const prepared = prepareCartGroups(
        await attachStoreSnapshotsToProducts(lockedCartItems, tx)
      );
      if (missingLockedItems.length > 0) {
        prepared.invalidItems.unshift(...missingLockedItems);
        prepared.summary.invalidItemCount = prepared.invalidItems.length;
      }
      if (prepared.invalidItems.length > 0) {
        await tx.rollback();
        res.set("Retry-After", String(CHECKOUT_IDEMPOTENCY_RETRY_AFTER_SECONDS));
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
          message: "One or more stores are no longer operationally ready for checkout.",
          data: {
            groups: inactiveGroups.map(serializePreviewGroup),
          },
        });
      }

      const requestedByProductId = buildCheckoutProductRequestMap(prepared.groups);
      for (const [productId, entry] of requestedByProductId.entries()) {
        const currentStock = toNumber(getAttr(entry.product, "stock"), 0);
        if (currentStock < entry.requested) {
          await tx.rollback();
          return res.status(409).json({
            success: false,
            message: "Insufficient stock",
            data: {
              productId,
              name: entry.productName,
              available: currentStock,
              requested: entry.requested,
            },
          });
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
      const invoiceNo = idempotentInvoiceNo || buildInvoiceNo();
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
        const expiresAt = buildPaymentExpiry();
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
            expiresAt,
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

        await createCheckoutShipmentForSuborder({
          transaction: tx,
          order: parentOrder,
          suborder,
          group,
          shippingDetails,
        });

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
            expiresAt,
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
            traceId,
            note: appendAuditNote("Payment record created during multi-store checkout.", {
              source: "checkout:create-multi-store",
              traceId,
              orderId: Number(parentOrder.id || 0),
              invoiceNo,
              suborderId: Number(suborder.id || 0),
              suborderNumber,
              storeId: Number(group.storeId || 0),
              idempotencyKeyFingerprint,
              idempotencySource: resolvedCheckoutRequestKey.source,
            }),
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

      for (const [productId, entry] of requestedByProductId.entries()) {
        const product = entry.product ?? lockedProductsById.get(productId) ?? null;
        if (!product) continue;
        const currentStock = toNumber(getAttr(product, "stock"), 0);
        product.set("stock", Math.max(0, currentStock - entry.requested));
        await product.save({ transaction: tx });
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
      logOperationalAuditEvent("checkout.create.committed", {
        traceId,
        userId: authUser.id,
        orderId: Number(parentOrder.id || 0),
        invoiceNo,
        checkoutMode: prepared.checkoutMode,
        suborderCount: createdSellerSuborders.length,
        paymentStatus: "UNPAID",
        idempotencyKeyFingerprint,
        idempotencySource: resolvedCheckoutRequestKey.source,
      });

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
              title: `New suborder ${suborder.suborderNumber} is awaiting buyer payment`,
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
                paymentStatus: "UNPAID",
                fulfillmentStatus: "UNFULFILLED",
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
          ? idempotentInvoiceNo
            ? serializeIdempotentCheckoutOrder(createdOrder, false)
            : serializeSplitOrder(createdOrder)
          : {
              orderId: parentOrder.id,
              ref: invoiceNo,
              invoiceNo,
              checkoutMode: prepared.checkoutMode,
              paymentStatus: "UNPAID",
              orderStatus: "pending",
              paymentMethod: "QRIS",
              ...(idempotentInvoiceNo
                ? {
                    idempotency: {
                      replayed: false,
                      source: CHECKOUT_REQUEST_KEY_SOURCE,
                    },
                  }
                : {}),
            },
      });
    } catch (error) {
      const canRecoverIdempotentRace =
        Boolean(idempotentInvoiceNo) && isRecoverableIdempotencyRaceError(error);
      await tx.rollback().catch((rollbackError) => {
        console.warn("[checkout/create-multi-store] rollback failed", rollbackError);
      });
      if (canRecoverIdempotentRace && idempotentInvoiceNo) {
        const existingOrder = await waitForIdempotentCheckoutOrder(
          idempotentInvoiceNo,
          authUser.id
        );
        if (existingOrder) {
          logOperationalAuditEvent("checkout.idempotency.race_replay", {
            traceId,
            userId: authUser.id,
            orderId: toNumber(getAttr(existingOrder, "id"), 0),
            invoiceNo: getAttr(existingOrder, "invoiceNo"),
            idempotencyKeyFingerprint,
            idempotencySource: resolvedCheckoutRequestKey.source,
          });
          return res.status(200).json({
            success: true,
            data: serializeIdempotentCheckoutOrder(existingOrder, true),
          });
        }
        logOperationalAuditEvent("checkout.idempotency.in_progress", {
          traceId,
          userId: authUser.id,
          invoiceNo: idempotentInvoiceNo,
          idempotencyKeyFingerprint,
          idempotencySource: resolvedCheckoutRequestKey.source,
          retryAfterMs: CHECKOUT_IDEMPOTENCY_RETRY_AFTER_SECONDS * 1000,
        });
        res.set("Retry-After", String(CHECKOUT_IDEMPOTENCY_RETRY_AFTER_SECONDS));
        return res.status(409).json({
          success: false,
          message: "Checkout request is already being processed. Please wait a moment and retry.",
          code: "CHECKOUT_IDEMPOTENCY_IN_PROGRESS",
          data: {
            retryable: true,
            retryAfterMs: CHECKOUT_IDEMPOTENCY_RETRY_AFTER_SECONDS * 1000,
            idempotency: {
              replayed: false,
              source: CHECKOUT_REQUEST_KEY_SOURCE,
            },
          },
        });
      }
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
