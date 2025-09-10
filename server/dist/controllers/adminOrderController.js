import { initializedDbPromise } from "../models/index.js";
const db = await initializedDbPromise;
export const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 8;
        const offset = (page - 1) * limit;
        const { count, rows: orders } = await db.Order.findAndCountAll({
            include: [
                {
                    model: db.User,
                    as: "user",
                    attributes: ["name"], // Only fetch the user's name
                },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
            distinct: true,
        });
        // Cast the result to our more specific type
        const typedOrders = orders;
        const toClientStatus = (serverStatus) => {
            switch (serverStatus) {
                case "pending":
                    return "Pending";
                case "processing":
                    return "Processing";
                case "shipped":
                    return "Delivered";
                case "completed":
                    return "Delivered";
                case "cancelled":
                    return "Cancelled";
                default:
                    // This case should ideally not be reached if all statuses are handled.
                    return "Pending";
            }
        };
        // Transform data for the client
        const transformedData = typedOrders.map((order) => ({
            id: order.id,
            invoiceNo: order.invoiceNo,
            orderTime: order.createdAt.toISOString(),
            customerName: order.user?.name || "Guest",
            amount: order.totalAmount,
            status: toClientStatus(order.status),
        }));
        res.status(200).json({
            data: transformedData,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to fetch orders",
            error: error.message,
        });
    }
};
export const updateOrderStatus = async (req, res) => {
    // Placeholder implementation
    res.status(500).json({ message: "Not implemented yet" });
};
