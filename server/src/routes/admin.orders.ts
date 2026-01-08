import { Router } from "express";
import { Op } from "sequelize";
import { parseListQuery } from "../utils/pagination.js";
import { updateOrderStatus } from "../controllers/orderController.js";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { OrderItem } from "../models/OrderItem.js";
import { Product } from "../models/Product.js";

const router = Router();

// GET list with pagination, search, and filtering
router.get("/", requireStaffOrAdmin, async (req, res) => {
  const { page, pageSize, sort, order, search } = parseListQuery(req.query);
  const { status, userId } = req.query;
  const dateFrom = (req.query.dateFrom ?? req.query.startDate) as string | undefined;
  const dateTo = (req.query.dateTo ?? req.query.endDate) as string | undefined;

  let where: any = {};
  const include: any[] = [
    { model: User, as: "customer", attributes: ["name", "email"] },
  ];

  if (search) {
    where[Op.or] = [
      { "$customer.name$": { [Op.like]: `%${search}%` } },
      { "$customer.email$": { [Op.like]: `%${search}%` } },
    ];
  }

  if (status) {
    where.status = status as string;
  }

  if (userId) {
    where.userId = userId;
  }

  if (dateFrom && dateTo) {
    where.createdAt = {
      [Op.between]: [new Date(dateFrom), new Date(dateTo)],
    };
  } else if (dateFrom) {
    where.createdAt = { [Op.gte]: new Date(dateFrom) };
  } else if (dateTo) {
    where.createdAt = { [Op.lte]: new Date(dateTo) };
  }

  const { rows, count } = await Order.findAndCountAll({
    where,
    include,
    order: [[sort, order]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true, // needed for correct count with includes
  });

  res.json({
    data: rows,
    meta: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
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

  return res.json(orderItem);
});

router.put("/:id/status", requireAdmin, updateOrderStatus);

// Other CRUD endpoints for Orders can be added here following the same pattern as Customers

export default router;
