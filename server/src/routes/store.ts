import { Router, Request, Response, NextFunction } from "express";
import { Op, QueryTypes } from "sequelize";
import {
  createOrderSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
} from "@ecommerce/schemas";
import { z } from "zod";
import {
  Category,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductReview,
  Store,
  Suborder,
  User,
  sequelize,
} from "../models/index.js";
import { validateCoupon } from "../services/coupon.service.js";
import {
  buildPublicOperationalStoreInclude,
  buildPublicStoreOperationalReadiness,
  serializePublicSellerInfo,
} from "../services/sharedContracts/publicStoreIdentity.js";
import {
  createNewOrderNotification,
  createUserOrderPlacedNotification,
} from "../services/notification.service.js";
import {
  ensureSettingsTable,
  getAvailableCheckoutPaymentMethods,
  getPersistedStoreSettings,
  getStripeRuntimeConfig,
} from "../services/storeSettings.js";
import {
  createStripeCheckoutSession,
  resolveStripeCheckoutBaseUrl,
  retrieveStripeCheckoutSession,
} from "../services/stripeCheckout.js";
import { syncStoreOrderFromStripeSession } from "../services/stripeOrderSync.js";
import {
  buildBuyerOrderPaymentEntry,
  resolveBuyerFacingPaymentStatus,
} from "../services/paymentCheckoutView.service.js";
import { buildGroupedPaymentReadModel } from "../services/groupedPaymentReadModel.service.js";
import {
  buildBuyerOrderContract,
  buildFulfillmentStatusMeta,
  buildPaymentStatusMeta,
  buildSellerSuborderContract,
} from "../services/orderLifecycleContract.service.js";
import { getDefaultAddressByUser } from "../services/userAddress.service.js";
import { protect } from "../middleware/authMiddleware.js";
import { STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES } from "../services/sharedContracts/storePaymentProfileCompat.js";

const router = Router();

const toNumber = (value: any) => (value == null ? null : Number(value));
const normalizeCouponCode = (value: any) => String(value || "").trim().toUpperCase();
const normalizeStoreSlug = (value: any) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
const normalizeStripeSessionId = (value: any) => String(value || "").trim();
const getAuthUserId = (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = Number(user?.id);
  if (!user || !Number.isFinite(userId)) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return userId;
};

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ??
  row?.get?.(key) ??
  row?.dataValues?.[key] ??
  undefined;

const normalizeSellerSubmissionStatus = (value: any) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "submitted") return "submitted";
  if (normalized === "needs_revision") return "needs_revision";
  return "none";
};

const toCanonicalOrderStatus = (raw: any) => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "pending";
  if (["pending_payment", "awaiting_payment", "unpaid"].includes(value)) {
    return "pending";
  }
  if (["processing", "process", "packed", "confirmed", "paid"].includes(value)) {
    return "processing";
  }
  if (["shipped", "shipping", "in_transit"].includes(value)) return "shipping";
  if (["delivered", "completed", "complete"].includes(value)) return "complete";
  if (["cancelled", "canceled", "cancel", "refunded", "failed"].includes(value)) {
    return "cancelled";
  }
  return "pending";
};

const buildStripeCheckoutLineItems = (items: Array<{
  name: string;
  quantity: number;
  price: number;
}>) =>
  items.map((item) => ({
    name: String(item.name || "Product"),
    quantity: Math.max(1, Number(item.quantity || 0)),
    unitAmount: Math.max(0, Math.round(Number(item.price || 0))),
  }));

const resolveRequestBaseUrl = (req: Request) =>
  resolveStripeCheckoutBaseUrl({
    explicitBaseUrl:
      process.env.STORE_PUBLIC_BASE_URL ||
      process.env.CLIENT_PUBLIC_BASE_URL ||
      process.env.PUBLIC_BASE_URL,
    origin: req.get("origin"),
    protocol: req.get("x-forwarded-proto") || req.protocol,
    host: req.get("x-forwarded-host") || req.get("host"),
  });

const createOrderRequestSchema = createOrderSchema.partial({
  customer: true,
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

type ShippingDetailsSnapshot = z.infer<typeof shippingDetailsSchema>;

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

const normalizeShippingDetailsOutput = (raw: any): Record<string, any> | null => {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw;
  return null;
};

const resolveOrderAmountSnapshot = (order: any, computedSubtotal = 0) => {
  const subtotalAmount = toNumber(
    getAttr(order, "subtotalAmount") ?? order?.subtotalAmount ?? order?.subtotal_amount
  );
  const shippingAmount = toNumber(
    getAttr(order, "shippingAmount") ??
      order?.shippingAmount ??
      order?.shipping_amount ??
      getAttr(order, "shippingCost") ??
      order?.shippingCost
  );
  const serviceFeeAmount = toNumber(
    getAttr(order, "serviceFeeAmount") ??
      order?.serviceFeeAmount ??
      order?.service_fee_amount
  );
  const discountAmount = toNumber(
    getAttr(order, "discountAmount") ?? order?.discountAmount ?? order?.discount_amount
  );
  const totalAmount = toNumber(
    getAttr(order, "totalAmount") ?? order?.totalAmount ?? order?.total_amount
  );

  const subtotal = Number.isFinite(subtotalAmount) ? Number(subtotalAmount) : computedSubtotal;
  const shipping = Number.isFinite(shippingAmount) ? Number(shippingAmount) : 0;
  const serviceFee = Number.isFinite(serviceFeeAmount) ? Number(serviceFeeAmount) : 0;
  const discount = Number.isFinite(discountAmount) ? Number(discountAmount) : 0;
  const total = Number.isFinite(totalAmount)
    ? Number(totalAmount)
    : Math.max(0, subtotal + shipping + serviceFee - discount);

  return {
    subtotal,
    shipping,
    serviceFee,
    discount,
    total,
  };
};

const buildBuyerPaymentEntryWithTargetPath = (
  orderId: number,
  displayStatuses: unknown[]
) => {
  const paymentEntry = buildBuyerOrderPaymentEntry(displayStatuses);
  return {
    ...paymentEntry,
    targetPath: paymentEntry.visible ? `/user/my-orders/${orderId}/payment` : null,
  };
};

const buildBuyerOrderContractPayload = (input: {
  orderId?: number;
  orderStatus?: unknown;
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  displayStatuses?: unknown[];
  fulfillmentStatuses?: unknown[];
}) => {
  const contract = buildBuyerOrderContract({
    orderStatus: input.orderStatus,
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
    displayStatuses: input.displayStatuses,
    fulfillmentStatuses: input.fulfillmentStatuses,
  });

  return {
    ...contract,
    availableActions: contract.availableActions.map((action) =>
      action.code === "CONTINUE_PAYMENT" || action.code === "CONTINUE_STRIPE_PAYMENT"
        ? {
            ...action,
            targetPath:
              input.orderId && action.enabled
                ? `/user/my-orders/${input.orderId}/payment`
                : null,
          }
        : action
    ),
  };
};

const loadStoreOrderForStripe = async (invoiceNo: string, userId: number) =>
  Order.findOne({
    where: {
      invoiceNo,
      userId,
    } as any,
    attributes: [
      "id",
      "invoiceNo",
      "status",
      "paymentStatus",
      "paymentMethod",
      "totalAmount",
      "customerName",
      "customerPhone",
      "customerAddress",
      "customerNotes",
      "createdAt",
    ],
    include: [
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "quantity", "price", ["product_id", "productId"]],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name"],
          },
        ],
      },
    ],
  });

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

const REVIEWABLE_ORDER_STATUSES = ["delivered", "completed", "complete"] as const;
const REVIEWABLE_STATUS_SQL = REVIEWABLE_ORDER_STATUSES.map((status) => `'${status}'`).join(", ");
const REVIEW_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png);base64,/i;
const REVIEW_IMAGE_FILE_PATTERN = /\.(?:jpe?g|png)(?:$|[?#])/i;

function normalizeUploadsUrl(v?: string | null) {
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/uploads/")) return v;
  if (v.startsWith("/")) return v;
  return `/uploads/${v}`;
}

function getProductId(product: any): number {
  const raw =
    product?.getDataValue?.("id") ??
    product?.get?.("id") ??
    product?.id;
  return Number(raw);
}

const toProductPreview = (product: any) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const rawImage = plain?.promoImagePath || plain?.imagePaths?.[0] || null;
  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
    imageUrl: normalizeUploadsUrl(rawImage),
  };
};

