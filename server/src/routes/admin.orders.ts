import { Router } from "express";
import { Op } from "sequelize";
import { parseListQuery } from "../utils/pagination.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";

const router = Router();

// GET list with pagination, search, and filtering
router.get("/", async (req, res) => {
  const { page, pageSize, sort, order, search } = parseListQuery(req.query);
  const { status, userId, dateFrom, dateTo } = req.query;

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
      [Op.between]: [new Date(dateFrom as string), new Date(dateTo as string)],
    };
  } else if (dateFrom) {
    where.createdAt = { [Op.gte]: new Date(dateFrom as string) };
  } else if (dateTo) {
    where.createdAt = { [Op.lte]: new Date(dateTo as string) };
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

// Other CRUD endpoints for Orders can be added here following the same pattern as Customers

export default router;
