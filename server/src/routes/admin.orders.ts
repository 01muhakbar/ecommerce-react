import { Router } from "express";
import { Op } from "sequelize";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { OrderItem } from "../models/OrderItem.js";
import { Product } from "../models/Product.js";

const router = Router();
type UiOrderStatus = "pending" | "processing" | "shipping" | "complete" | "cancelled";
type DbOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
type CanonicalMethod = "cash" | "card" | "credit";

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ??
  row?.get?.(key) ??
  row?.dataValues?.[key] ??
  undefined;
const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};
const csvRow = (values: unknown[]) => values.map((value) => csvEscape(value)).join(",");

const normalizeStatusInput = (raw: unknown): DbOrderStatus | "" => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "";
  if (value === "shipping") return "shipped";
  if (value === "complete") return "delivered";
  if (value === "completed") return "delivered";
  if (value === "pending") return "pending";
  if (value === "processing") return "processing";
  if (value === "shipped") return "shipped";
  if (value === "delivered") return "delivered";
  if (value === "cancelled") return "cancelled";
  if (value === "cancel" || value === "canceled") return "cancelled";
  return "";
};

const toUiStatus = (raw: unknown) => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "pending";
  if (["pending_payment", "awaiting_payment", "unpaid"].includes(value)) {
    return "pending";
  }
  if (["processing", "process", "packed", "confirmed", "paid"].includes(value)) {
    return "processing";
  }
  if (["shipped", "shipping", "in_transit"].includes(value)) return "shipping";
  if (["delivered", "completed", "complete"].includes(value)) return "complete";
  if (["cancelled", "canceled", "cancel", "refunded", "failed"].includes(value)) {
    return "cancelled";
  }
  return "pending";
};

const methodPatternMap: Record<CanonicalMethod, string[]> = {
  cash: ["cod", "cash"],
  card: ["card", "debit", "credit card", "credit_card", "visa", "master"],
  credit: ["credit", "paylater", "installment"],
};

const normalizeMethodInput = (raw: unknown): CanonicalMethod | "" => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "";
  if (value === "cash" || value === "cod") return "cash";
  if (value === "card") return "card";
  if (value === "credit") return "credit";
  return "";
};

const normalizeMethodOutput = (raw: unknown): CanonicalMethod => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "cash";
  if (value.includes("cod") || value.includes("cash")) return "cash";
  if (value.includes("credit card") || value.includes("credit_card")) return "card";
  if (value.includes("card") || value.includes("debit") || value.includes("visa")) {
    return "card";
  }
  if (
    value.includes("credit") ||
    value.includes("paylater") ||
    value.includes("installment")
  ) {
    return "credit";
  }
  return "cash";
};

const toMethodLabel = (method: CanonicalMethod) => {
  if (method === "card") return "Card";
  if (method === "credit") return "Credit";
  return "Cash";
};

const allowedStatuses: string[] = [
  "pending",
  "processing",
  "shipping",
  "complete",
  "delivered",
  "cancelled",
  "cancel",
];
const isUiOrderStatus = (value: string) => allowedStatuses.includes(value);

const parseDateAtBoundary = (raw: unknown, endOfDay: boolean): Date | null => {
  const value = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parsePositiveInt = (
  raw: unknown,
  fallback: number,
  min: number,
  max: number
) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const parseLimitDays = (raw: unknown) => {
  const parsed = Number(raw);
  if (![5, 7, 15, 30].includes(parsed)) return 0;
  return parsed;
};

const buildOrdersWhere = (filters: {
  search: string;
  status: DbOrderStatus | "";
  method: CanonicalMethod | "";
  limitDays: number;
  startDate: Date | null;
  endDate: Date | null;
  userId: number | null;
}) => {
  const where: any = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.search) {
    const likeSearch = `%${filters.search}%`;
    where[Op.or] = [
      { invoiceNo: { [Op.like]: likeSearch } },
      { customerName: { [Op.like]: likeSearch } },
      { customerPhone: { [Op.like]: likeSearch } },
      { "$customer.name$": { [Op.like]: likeSearch } },
    ];
  }

  if (filters.status) {
    where.status = filters.status as string;
  }

  if (filters.method) {
    const patterns = methodPatternMap[filters.method] || [];
    if (patterns.length > 0) {
      const methodWhere = {
        [Op.or]: patterns.map((pattern) => ({
          paymentMethod: { [Op.like]: `%${pattern}%` },
        })),
      };
      where[Op.and] = [...(where[Op.and] || []), methodWhere];
    }
  }

  // Rule: explicit startDate/endDate overrides limitDays.
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt[Op.gte] = filters.startDate;
    if (filters.endDate) where.createdAt[Op.lte] = filters.endDate;
  } else if (filters.limitDays > 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - filters.limitDays);
    where.createdAt = { [Op.gte]: start };
  }

  return where;
};