const normalizeReviewImages = (images: any) => {
  if (!Array.isArray(images)) return null;
  const cleaned = images.map((img) => String(img || "").trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
};

const normalizeReviewComment = (comment: any) => {
  if (typeof comment !== "string") return null;
  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeReviewImageOutput = (value: any) => {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^data:image\//i.test(text)) return text;
  if (/^https?:\/\//i.test(text)) return text;
  return normalizeUploadsUrl(text) || text;
};

const parseImagePaths = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
};

const isValidReviewImageReference = (value: string) => {
  const text = String(value || "").trim();
  if (!text) return false;
  if (REVIEW_IMAGE_DATA_URL_PATTERN.test(text)) return true;
  if (/^https?:\/\//i.test(text) || text.startsWith("/uploads/")) {
    return REVIEW_IMAGE_FILE_PATTERN.test(text);
  }
  return false;
};

const validateReviewSubmission = (comment: any, images: any) => {
  const normalizedComment = normalizeReviewComment(comment);
  if (!normalizedComment || normalizedComment.length < 3) {
    return {
      ok: false as const,
      message: "Comment must be at least 3 characters.",
    };
  }
  const normalizedImages = normalizeReviewImages(images);
  if (
    normalizedImages &&
    normalizedImages.some((image) => !isValidReviewImageReference(image))
  ) {
    return {
      ok: false as const,
      message: "Images must be jpg/png URLs.",
    };
  }
  return {
    ok: true as const,
    comment: normalizedComment,
    images: normalizedImages,
  };
};

const hasEligibleDeliveredOrderItem = async (userId: number, productId: number) => {
  const [rows] = await sequelize.query(
    `SELECT 1
     FROM orders o
     INNER JOIN orderitems oi ON oi.order_id = o.id
     WHERE o.user_id = ?
       AND oi.product_id = ?
       AND LOWER(COALESCE(o.status, '')) IN (${REVIEWABLE_STATUS_SQL})
     LIMIT 1`,
    { replacements: [userId, productId] }
  );
  return Array.isArray(rows) && rows.length > 0;
};

const toReviewResponse = (review: any, product: any) => {
  const rawImages = review?.images ?? review?.get?.("images") ?? null;
  const parsedImagePaths = parseImagePaths(rawImages);
  const parsedImages =
    parsedImagePaths.length > 0
      ? parsedImagePaths
      : Array.isArray(rawImages)
        ? rawImages.map((image) => String(image || "").trim()).filter(Boolean)
        : typeof rawImages === "string"
          ? [rawImages].map((image) => String(image || "").trim()).filter(Boolean)
          : [];
  const normalizedImages = parsedImages
    .map((image) => normalizeReviewImageOutput(image))
    .filter(Boolean);
  const user =
    review?.user ?? review?.get?.("user") ?? review?.dataValues?.user ?? null;
  const userName =
    user?.name ?? user?.get?.("name") ?? user?.dataValues?.name ?? null;
  const userId =
    user?.id ?? user?.get?.("id") ?? user?.dataValues?.id ?? null;
  const createdAt =
    review?.createdAt ?? review?.get?.("createdAt") ?? review?.created_at ?? null;
  const updatedAt =
    review?.updatedAt ?? review?.get?.("updatedAt") ?? review?.updated_at ?? null;
  return {
    id: review?.id ?? review?.get?.("id"),
    userId: review?.userId ?? review?.get?.("userId"),
    productId: review?.productId ?? review?.get?.("productId"),
    rating: review?.rating ?? review?.get?.("rating"),
    comment: review?.comment ?? review?.get?.("comment") ?? null,
    images: normalizedImages.length > 0 ? normalizedImages : null,
    createdAt,
    updatedAt,
    user: userName
      ? {
          id: Number.isFinite(Number(userId)) ? Number(userId) : null,
          name: String(userName),
        }
      : null,
    product: product ? toProductPreview(product) : null,
  };
};

const toSafeNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildPublicPurchaseState = (product: any, store: any) => {
  const stock = toNumber(product?.stock);
  const operationalReadiness = store ? buildPublicStoreOperationalReadiness(store) : null;
  const isStoreReady = operationalReadiness ? Boolean(operationalReadiness.isReady) : true;

  if (!isStoreReady) {
    return {
      code: "STORE_NOT_READY",
      label: "Store not ready",
      isPurchasable: false,
      description:
        operationalReadiness?.description ||
        "This store is not operational for buyer checkout yet.",
    };
  }

  if (Number.isFinite(Number(stock)) && Number(stock) <= 0) {
    return {
      code: "OUT_OF_STOCK",
      label: "Out of stock",
      isPurchasable: false,
      description: "This product stays visible, but checkout is blocked until stock is available.",
    };
  }

  return {
    code: "READY",
    label: "Ready to buy",
    isPurchasable: true,
    description: "This product currently passes the public buyer gate for add-to-cart.",
  };
};

const toProductListItem = (product: any) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const rawImage = plain?.promoImagePath || plain?.imagePaths?.[0] || null;
  const imageUrl = normalizeUploadsUrl(rawImage);
  const basePrice = toSafeNumber(plain?.price, 0);
  const salePriceRaw = toNumber(plain?.salePrice);
  const salePrice = Number.isFinite(Number(salePriceRaw)) ? Number(salePriceRaw) : null;
  const hasDiscount =
    Number.isFinite(Number(salePrice)) &&
    Number(salePrice) > 0 &&
    Number(salePrice) < basePrice;
  const price = hasDiscount ? Number(salePrice) : basePrice;
  const originalPrice = hasDiscount ? basePrice : null;
  const discountPercent =
    hasDiscount && basePrice > 0
      ? Math.round(((basePrice - Number(salePrice)) / basePrice) * 100)
      : 0;
  const ratingAvg = Number(toSafeNumber(plain?.ratingAvg ?? plain?.rating_avg, 0).toFixed(1));
  const reviewCount = Math.max(0, Math.round(toSafeNumber(plain?.reviewCount ?? plain?.review_count, 0)));
  const unit = String(plain?.tags?.unit || "").trim() || null;
  const category = plain?.category
    ? {
        id: plain.category.id,
        name: plain.category.name,
        slug: plain.category.code,
      }
    : null;
  const purchaseState = buildPublicPurchaseState(plain, plain?.store ?? null);

  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
    routeSlug: plain?.slug || null,
    productHref: plain?.slug ? `/product/${encodeURIComponent(String(plain.slug))}` : null,
    price,
    originalPrice,
    salePrice: hasDiscount ? Number(salePrice) : null,
    discountPercent,
    ratingAvg,
    reviewCount,
    unit,
    imageUrl,
    categoryId: plain?.categoryId ?? null,
    category,
    stock: plain?.stock ?? null,
    purchaseState,
    status: plain?.status,
    published: plain?.isPublished ?? plain?.published ?? false,
    updatedAt: plain?.updatedAt,
  };
};

const buildPublicProductWhere = (extraWhere: Record<string, any> = {}) => ({
  status: "active",
  isPublished: { [Op.in]: [1, true] },
  sellerSubmissionStatus: "none",
  storeId: { [Op.not]: null },
  ...extraWhere,
});

