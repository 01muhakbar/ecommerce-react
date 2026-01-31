import { sequelize, User as UserModel, Cart as CartModel, Product as ProductModel, Order as OrderModel, OrderItem as OrderItemModel, } from "../models/index.js";
const asSingle = (v) => (Array.isArray(v) ? v[0] : v);
const toId = (v) => {
    const raw = asSingle(v);
    const id = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(id) ? id : null;
};
// --- ENUMS & TYPES ---
export const OrderStatus = {
    Pending: "pending",
    Paid: "paid",
    Processing: "processing",
    Shipped: "shipped",
    Delivered: "delivered",
    Completed: "completed",
    Cancelled: "cancelled",
};
const normalizeStatus = (v) => {
    const s = String(v ?? "pending").toLowerCase();
    if (s === "pending" ||
        s === "paid" ||
        s === "processing" ||
        s === "shipped" ||
        s === "delivered" ||
        s === "completed" ||
        s === "cancelled") {
        return s;
    }
    return "pending";
};
// --- CONTROLLER FUNCTIONS ---
/**
 * Membuat pesanan baru dari item yang ada di keranjang pengguna.
 * Menggunakan transaksi untuk memastikan integritas data.
 */
export const createOrder = async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const t = await sequelize.transaction();
    try {
        const cart = (await CartModel.findOne({
            where: { userId },
            include: [{ model: ProductModel, as: "Products" }],
            transaction: t,
        }));
        if (!cart || !cart.Products || cart.Products.length === 0) {
            await t.rollback();
            res
                .status(400)
                .json({ message: "Keranjang kosong, tidak bisa membuat pesanan." });
            return;
        }
        let totalAmount = 0;
        const orderItemsData = cart.Products.map((product) => {
            const itemPrice = product.price;
            const itemQuantity = product.CartItem.quantity;
            totalAmount += itemPrice * itemQuantity;
            return {
                productId: product.id,
                quantity: itemQuantity,
                price: itemPrice,
            };
        });
        const invoiceNo = `INV-${Date.now()}-${userId}`;
        const order = await OrderModel.create({
            userId,
            invoiceNo,
            totalAmount,
            status: "pending",
        }, { transaction: t });
        const itemsWithOrderId = orderItemsData.map((item) => ({
            ...item,
            orderId: order.id,
        }));
        await OrderItemModel.bulkCreate(itemsWithOrderId, { transaction: t });
        for (const product of cart.Products) {
            await ProductModel.update({ stock: sequelize.literal(`stock - ${product.CartItem.quantity}`) }, { where: { id: product.id }, transaction: t });
        }
        await cart.setProducts([], { transaction: t });
        await t.commit();
        res.status(201).json({ message: "Pesanan berhasil dibuat.", order });
    }
    catch (error) {
        await t.rollback();
        next(error);
    }
};
/**
 * Mendapatkan semua pesanan milik pengguna yang sedang login.
 */
export const getUserOrders = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const orders = await OrderModel.findAll({
            where: { userId },
            include: [
                {
                    model: ProductModel,
                    as: "products",
                    through: { attributes: ["quantity", "price"] },
                },
            ],
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({ status: "success", data: orders });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Mendapatkan detail satu pesanan spesifik.
 */
export const getOrderById = async (req, res, next) => {
    try {
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const userId = req.user?.id;
        const order = await OrderModel.findOne({
            where: { id, userId },
            include: [
                {
                    model: ProductModel,
                    as: "products",
                    through: { attributes: ["quantity", "price"] },
                },
            ],
        });
        if (!order) {
            res.status(404).json({ message: "Pesanan tidak ditemukan." });
            return;
        }
        res.status(200).json({ status: "success", data: order });
    }
    catch (error) {
        next(error);
    }
};
// --- ADMIN FUNCTIONS ---
/**
 * Mendapatkan semua pesanan dari semua pengguna (Admin only).
 */
export const getAllOrders = async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 10, 1);
        const offset = (page - 1) * limit;
        const { rows, count } = await OrderModel.findAndCountAll({
            attributes: [
                "id",
                ["invoice_no", "invoiceNo"],
                ["user_id", "userId"],
                ["total_amount", "totalAmount"],
                "status",
                "createdAt",
                "updatedAt",
            ],
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name"],
                },
                {
                    model: OrderItemModel,
                    as: "items",
                    attributes: ["id", "quantity", "price", ["product_id", "productId"]],
                    include: [
                        {
                            model: ProductModel,
                            as: "product",
                            attributes: ["id", ["product_name", "productName"]],
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
            distinct: true,
        });
        const totalPages = Math.ceil(count / limit);
        res.status(200).json({
            status: "success",
            data: rows,
            pagination: {
                totalItems: count,
                totalPages,
                currentPage: page,
                itemsPerPage: limit,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
/**
 * Memperbarui status pesanan (Admin only).
 */
export const updateOrderStatus = async (req, res, next) => {
    try {
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const { status } = req.body;
        const rawStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
        const normalizedStatus = normalizeStatus(rawStatus === "completed" ? "delivered" : rawStatus);
        const allowedStatuses = [
            "pending",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
        ];
        if (!normalizedStatus ||
            !allowedStatuses.includes(normalizedStatus)) {
            res.status(400).json({
                message: `Status tidak valid. Gunakan salah satu dari: ${allowedStatuses.join(", ")}`,
            });
            return;
        }
        const [updatedRows] = await OrderModel.update({ status: normalizedStatus }, { where: { id } });
        if (updatedRows === 0) {
            res.status(404).json({ message: "Pesanan tidak ditemukan." });
            return;
        }
        const updatedOrder = await OrderModel.findByPk(id);
        res.status(200).json({
            message: `Status pesanan berhasil diperbarui menjadi ${normalizedStatus}.`,
            data: updatedOrder,
        });
    }
    catch (error) {
        next(error);
    }
};
