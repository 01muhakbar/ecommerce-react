import { Router } from "express";
import { Op } from "sequelize";
import { Category, Order, OrderItem, Product, User, sequelize } from "../models/index.js";
import { validateCoupon } from "../services/coupon.service.js";
import { protect } from "../middleware/authMiddleware.js";
const router = Router();
const toNumber = (value) => (value == null ? null : Number(value));
const normalizeCouponCode = (value) => String(value || "").trim().toUpperCase();
const getAuthUserId = (req, res) => {
    const user = req.user;
    const userId = Number(user?.id);
    if (!user || !Number.isFinite(userId)) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    return userId;
};
const toProductListItem = (product) => {
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
router.get("/categories", async (_req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
});
// GET /api/store/products?search=&category=&page=&limit=
router.get("/products", async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || req.query.limit || "12"), 10)));
        const limit = pageSize;
        const search = String(req.query.search || "").trim();
        const categoryParam = String(req.query.category || "").trim();
        const where = { isPublished: true, status: "active" };
        if (search) {
            where.name = { [Op.like]: `%${search}%` };
        }
        if (categoryParam) {
            const categoryId = Number(categoryParam);
            if (Number.isFinite(categoryId)) {
                where.categoryId = categoryId;
            }
            else {
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
            meta: {
                page,
                pageSize,
                total: count,
                totalPages: Math.max(1, Math.ceil(count / pageSize)),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/store/products/:id
router.get("/products/:id", async (req, res, next) => {
    try {
        const product = await Product.findOne({
            where: { id: Number(req.params.id), isPublished: true, status: "active" },
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
    }
    catch (error) {
        next(error);
    }
});
// GET /api/store/orders (auth)
router.get("/orders", protect, async (req, res, next) => {
    try {
        const userId = getAuthUserId(req, res);
        if (!userId)
            return;
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
            data: rows.map((order) => ({
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
    }
    catch (error) {
        next(error);
    }
});
// GET /api/store/orders/my/:id (auth)
router.get("/orders/my/:id", protect, async (req, res, next) => {
    try {
        const userId = getAuthUserId(req, res);
        if (!userId)
            return;
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
        const items = (order.items ?? []).map((item) => ({
            id: item.id,
            productId: item.productId ?? item.get?.("productId") ?? item.product_id,
            name: item.product?.name ?? `Product #${item.productId || item.product_id || "-"}`,
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
        }));
        const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
        const discountAmount = Number(order.discountAmount || 0);
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
                couponCode: order.couponCode ?? null,
                paymentMethod: order.paymentMethod ?? "COD",
                createdAt: order.createdAt,
                customerName: order.customerName ?? null,
                customerPhone: order.customerPhone ?? null,
                customerAddress: order.customerAddress ?? null,
                items,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/store/profile (auth)
router.put("/profile", protect, async (req, res, next) => {
    try {
        const userId = getAuthUserId(req, res);
        if (!userId)
            return;
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : null;
        const email = typeof req.body?.email === "string" ? req.body.email.trim() : null;
        if (!name && !email) {
            return res.status(400).json({ message: "No updates provided." });
        }
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (name)
            user.name = name;
        if (email)
            user.email = email;
        await user.save();
        return res.json({
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        if (error?.name === "SequelizeUniqueConstraintError") {
            return res.status(409).json({ message: "Email already in use." });
        }
        next(error);
    }
});
// GET /api/store/orders/:ref
router.get("/orders/:ref", async (req, res, next) => {
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
        const items = (order.items ?? []).map((item) => ({
            id: item.id,
            productId: item.productId ?? item.get?.("productId") ?? item.product_id,
            name: item.product?.name ?? `Product #${item.productId || item.product_id || "-"}`,
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
        }));
        const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
        const discountAmount = Number(order.discountAmount || 0);
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
                couponCode: order.couponCode ?? null,
                paymentMethod: order.paymentMethod ?? "COD",
                createdAt: order.createdAt,
                customerName: order.customerName ?? null,
                customerPhone: order.customerPhone ?? null,
                customerAddress: order.customerAddress ?? null,
                items,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/store/orders
router.post("/orders", async (req, res, next) => {
    try {
        const customer = req.body?.customer;
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const couponCode = normalizeCouponCode(req.body?.couponCode);
        const PAYMENT_METHODS = ["COD", "TRANSFER", "EWALLET"];
        const rawPaymentMethod = req.body?.paymentMethod;
        let paymentMethod = "COD";
        if (typeof rawPaymentMethod === "string" && rawPaymentMethod.trim() !== "") {
            paymentMethod = rawPaymentMethod.trim();
        }
        if (!PAYMENT_METHODS.includes(paymentMethod)) {
            return res.status(400).json({ message: "Invalid paymentMethod" });
        }
        if (!customer ||
            typeof customer.name !== "string" ||
            typeof customer.phone !== "string" ||
            typeof customer.address !== "string") {
            return res.status(400).json({ message: "Invalid customer details." });
        }
        if (items.length === 0) {
            return res.status(400).json({ message: "Cart items are required." });
        }
        const normalizedItems = new Map();
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
                where: { id: { [Op.in]: productIds }, isPublished: true, status: "active" },
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
                const product = byId.get(item.productId);
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
                },
                transaction: tx,
            });
            let subtotal = 0;
            const orderItemsPayload = itemsNorm.map((item) => {
                const product = byId.get(item.productId);
                const unitPrice = Number(product.salePrice ?? product.price ?? 0);
                subtotal += unitPrice * item.qty;
                return {
                    productId: product.id,
                    quantity: item.qty,
                    price: unitPrice,
                };
            });
            let discountAmount = 0;
            let appliedCouponCode = null;
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
            const tax = 0;
            const shipping = 0;
            const totalAmount = Math.max(0, subtotal - discountAmount + tax + shipping);
            const order = await Order.create({
                invoiceNo: `STORE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                userId: guestUser.id,
                customerName: customer.name,
                customerPhone: customer.phone,
                customerAddress: customer.address,
                customerNotes: customer.notes ?? null,
                paymentMethod,
                totalAmount,
                couponCode: appliedCouponCode,
                discountAmount,
                status: "pending",
            }, { transaction: tx });
            await OrderItem.bulkCreate(orderItemsPayload.map((item) => ({ ...item, orderId: order.id })), { transaction: tx });
            for (const item of itemsNorm) {
                const product = byId.get(item.productId);
                product.stock = Number(product.stock || 0) - item.qty;
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
        }
        catch (error) {
            await tx.rollback();
            return res.status(500).json({ message: "Failed to create order" });
        }
    }
    catch (error) {
        next(error);
    }
});
export default router;
