"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getAllOrders = exports.getOrderById = exports.getUserOrders = exports.createOrder = exports.OrderStatus = void 0;
const index_1 = require("../models/index");
// --- ENUMS & TYPES ---
// Menggunakan enum untuk status pesanan agar lebih aman dan mudah dikelola
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["Pending"] = "pending";
    OrderStatus["Processing"] = "processing";
    OrderStatus["Shipped"] = "shipped";
    OrderStatus["Completed"] = "completed";
    OrderStatus["Cancelled"] = "cancelled";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
// --- CONTROLLER FUNCTIONS ---
/**
 * Membuat pesanan baru dari item yang ada di keranjang pengguna.
 * Menggunakan transaksi untuk memastikan integritas data.
 */
const createOrder = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const t = await index_1.sequelize.transaction();
    try {
        // 1. Ambil keranjang dan isinya
        const cart = (await index_1.Cart.findOne({
            where: { userId },
            include: [{ model: index_1.Product, as: "Products" }],
            transaction: t,
        }));
        if (!cart || !cart.Products || cart.Products.length === 0) {
            await t.rollback();
            res
                .status(400)
                .json({ message: "Keranjang kosong, tidak bisa membuat pesanan." });
            return;
        }
        // 2. Hitung total harga dan siapkan item pesanan
        let totalAmount = 0;
        const orderItemsData = cart.Products.map((product) => {
            const itemPrice = product.price;
            const itemQuantity = product.CartItem.quantity;
            totalAmount += itemPrice * itemQuantity;
            return {
                productId: product.id,
                quantity: itemQuantity,
                price: itemPrice, // Simpan harga saat checkout
            };
        });
        // 3. Buat pesanan (Order)
        const order = await index_1.Order.create({
            userId,
            totalAmount,
            status: "pending",
        }, { transaction: t });
        // 4. Tambahkan orderId ke setiap item dan buat OrderItem
        const itemsWithOrderId = orderItemsData.map((item) => ({
            ...item,
            orderId: order.id,
        }));
        await index_1.OrderItem.bulkCreate(itemsWithOrderId, { transaction: t });
        // 5. Kurangi stok produk
        for (const product of cart.Products) {
            await index_1.Product.update({ stock: index_1.sequelize.literal(`stock - ${product.CartItem.quantity}`) }, { where: { id: product.id }, transaction: t });
        }
        // 6. Kosongkan keranjang pengguna
        // Cukup hancurkan relasi di CartItem, bukan seluruh Cart jika Cart masih ingin disimpan
        // Namun jika modelnya 1 user 1 cart, destroy adalah pilihan yang tepat
        // Cast to `any` because the custom type `CartWithProducts` doesn't know about the `setProducts` mixin method added by Sequelize.
        await cart.setProducts([], { transaction: t }); // Cara yang lebih aman untuk mengosongkan relasi
        // 7. Jika semua berhasil, commit transaksi
        await t.commit();
        res.status(201).json({ message: "Pesanan berhasil dibuat.", order });
    }
    catch (error) {
        await t.rollback();
        console.error("CREATE ORDER ERROR:", error);
        res.status(500).json({
            message: "Gagal membuat pesanan.",
            error: error.message,
        });
    }
};
exports.createOrder = createOrder;
/**
 * Mendapatkan semua pesanan milik pengguna yang sedang login.
 */
const getUserOrders = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orders = await index_1.Order.findAll({
            where: { userId },
            include: [
                {
                    model: index_1.Product,
                    as: "products",
                    through: { attributes: ["quantity", "price"] },
                },
            ], // Gunakan alias 'products' jika ada
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({ status: "success", data: orders });
    }
    catch (error) {
        res.status(500).json({
            message: "Gagal mengambil data pesanan.",
            error: error.message,
        });
    }
};
exports.getUserOrders = getUserOrders;
/**
 * Mendapatkan detail satu pesanan spesifik.
 */
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const order = await index_1.Order.findOne({
            where: { id, userId }, // Pastikan user hanya bisa akses order miliknya
            include: [
                {
                    model: index_1.Product,
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
        res.status(500).json({
            message: "Gagal mengambil detail pesanan.",
            error: error.message,
        });
    }
};
exports.getOrderById = getOrderById;
// --- ADMIN FUNCTIONS ---
/**
 * Mendapatkan semua pesanan dari semua pengguna (Admin only).
 */
const getAllOrders = async (req, res) => {
    try {
        const orders = await index_1.Order.findAll({
            include: [{ model: index_1.User, attributes: ["id", "name", "email"] }],
            order: [["createdAt", "DESC"]],
        });
        res
            .status(200)
            .json({ status: "success", results: orders.length, data: orders });
    }
    catch (error) {
        res.status(500).json({
            message: "Gagal mengambil semua pesanan.",
            error: error.message,
        });
    }
};
exports.getAllOrders = getAllOrders;
/**
 * Memperbarui status pesanan (Admin only).
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // Validasi menggunakan enum untuk memastikan nilai status valid dan aman
        if (!status ||
            !Object.values(OrderStatus).includes(status)) {
            res.status(400).json({
                message: `Status tidak valid. Gunakan salah satu dari: ${Object.values(OrderStatus).join(", ")}`,
            });
            return;
        }
        const [updatedRows] = await index_1.Order.update({ status }, { where: { id } });
        if (updatedRows === 0) {
            res.status(404).json({ message: "Pesanan tidak ditemukan." });
            return;
        }
        res.status(200).json({
            message: `Status pesanan berhasil diperbarui menjadi ${status}.`,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Gagal memperbarui status pesanan.",
            error: error.message,
        });
    }
};
exports.updateOrderStatus = updateOrderStatus;
