import { initializedDbPromise } from "../models/index.js";
import { User } from "../models/User.js";
import { Cart } from "../models/Cart.js";
import { Product } from "../models/Product.js";
const db = await initializedDbPromise;
const { sequelize, Order, OrderItem } = db;
// --- ENUMS & TYPES ---
// Menggunakan const object untuk status pesanan agar lebih aman dan mudah dikelola
export const OrderStatus = {
    Pending: "pending",
    Processing: "processing",
    Shipped: "shipped",
    Completed: "completed",
    Cancelled: "cancelled",
};
// --- CONTROLLER FUNCTIONS ---
/**
 * Membuat pesanan baru dari item yang ada di keranjang pengguna.
 * Menggunakan transaksi untuk memastikan integritas data.
 */
export const createOrder = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const t = await sequelize.transaction();
    try {
        // 1. Ambil keranjang dan isinya
        const cart = (await Cart.findOne({
            where: { userId },
            include: [{ model: Product, as: "Products" }],
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
        const order = await Order.create({
            userId,
            totalAmount,
            status: "pending",
        }, { transaction: t });
        // 4. Tambahkan orderId ke setiap item dan buat OrderItem
        const itemsWithOrderId = orderItemsData.map((item) => ({
            ...item,
            orderId: order.id,
        }));
        await OrderItem.bulkCreate(itemsWithOrderId, { transaction: t });
        // 5. Kurangi stok produk
        for (const product of cart.Products) {
            await Product.update({ stock: sequelize.literal(`stock - ${product.CartItem.quantity}`) }, { where: { id: product.id }, transaction: t });
        }
        // 6. Kosongkan keranjang pengguna
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
/**
 * Mendapatkan semua pesanan milik pengguna yang sedang login.
 */
export const getUserOrders = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orders = await Order.findAll({
            where: { userId },
            include: [
                {
                    model: Product,
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
/**
 * Mendapatkan detail satu pesanan spesifik.
 */
export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const order = await Order.findOne({
            where: { id, userId }, // Pastikan user hanya bisa akses order miliknya
            include: [
                {
                    model: Product,
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
// --- ADMIN FUNCTIONS ---
/**
 * Mendapatkan semua pesanan dari semua pengguna (Admin only).
 */
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: [{ model: User, attributes: ["id", "name", "email"] }],
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
/**
 * Memperbarui status pesanan (Admin only).
 */
export const updateOrderStatus = async (req, res) => {
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
        const [updatedRows] = await Order.update({ status }, { where: { id } });
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
