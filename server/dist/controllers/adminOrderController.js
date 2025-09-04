"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrders = void 0;
const Order_1 = require("../models/Order");
const User_1 = require("../models/User");
const zod_1 = require("zod");
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'completed', 'cancelled']),
});
const getOrders = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;
    try {
        const { count, rows } = await Order_1.Order.findAndCountAll({
            limit,
            offset,
            include: [
                {
                    model: User_1.User,
                    as: 'user',
                    attributes: ['name'],
                },
            ],
            order: [['createdAt', 'DESC']],
        });
        const totalPages = Math.ceil(count / limit);
        const data = rows.map(order => ({
            id: order.id,
            invoiceNo: order.id,
            orderTime: order.createdAt, // Use createdAt
            customerName: order.user.name, // Use user.name
            amount: order.totalAmount,
            status: order.status,
        }));
        res.json({
            data,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: count,
            },
        });
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getOrders = getOrders;
const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const validation = statusSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ message: 'Invalid status provided', errors: validation.error.issues });
    }
    const { status } = validation.data;
    try {
        const order = await Order_1.Order.findByPk(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        order.status = status;
        await order.save();
        res.json({ message: 'Order status updated successfully', order });
    }
    catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