const parseOrdersQuery = (query: any) => {
  const page = parsePositiveInt(asSingle(query.page), 1, 1, 1_000_000);
  const pageSize = parsePositiveInt(
    asSingle(query.pageSize) ?? asSingle(query.limit),
    10,
    1,
    100
  );

  const search = String(asSingle(query.search) ?? asSingle(query.q) ?? "").trim();
  const status = normalizeStatusInput(asSingle(query.status));
  const method = normalizeMethodInput(asSingle(query.method));
  const limitDays = parseLimitDays(asSingle(query.limitDays));
  const startDate = parseDateAtBoundary(asSingle(query.startDate), false);
  const endDate = parseDateAtBoundary(asSingle(query.endDate), true);
  const userIdRaw = Number(asSingle(query.userId));
  const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;

  const where = buildOrdersWhere({
    search,
    status,
    method,
    limitDays,
    startDate,
    endDate,
    userId,
  });

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    where,
    filters: {
      search,
      status,
      method,
      limitDays,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      dateSource: startDate || endDate ? "dateRange" : limitDays > 0 ? "limitDays" : "none",
    },
  };
};

const resolveOrderWhere = (idOrRef: string) => {
  const trimmed = String(idOrRef || "").trim();
  const isNumeric = /^\d+$/.test(trimmed);
  if (isNumeric) {
    return { id: Number(trimmed) };
  }
  return { invoiceNo: trimmed };
};

const orderDetailInclude: any[] = [
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
];

const toOrderDetailPayload = (orderItem: any) => {
  const items = ((orderItem as any).items ?? []).map((item: any) => ({
    id: getAttr(item, "id"),
    productId:
      getAttr(item, "productId") ?? item.get?.("productId") ?? item.product_id,
    quantity: getAttr(item, "quantity"),
    price: Number(getAttr(item, "price") || 0),
    lineTotal:
      Number(getAttr(item, "price") || 0) *
      Number(getAttr(item, "quantity") || 0),
    product: item.product
      ? {
          id: getAttr(item.product, "id"),
          name: getAttr(item.product, "name"),
        }
      : null,
  }));

  const customer = (orderItem as any).customer ?? null;

  const subtotal = items.reduce((sum: number, item: any) => {
    return sum + Number(item.lineTotal || 0);
  }, 0);
  const discount = Number(getAttr(orderItem, "discountAmount") || 0);
  const shipping = Number(getAttr(orderItem, "shippingCost") || 0);
  const totalAmount = Number(getAttr(orderItem, "totalAmount") || 0);

  return {
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
  };
};

// GET list with pagination, search, status/method/date filters.
router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const parsed = parseOrdersQuery(req.query || {});
    const { page, pageSize, offset, where } = parsed;

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "customer",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
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
      limit: pageSize,
      offset,
      distinct: true,
      col: "id",
    });

    const items = rows.map((orderRow: any) => {
      const customer =
        orderRow?.customer ??
        orderRow?.get?.("customer") ??
        orderRow?.dataValues?.customer ??
        null;
      const id = getAttr(orderRow, "id");
      const invoiceNo = getAttr(orderRow, "invoiceNo");
      const amount = Number(
        getAttr(orderRow, "totalAmount") ??
          getAttr(orderRow, "total") ??
          getAttr(orderRow, "grandTotal") ??
          0
      );
      const methodRaw = getAttr(orderRow, "paymentMethod") ?? "COD";
      const method = normalizeMethodOutput(methodRaw);
      const customerName =
        getAttr(orderRow, "customerName") ??
        getAttr(orderRow, "shippingName") ??
        customer?.name ??
        "Guest";
      return {
        id,
        ref: invoiceNo ?? String(id ?? ""),
        orderId: id,
        invoiceNo,
        orderTime: getAttr(orderRow, "createdAt"),
        createdAt: getAttr(orderRow, "createdAt"),
        customerName,
        customerPhone:
          getAttr(orderRow, "customerPhone") ??
          getAttr(orderRow, "shippingPhone") ??
          customer?.phone ??
          null,
        method,
        paymentMethod: method,
        amount,
        totalAmount: amount,
        status: toUiStatus(getAttr(orderRow, "status")),
      };
    });

    const totalPages = Math.max(1, Math.ceil(count / pageSize));

    return res.json({
      success: true,
      data: {
        items,
        total: count,
        page,
        pageSize,
        totalPages,
        // Backward compatibility for existing admin client consumers.
        limit: pageSize,
        totalItems: count,
        filters: parsed.filters,
      },
    });
  } catch (error) {
    console.error("[admin.orders list] error", error);
    return res.status(500).json({ message: "Failed to load orders." });
  }
});

