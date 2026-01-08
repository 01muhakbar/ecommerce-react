import { Router } from "express";
import { Op, fn, col, literal } from "sequelize";
import * as models from "../models/index.ts";

const { Order, OrderItem, Product, User } = models as {
  Order: any;
  OrderItem: any;
  Product: any;
  User: any;
};
const router = Router();

// Association aliases discovered:
// Order -> OrderItem as: "items"
// OrderItem -> Product as: "product"
// Order -> User as: "customer"

const toDateString = (value: Date) => value.toISOString().slice(0, 10);

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const normalizeStatus = (value: unknown) => {
  const status = String(value || "").toLowerCase();
  if (status === "cancel") return "cancelled";
  if (status === "delivered" || status === "shipped") return "completed";
  if (!status) return "pending";
  return status;
};

const DB = {
  createdAt: col("created_at"),
  totalAmount: col("total_amount"),
};

const parseRange = (raw: unknown) => {
  const value = String(raw || "7d").toLowerCase();
  if (!/^\d+d$/.test(value)) {
    return { range: "7d", days: 7, error: "Invalid range format." };
  }
  const days = Math.min(365, Math.max(1, Number(value.replace("d", "")) || 7));
  return { range: `${days}d`, days, error: "" };
};

const buildRange = (range: string, days: number) => {
  const now = new Date();
  const start = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));
  const end = endOfDay(now);
  return { start, end, range };
};

const ensureNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const parseLimit = (raw: unknown, fallback = 10, max = 50) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
};

// GET /api/admin/analytics/overview
router.get("/overview", async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterdayStart = startOfDay(new Date(now.getTime() - 86400000));
    const yesterdayEnd = endOfDay(new Date(now.getTime() - 86400000));
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    const [
      todayOrders,
      yesterdayOrders,
      thisMonthRows,
      lastMonthRows,
      allTimeRows,
      statusRows,
      totalOrders,
    ] = await Promise.all([
      Order.count({
        where: { createdAt: { [Op.between]: [todayStart, todayEnd] } },
      }),
      Order.count({
        where: { createdAt: {
          [Op.between]: [yesterdayStart, yesterdayEnd],
        } },
      }),
      Order.findAll({
        attributes: [[fn("SUM", DB.totalAmount), "total"]],
        where: { createdAt: { [Op.gte]: thisMonthStart } },
        raw: true as true,
      }),
      Order.findAll({
        attributes: [[fn("SUM", DB.totalAmount), "total"]],
        where: { createdAt: {
          [Op.between]: [lastMonthStart, lastMonthEnd],
        } },
        raw: true as true,
      }),
      Order.findAll({
        attributes: [[fn("SUM", DB.totalAmount), "total"]],
        raw: true as true,
      }),
      Order.findAll({
        attributes: [
          [col("status"), "status"],
          [fn("COUNT", col("id")), "count"],
        ],
        group: [col("status")],
        raw: true as true,
      }),
      Order.count(),
    ]);

    const thisMonthSales = ensureNumber(thisMonthRows?.[0]?.total);
    const lastMonthSales = ensureNumber(lastMonthRows?.[0]?.total);
    const allTimeSales = ensureNumber(allTimeRows?.[0]?.total);

    const statusCounts: Record<string, number> = {
      total: totalOrders,
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
    };

    statusRows.forEach((row: any) => {
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
  } catch (error) {
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

// GET /api/admin/analytics/sales?range=7d
router.get("/sales", async (req, res) => {
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
      raw: true as true,
    });

    const byDate = new Map(
      rows.map((row: any) => [
        String(row.date),
        {
          sales: ensureNumber(row.sales),
          orders: ensureNumber(row.orders),
        },
      ])
    );

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
  } catch (error) {
    console.error("[analytics] sales failed", error);
    return res.json({ range, sales: [], orders: [] });
  }
});

// GET /api/admin/analytics/best-selling?range=7d&limit=5
router.get("/best-selling", async (req, res) => {
  const { range, days, error } = parseRange(req.query.range);
  if (error) {
    return res.status(400).json({ message: error });
  }
  const limit = parseLimit(req.query.limit, 5, 50);
  const { start, end } = buildRange(range, days);

  try {
    const completedStatuses = ["completed", "delivered", "shipped"];
    const rows = await OrderItem.findAll({
      attributes: [
        "productId",
        [fn("SUM", col("OrderItem.quantity")), "qty"],
        [fn("SUM", literal("quantity * price")), "revenue"],
      ],
      include: [
        {
          model: Order,
          attributes: [],
          where: {
            createdAt: { [Op.between]: [start, end] },
            status: { [Op.in]: completedStatuses },
          },
          required: true,
        },
      ],
      group: ["productId"],
      order: [[fn("SUM", col("OrderItem.quantity")), "DESC"]],
      limit,
      raw: true as true,
    });

    const productIds = rows
      .map((row: any) => Number(row.productId))
      .filter((id) => Number.isFinite(id));
    const products = productIds.length
      ? await Product.findAll({
          where: { id: productIds },
          attributes: ["id", "name", "price", "slug", "promoImagePath", "imagePaths"],
          raw: true as true,
        })
      : [];
    const byId = new Map(products.map((product: any) => [Number(product.id), product]));

    const items = rows.map((row: any) => {
      const product = byId.get(Number(row.productId));
      const imagePaths = product?.imagePaths;
      const mainImageUrl =
        product?.promoImagePath ||
        (Array.isArray(imagePaths) ? imagePaths[0] : null) ||
        null;
      return {
        productId: row.productId,
        name: product?.name ?? "Unknown",
        qty: ensureNumber(row.qty),
        revenue: ensureNumber(row.revenue),
        price: product?.price ?? null,
        slug: product?.slug ?? null,
        mainImageUrl,
      };
    });

    return res.json({ range, items });
  } catch (error) {
    console.error("[analytics] best-selling failed", error);
    return res.json({ range, items: [] });
  }
});

// GET /api/admin/analytics/recent-orders?limit=10
router.get("/recent-orders", async (req, res) => {
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

    const items = orders.map((order: any) => ({
      id: order.id,
      invoiceNo: order.invoiceNo,
      customerName: order.customer?.name || "Unknown",
      createdAt: order.createdAt,
      method: order.method ?? null,
      totalAmount: ensureNumber(order.totalAmount),
      status: normalizeStatus(order.status),
    }));

    return res.json({ items });
  } catch (error) {
    console.error("[analytics] recent-orders failed", error);
    return res.json({ items: [] });
  }
});

export default router;