const toText = (value: any, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

// GET /api/store/categories
router.get(
  "/categories",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await Category.findAll({
        where: { published: true },
        order: [["createdAt", "DESC"]],
      });

      const normalized = categories
        .map((category: any, index: number) => {
          const id = getAttr(category, "id");
          const code = String(
            getAttr(category, "code") ?? getAttr(category, "slug") ?? ""
          ).trim();
          const name = String(
            getAttr(category, "name") ??
              getAttr(category, "title") ??
              getAttr(category, "label") ??
              code
          ).trim();
          const parentId =
            getAttr(category, "parentId") ?? getAttr(category, "parent_id") ?? null;
          const publishedRaw =
            getAttr(category, "published") ?? getAttr(category, "isPublished") ?? true;
          const imageRaw =
            getAttr(category, "icon") ??
            getAttr(category, "image") ??
            getAttr(category, "imageUrl") ??
            null;

          if (!name) return null;

          const safeCode = code || String(id ?? "").trim();
          const slug = safeCode || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

          return {
            id: id ?? index + 1,
            name,
            slug,
            code: safeCode || slug,
            image: imageRaw ? String(imageRaw).trim() : null,
            parentId,
            parent_id: parentId,
            published: Boolean(publishedRaw),
          };
        })
        .filter(Boolean);

      res.json({
        data: normalized,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store/products?search=&category=&page=&limit=
router.get(
  "/products",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.pageSize || req.query.limit || "12"), 10))
      );
      const limit = pageSize;
      const search = String(req.query.search || "").trim();
      const categoryParam = String(req.query.category || "").trim();
      const storeSlug = normalizeStoreSlug(req.query.storeSlug);

      const where: any = buildPublicProductWhere();
      if (search) {
        where.name = { [Op.like]: `%${search}%` };
      }

      if (categoryParam) {
        const categoryId = Number(categoryParam);
        if (Number.isFinite(categoryId)) {
          where.categoryId = categoryId;
        } else {
          const category = await Category.findOne({
            where: {
              published: true,
              [Op.or]: [{ code: categoryParam }, { name: categoryParam }],
            },
          });
          if (!category) {
            return res.json({
              data: [],
              meta: { page, limit, total: 0 },
            });
          }
          where.categoryId = category.id;
        }
      }

      if (storeSlug) {
        const store = await Store.findOne({
          where: {
            slug: storeSlug,
            status: "ACTIVE",
          } as any,
          attributes: ["id"],
          include: [
            {
              association: "activePaymentProfile",
              attributes: ["id"],
              required: true,
              where: {
                isActive: true,
                verificationStatus: "ACTIVE",
              } as any,
            },
          ],
        });

        if (!store) {
          return res.json({
            data: [],
            meta: {
              page,
              pageSize,
              total: 0,
              totalPages: 1,
            },
          });
        }

        where.storeId = Number((store as any).id);
      }

      const offset = (page - 1) * limit;

      const { rows, count } = await Product.findAndCountAll({
        where,
        attributes: [
          "id",
          "name",
          "slug",
          "price",
          "salePrice",
          "stock",
          "categoryId",
          "promoImagePath",
          "imagePaths",
          "tags",
          "status",
          "isPublished",
          "updatedAt",
          [
            sequelize.literal(
              "(SELECT ROUND(AVG(pr.rating), 1) FROM product_reviews pr WHERE pr.product_id = Product.id)"
            ),
            "ratingAvg",
          ],
          [
            sequelize.literal(
              "(SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = Product.id)"
            ),
            "reviewCount",
          ],
        ],
        include: [
          { model: Category, as: "category", attributes: ["id", "name", "code"] },
          buildPublicOperationalStoreInclude({
            attributes: ["id", "status"],
          }),
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "[store/products] sample",
          rows?.[0]?.toJSON?.() ?? rows?.[0]
        );
      }

      res.json({
        data: rows.map(toProductListItem),
        meta: {
          page,
          pageSize,
          total: count,
          totalPages: Math.max(1, Math.ceil(count / pageSize)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store/products/:id
router.get(
  "/products/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawParam = String(req.params.id || "").trim();
      const storeSlug = normalizeStoreSlug(req.query.storeSlug);
      const isNumeric = /^\d+$/.test(rawParam);
      const where = isNumeric
        ? { id: Number(rawParam) }
        : { slug: rawParam };

      if (storeSlug) {
        const store = await Store.findOne({
          where: {
            slug: storeSlug,
            status: "ACTIVE",
          } as any,
          attributes: ["id"],
        });

        if (!store) {
          return res.status(404).json({ message: "Store not found." });
        }

        (where as any).storeId = Number((store as any).id);
      }

      const productStoreInclude = storeSlug
        ? {
            model: Store,
            as: "store",
            attributes: [
              "id",
              "name",
              "slug",
              "status",
              "description",
              "logoUrl",
              "phone",
              "email",
              "whatsapp",
              "createdAt",
            ],
            required: true,
            where: { status: "ACTIVE" } as any,
            include: [
              {
                association: "paymentProfile",
                attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
                required: false,
              },
              {
                association: "activePaymentProfile",
                attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
                required: false,
              },
            ],
          }
        : buildPublicOperationalStoreInclude({
            attributes: [
              "id",
              "name",
              "slug",
              "status",
              "description",
              "logoUrl",
              "phone",
              "email",
              "whatsapp",
              "createdAt",
            ],
          });

      const product = await Product.findOne({
        where: buildPublicProductWhere(where),
        attributes: [
          "id",
          "name",
          "slug",
          "sku",
          "price",
          "salePrice",
          "stock",
          "description",
          "storeId",
          "categoryId",
          "status",
          "isPublished",
          "preOrder",
          "preorderDays",
          "weight",
          "condition",
          "variations",
          "promoImagePath",
          "imagePaths",
          "tags",
          "updatedAt",
        ],
        include: [
          { model: Category, as: "category", attributes: ["id", "name", "code"] },
          productStoreInclude,
        ],
      });
      if (process.env.NODE_ENV !== "production" && !isNumeric) {
        console.debug("[store/products/:id] lookup by slug", rawParam);
      }

      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }
      const productPlain = product.get ? product.get({ plain: true }) : (product as any);
      const productIdRaw =
        (product as any)?.id ??
        (product as any)?.get?.("id") ??
        (product as any)?.dataValues?.id ??
        productPlain?.id;
      const productId = Number(productIdRaw);

      let stats: { ratingAvg?: number | string | null; reviewCount?: number | string | null } = {
        ratingAvg: 0,
        reviewCount: 0,
      };
      let detailedReviews: any[] = [];
      if (Number.isFinite(productId) && productId > 0) {
        try {
          const statsRows = (await ProductReview.findAll({
            where: { productId },
            attributes: [
              [sequelize.fn("AVG", sequelize.col("rating")), "ratingAvg"],
              [sequelize.fn("COUNT", sequelize.col("id")), "reviewCount"],
            ],
            raw: true,
          })) as Array<{ ratingAvg?: number | string | null; reviewCount?: number | string | null }>;
          stats = statsRows[0] || stats;
        } catch (statsError) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[store/products/:id] stats fallback", {
              rawParam,
              productId,
              error: (statsError as any)?.message || statsError,
            });
          }
        }
        try {
          const reviewRows = await ProductReview.findAll({
            where: { productId },
            attributes: ["id", "userId", "productId", "rating", "comment", "images", "createdAt", "updatedAt"],
            include: [{ model: User, as: "user", attributes: ["id", "name"] }],
            order: [["updatedAt", "DESC"]],
            limit: 30,
          });
          detailedReviews = reviewRows.map((review: any) => toReviewResponse(review, null));
        } catch (reviewsError) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[store/products/:id] reviews fallback", {
              rawParam,
              productId,
              error: (reviewsError as any)?.message || reviewsError,
            });
          }
        }
      }
      const productWithStats = {
        ...productPlain,
        id: Number.isFinite(productId) && productId > 0 ? productId : productPlain?.id,
        published: productPlain?.published ?? productPlain?.isPublished ?? false,
        isPublished: productPlain?.isPublished ?? Boolean(productPlain?.published),
        ratingAvg: stats.ratingAvg ?? 0,
        reviewCount: stats.reviewCount ?? 0,
      };
      const sellerInfo = await serializePublicSellerInfo(productPlain?.store ?? null);

      res.json({
        data: {
          ...toProductListItem(productWithStats),
          description: productPlain?.description ?? null,
          reviews: detailedReviews,
          sellerInfo,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store/orders (auth)
router.get(
  "/orders",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const page = Math.max(1, Number(req.query.page || 1));
      const rawLimit = Number(req.query.limit || 10);
      const limit = Math.min(50, Math.max(1, rawLimit || 10));
      const offset = (page - 1) * limit;

      const { rows, count } = await Order.findAndCountAll({
        where: { userId },
        attributes: [
          "id",
          "invoiceNo",
          "checkoutMode",
          "status",
          "paymentStatus",
          "totalAmount",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      res.json({
        data: rows.map((order: any) => {
          const id = getAttr(order, "id");
          return {
            id,
            ref:
              getAttr(order, "invoiceNo") ??
              getAttr(order, "ref") ??
              String(id ?? ""),
            status: toCanonicalOrderStatus(getAttr(order, "status")),
            checkoutMode:
              String(getAttr(order, "checkoutMode") || "").toUpperCase().trim() || "LEGACY",
            paymentStatus:
              String(getAttr(order, "paymentStatus") || "").toUpperCase().trim() || "UNPAID",
            totalAmount: Number(getAttr(order, "totalAmount") || 0),
            createdAt: getAttr(order, "createdAt"),
          };
        }),
        meta: {
          page,
          limit,
          total: count,
          totalPages: Math.max(1, Math.ceil(count / limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store/my/orders (auth)
router.get(
  "/my/orders",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(
        50,
        Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20)
      );
      const offset = (page - 1) * limit;

      const [[countRow]] = (await sequelize.query(
        "SELECT COUNT(*) AS total FROM orders WHERE user_id = ?",
        { replacements: [userId] }
      )) as any;

      const [rows] = await sequelize.query(
        "SELECT id, invoice_no, checkout_mode, status, payment_status, total_amount, created_at, payment_method FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        { replacements: [userId, limit, offset] }
      );

      const orderRows = Array.isArray(rows) ? (rows as any[]) : [];
      const orderIds = orderRows
        .map((row: any) => Number(row?.id))
        .filter((value) => Number.isFinite(value) && value > 0);

      const paymentGroupsByOrderId = new Map<number, any[]>();
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => "?").join(", ");
        const paymentRows = (await sequelize.query(
          `
            SELECT
              s.order_id AS orderId,
              s.store_id AS storeId,
              st.name AS storeName,
              s.payment_status AS suborderPaymentStatus,
              p.status AS paymentStatus,
              p.expires_at AS paymentExpiresAt
            FROM suborders s
            LEFT JOIN payments p ON p.suborder_id = s.id
            LEFT JOIN stores st ON st.id = s.store_id
            WHERE s.order_id IN (${placeholders})
            ORDER BY s.order_id ASC, s.id ASC
          `,
          {
            replacements: orderIds,
            type: QueryTypes.SELECT,
          }
        )) as any[];

        for (const row of paymentRows) {
          const orderId = Number((row as any)?.orderId ?? 0);
          if (!Number.isFinite(orderId) || orderId <= 0) continue;
          const displayStatus = resolveBuyerFacingPaymentStatus({
            paymentStatus: (row as any)?.paymentStatus,
            suborderPaymentStatus: (row as any)?.suborderPaymentStatus,
            expiresAt: (row as any)?.paymentExpiresAt ?? null,
          });
          const current = paymentGroupsByOrderId.get(orderId) ?? [];
          current.push({
            storeId: Number((row as any)?.storeId ?? 0) || null,
            storeName: String((row as any)?.storeName || "").trim() || null,
            displayStatus,
          });
          paymentGroupsByOrderId.set(orderId, current);
        }
      }

      const total = Number(countRow?.total ?? countRow?.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      res.json({
        data: orderRows.map((row: any) => {
          const orderId = Number(row.id ?? 0);
          const paymentGroups = paymentGroupsByOrderId.get(orderId) ?? [];
          const displayStatuses = paymentGroups.map((group: any) => group.displayStatus);
          const paymentEntry = buildBuyerPaymentEntryWithTargetPath(orderId, displayStatuses);
          const contract = buildBuyerOrderContractPayload({
            orderId,
            orderStatus: row.status ?? null,
            paymentStatus: row.payment_status ?? row.paymentStatus ?? "UNPAID",
            paymentMethod: row.payment_method ?? row.paymentMethod ?? null,
            displayStatuses,
            fulfillmentStatuses: [],
          });
          return {
            id: row.id,
            invoiceNo: row.invoice_no ?? row.invoiceNo ?? null,
            checkoutMode: String(row.checkout_mode ?? row.checkoutMode ?? "LEGACY")
              .toUpperCase()
              .trim() || "LEGACY",
            status: toCanonicalOrderStatus(row.status ?? null),
            paymentStatus: String(row.payment_status ?? row.paymentStatus ?? "UNPAID")
              .toUpperCase()
              .trim() || "UNPAID",
            paymentStatusMeta: buildPaymentStatusMeta(
              row.payment_status ?? row.paymentStatus ?? "UNPAID"
            ),
            totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
            createdAt: row.created_at ?? row.createdAt ?? null,
            paymentMethod: row.payment_method ?? row.paymentMethod ?? null,
            paymentEntry,
            contract,
          };
        }),
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasPrev: page > 1,
          hasNext: page < totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store/orders/my/:id (auth)
router.get(
  "/orders/my/:id",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const orderId = Number(req.params.id);
      if (!Number.isFinite(orderId)) {
        return res.status(400).json({ message: "Invalid order id." });
      }

      const order = await Order.findOne({
        where: { id: orderId, userId },
        attributes: [
          "id",
          "invoiceNo",
          "checkoutMode",
          "status",
          "paymentStatus",
          "subtotalAmount",
          "shippingAmount",
          "serviceFeeAmount",
          "totalAmount",
          "couponCode",
          "discountAmount",
          "paymentMethod",
          "createdAt",
          "shippingDetails",
          "customerName",
          "customerPhone",
          "customerAddress",
        ],
        include: [
          {
            model: OrderItem,
            as: "items",
            attributes: ["id", "quantity", "price", ["product_id", "productId"]],
            include: [
              {
                model: Product,
                as: "product",
                attributes: ["id", "name"],
              },
            ],
          },
        ],
      });

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const items = ((order as any).items ?? []).map((item: any) => ({
        id: item.id,
        productId: item.productId ?? item.get?.("productId") ?? item.product_id,
        name: item.product?.name ?? `Product #${item.productId || item.product_id || "-"}`,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
      }));
      const paymentGroups = await Suborder.findAll({
        where: { orderId },
        attributes: ["id", "paymentStatus", "fulfillmentStatus", "expiresAt"],
        include: [
          {
            model: Payment,
            as: "payments",
            attributes: ["id", "status", "expiresAt", "updatedAt"],
            required: false,
          },
        ],
        order: [["id", "ASC"]],
      });
      const displayStatuses = paymentGroups.map((suborder: any) => {
        const payment = Array.isArray(suborder?.payments) ? suborder.payments[0] : null;
        return resolveBuyerFacingPaymentStatus({
          paymentStatus: payment?.status,
          suborderPaymentStatus: suborder?.paymentStatus,
          expiresAt: payment?.expiresAt ?? suborder?.expiresAt ?? null,
        });
      });
      const paymentEntryWithPath = buildBuyerPaymentEntryWithTargetPath(orderId, displayStatuses);
      const subtotal = items.reduce(
        (sum: number, item: any) => sum + Number(item.lineTotal || 0),
        0
      );
      const amounts = resolveOrderAmountSnapshot(order, subtotal);
      const tax = 0;
      const contract = buildBuyerOrderContractPayload({
        orderId,
        orderStatus: order.status,
        paymentStatus:
          String((order as any).paymentStatus || order.get?.("paymentStatus") || "UNPAID")
            .toUpperCase()
            .trim() || "UNPAID",
        paymentMethod: order.paymentMethod ?? "COD",
        displayStatuses,
        fulfillmentStatuses: paymentGroups.map((suborder: any) => suborder?.fulfillmentStatus),
      });

      return res.json({
        data: {
          id: order.id,
          ref: order.invoiceNo || String(order.id),
          invoiceNo: order.invoiceNo,
          checkoutMode:
            String((order as any).checkoutMode || order.get?.("checkoutMode") || "LEGACY")
              .toUpperCase()
              .trim() || "LEGACY",
          status: toCanonicalOrderStatus(order.status),
          paymentStatus:
            String((order as any).paymentStatus || order.get?.("paymentStatus") || "UNPAID")
              .toUpperCase()
              .trim() || "UNPAID",
          paymentStatusMeta: buildPaymentStatusMeta(
            (order as any).paymentStatus || order.get?.("paymentStatus") || "UNPAID"
          ),
          totalAmount: amounts.total,
          subtotal: amounts.subtotal,
          subtotalAmount: amounts.subtotal,
          discount: amounts.discount,
          tax,
          shipping: amounts.shipping,
          shippingCost: amounts.shipping,
          serviceFeeAmount: amounts.serviceFee,
          total: amounts.total,
          grandTotal: amounts.total,
          couponCode: (order as any).couponCode ?? null,
          paymentMethod: order.paymentMethod ?? "COD",
          paymentEntry: paymentEntryWithPath,
          contract,
          createdAt: order.createdAt,
          shippingDetails: normalizeShippingDetailsOutput(
            (order as any).shippingDetails ??
              order.get?.("shippingDetails") ??
              (order as any).shipping_details ??
              order.get?.("shipping_details") ??
              null
          ),
          customerName: order.customerName ?? null,
          customerPhone: order.customerPhone ?? null,
          customerAddress: order.customerAddress ?? null,
          items,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/store/profile (auth)
router.put(
  "/profile",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const name = typeof req.body?.name === "string" ? req.body.name.trim() : null;
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : null;
      const avatarProvided =
        Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl") ||
        Object.prototype.hasOwnProperty.call(req.body || {}, "avatar");
      const avatarRaw = avatarProvided
        ? Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl")
          ? req.body?.avatarUrl
          : req.body?.avatar
        : undefined;
      const avatarUrl =
        avatarRaw === undefined || avatarRaw == null || String(avatarRaw).trim() === ""
          ? avatarProvided
            ? null
            : undefined
          : String(avatarRaw).trim();

      if (!name && !email && avatarUrl === undefined) {
        return res.status(400).json({ message: "No updates provided." });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (name) user.name = name;
      if (email) user.email = email;
      if (avatarUrl !== undefined) {
        (user as any).avatarUrl = avatarUrl;
      }

      await user.save();

      return res.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: (user as any).role,
          avatarUrl: (user as any).avatarUrl ?? null,
        },
      });
    } catch (error: any) {
      if (error?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ message: "Email already in use." });
      }
      next(error);
    }
  }
);

// GET /api/store/orders/:ref
router.get(
  "/orders/:ref",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refParam = String(req.params.ref || "").trim();
      if (!refParam) {
        return res.status(400).json({ message: "Invalid order reference." });
      }

      // Public tracking must use the external invoice reference only.
      // Internal numeric order ids stay out of the public lookup lane.
      if (/^\d+$/.test(refParam)) {
        return res.status(400).json({
          message: "Order tracking requires a public invoice reference.",
        });
      }

      const where = sequelize.where(sequelize.col("invoice_no"), refParam);

      const order = await Order.findOne({
        where,
        attributes: [
          "id",
          "invoiceNo",
          "checkoutMode",
          "status",
          "paymentStatus",
          "subtotalAmount",
          "shippingAmount",
          "serviceFeeAmount",
          "totalAmount",
          "couponCode",
          "discountAmount",
          "paymentMethod",
          "createdAt",
          "shippingDetails",
          "customerName",
          "customerPhone",
          "customerAddress",
        ],
        include: [
          {
            model: OrderItem,
            as: "items",
            attributes: ["id", "quantity", "price", ["product_id", "productId"]],
            include: [
              {
                model: Product,
                as: "product",
                attributes: ["id", "name"],
              },
            ],
          },
          {
            model: Suborder,
            as: "suborders",
            attributes: [
              "id",
              "suborderNumber",
              "storeId",
              "totalAmount",
              "paymentStatus",
              "fulfillmentStatus",
            ],
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
                attributes: ["id", "status", "expiresAt", "paidAt", "updatedAt"],
                required: false,
              },
            ],
          },
        ],
      });

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const orderId =
        (order as any).id ??
        order.get?.("id") ??
        (order as any).get?.("id") ??
        null;
      if (!orderId) {
        return res.status(500).json({ message: "Order id missing" });
      }

      const invoiceNo =
        (order as any).invoiceNo ??
        order.get?.("invoiceNo") ??
        (order as any).invoice_no ??
        order.get?.("invoice_no") ??
        null;
      const paymentMethod =
        (order as any).paymentMethod ??
        order.get?.("paymentMethod") ??
        (order as any).payment_method ??
        order.get?.("payment_method") ??
        "COD";
      const status =
        (order as any).status ??
        order.get?.("status") ??
        (order as any).status_text ??
        order.get?.("status_text") ??
        "pending";
      const customerName =
        (order as any).customerName ??
        order.get?.("customerName") ??
        (order as any).customer_name ??
        order.get?.("customer_name") ??
        null;
      const customerPhone =
        (order as any).customerPhone ??
        order.get?.("customerPhone") ??
        (order as any).customer_phone ??
        order.get?.("customer_phone") ??
        null;
      const customerAddress =
        (order as any).customerAddress ??
        order.get?.("customerAddress") ??
        (order as any).customer_address ??
        order.get?.("customer_address") ??
        null;
      const shippingDetails =
        normalizeShippingDetailsOutput(
          (order as any).shippingDetails ??
            order.get?.("shippingDetails") ??
            (order as any).shipping_details ??
            order.get?.("shipping_details") ??
            null
        );
      const createdAt =
        (order as any).createdAt ??
        order.get?.("createdAt") ??
        (order as any).created_at ??
        order.get?.("created_at") ??
        null;

      const [rows] = await sequelize.query(
        "SELECT oi.product_id, oi.quantity, oi.price, p.name FROM orderitems oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id = ?",
        { replacements: [orderId] }
      );

      const items = (rows as any[]).map((r: any) => {
        const productId = r.product_id ?? r.productId;
        const quantity = Number(r.quantity || 0);
        const price = Number(r.price || 0);
        return {
          productId,
          name: r.name ?? `Product #${productId || "-"}`,
          quantity,
          price,
          lineTotal: price * quantity,
        };
      });
      const subtotal = items.reduce(
        (sum: number, item: any) => sum + Number(item.lineTotal || 0),
        0
      );
      const amounts = resolveOrderAmountSnapshot(order, subtotal);
      const tax = 0;
      const storeSplits = Array.isArray((order as any).suborders)
        ? [...((order as any).suborders as any[])].map((suborder: any) => {
            const store =
              suborder?.store ??
              suborder?.get?.("store") ??
              null;
            const payments = Array.isArray(suborder?.payments) ? suborder.payments : [];
            const payment = payments[0] ?? null;
            const paymentStatus =
              String(getAttr(suborder, "paymentStatus") || "UNPAID").toUpperCase().trim() ||
              "UNPAID";
            const fulfillmentStatus =
              String(getAttr(suborder, "fulfillmentStatus") || "UNFULFILLED")
                .toUpperCase()
                .trim() || "UNFULFILLED";
            const paymentReadModel = buildGroupedPaymentReadModel({
              paymentStatus: getAttr(payment, "status") || "CREATED",
              suborderPaymentStatus: paymentStatus,
              expiresAt: getAttr(payment, "expiresAt") || null,
              hasPaymentRecord: Boolean(payment),
            });
            const displayStatus = paymentReadModel.status;
            return {
              suborderId: Number(getAttr(suborder, "id") || 0),
              suborderNumber: String(getAttr(suborder, "suborderNumber") || ""),
              storeId: Number(getAttr(suborder, "storeId") || getAttr(store, "id") || 0) || null,
              storeName: String(getAttr(store, "name") || `Store #${getAttr(suborder, "storeId")}`),
              storeSlug: getAttr(store, "slug") ? String(getAttr(store, "slug")) : null,
              totalAmount: Number(getAttr(suborder, "totalAmount") || 0),
              paymentStatus,
              paymentStatusMeta: buildPaymentStatusMeta(paymentStatus),
              paymentReadModel,
              fulfillmentStatus,
              fulfillmentStatusMeta: buildFulfillmentStatusMeta(fulfillmentStatus),
              payment: payment
                ? {
                    id: Number(getAttr(payment, "id") || 0) || null,
                    status: String(getAttr(payment, "status") || "CREATED"),
                    statusMeta: buildPaymentStatusMeta(getAttr(payment, "status") || "CREATED"),
                    displayStatus,
                    displayStatusMeta: buildPaymentStatusMeta(displayStatus),
                    readModel: paymentReadModel,
                    expiresAt: getAttr(payment, "expiresAt") || null,
                    paidAt: getAttr(payment, "paidAt") || null,
                  }
                : null,
              contract: buildSellerSuborderContract({
                orderStatus: fulfillmentStatus,
                paymentStatus,
                parentOrderStatus: status,
                parentPaymentStatus:
                  (order as any).paymentStatus ??
                  order.get?.("paymentStatus") ??
                  (order as any).payment_status ??
                  order.get?.("payment_status") ??
                  "UNPAID",
                availableActions: [],
              }),
            };
          })
        : [];
      const contract = buildBuyerOrderContractPayload({
        orderStatus: status,
        paymentStatus:
          String(
            (order as any).paymentStatus ??
              order.get?.("paymentStatus") ??
              (order as any).payment_status ??
              order.get?.("payment_status") ??
              "UNPAID"
          )
            .toUpperCase()
            .trim() || "UNPAID",
        paymentMethod,
        displayStatuses: storeSplits.map(
          (split) => split.payment?.displayStatus || split.paymentStatus
        ),
        fulfillmentStatuses: storeSplits.map((split) => split.fulfillmentStatus),
      });
      const paymentEntry = buildBuyerPaymentEntryWithTargetPath(
        Number(order.id),
        storeSplits.map((split) => split.payment?.displayStatus || split.paymentStatus)
      );

      return res.json({
        data: {
          id: Number(order.id),
          ref: invoiceNo || String(order.id),
          invoiceNo,
          checkoutMode:
            String(
              (order as any).checkoutMode ??
                order.get?.("checkoutMode") ??
                (order as any).checkout_mode ??
                order.get?.("checkout_mode") ??
                "LEGACY"
            )
              .toUpperCase()
              .trim() || "LEGACY",
          status: toCanonicalOrderStatus(status),
          paymentStatus:
            String(
              (order as any).paymentStatus ??
                order.get?.("paymentStatus") ??
                (order as any).payment_status ??
                order.get?.("payment_status") ??
                "UNPAID"
            )
              .toUpperCase()
              .trim() || "UNPAID",
          paymentStatusMeta: buildPaymentStatusMeta(
            (order as any).paymentStatus ??
              order.get?.("paymentStatus") ??
              (order as any).payment_status ??
              order.get?.("payment_status") ??
              "UNPAID"
          ),
          totalAmount: amounts.total,
          subtotal: amounts.subtotal,
          subtotalAmount: amounts.subtotal,
          discount: amounts.discount,
          tax,
          shipping: amounts.shipping,
          shippingCost: amounts.shipping,
          serviceFeeAmount: amounts.serviceFee,
          total: amounts.total,
          grandTotal: amounts.total,
          couponCode: (order as any).couponCode ?? null,
          paymentMethod,
          paymentEntry,
          createdAt,
          shippingDetails,
          customerName,
          customerPhone,
          customerAddress,
          items,
          storeSplits,
          contract,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/store/my/reviews (auth)
router.get(
  "/my/reviews/need",
  protect,
  async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const [rows] = await sequelize.query(
        `SELECT
           oi.product_id AS productId,
           MAX(o.id) AS orderId,
           MAX(o.invoice_no) AS orderRef,
           MAX(o.created_at) AS orderedAt,
           p.id AS id,
           p.name AS name,
           p.slug AS slug,
           p.promo_image_path AS promoImagePath,
           p.image_paths AS imagePaths
         FROM orderitems oi
         INNER JOIN orders o ON o.id = oi.order_id
         INNER JOIN products p ON p.id = oi.product_id
         LEFT JOIN product_reviews pr
           ON pr.product_id = oi.product_id
          AND pr.user_id = ?
         WHERE o.user_id = ?
           AND LOWER(COALESCE(o.status, '')) IN (${REVIEWABLE_STATUS_SQL})
           AND pr.id IS NULL
         GROUP BY
           oi.product_id, p.id, p.name, p.slug, p.promo_image_path, p.image_paths
         ORDER BY MAX(o.created_at) DESC`,
        { replacements: [userId, userId] }
      );

      const items = (rows as any[]).map((row: any) => {
        const imagePaths = parseImagePaths(row.imagePaths ?? row.image_paths);
        const rawImage =
          row.promoImagePath ??
          row.promo_image_path ??
          imagePaths[0] ??
          null;
        const productId = Number(row.productId ?? row.product_id ?? row.id);
        const orderId = Number(row.orderId ?? row.order_id);
        return {
          productId,
          orderId: Number.isFinite(orderId) ? orderId : null,
          orderRef: row.orderRef ?? row.order_ref ?? null,
          orderedAt: row.orderedAt ?? row.ordered_at ?? null,
          name: String(row.name || `Product #${productId || "-"}`),
          slug: row.slug ? String(row.slug) : null,
          image: normalizeUploadsUrl(rawImage),
          imageUrl: normalizeUploadsUrl(rawImage),
        };
      });

      return res.json({
        success: true,
        items,
        meta: { totalItems: items.length },
      });
    } catch (error) {
      console.error("[store/my/reviews/need] error", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to load need-to-review list" });
    }
  }
);

// GET /api/store/my/reviews (auth)
router.get(
  "/my/reviews",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const reviews = await ProductReview.findAll({
        where: { userId },
        order: [["updatedAt", "DESC"]],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "slug", "promoImagePath", "imagePaths"],
          },
        ],
      });

      const items = reviews.map((review: any) =>
        toReviewResponse(review, review?.product ?? review?.get?.("product"))
      );

      return res.json({
        success: true,
        items,
        meta: { totalItems: items.length },
      });
    } catch (error) {
      console.error("[store/my/reviews] error", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to load reviews" });
    }
  }
);

// POST /api/store/reviews (auth)
router.post(
  "/reviews",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = reviewCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload",
          errors: parsed.error.flatten(),
        });
      }

      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const { productId, rating, comment, images } = parsed.data;
      const validated = validateReviewSubmission(comment, images);
      if (!validated.ok) {
        return res.status(400).json({ message: validated.message });
      }

      const eligible = await hasEligibleDeliveredOrderItem(userId, productId);
      if (!eligible) {
        return res.status(403).json({
          message: "Product is not eligible for review yet.",
        });
      }

      const product = await Product.findByPk(productId, {
        attributes: ["id", "name", "slug", "promoImagePath", "imagePaths"],
      });
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const existing = await ProductReview.findOne({
        where: { userId, productId },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You already reviewed this product.",
        });
      }

      const review = await ProductReview.create({
        userId,
        productId,
        rating,
        comment: validated.comment,
        images: validated.images,
      } as any);

      return res.status(201).json({
        success: true,
        data: toReviewResponse(review, product),
      });
    } catch (error) {
      console.error("[store/reviews] error", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to create review" });
    }
  }
);

// PATCH /api/store/reviews/:id (auth)
router.patch(
  "/reviews/:id",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviewId = Number(req.params.id);
      if (!Number.isFinite(reviewId)) {
        return res.status(400).json({ message: "Invalid review id" });
      }

      const parsed = reviewUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload",
          errors: parsed.error.flatten(),
        });
      }

      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const review = await ProductReview.findOne({
        where: { id: reviewId, userId },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "slug", "promoImagePath", "imagePaths"],
          },
        ],
      });
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      const updates: any = {};
      if (typeof parsed.data.rating === "number") {
        updates.rating = parsed.data.rating;
      }
      if (typeof parsed.data.comment !== "undefined") {
        const nextComment = normalizeReviewComment(parsed.data.comment);
        if (!nextComment || nextComment.length < 3) {
          return res.status(400).json({
            message: "Comment must be at least 3 characters.",
          });
        }
        updates.comment = nextComment;
      }
      if (typeof parsed.data.images !== "undefined") {
        const nextImages = normalizeReviewImages(parsed.data.images);
        if (
          nextImages &&
          nextImages.some((image) => !isValidReviewImageReference(image))
        ) {
          return res.status(400).json({
            message: "Images must be jpg/png URLs.",
          });
        }
        updates.images = nextImages;
      }

      await review.update(updates);
      const reviewWithRelations = review as any;

      return res.json({
        success: true,
        data: toReviewResponse(
          reviewWithRelations,
          reviewWithRelations?.product ?? reviewWithRelations?.get?.("product")
        ),
      });
    } catch (error) {
      console.error("[store/reviews/:id] error", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update review" });
    }
  }
);