const exportOrdersCsv = async (req: any, res: any) => {
  try {
    const parsed = parseOrdersQuery(req.query || {});
    const rows = await Order.findAll({
      where: parsed.where,
      attributes: [
        "id",
        "invoiceNo",
        "status",
        "createdAt",
        "totalAmount",
        "customerName",
        "paymentMethod",
      ],
      include: [
        {
          model: User,
          as: "customer",
          attributes: ["name", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const header = csvRow([
      "Invoice No",
      "Order Time",
      "Customer Name",
      "Method",
      "Amount",
      "Status",
    ]);

    const lines = rows.map((orderRow: any) => {
      const customer =
        orderRow?.customer ??
        orderRow?.get?.("customer") ??
        orderRow?.dataValues?.customer ??
        null;

      const invoiceNo =
        getAttr(orderRow, "invoiceNo") ?? String(getAttr(orderRow, "id") ?? "");
      const createdAt = getAttr(orderRow, "createdAt")
        ? new Date(getAttr(orderRow, "createdAt")).toISOString().replace("T", " ").slice(0, 19)
        : "";
      const customerName =
        getAttr(orderRow, "customerName") ?? customer?.name ?? customer?.email ?? "Guest";
      const method = toMethodLabel(
        normalizeMethodOutput(getAttr(orderRow, "paymentMethod") ?? "COD")
      );
      const amount = Number(getAttr(orderRow, "totalAmount") ?? 0);
      const status = toUiStatus(getAttr(orderRow, "status"));

      return csvRow([invoiceNo, createdAt, customerName, method, amount, status]);
    });

    const now = new Date();
    const stampDate = now.toISOString().slice(0, 10).replace(/-/g, "");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const filename = `orders-${stampDate}-${hh}${mm}.csv`;
    const csv = [header, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("[admin.orders export] error", error);
    return res.status(500).json({ message: "Failed to export orders." });
  }
};

router.get("/export", requireStaffOrAdmin, exportOrdersCsv);
router.get("/export.csv", requireStaffOrAdmin, exportOrdersCsv);

const findOrderDetail = async (lookup: string, preferInvoiceLookup = false) => {
  if (!lookup) return null;
  if (!preferInvoiceLookup) {
    return Order.findOne({
      where: resolveOrderWhere(lookup),
      include: orderDetailInclude,
    });
  }

  let orderItem = await Order.findOne({
    where: { invoiceNo: lookup },
    include: orderDetailInclude,
  });
  if (!orderItem && /^\d+$/.test(lookup)) {
    // Backward-compat fallback for legacy numeric links.
    orderItem = await Order.findOne({
      where: { id: Number(lookup) },
      include: orderDetailInclude,
    });
  }
  return orderItem;
};

const sendOrderDetail = async (res: any, lookup: string, preferInvoiceLookup = false) => {
  const orderItem = await findOrderDetail(lookup, preferInvoiceLookup);
  if (!orderItem) {
    return res.status(404).json({ message: "Not found" });
  }
  return res.json({
    success: true,
    data: toOrderDetailPayload(orderItem),
  });
};

router.get("/by-invoice/:invoiceNo", requireStaffOrAdmin, async (req, res) => {
  const invoiceNo = String(asSingle(req.params.invoiceNo) ?? "").trim();
  if (!invoiceNo) {
    return res.status(400).json({ message: "Invalid invoice no" });
  }
  return sendOrderDetail(res, invoiceNo, true);
});

router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  const idStr = String(asSingle(req.params.id) ?? "").trim();
  if (!idStr) {
    return res.status(400).json({ message: "Invalid id" });
  }
  return sendOrderDetail(res, idStr, false);
});

router.patch("/:id/status", requireStaffOrAdmin, async (req, res) => {
  const idStr = String(asSingle(req.params.id) ?? "");
  if (!idStr) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const rawStatus = String(req.body?.status ?? "").toLowerCase().trim();
  if (!rawStatus || !isUiOrderStatus(rawStatus)) {
    return res.status(400).json({
      message: `Status tidak valid. Gunakan salah satu dari: ${allowedStatuses.join(
        ", "
      )}`,
    });
  }

  const normalizedStatus = normalizeStatusInput(rawStatus);
  if (!normalizedStatus) {
    return res.status(400).json({
      message: `Status tidak valid. Gunakan salah satu dari: ${allowedStatuses.join(
        ", "
      )}`,
    });
  }
  const [updatedRows] = await Order.update(
    { status: normalizedStatus, updatedAt: new Date() },
    { where: resolveOrderWhere(idStr) }
  );

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
