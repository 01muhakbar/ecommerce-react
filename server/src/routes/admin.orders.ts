import { Router } from "express";
import { Op } from "sequelize";
import { updateOrderStatus } from "../controllers/orderController.js";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { OrderItem } from "../models/OrderItem.js";
import { Product } from "../models/Product.js";

const router = Router();
const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ??
  row?.get?.(key) ??
  row?.dataValues?.[key] ??
  undefined;

// GET list with pagination, search, and filtering
router.get("/", requireStaffOrAdmin, async (req, res) => {
  const page = Math.max(1, Number(asSingle(req.query.page) ?? 1));
  const rawLimit = Number(asSingle(req.query.limit) ?? asSingle(req.query.pageSize) ?? 10);
  const limit = Math.min(50, Math.max(1, rawLimit || 10));
  const rawStatus = String(asSingle(req.query.status) ?? "").trim().toLowerCase();
  const status = rawStatus === "completed" ? "delivered" : rawStatus;
  const q = String(asSingle(req.query.q) ?? "").trim();

  const where: any = {};

  if (q) {
    where[Op.or] = [
      { invoiceNo: { [Op.like]: `%${q}%` } },
      { customerName: { [Op.like]: `%${q}%` } },
      { customerPhone: { [Op.like]: `%${q}%` } },
    ];
  }

  if (status) {
    where.status = status as string;
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
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  const data = rows.map((orderRow: any) => {
    const customer =
      orderRow?.customer ??
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
      orderId: id,
      invoiceNo,
      status,
      createdAt,
      totalAmount: Number(
        getAttr(orderRow, "totalAmount") ??
          getAttr(orderRow, "total") ??
          getAttr(orderRow, "grandTotal") ??
          0
      ),
      customerName:
        customerName ??
        getAttr(orderRow, "shippingName") ??
        customer?.name ??
        "Guest",
      customerPhone:
        customerPhone ??
        getAttr(orderRow, "shippingPhone") ??
        customer?.phone ??
        null,
    };
  });

  res.json({
    data,
    meta: {
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    },
  });
});

router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  const idStr = String(asSingle(req.params.id) ?? "");
  const idNum = Number(idStr);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const orderItem = await Order.findByPk(idNum, {
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

  return res.json({
    data: {
      id: getAttr(orderItem, "id"),
      invoiceNo: getAttr(orderItem, "invoiceNo"),
      status: getAttr(orderItem, "status"),
      totalAmount: Number(getAttr(orderItem, "totalAmount") || 0),
      createdAt: getAttr(orderItem, "createdAt"),
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

router.patch("/:id/status", requireStaffOrAdmin, updateOrderStatus);

// Other CRUD endpoints for Orders can be added here following the same pattern as Customers

export default router;
