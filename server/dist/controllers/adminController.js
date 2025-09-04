"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStatistics = void 0;
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const getDashboardStatistics = async (req, res, next) => {
    try {
        // Helper function to get date ranges
        const getDates = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            return { today, yesterday, thisMonth, lastMonth, endOfLastMonth };
        };
        const { today, yesterday, thisMonth, lastMonth, endOfLastMonth } = getDates();
        // 1. Total Sales
        const todaySales = await models_1.Order.sum("totalAmount", {
            where: {
                createdAt: { [sequelize_1.Op.gte]: today },
                status: "completed",
            },
        });
        const yesterdaySales = await models_1.Order.sum("totalAmount", {
            where: {
                createdAt: { [sequelize_1.Op.gte]: yesterday, [sequelize_1.Op.lt]: today },
                status: "completed",
            },
        });
        const thisMonthSales = await models_1.Order.sum("totalAmount", {
            where: {
                createdAt: { [sequelize_1.Op.gte]: thisMonth },
                status: "completed",
            },
        });
        const lastMonthSales = await models_1.Order.sum("totalAmount", {
            where: {
                createdAt: { [sequelize_1.Op.gte]: lastMonth, [sequelize_1.Op.lt]: thisMonth },
                status: "completed",
            },
        });
        const allTimeSales = await models_1.Order.sum("totalAmount", {
            where: { status: "completed" },
        });
        // 2. Order Status Counts
        const totalOrders = await models_1.Order.count();
        const pendingOrders = await models_1.Order.count({ where: { status: "pending" } });
        const processingOrders = await models_1.Order.count({
            where: { status: "processing" },
        });
        const deliveredOrders = await models_1.Order.count({
            where: { status: "completed" },
        });
        // 3. Weekly Sales Data (last 7 days)
        const weeklySalesData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);
            const dailySales = await models_1.Order.sum("totalAmount", {
                where: {
                    createdAt: { [sequelize_1.Op.gte]: date, [sequelize_1.Op.lt]: nextDay },
                    status: "completed",
                },
            });
            weeklySalesData.push({
                date: date.toISOString().split("T")[0],
                sales: dailySales || 0,
            });
        }
        // 4. Best Selling Products (Top 5)
        const bestSellingProducts = await models_1.OrderItem.findAll({
            attributes: [
                "productId",
                [(0, sequelize_1.fn)("SUM", (0, sequelize_1.col)("quantity")), "totalQuantity"],
                [(0, sequelize_1.fn)("SUM", (0, sequelize_1.literal)("quantity * `OrderItem`.`price`")), "totalSales"],
            ],
            group: ["productId"],
            order: [[(0, sequelize_1.literal)("totalSales"), "DESC"]],
            limit: 5,
            include: [
                {
                    model: models_1.Product,
                    attributes: ["name"],
                    required: true,
                },
            ],
        });
        const formattedBestSellingProducts = bestSellingProducts.map((item) => ({
            name: item.Product.name,
            sales: parseFloat(item.getDataValue("totalSales")),
        }));
        // 5. Ambil 5 pesanan terbaru (LOGIKA YANG HILANG)
        const recentOrders = await models_1.Order.findAll({
            limit: 5,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: models_1.User,
                    attributes: ["name"], // Hanya ambil nama dari user
                },
            ],
            attributes: [
                ["id", "invoiceNo"],
                ["createdAt", "orderTime"],
                "status",
                ["totalAmount", "amount"],
            ],
        });
        res.status(200).json({
            status: "success",
            data: {
                summaryStats: {
                    todaySales: todaySales || 0,
                    yesterdaySales: yesterdaySales || 0,
                    thisMonthSales: thisMonthSales || 0,
                    lastMonthSales: lastMonthSales || 0,
                    allTimeSales: allTimeSales || 0,
                },
                orderStatusCounts: {
                    total: totalOrders,
                    pending: pendingOrders,
                    processing: processingOrders,
                    delivered: deliveredOrders,
                },
                weeklySalesData,
                bestSellingProducts: formattedBestSellingProducts,
                recentOrders, // Tambahkan recentOrders ke dalam respons
            },
        });
    }
    catch (error) {
        console.error("GET DASHBOARD STATISTICS ERROR:", error);
        res
            .status(500)
            .json({ status: "error", message: error.message });
    }
};
exports.getDashboardStatistics = getDashboardStatistics;
