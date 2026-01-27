import { Router, Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { Category, Order, OrderItem, Product, User, sequelize } from "../models";

const router = Router();

const toNumber = (value: any) => (value == null ? null : Number(value));

const toProductListItem = (product: any) => {
  const imageUrl = product.promoImagePath || product.imagePaths?.[0] || null;
  const category = product.category
    ? {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.code,
      }
    : null;

  return {
    id: product.id,
    name: product.name,
    price: toNumber(product.price) ?? 0,
    imageUrl,
    categoryId: product.categoryId ?? null,
    category,
    stock: product.stock ?? null,
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
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.limit || "12"), 10))
      );
      const search = String(req.query.search || "").trim();
      const categoryParam = String(req.query.category || "").trim();

      const where: any = { isPublished: true };
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
        include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      res.json({
        data: rows.map(toProductListItem),
        meta: { page, limit, total: count },
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
      const product = await Product.findByPk(req.params.id, {
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

      const items = (order.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId ?? item.get?.("productId") ?? item.product_id,
        name: item.product?.name ?? `Product #${item.productId || item.product_id || "-"}`,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
      }));

      return res.json({
        data: {
          id: order.id,
          ref: order.invoiceNo || String(order.id),
          invoiceNo: order.invoiceNo,
          status: order.status,
          totalAmount: Number(order.totalAmount || 0),
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customer = req.body?.customer;
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
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

      if (items.length === 0) {
        return res.status(400).json({ message: "Cart items are required." });
      }

      const normalizedItems = new Map<number, number>();
      for (const item of items) {
        const productId = Number(item?.productId);
        const qty = Number(item?.qty);
        if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(qty) || qty < 1) {
          return res.status(400).json({ message: "Invalid cart items." });
        }
        normalizedItems.set(productId, (normalizedItems.get(productId) || 0) + qty);
      }

      const tx = await sequelize.transaction();
      try {
        const itemsNorm = Array.from(normalizedItems.entries()).map(([productId, qty]) => ({
          productId: Number(productId),
          qty: Number(qty),
        }));
        const productIds = itemsNorm.map((item) => item.productId);

        const products = await Product.findAll({
          where: { id: { [Op.in]: productIds }, isPublished: true },
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });

        if (products.length !== productIds.length) {
          const foundIds = new Set(products.map((product) => product.id));
          const missing = productIds.filter((id) => !foundIds.has(id));
          await tx.rollback();
          return res.status(404).json({
            message: "Some products are missing.",
            missing,
          });
        }

        const byId = new Map(products.map((product) => [product.id, product]));

        for (const item of itemsNorm) {
          const product = byId.get(item.productId)!;
          const stock = Number(product.stock || 0);
          if (stock < item.qty) {
            await tx.rollback();
            return res.status(409).json({
              message: "Insufficient stock",
              data: {
                productId: product.id,
                name: product.name,
                available: stock,
                requested: item.qty,
              },
            });
          }
        }

        const [guestUser] = await User.findOrCreate({
          where: { email: "guest@store.local" },
          defaults: {
            name: "Store Guest",
            email: "guest@store.local",
            password: "guest",
            role: "user",
            status: "active",
          } as any,
          transaction: tx,
        });

        let totalAmount = 0;
        const orderItemsPayload = itemsNorm.map((item) => {
          const product = byId.get(item.productId)!;
          const unitPrice = Number(product.salePrice ?? product.price ?? 0);
          totalAmount += unitPrice * item.qty;
          return {
            productId: product.id,
            quantity: item.qty,
            price: unitPrice,
          };
        });

        const order = await Order.create(
          {
            invoiceNo: `STORE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: guestUser.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerAddress: customer.address,
            customerNotes: customer.notes ?? null,
            paymentMethod,
            totalAmount,
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
          product.stock = Number(product.stock || 0) - item.qty;
          await product.save({ transaction: tx });
        }

        await tx.commit();

        return res.status(201).json({
          data: {
            orderId: order.id,
            invoiceNo: order.invoiceNo,
            total: totalAmount,
            paymentMethod,
          },
        });
      } catch (error) {
        await tx.rollback();
        return res.status(500).json({ message: "Failed to create order" });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
