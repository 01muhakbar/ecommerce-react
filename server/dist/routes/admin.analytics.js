import { Router } from "express";
import { Op, QueryTypes, fn, col } from "sequelize";
import { requireAdmin } from "../middleware/requireRole.js";
import * as models from "../models/index.js";
const { Order, OrderItem, Product, User, sequelize } = models;
const router = Router();
const TZ = "+08:00";
const ANALYTICS_STATUSES = ["paid", "shipped", "delivered", "completed"];
const toDateString = (value) => value.toISOString().slice(0, 10);
const toWitaDateKey = (value = new Date()) => {
    const ms = value.getTime() + 8 * 60 * 60 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
};
const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};
const endOfDay = (value) => {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
};
const ensureNumber = (value) => {
    if (value === null || value === undefined)
        return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};
const normalizeStatus = (value) => {
    const status = String(value || "").toLowerCase();
    if (status === "cancel")
        return "cancelled";
    if (status === "delivered" || status === "shipped")
        return "completed";
    if (!status)
        return "pending";
    return status;
};
const parseRange = (raw) => {
    const value = String(raw || "7d").toLowerCase();
    if (!/^\d+d$/.test(value)) {
        return { range: "7d", days: 7, error: "Invalid range format." };
    }
    const days = Math.min(365, Math.max(1, Number(value.replace("d", "")) || 7));
    return { range: `${days}d`, days, error: "" };
};
const buildRange = (range, days) => {
    const now = new Date();
    const start = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));
    const end = endOfDay(now);
    return { start, end, range };
};
const parseLimit = (raw, fallback = 10, max = 50) => {
    const value = Number(raw);
    if (!Number.isFinite(value))
        return fallback;
    return Math.max(1, Math.min(max, Math.floor(value)));
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const DB = {
    createdAt: col("created_at"),
    totalAmount: col("total_amount"),
};
// GET /api/admin/analytics/overview
router.get("/overview", async (_req, res) => {
    try {
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const yesterdayStart = startOfDay(new Date(now.getTime() - 86400000));
        const yesterdayEnd = endOfDay(new Date(now.getTime() - 86400000));
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        const [todayOrders, yesterdayOrders, thisMonthRows, lastMonthRows, allTimeRows, statusRows, totalOrders,] = await Promise.all([
            Order.count({
                where: { createdAt: { [Op.between]: [todayStart, todayEnd] } },
            }),
            Order.count({
                where: { createdAt: { [Op.between]: [yesterdayStart, yesterdayEnd] } },
            }),
            Order.findAll({
                attributes: [[fn("SUM", DB.totalAmount), "total"]],
                where: { createdAt: { [Op.gte]: thisMonthStart } },
                raw: true,
            }),
            Order.findAll({
                attributes: [[fn("SUM", DB.totalAmount), "total"]],
                where: { createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] } },
                raw: true,
            }),
            Order.findAll({
                attributes: [[fn("SUM", DB.totalAmount), "total"]],
                raw: true,
            }),
            Order.findAll({
                attributes: [
                    [col("status"), "status"],
                    [fn("COUNT", col("id")), "count"],
                ],
                group: [col("status")],
                raw: true,
            }),
            Order.count(),
        ]);
        const thisMonthSales = ensureNumber(thisMonthRows?.[0]?.total);
        const lastMonthSales = ensureNumber(lastMonthRows?.[0]?.total);
        const allTimeSales = ensureNumber(allTimeRows?.[0]?.total);
        const statusCounts = {
            total: totalOrders,
            pending: 0,
            processing: 0,
            completed: 0,
            cancelled: 0,
        };
        statusRows.forEach((row) => {
            const status = normalizeStatus(row.status);
            if (statusCounts[status] !== undefined) {
                statusCounts[status] += ensureNumber(row.count);
            }
        });
        return res.json({
            kpis: {
                todayOrders: ensureNumber(todayOrders),
                yesterdayOrders: ensureNumber(yesterdayOrders),
                thisMonthSales,
                lastMonthSales,
                allTimeSales,
                breakdown: { cash: 0, card: 0, credit: 0 },
            },
            statusCounts,
        });
    }
    catch (error) {
        console.error("[analytics] overview failed", error);
        return res.json({
            kpis: {
                todayOrders: 0,
                yesterdayOrders: 0,
                thisMonthSales: 0,
                lastMonthSales: 0,
                allTimeSales: 0,
                breakdown: { cash: 0, card: 0, credit: 0 },
            },
            statusCounts: {
                total: 0,
                pending: 0,
                processing: 0,
                completed: 0,
                cancelled: 0,
            },
        });
    }
});
// GET /api/admin/analytics/summary?days=7
router.get("/summary", requireAdmin, async (req, res) => {
    const days = clamp(Number(req.query.days) || 7, 1, 365);
    const statuses = ANALYTICS_STATUSES;
    const now = new Date();
    const todayKey = toWitaDateKey(now);
    const yesterdayKey = toWitaDateKey(new Date(now.getTime() - 86400000));
    const sumByMethodDay = async (dayKey) => {
        const rows = await sequelize.query(`
        SELECT COALESCE(payment_method, 'COD') as method,
               SUM(total_amount) as total
        FROM Orders
        WHERE DATE(CONVERT_TZ(created_at, '+00:00', :tz)) = :day
          AND status IN (:statuses)
        GROUP BY method
      `, {
            replacements: { day: dayKey, statuses, tz: TZ },
            type: QueryTypes.SELECT,
        });
        const byMethod = {};
        rows.forEach((row) => {
            const method = String(row.method || "COD");
            byMethod[method] = ensureNumber(row.total);
        });
        const total = Object.values(byMethod).reduce((sum, value) => sum + value, 0);
        return { total, byMethod };
    };
    const witaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const thisMonthStartKey = `${witaNow.getUTCFullYear()}-${String(witaNow.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthDate = new Date(Date.UTC(witaNow.getUTCFullYear(), witaNow.getUTCMonth() - 1, 1));
    const lastMonthStartKey = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthEndKey = toWitaDateKey(new Date(Date.UTC(witaNow.getUTCFullYear(), witaNow.getUTCMonth(), 0)));
    try {
        const [today, yesterday, thisMonthRows, lastMonthRows, allTimeRows] = await Promise.all([
            sumByMethodDay(todayKey),
            sumByMethodDay(yesterdayKey),
            sequelize.query(`
            SELECT SUM(total_amount) as total
            FROM Orders
            WHERE DATE(CONVERT_TZ(created_at, '+00:00', :tz)) BETWEEN :startDay AND :endDay
              AND status IN (:statuses)
          `, {
                replacements: {
                    startDay: thisMonthStartKey,
                    endDay: todayKey,
                    statuses,
                    tz: TZ,
                },
                type: QueryTypes.SELECT,
            }),
            sequelize.query(`
            SELECT SUM(total_amount) as total
            FROM Orders
            WHERE DATE(CONVERT_TZ(created_at, '+00:00', :tz)) BETWEEN :startDay AND :endDay
              AND status IN (:statuses)
          `, {
                replacements: {
                    startDay: lastMonthStartKey,
                    endDay: lastMonthEndKey,
                    statuses,
                    tz: TZ,
                },
                type: QueryTypes.SELECT,
            }),
            Order.findAll({
                attributes: [[fn("SUM", DB.totalAmount), "total"]],
                where: { status: { [Op.in]: statuses } },
                raw: true,
            }),
        ]);
        const thisMonth = { total: ensureNumber(thisMonthRows?.[0]?.total) };
        const lastMonth = { total: ensureNumber(lastMonthRows?.[0]?.total) };
        const allTime = { total: ensureNumber(allTimeRows?.[0]?.total) };
        return res.json({
            data: {
                today,
                yesterday,
                thisMonth,
                lastMonth,
                allTime,
            },
        });
    }
    catch (error) {
        console.error("[analytics] summary failed", error);
        return res.status(500).json({
            data: {
                today: { total: 0, byMethod: {} },
                yesterday: { total: 0, byMethod: {} },
                thisMonth: { total: 0 },
                lastMonth: { total: 0 },
                allTime: { total: 0 },
            },
        });
    }
});
// GET /api/admin/analytics/sales?range=7d
router.get("/sales", requireAdmin, async (req, res) => {
    const { range, days, error } = parseRange(req.query.range);
    if (error) {
        return res.status(400).json({ message: error });
    }
    try {
        const { start, end } = buildRange(range, days);
        const rows = await Order.findAll({
            attributes: [
                [fn("DATE", DB.createdAt), "date"],
                [fn("COUNT", col("id")), "orders"],
                [fn("SUM", DB.totalAmount), "sales"],
            ],
            where: { createdAt: { [Op.between]: [start, end] } },
            group: [fn("DATE", DB.createdAt)],
            order: [[fn("DATE", DB.createdAt), "ASC"]],
            raw: true,
        });
        const byDate = new Map(rows.map((row) => [
            String(row.date),
            {
                sales: ensureNumber(row.sales),
                orders: ensureNumber(row.orders),
            },
        ]));
        const labels = Array.from({ length: days }).map((_, index) => {
            const day = new Date(start.getTime() + index * 86400000);
            return toDateString(day);
        });
        const sales = labels.map((label) => ({
            date: label,
            value: byDate.get(label)?.sales ?? 0,
        }));
        const orders = labels.map((label) => ({
            date: label,
            value: byDate.get(label)?.orders ?? 0,
        }));
        return res.json({ range, sales, orders });
    }
    catch (error) {
        console.error("[analytics] sales failed", error);
        return res.json({ range, sales: [], orders: [] });
    }
});
// GET /api/admin/analytics/weekly-sales?days=7
router.get("/weekly-sales", requireAdmin, async (req, res) => {
    const days = clamp(Number(req.query.days) || 7, 1, 365);
    const now = new Date();
    const endDayKey = toWitaDateKey(now);
    const startDayKey = toWitaDateKey(new Date(now.getTime() - (days - 1) * 86400000));
    const startMs = new Date(`${startDayKey}T00:00:00.000Z`).getTime();
    const dateKeys = Array.from({ length: days }).map((_, index) => toWitaDateKey(new Date(startMs + index * 86400000)));
    const buckets = new Map(dateKeys.map((date) => [date, { date, sales: 0, orders: 0 }]));
    try {
        const statuses = ANALYTICS_STATUSES;
        const rows = await sequelize.query(`
        SELECT DATE(CONVERT_TZ(created_at, '+00:00', :tz)) as day,
               COUNT(*) as orders,
               SUM(total_amount) as sales
        FROM Orders
        WHERE DATE(CONVERT_TZ(created_at, '+00:00', :tz)) BETWEEN :startDay AND :endDay
          AND status IN (:statuses)
        GROUP BY day
        ORDER BY day ASC
      `, {
            replacements: { startDay: startDayKey, endDay: endDayKey, statuses, tz: TZ },
            type: QueryTypes.SELECT,
        });
        rows.forEach((row) => {
            const key = String(row.day || "");
            if (!buckets.has(key))
                return;
            const current = buckets.get(key);
            current.sales = ensureNumber(row.sales);
            current.orders = ensureNumber(row.orders);
        });
        return res.json({ data: Array.from(buckets.values()) });
    }
    catch (error) {
        console.error("[analytics] weekly-sales failed", error);
        return res.status(500).json({ data: Array.from(buckets.values()) });
    }
});
// GET /api/admin/analytics/best-selling?days=7&limit=5
router.get("/best-selling", requireAdmin, async (req, res) => {
    const days = clamp(Number(req.query.days) || 7, 1, 365);
    const limit = clamp(Number(req.query.limit) || 5, 1, 50);
    const now = new Date();
    const endDayKey = toWitaDateKey(now);
    const startDayKey = toWitaDateKey(new Date(now.getTime() - (days - 1) * 86400000));
    try {
        const rows = await sequelize.query(`
        SELECT
          oi.product_id AS productId,
          SUM(oi.quantity) AS qty,
          SUM(oi.quantity * oi.price) AS revenue
        FROM OrderItems oi
        INNER JOIN Orders o ON o.id = oi.order_id
        WHERE DATE(CONVERT_TZ(o.created_at, '+00:00', :tz)) BETWEEN :startDay AND :endDay
          AND o.status IN (:statuses)
        GROUP BY oi.product_id
        ORDER BY qty DESC
        LIMIT :limit
      `, {
            replacements: {
                tz: TZ,
                startDay: startDayKey,
                endDay: endDayKey,
                statuses: ANALYTICS_STATUSES,
                limit,
            },
            type: QueryTypes.SELECT,
        });
        const productIds = rows
            .map((row) => Number(row.productId))
            .filter((id) => Number.isFinite(id));
        const products = productIds.length
            ? await Product.findAll({
                where: { id: productIds },
                attributes: ["id", "name"],
                raw: true,
            })
            : [];
        const byId = new Map(products.map((product) => [Number(product.id), product]));
        const items = rows.map((row) => {
            const product = byId.get(Number(row.productId));
            return {
                productId: row.productId,
                name: product?.name ?? "Unknown",
                soldQty: ensureNumber(row.qty),
                revenue: ensureNumber(row.revenue),
            };
        });
        return res.json({ data: items });
    }
    catch (error) {
        console.error("[analytics] best-selling failed", error);
        return res.status(500).json({ data: [] });
    }
});
// GET /api/admin/analytics/recent-orders?limit=10
router.get("/recent-orders", requireAdmin, async (req, res) => {
    const limit = parseLimit(req.query.limit, 10, 50);
    try {
        let orders = await Order.findAll({
            limit,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: User,
                    as: "customer",
                    attributes: ["name"],
                },
            ],
        });
        if (!orders.length) {
            orders = await Order.findAll({
                limit,
                order: [["createdAt", "DESC"]],
            });
        }
        const items = orders.map((order) => ({
            id: order.id,
            invoiceNo: order.invoiceNo,
            customerName: order.customerName ?? order.customer?.name ?? "Unknown",
            createdAt: order.createdAt,
            method: order.paymentMethod ?? order.method ?? null,
            totalAmount: ensureNumber(order.totalAmount),
            status: normalizeStatus(order.status),
        }));
        return res.json({ data: items });
    }
    catch (error) {
        console.error("[analytics] recent-orders failed", error);
        return res.status(500).json({ data: [] });
    }
});
export default router;