// PUT /api/store/reviews/product/:productId (auth)
router.put(
  "/reviews/product/:productId",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId)) {
        return res.status(400).json({ message: "Invalid product id" });
      }

      const parsed = reviewCreateSchema.safeParse({
        ...req.body,
        productId,
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload",
          errors: parsed.error.flatten(),
        });
      }

      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const product = await Product.findByPk(productId, {
        attributes: ["id", "name", "slug", "promoImagePath", "imagePaths"],
      });
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const { rating, comment, images } = parsed.data;
      const validated = validateReviewSubmission(comment, images);
      if (!validated.ok) {
        return res.status(400).json({ message: validated.message });
      }

      const eligible = await hasEligibleDeliveredOrderItem(userId, productId);
      if (!eligible) {
        return res.status(403).json({
          message: "Product is not eligible for review yet.",
        });
      }

      const existing = await ProductReview.findOne({
        where: { userId, productId },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You already reviewed this product.",
        });
      }

      const created = await ProductReview.create({
        userId,
        productId,
        rating,
        comment: validated.comment,
        images: validated.images,
      } as any);

      return res.status(201).json({
        success: true,
        data: toReviewResponse(created, product),
      });
    } catch (error) {
      console.error("[store/reviews/product] error", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to upsert review" });
    }
  }
);

