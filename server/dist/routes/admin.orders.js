import { Router } from "express";
import { Op } from "sequelize";
import { requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { OrderItem } from "../models/OrderItem.js";
import { Product } from "../models/Product.js";
const router = Router();
const asSingle = (v) => (Array.isArray(v) ? v[0] : v);
const getAttr = (row, key) => row?.getDataValue?.(key) ??
    row?.get?.(key) ??
    row?.dataValues?.[key] ??
    undefined;
const normalizeStatusInput = (raw) => {
    const value = String(raw || "").toLowerCase().trim();
    if (!value)
        return "";
    if (value === "shipping")
        return "shipped";
    if (value === "complete")
        return "delivered";
    if (value === "completed")
        return "delivered";
    return value;
};
const toUiStatus = (raw) => {
    const value = String(raw || "").toLowerCase().trim();
    if (!value)
        return "pending";
    if (["pending_payment", "awaiting_payment", "unpaid"].includes(value)) {
        return "pending";
    }
    if (["processing", "process", "packed", "confirmed", "paid"].includes(value)) {
        return "processing";
    }
    if (["shipped", "shipping", "in_transit"].includes(value))
        return "shipping";
    if (["delivered", "completed", "complete"].includes(value))
        return "complete";
    if (["cancelled", "canceled", "cancel", "refunded", "failed"].includes(value)) {
        return "cancelled";
    }
    return "pending";
};
const allowedStatuses = ["pending", "processing", "shipping", "complete", "cancelled"];
const resolveOrderWhere = (idOrRef) => {
    const trimmed = String(idOrRef || "").trim();
    const isNumeric = /^\d+$/.test(trimmed);
    if (isNumeric) {
        return { id: Number(trimmed) };
    }
    return { invoiceNo: trimmed };
};
// GET list with pagination, search, and filtering
router.get("/", requireStaffOrAdmin, async (req, res) => {
    const page = Math.max(1, Number(asSingle(req.query.page) ?? 1));
    const rawLimit = Number(asSingle(req.query.limit) ?? asSingle(req.query.pageSize) ?? 10);
    const limit = Math.min(50, Math.max(1, rawLimit || 10));
    const rawStatus = String(asSingle(req.query.status) ?? "").trim().toLowerCase();
    const normalizedStatus = normalizeStatusInput(rawStatus);
    const q = String(asSingle(req.query.q) ?? "").trim();
    const where = {};
    if (q) {
        where[Op.or] = [
            { invoiceNo: { [Op.like]: `%${q}%` } },
            { customerName: { [Op.like]: `%${q}%` } },
            { customerPhone: { [Op.like]: `%${q}%` } },
        ];
    }
    if (normalizedStatus) {
        where.status = normalizedStatus;
    }
    const { rows, count } = await Order.findAndCountAll({
        where,
        attributes: [
            "id",
            "invoiceNo",
            "status",
            "createdAt",
            "totalAmount",
            "customerName",
            "customerPhone",
            "paymentMethod",
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
    });
    const data = rows.map((orderRow) => {
        const customer = orderRow?.customer ??
            orderRow?.get?.("customer") ??
            orderRow?.dataValues?.customer ??
            null;
        const id = getAttr(orderRow, "id");
        const invoiceNo = getAttr(orderRow, "invoiceNo");
        const status = getAttr(orderRow, "status");
        const createdAt = getAttr(orderRow, "createdAt");
        const customerName = getAttr(orderRow, "customerName");
        const customerPhone = getAttr(orderRow, "customerPhone");
        return {
            id,
            ref: invoiceNo ?? String(id ?? ""),
            orderId: id,
            invoiceNo,
            status: toUiStatus(status),
            createdAt,
            totalAmount: Number(getAttr(orderRow, "totalAmount") ??
                getAttr(orderRow, "total") ??
                getAttr(orderRow, "grandTotal") ??
                0),
            paymentMethod: getAttr(orderRow, "paymentMethod") ?? "COD",
            customerName: customerName ??
                getAttr(orderRow, "shippingName") ??
                customer?.name ??
                "Guest",
            customerPhone: customerPhone ??
                getAttr(orderRow, "shippingPhone") ??
                customer?.phone ??
                null,
        };
    });
    res.json({
        success: true,
        data: {
            items: data,
            page,
            limit,
            totalItems: count,
            totalPages: Math.max(1, Math.ceil(count / limit)),
        },
    });
});
router.get("/:id", requireStaffOrAdmin, async (req, res) => {
    const idStr = String(asSingle(req.params.id) ?? "");
    if (!idStr) {
        return res.status(400).json({ message: "Invalid id" });
    }
    const orderItem = await Order.findOne({
        where: resolveOrderWhere(idStr),
        include: [
            { model: User, as: "customer", attributes: ["name", "email"] },
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
    if (!orderItem) {
        return res.status(404).json({ message: "Not found" });
    }
    const items = (orderItem.items ?? []).map((item) => ({
        id: getAttr(item, "id"),
        productId: getAttr(item, "productId") ?? item.get?.("productId") ?? item.product_id,
        quantity: getAttr(item, "quantity"),
        price: Number(getAttr(item, "price") || 0),
        lineTotal: Number(getAttr(item, "price") || 0) *
            Number(getAttr(item, "quantity") || 0),
        product: item.product
            ? {
                id: getAttr(item.product, "id"),
                name: getAttr(item.product, "name"),
            }
            : null,
    }));
    const customer = orderItem.customer ?? null;
    const subtotal = items.reduce((sum, item) => {
        return sum + Number(item.lineTotal || 0);
    }, 0);
    const discount = Number(getAttr(orderItem, "discountAmount") || 0);
    const shipping = Number(getAttr(orderItem, "shippingCost") || 0);
    const totalAmount = Number(getAttr(orderItem, "totalAmount") || 0);
    return res.json({
        success: true,
        data: {
            id: getAttr(orderItem, "id"),
            ref: getAttr(orderItem, "invoiceNo") ?? String(getAttr(orderItem, "id") ?? ""),
            invoiceNo: getAttr(orderItem, "invoiceNo"),
            status: toUiStatus(getAttr(orderItem, "status")),
            totalAmount,
            subtotal,
            discount,
            shipping,
            total: totalAmount,
            createdAt: getAttr(orderItem, "createdAt"),
            updatedAt: getAttr(orderItem, "updatedAt"),
            customerName: getAttr(orderItem, "customerName") ?? customer?.name ?? null,
            customerPhone: getAttr(orderItem, "customerPhone") ?? null,
            customerAddress: getAttr(orderItem, "customerAddress") ?? null,
            customerNotes: getAttr(orderItem, "customerNotes") ?? null,
            paymentMethod: getAttr(orderItem, "paymentMethod") ?? "COD",
            method: getAttr(orderItem, "paymentMethod") ?? "COD",
            items,
        },
    });
});
router.patch("/:id/status", requireStaffOrAdmin, async (req, res) => {
    const idStr = String(asSingle(req.params.id) ?? "");
    if (!idStr) {
        return res.status(400).json({ message: "Invalid id" });
    }
    const rawStatus = String(req.body?.status ?? "").toLowerCase().trim();
    if (!rawStatus || !allowedStatuses.includes(rawStatus)) {
        return res.status(400).json({
            message: `Status tidak valid. Gunakan salah satu dari: ${allowedStatuses.join(", ")}`,
        });
    }
    const normalizedStatus = normalizeStatusInput(rawStatus);
    const [updatedRows] = await Order.update({ status: normalizedStatus, updatedAt: new Date() }, { where: resolveOrderWhere(idStr) });
    if (updatedRows === 0) {
        return res.status(404).json({ message: "Pesanan tidak ditemukan." });
    }
    const updatedOrder = await Order.findOne({
        where: resolveOrderWhere(idStr),
        attributes: ["id", "invoiceNo", "status", "totalAmount", "createdAt", "updatedAt"],
    });
    return res.json({
        success: true,
        message: `Status pesanan berhasil diperbarui menjadi ${rawStatus}.`,
        data: {
            id: getAttr(updatedOrder, "id"),
            invoiceNo: getAttr(updatedOrder, "invoiceNo"),
            status: toUiStatus(getAttr(updatedOrder, "status")),
            totalAmount: Number(getAttr(updatedOrder, "totalAmount") || 0),
            createdAt: getAttr(updatedOrder, "createdAt"),
            updatedAt: getAttr(updatedOrder, "updatedAt"),
        },
    });
});
// Other CRUD endpoints for Orders can be added here following the same pattern as Customers
export default router;
