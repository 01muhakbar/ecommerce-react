import { Router, Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { Category, Order, OrderItem, Product, User, sequelize } from "../models/index.js";
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

function getProductId(product: any): number {
  const raw =
    product?.getDataValue?.("id") ??
    product?.get?.("id") ??
    product?.id;
  return Number(raw);
}

const toProductListItem = (product: any) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const imageUrl = plain?.promoImagePath || plain?.imagePaths?.[0] || null;
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
    price: Number(plain?.price ?? 0),
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

      res.json({
        data: categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.code,
          image: category.icon ?? null,
        })),
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
          "stock",
          "categoryId",
          "promoImagePath",
          "imagePaths",
          "status",
          "published",
          "updatedAt",
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
      const product = await Product.findOne({
        where: {
          id: Number(req.params.id),
          status: "active",
          published: { [Op.in]: [1, true] },
        },
        include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
      });

      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }

      res.json({
        data: {
          ...toProductListItem(product),
          slug: product.slug,
          description: product.description ?? null,
          salePrice: toNumber(product.salePrice),
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
        data: rows.map((order: any) => ({
          id: order.id,
          ref: order.invoiceNo || String(order.id),
          status: order.status,
          totalAmount: Number(order.totalAmount || 0),
          createdAt: order.createdAt,
        })),
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
          status: order.status,
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
      const ref = String(req.params.ref || "").trim();
      if (!ref) {
        return res.status(400).json({ message: "Invalid order reference." });
      }

      const isNumeric = /^\d+$/.test(ref);
      const where = isNumeric ? { id: Number(ref) } : { invoiceNo: ref };

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
          status: order.status,
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

// POST /api/store/orders
router.post(
  "/orders",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("[store] POST /orders hit", new Date().toISOString());
      console.log("[store/orders] payload", {
        customer: req.body?.customer,
        paymentMethod: req.body?.paymentMethod,
        itemsCount: Array.isArray(req.body?.items) ? req.body.items.length : 0,
        firstItem: Array.isArray(req.body?.items) ? req.body.items[0] : null,
      });
      const userId = getAuthUserId(req, res);
      if (!userId) return;
      const customer = req.body?.customer;
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const couponCode = normalizeCouponCode(req.body?.couponCode);
      const PAYMENT_METHODS = ["COD", "TRANSFER", "EWALLET"] as const;
      const rawPaymentMethod = req.body?.paymentMethod;
      let paymentMethod = "COD";
      if (typeof rawPaymentMethod === "string" && rawPaymentMethod.trim() !== "") {
        paymentMethod = rawPaymentMethod.trim();
      }
      if (!PAYMENT_METHODS.includes(paymentMethod as any)) {
        return res.status(400).json({ message: "Invalid paymentMethod" });
      }

      if (
        !customer ||
        typeof customer.name !== "string" ||
        typeof customer.phone !== "string" ||
        typeof customer.address !== "string"
      ) {
        return res.status(400).json({ message: "Invalid customer details." });
      }

      const normalizedItems = new Map<number, number>();
      for (const item of items) {
        const productId = Number(item?.productId);
        const qty = Number(item?.qty);
        if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(qty) || qty < 1) {
          continue;
        }
        normalizedItems.set(productId, (normalizedItems.get(productId) || 0) + qty);
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
            message: "Some products are missing.",
            missing,
          });
        }

        const byId = new Map(
          products.map((product: any) => {
            const id = getProductId(product);
            return [id, product];
          })
        );

        for (const item of itemsNorm) {
          const product = byId.get(item.productId);
          if (!product) {
            await tx.rollback();
            return res.status(400).json({
              message: "Some products are missing.",
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
        const orderItemsPayload = itemsNorm.map((item) => {
          const product = byId.get(item.productId)!;
          const sale = Number(product.salePrice ?? 0);
          const price = Number(product.price ?? 0);
          const unitPrice = sale > 0 ? sale : price;
          subtotal += unitPrice * item.qty;
          const pid = getProductId(product);
        if (!Number.isFinite(pid)) {
          throw new Error("Invalid product id for order item");
        }
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
        if (couponCode) {
          const result = await validateCoupon(couponCode, subtotal);
        if (!result.valid) {
          await tx.rollback();
          return res.status(400).json({
            message: result.message || "Coupon invalid/expired/min spend not met",
          });
        }
        discountAmount = result.discountAmount;
        appliedCouponCode = result.code || couponCode;
      }

      function getProductId(p: any): number {
        return Number(p?.getDataValue?.("id") ?? p?.get?.("id") ?? p?.id);
      }

      const tax = 0;
      const shipping = 0;
      const totalAmount = Math.max(0, subtotal - discountAmount + tax + shipping);

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
            status: "pending",
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

        return res.status(201).json({
          success: true,
          data: {
            orderId: order.id,
            invoiceNo: order.invoiceNo,
            subtotal,
            discount: discountAmount,
            tax,
            shipping,
            total: totalAmount,
            paymentMethod,
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