// POST /api/store/orders
// Legacy compatibility path for direct storefront order creation.
// Active storefront checkout should use /api/checkout/preview + /api/checkout/create-multi-store
// so readiness, payment availability, and order/payment contract stay aligned across apps.
router.post(
  "/orders",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = createOrderRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid payload",
            errors: parsed.error.flatten(),
          });
        }
        const userId = getAuthUserId(req, res);
        if (!userId) return;
        const { customer, items, paymentMethod, couponCode } = parsed.data;
        const useDefaultShipping = req.body?.useDefaultShipping === true;
        let shippingDetails = normalizeShippingDetails(req.body?.shippingDetails);

        if (useDefaultShipping) {
          const defaultAddress = await getDefaultAddressByUser(userId);
          if (!defaultAddress) {
            return res.status(400).json({
              message: "Default shipping address not set",
            });
          }
          shippingDetails = normalizeShippingDetails(defaultAddress);
          const missingField = getMissingShippingField(shippingDetails);
          if (missingField) {
            return res.status(400).json({
              message: `Invalid default shipping address: ${missingField}`,
            });
          }
        } else if (shippingDetails) {
          const missingField = getMissingShippingField(shippingDetails);
          if (missingField) {
            return res.status(400).json({
              message: `Invalid shipping details: ${missingField}`,
            });
          }
        }

        if (!customer && !shippingDetails) {
          return res.status(400).json({
            message: "Customer or shipping details are required",
          });
        }

        const resolvedCustomer = {
          name: shippingDetails?.fullName || customer?.name || "",
          phone: shippingDetails?.phoneNumber || customer?.phone || "",
          address: shippingDetails
            ? toShippingAddressLine(shippingDetails)
            : String(customer?.address || "").trim(),
          notes: customer?.notes ?? null,
        };
        if (
          !resolvedCustomer.name.trim() ||
          !resolvedCustomer.phone.trim() ||
          !resolvedCustomer.address.trim()
        ) {
          return res.status(400).json({
            message: "Customer shipping information is incomplete",
          });
        }

        console.log("[store] POST /orders hit", new Date().toISOString());
        console.log("[store/orders] payload", {
          customer: resolvedCustomer,
          paymentMethod,
          itemsCount: items.length,
          firstItem: items[0] ?? null,
          useDefaultShipping,
          hasShippingDetails: Boolean(shippingDetails),
        });
        const normalizedCouponCode = normalizeCouponCode(couponCode);

        const normalizedItems = new Map<number, number>();
        for (const item of items) {
          normalizedItems.set(
            item.productId,
            (normalizedItems.get(item.productId) || 0) + item.qty
          );
        }
        if (normalizedItems.size === 0) {
          return res.status(400).json({ message: "Invalid cart items." });
        }

        await ensureSettingsTable();
        const storeSettings = await getPersistedStoreSettings();
        const availablePaymentMethods = getAvailableCheckoutPaymentMethods(storeSettings);
        const availablePaymentMethodCodes = new Set(
          availablePaymentMethods.map((method) => String(method?.code || "").toUpperCase())
        );
        const normalizedPaymentMethod = String(paymentMethod || "").toUpperCase().trim();
        const stripeRuntimeConfig = getStripeRuntimeConfig(storeSettings);
        const shouldUseStripe = normalizedPaymentMethod === "STRIPE";
        if (!availablePaymentMethodCodes.has(normalizedPaymentMethod)) {
          return res.status(409).json({
            code: "STORE_PAYMENT_METHOD_NOT_AVAILABLE",
            message: "Selected payment method is not available for checkout.",
            data: {
              paymentMethod: normalizedPaymentMethod,
              availableMethods: availablePaymentMethods,
            },
          });
        }
        if (shouldUseStripe && !stripeRuntimeConfig.enabled) {
          return res.status(409).json({
            code: "STORE_PAYMENT_METHOD_NOT_READY",
            message: "Stripe checkout is not ready for this store yet.",
          });
        }
        const checkoutBaseUrl = shouldUseStripe ? resolveRequestBaseUrl(req) : "";
        if (shouldUseStripe && !checkoutBaseUrl) {
          return res.status(500).json({
            code: "STORE_PAYMENT_CHECKOUT_BASE_URL_MISSING",
            message: "Stripe checkout cannot start because the public base URL is missing.",
          });
        }
        const checkoutUser = shouldUseStripe
          ? await User.findByPk(userId, { attributes: ["id", "name", "email"] })
          : null;

      const tx = await sequelize.transaction();
      try {
        const itemsNorm = Array.from(normalizedItems.entries()).map(([productId, qty]) => ({
          productId: Number(productId),
          qty: Number(qty),
        }));
        const productIds = [
          ...new Set(itemsNorm.map((item) => Number(item.productId))),
        ].filter((id) => Number.isFinite(id) && id > 0);
        if (process.env.NODE_ENV !== "production") {
          console.log("[store/orders] requestedIds", productIds);
        }

        const products = await Product.findAll({
          where: buildPublicProductWhere({
            id: { [Op.in]: productIds },
          }),
          attributes: [
            "id",
            "name",
            "stock",
            "price",
            "salePrice",
            "status",
            "isPublished",
            "sellerSubmissionStatus",
          ],
          include: [
            buildPublicOperationalStoreInclude({
              attributes: ["id"],
            }),
          ],
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });
        if (process.env.NODE_ENV !== "production") {
          const foundIdsArr = products
            .map((product: any) => getProductId(product))
            .filter((n: number) => Number.isFinite(n) && n > 0);
          console.log("[store/orders] foundIds", foundIdsArr);
          console.log(
            "[store/orders] sampleProduct",
            products?.[0]?.toJSON?.() ?? products?.[0]
          );
        }

        const foundIdsArr = products
          .map((product: any) => getProductId(product))
          .filter((n: number) => Number.isFinite(n) && n > 0);
        const foundIds = new Set(foundIdsArr);
        if (products.length !== productIds.length) {
          const missing = productIds.filter((id) => !foundIds.has(id));
          await tx.rollback();
          return res.status(400).json({
            message: "Invalid productId",
            missing,
          });
        }

        const byId = new Map(
          products.map((product: any) => {
            const id = getProductId(product);
            return [id, product];
          })
        );
        const getUnitPrice = (product: any) => {
          const rawSale =
            product?.getDataValue?.("salePrice") ??
            product?.get?.("salePrice") ??
            product?.salePrice;
          const rawPrice =
            product?.getDataValue?.("price") ??
            product?.get?.("price") ??
            product?.price;
          const rawOriginal =
            product?.getDataValue?.("originalPrice") ??
            product?.get?.("originalPrice") ??
            product?.originalPrice;
          const sale = Number(rawSale ?? 0);
          const price = Number(rawPrice ?? 0);
          const original = Number(rawOriginal ?? 0);
          if (Number.isFinite(sale) && sale > 0) return sale;
          if (Number.isFinite(price) && price > 0) return price;
          if (Number.isFinite(original) && original > 0) return original;
          return 0;
        };

        for (const item of itemsNorm) {
          const product = byId.get(item.productId);
          if (!product) {
            await tx.rollback();
            return res.status(400).json({
              message: "Invalid productId",
              missing: [item.productId],
            });
          }
          if (process.env.NODE_ENV !== "production") {
            console.log("[store/orders] stockCheck", {
              item: { productId: item.productId, qty: item.qty },
              product: product
                ? {
                    id: product.get?.("id") ?? product.getDataValue?.("id") ?? product.id,
                    name: product.get?.("name") ?? product.name,
                    stock: product.get?.("stock") ?? product.stock,
                    status: product.get?.("status") ?? product.status,
                    isPublished: product.get?.("isPublished") ?? product.isPublished,
                    published: product.get?.("published") ?? product.published,
                  }
                : null,
            });
          }
          const stock = Number(
            product.getDataValue?.("stock") ?? (product as any).stock ?? 0
          );
          if (stock < item.qty) {
            await tx.rollback();
            return res.status(409).json({
              message: "Insufficient stock",
              data: {
                productId: Number(
                  product.getDataValue?.("id") ?? (product as any).id
                ),
                name: String(
                  product.getDataValue?.("name") ?? (product as any).name ?? ""
                ),
                available: stock,
                requested: item.qty,
              },
            });
          }
        }

        let subtotal = 0;
        const orderStoreIds = new Set<number>();
          const responseItems: Array<{
            productId: number;
            name: string;
            quantity: number;
            price: number;
            lineTotal: number;
          }> = [];
          const orderItemsPayload = itemsNorm.map((item) => {
            const product = byId.get(item.productId)!;
            const storeId = Number(
              product?.store?.id ??
                product?.get?.("store")?.id ??
                product?.dataValues?.store?.id ??
                0
            );
            if (Number.isFinite(storeId) && storeId > 0) {
              orderStoreIds.add(storeId);
            }
            const unitPrice = getUnitPrice(product);
            subtotal += unitPrice * item.qty;
            const pid = getProductId(product);
            if (!Number.isFinite(pid)) {
              throw new Error("Invalid product id for order item");
            }
            const name =
              product?.getDataValue?.("name") ??
              product?.get?.("name") ??
              product?.name ??
              `Product #${pid}`;
            responseItems.push({
              productId: pid,
              name: String(name || `Product #${pid}`),
              quantity: item.qty,
              price: unitPrice,
              lineTotal: unitPrice * item.qty,
            });
            return {
              productId: pid,
              product_id: pid,
              quantity: item.qty,
              price: unitPrice,
            };
          });
      if (process.env.NODE_ENV !== "production") {
        console.log("[store/orders] orderItemsPayload sample", orderItemsPayload[0]);
      }

        let discountAmount = 0;
        let appliedCouponCode: string | null = null;
          if (normalizedCouponCode) {
            const result = await validateCoupon(normalizedCouponCode, subtotal, {
              storeIds: Array.from(orderStoreIds),
            });
            if (!result.valid) {
              await tx.rollback();
              return res.status(400).json({
                message: result.message || "Coupon invalid/expired/min spend not met",
              });
            }
            discountAmount = result.discountAmount;
            appliedCouponCode = result.code || normalizedCouponCode;
          }

      const tax = 0;
      const shipping = 0;
      const totalAmount = Math.max(0, subtotal - discountAmount + tax + shipping);
      if (process.env.NODE_ENV !== "production") {
        console.debug("create order totals", {
          subtotal,
          total: totalAmount,
          totalAmount,
        });
      }

        const orderStatus = "pending";
        let stripeCheckout:
          | {
              sessionId: string;
              url: string | null;
            }
          | null = null;
        const order = await Order.create(
            {
              invoiceNo: `STORE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              userId,
              shippingDetails: shippingDetails ?? null,
              customerName: resolvedCustomer.name,
              customerPhone: resolvedCustomer.phone,
              customerAddress: resolvedCustomer.address,
              customerNotes: resolvedCustomer.notes ?? null,
              paymentMethod: normalizedPaymentMethod,
              paymentStatus: "UNPAID",
              totalAmount,
              couponCode: appliedCouponCode,
              discountAmount,
              status: toCanonicalOrderStatus(orderStatus),
            } as any,
            { transaction: tx }
          );

        await OrderItem.bulkCreate(
          orderItemsPayload.map((item) => ({ ...item, orderId: order.id })),
          { transaction: tx }
        );

        for (const item of itemsNorm) {
          const product = byId.get(item.productId)!;
          const currentStock = Number(
            product.getDataValue?.("stock") ?? product.get?.("stock") ?? product.stock ?? 0
          );
          product.stock = currentStock - item.qty;
          await product.save({ transaction: tx });
        }

        const invoiceNoForPayment =
          order?.getDataValue?.("invoiceNo") ??
          order?.get?.("invoiceNo") ??
          (order as any)?.dataValues?.invoiceNo ??
          (order as any)?.invoiceNo ??
          null;
        if (!invoiceNoForPayment) {
          throw new Error("Order invoice reference is missing.");
        }

        if (shouldUseStripe) {
          stripeCheckout = await createStripeCheckoutSession({
            secretKey: stripeRuntimeConfig.secretKey,
            baseUrl: checkoutBaseUrl,
            invoiceNo: String(invoiceNoForPayment),
            orderId: Number(order.id),
            amountTotal: totalAmount,
            lineItems: buildStripeCheckoutLineItems(responseItems),
            customerEmail: checkoutUser?.get?.("email") ? String(checkoutUser.get("email")) : null,
            customerName: resolvedCustomer.name,
            currency: stripeRuntimeConfig.currency,
          });
          if (!stripeCheckout?.url) {
            throw new Error("Stripe checkout session did not return a redirect URL.");
          }
        }

        await tx.commit();

          const invoiceNo =
            order?.getDataValue?.("invoiceNo") ??
            order?.get?.("invoiceNo") ??
            (order as any)?.dataValues?.invoiceNo ??
            (order as any)?.invoiceNo ??
            null;
          const createdAt =
            order?.getDataValue?.("createdAt") ??
            order?.get?.("createdAt") ??
            (order as any)?.createdAt ??
            new Date().toISOString();
          try {
            await Promise.allSettled([
              createNewOrderNotification({
                customerName: resolvedCustomer.name ?? null,
                amount: totalAmount,
                orderId: Number(order?.id || 0),
                invoiceNo: invoiceNo ? String(invoiceNo) : null,
              }),
              createUserOrderPlacedNotification({
                userId,
                orderId: Number(order?.id || 0),
                invoiceNo: invoiceNo ? String(invoiceNo) : null,
              }),
            ]);
          } catch (notifyError) {
            console.warn("[store/orders] failed to create notification", notifyError);
          }
          return res.status(201).json({
            success: true,
            data: {
              id: order.id,
              ref: invoiceNo || String(order.id),
              invoiceNo,
              status: orderStatus,
              totalAmount,
              createdAt,
              subtotal,
              discount: discountAmount,
              tax,
              shipping,
              total: totalAmount,
              shippingDetails: shippingDetails ?? null,
              useDefaultShipping,
              paymentStatus: "UNPAID",
              paymentMethod: normalizedPaymentMethod,
              checkoutRedirectMode: stripeCheckout ? "HOSTED" : null,
              checkoutRedirectUrl: stripeCheckout?.url || null,
              checkoutSessionId: stripeCheckout?.sessionId || null,
              items: responseItems,
            },
          });
      } catch (error) {
        await tx.rollback();
        console.error("[store/orders] error", error);
        const errorMessage = (error as any)?.message;
        return res
          .status(500)
          .json({ message: errorMessage || "Failed to create order" });
      }
    } catch (error) {
      console.error("[store/orders] error", error);
      const errorMessage = (error as any)?.message;
      return res
        .status(500)
        .json({ message: errorMessage || "Failed to create order" });
    }
  }
);

router.get(
  "/orders/:ref/stripe/session",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const refParam = String(req.params.ref || "").trim();
      const sessionId = normalizeStripeSessionId(req.query.sessionId);
      if (!refParam || !sessionId) {
        return res.status(400).json({
          code: "STRIPE_SESSION_QUERY_INVALID",
          message: "Order reference and Stripe session id are required.",
        });
      }

      await ensureSettingsTable();
      const storeSettings = await getPersistedStoreSettings();
      const stripeRuntimeConfig = getStripeRuntimeConfig(storeSettings);
      if (!stripeRuntimeConfig.enabled) {
        return res.status(409).json({
          code: "STORE_PAYMENT_METHOD_NOT_READY",
          message: "Stripe checkout is not ready for this store yet.",
        });
      }

      const order = await loadStoreOrderForStripe(refParam, userId);
      if (!order) {
        return res.status(404).json({
          code: "STORE_ORDER_NOT_FOUND",
          message: "Order not found.",
        });
      }

      const paymentMethod = String(getAttr(order, "paymentMethod") || "").toUpperCase().trim();
      if (paymentMethod !== "STRIPE") {
        return res.status(409).json({
          code: "STORE_ORDER_PAYMENT_METHOD_MISMATCH",
          message: "This order does not use Stripe checkout.",
        });
      }

      const session = await retrieveStripeCheckoutSession({
        secretKey: stripeRuntimeConfig.secretKey,
        sessionId,
      });

      const invoiceNo = String(getAttr(order, "invoiceNo") || refParam);
      const sessionInvoiceNo =
        String(session.client_reference_id || "") ||
        String(session.metadata?.invoiceNo || "");
      if (sessionInvoiceNo !== invoiceNo) {
        return res.status(409).json({
          code: "STRIPE_SESSION_ORDER_MISMATCH",
          message: "Stripe session does not belong to this order.",
        });
      }

      const syncResult = await syncStoreOrderFromStripeSession({
        session,
        source: "return",
      });
      const nextPaymentStatus = syncResult.ok
        ? syncResult.paymentStatus || "UNPAID"
        : String(getAttr(order, "paymentStatus") || "UNPAID").toUpperCase().trim() || "UNPAID";
      const nextOrderStatus = syncResult.ok
        ? syncResult.orderStatus || "pending"
        : String(getAttr(order, "status") || "pending").toLowerCase().trim() || "pending";
      const contract = buildBuyerOrderContractPayload({
        orderStatus: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        paymentMethod,
        displayStatuses: [nextPaymentStatus === "PAID" ? "PAID" : "CREATED"],
        fulfillmentStatuses: [nextOrderStatus],
      });

      return res.json({
        success: true,
        data: {
          orderRef: invoiceNo,
          sessionId,
          sessionStatus: String(session.status || "").toLowerCase() || null,
          sessionPaymentStatus: String(session.payment_status || "").toUpperCase() || null,
          paymentStatus: nextPaymentStatus,
          orderStatus: nextOrderStatus,
          paid: nextPaymentStatus === "PAID",
          updatedBySync: syncResult.ok ? syncResult.updated : false,
          contract,
          checkoutUrl:
            String(session.status || "").toLowerCase() === "open" && session.url
              ? String(session.url)
              : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/orders/:ref/stripe/session",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req, res);
      if (!userId) return;

      const refParam = String(req.params.ref || "").trim();
      if (!refParam) {
        return res.status(400).json({
          code: "STORE_ORDER_REFERENCE_INVALID",
          message: "Order reference is required.",
        });
      }

      await ensureSettingsTable();
      const storeSettings = await getPersistedStoreSettings();
      const stripeRuntimeConfig = getStripeRuntimeConfig(storeSettings);
      if (!stripeRuntimeConfig.enabled) {
        return res.status(409).json({
          code: "STORE_PAYMENT_METHOD_NOT_READY",
          message: "Stripe checkout is not ready for this store yet.",
        });
      }

      const order = await loadStoreOrderForStripe(refParam, userId);
      if (!order) {
        return res.status(404).json({
          code: "STORE_ORDER_NOT_FOUND",
          message: "Order not found.",
        });
      }

      const paymentMethod = String(getAttr(order, "paymentMethod") || "").toUpperCase().trim();
      const paymentStatus =
        String(getAttr(order, "paymentStatus") || "UNPAID").toUpperCase().trim() || "UNPAID";
      if (paymentMethod !== "STRIPE") {
        return res.status(409).json({
          code: "STORE_ORDER_PAYMENT_METHOD_MISMATCH",
          message: "This order does not use Stripe checkout.",
        });
      }
      if (paymentStatus === "PAID") {
        return res.status(409).json({
          code: "STORE_ORDER_ALREADY_PAID",
          message: "This order has already been paid.",
        });
      }

      const checkoutBaseUrl = resolveRequestBaseUrl(req);
      if (!checkoutBaseUrl) {
        return res.status(500).json({
          code: "STORE_PAYMENT_CHECKOUT_BASE_URL_MISSING",
          message: "Stripe checkout cannot start because the public base URL is missing.",
        });
      }

      const orderItems = Array.isArray((order as any).items) ? ((order as any).items as any[]) : [];
      const stripeCheckout = await createStripeCheckoutSession({
        secretKey: stripeRuntimeConfig.secretKey,
        baseUrl: checkoutBaseUrl,
        invoiceNo: String(getAttr(order, "invoiceNo") || refParam),
        orderId: Number(getAttr(order, "id") || 0),
        amountTotal: Number(getAttr(order, "totalAmount") || 0),
        lineItems: buildStripeCheckoutLineItems(
          orderItems.map((item: any) => ({
            name:
              String(item?.product?.name || item?.get?.("product")?.name || "").trim() ||
              `Product #${String(item?.productId || item?.get?.("productId") || "")}`,
            quantity: Number(item?.quantity || item?.get?.("quantity") || 0),
            price: Number(item?.price || item?.get?.("price") || 0),
          }))
        ),
        customerName: String(getAttr(order, "customerName") || ""),
        currency: stripeRuntimeConfig.currency,
      });

      if (!stripeCheckout?.url) {
        return res.status(502).json({
          code: "STRIPE_SESSION_URL_MISSING",
          message: "Stripe checkout session did not return a redirect URL.",
        });
      }

      return res.json({
        success: true,
        data: {
          orderRef: String(getAttr(order, "invoiceNo") || refParam),
          checkoutRedirectMode: "HOSTED",
          checkoutRedirectUrl: stripeCheckout.url,
          checkoutSessionId: stripeCheckout.sessionId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;


