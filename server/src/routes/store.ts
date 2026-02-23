import { Router, Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import {
  createOrderSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
} from "@ecommerce/schemas";
import {
  Category,
  Order,
  OrderItem,
  Product,
  ProductReview,
  User,
  sequelize,
} from "../models/index.js";
import { validateCoupon } from "../services/coupon.service.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

const toNumber = (value: any) => (value == null ? null : Number(value));
const normalizeCouponCode = (value: any) => String(value || "").trim().toUpperCase();
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

const toReviewResponse = (review: any, product: any) => {
  const images = review?.images ?? review?.get?.("images") ?? null;
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
    images: Array.isArray(images) ? images : images ? [images] : null,
    createdAt,
    updatedAt,
    product: product ? toProductPreview(product) : null,
  };
};

const toSafeNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
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
    status: plain?.status,
    published: plain?.published,
    updatedAt: plain?.updatedAt,
  };
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

      const where: any = {
        status: "active",
        published: { [Op.in]: [1, true] },
      };
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
          "published",
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
        include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
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
      const isNumeric = /^\d+$/.test(rawParam);
      const where = isNumeric
        ? { id: Number(rawParam) }
        : { slug: rawParam };
      const product = await Product.findOne({
        where: {
          ...where,
          status: "active",
          published: { [Op.in]: [1, true] },
        },
        include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
      });
      if (process.env.NODE_ENV !== "production" && !isNumeric) {
        console.debug("[store/products/:id] lookup by slug", rawParam);
      }

      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }
      const statsRows = (await ProductReview.findAll({
        where: { productId: product.id },
        attributes: [
          [sequelize.fn("AVG", sequelize.col("rating")), "ratingAvg"],
          [sequelize.fn("COUNT", sequelize.col("id")), "reviewCount"],
        ],
        raw: true,
      })) as Array<{ ratingAvg?: number | string | null; reviewCount?: number | string | null }>;
      const stats = statsRows[0] || {};
      const productWithStats = {
        ...(product.get ? product.get({ plain: true }) : product),
        ratingAvg: stats.ratingAvg ?? 0,
        reviewCount: stats.reviewCount ?? 0,
      };

      res.json({
        data: {
          ...toProductListItem(productWithStats),
          description: product.description ?? null,
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
        attributes: ["id", "invoiceNo", "status", "totalAmount", "createdAt"],
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

      const [rows] = await sequelize.query(
        "SELECT id, invoice_no, status, total_amount, created_at, payment_method FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        { replacements: [userId] }
      );

      res.json({
        data: (rows as any[]).map((row: any) => ({
          id: row.id,
          invoiceNo: row.invoice_no ?? row.invoiceNo ?? null,
          status: toCanonicalOrderStatus(row.status ?? null),
          totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
          createdAt: row.created_at ?? row.createdAt ?? null,
          paymentMethod: row.payment_method ?? row.paymentMethod ?? null,
        })),
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
          "status",
          "totalAmount",
          "couponCode",
          "discountAmount",
          "paymentMethod",
          "createdAt",
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
      const subtotal = items.reduce(
        (sum: number, item: any) => sum + Number(item.lineTotal || 0),
        0
      );
      const discountAmount = Number((order as any).discountAmount || 0);
      const tax = 0;
      const shipping = 0;

      return res.json({
        data: {
          id: order.id,
          ref: order.invoiceNo || String(order.id),
          invoiceNo: order.invoiceNo,
          status: toCanonicalOrderStatus(order.status),
          totalAmount: Number(order.totalAmount || 0),
          subtotal,
          discount: discountAmount,
          tax,
          shipping,
          couponCode: (order as any).couponCode ?? null,
          paymentMethod: order.paymentMethod ?? "COD",
          createdAt: order.createdAt,
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

      if (!name && !email) {
        return res.status(400).json({ message: "No updates provided." });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (name) user.name = name;
      if (email) user.email = email;

      await user.save();

      return res.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: (user as any).role,
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

      const isNumeric = /^\d+$/.test(refParam);
      const where = isNumeric
        ? { id: Number(refParam) }
        : sequelize.where(sequelize.col("invoice_no"), refParam);

      const order = await Order.findOne({
        where,
        attributes: [
          "id",
          "invoiceNo",
          "status",
          "totalAmount",
          "couponCode",
          "discountAmount",
          "paymentMethod",
          "createdAt",
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
      const totalAmount =
        (order as any).totalAmount ??
        order.get?.("totalAmount") ??
        (order as any).total_amount ??
        order.get?.("total_amount") ??
        0;
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
      const discountAmount = Number((order as any).discountAmount || 0);
      const tax = 0;
      const shipping = 0;

      return res.json({
        data: {
          ref: invoiceNo || String(order.id),
          invoiceNo,
          status: toCanonicalOrderStatus(status),
          totalAmount: Number(totalAmount),
          subtotal,
          discount: discountAmount,
          tax,
          shipping,
          couponCode: (order as any).couponCode ?? null,
          paymentMethod,
          createdAt,
          customerName,
          customerPhone,
          customerAddress,
          items,
        },
      });
    } catch (error) {
      next(error);
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

      const data = reviews.map((review: any) =>
        toReviewResponse(review, review?.product ?? review?.get?.("product"))
      );

      return res.json({ success: true, data });
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
        return res.status(409).json({ message: "Review already exists" });
      }

      const review = await ProductReview.create({
        userId,
        productId,
        rating,
        comment: normalizeReviewComment(comment),
        images: normalizeReviewImages(images),
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
        updates.comment = normalizeReviewComment(parsed.data.comment);
      }
      if (typeof parsed.data.images !== "undefined") {
        updates.images = normalizeReviewImages(parsed.data.images);
      }

      await review.update(updates);

      return res.json({
        success: true,
        data: toReviewResponse(review, review?.product ?? review?.get?.("product")),
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
      const existing = await ProductReview.findOne({
        where: { userId, productId },
      });

      if (existing) {
        await existing.update({
          rating,
          comment: normalizeReviewComment(comment),
          images: normalizeReviewImages(images),
        });
        return res.json({
          success: true,
          data: toReviewResponse(existing, product),
        });
      }

      const created = await ProductReview.create({
        userId,
        productId,
        rating,
        comment: normalizeReviewComment(comment),
        images: normalizeReviewImages(images),
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
router.post(
  "/orders",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = createOrderSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid payload",
            errors: parsed.error.flatten(),
          });
        }
        const { customer, items, paymentMethod, couponCode } = parsed.data;
        console.log("[store] POST /orders hit", new Date().toISOString());
        console.log("[store/orders] payload", {
          customer,
          paymentMethod,
          itemsCount: items.length,
          firstItem: items[0] ?? null,
        });
        const userId = getAuthUserId(req, res);
        if (!userId) return;
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
          where: {
            id: { [Op.in]: productIds },
            status: "active",
            published: { [Op.in]: [1, true] },
          },
          attributes: [
            "id",
            "name",
            "stock",
            "price",
            "salePrice",
            "status",
            "published",
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
          const responseItems: Array<{
            productId: number;
            name: string;
            quantity: number;
            price: number;
            lineTotal: number;
          }> = [];
          const orderItemsPayload = itemsNorm.map((item) => {
            const product = byId.get(item.productId)!;
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
            const result = await validateCoupon(normalizedCouponCode, subtotal);
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
        const order = await Order.create(
            {
              invoiceNo: `STORE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              userId,
              customerName: customer.name,
              customerPhone: customer.phone,
              customerAddress: customer.address,
              customerNotes: customer.notes ?? null,
              paymentMethod,
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
              paymentMethod,
              items: responseItems,
            },
          });
      } catch (error) {
        await tx.rollback();
        console.error("[store/orders] error", error);
        return res
          .status(500)
          .json({ message: error?.message || "Failed to create order" });
      }
    } catch (error) {
      console.error("[store/orders] error", error);
      return res
        .status(500)
        .json({ message: error?.message || "Failed to create order" });
    }
  }
);

export default router;


