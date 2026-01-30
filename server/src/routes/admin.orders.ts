import { Router } from "express";
import { Op } from "sequelize";
import { updateOrderStatus } from "../controllers/orderController.js";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { OrderItem } from "../models/OrderItem.js";
import { Product } from "../models/Product.js";

const router = Router();

// GET list with pagination, search, and filtering
router.get("/", requireStaffOrAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const rawLimit = Number(req.query.limit || req.query.pageSize || 10);
  const limit = Math.min(50, Math.max(1, rawLimit || 10));
  const rawStatus =
    typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
  const status = rawStatus === "completed" ? "delivered" : rawStatus;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

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
      "totalAmount",
      "customerName",
      "customerPhone",
      "createdAt",
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  const data = rows.map((orderRow: any) => ({
    id: orderRow.id,
    invoiceNo: orderRow.invoiceNo,
    status: orderRow.status,
    totalAmount: Number(orderRow.totalAmount || 0),
    createdAt: orderRow.createdAt,
    customerName: orderRow.customerName ?? "Guest",
    customerPhone: orderRow.customerPhone ?? null,
  }));

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
  const orderItem = await Order.findByPk(req.params.id as any, {
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

  const items = (orderItem.items || []).map((item: any) => ({
    id: item.id,
    productId: item.productId ?? item.get?.("productId") ?? item.product_id,
    quantity: item.quantity,
    price: Number(item.price || 0),
    lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
        }
      : null,
  }));

  return res.json({
    data: {
      id: orderItem.id,
      invoiceNo: orderItem.invoiceNo,
      status: orderItem.status,
      totalAmount: Number(orderItem.totalAmount || 0),
      createdAt: orderItem.createdAt,
      customerName: orderItem.customerName ?? orderItem.customer?.name ?? null,
      customerPhone: orderItem.customerPhone ?? null,
      customerAddress: orderItem.customerAddress ?? null,
      customerNotes: orderItem.customerNotes ?? null,
      method: orderItem.paymentMethod ?? "COD",
      items,
    },
  });
});

router.patch("/:id/status", requireAdmin, updateOrderStatus);

// Other CRUD endpoints for Orders can be added here following the same pattern as Customers

export default router;
