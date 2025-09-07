import express from "express";
import { Op, fn, col, literal, cast } from "sequelize";
import initializedDbPromise from "../models/index.js";

const db = await initializedDbPromise;
const { User, Order, OrderItem, Product } = db;

export const getDashboardStatistics = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
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

    const { today, yesterday, thisMonth, lastMonth, endOfLastMonth } =
      getDates();

    // 1. Total Sales
    const todaySales = await Order.sum("totalAmount", {
      where: {
        createdAt: { [Op.gte]: today },
        status: "completed",
      },
    });

    const yesterdaySales = await Order.sum("totalAmount", {
      where: {
        createdAt: { [Op.gte]: yesterday, [Op.lt]: today },
        status: "completed",
      },
    });

    const thisMonthSales = await Order.sum("totalAmount", {
      where: {
        createdAt: { [Op.gte]: thisMonth },
        status: "completed",
      },
    });

    const lastMonthSales = await Order.sum("totalAmount", {
      where: {
        createdAt: { [Op.gte]: lastMonth, [Op.lt]: thisMonth },
        status: "completed",
      },
    });

    const allTimeSales = await Order.sum("totalAmount", {
      where: { status: "completed" },
    });

    // 2. Order Status Counts
    const totalOrders = await Order.count();
    const pendingOrders = await Order.count({ where: { status: "pending" } });
    const processingOrders = await Order.count({
      where: { status: "processing" },
    });
    const deliveredOrders = await Order.count({
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

      const dailySales = await Order.sum("totalAmount", {
        where: {
          createdAt: { [Op.gte]: date, [Op.lt]: nextDay },
          status: "completed",
        },
      });
      weeklySalesData.push({
        date: date.toISOString().split("T")[0],
        sales: dailySales || 0,
      });
    }

    // 4. Best Selling Products (Top 5)
    const bestSellingProducts = await OrderItem.findAll({
      attributes: [
        "productId",
        [fn("SUM", col("quantity")), "totalQuantity"],
        [fn("SUM", literal("quantity * `OrderItem`.`price`")), "totalSales"],
      ],
      group: ["productId"],
      order: [[literal("totalSales"), "DESC"]],
      limit: 5,
      include: [
        {
          model: Product,
          attributes: ["name"],
          required: true,
        },
      ],
    });

    const formattedBestSellingProducts = bestSellingProducts.map(
      (item: any) => ({
        name: item.Product.name,
        sales: parseFloat(item.getDataValue("totalSales")),
      })
    );

    // 5. Ambil 5 pesanan terbaru dan transformasikan datanya agar konsisten
    const recentOrdersRaw = await Order.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user", // Pastikan alias sesuai dengan definisi model
          attributes: ["name"],
        },
      ],
    });

    const mapStatus = (
      status: string
    ): "Pending" | "Processing" | "Delivered" | "Cancelled" => {
      const statusMap: { [key: string]: any } = {
        pending: "Pending",
        processing: "Processing",
        completed: "Delivered",
        shipped: "Delivered",
        cancelled: "Cancelled",
      };
      return statusMap[status.toLowerCase()] || "Pending";
    };

    const recentOrders = (recentOrdersRaw as any[]).map((order) => ({
      id: order.id,
      invoiceNo: order.invoiceNo,
      orderTime: order.createdAt.toISOString(),
      customerName: order.user?.name || "Guest",
      amount: order.totalAmount,
      status: mapStatus(order.status),
    }));

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
        recentOrders,
      },
    });
  } catch (error) {
    console.error("GET DASHBOARD STATISTICS ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};
