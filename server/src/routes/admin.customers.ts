import { Router } from "express";
import { Op } from "sequelize";
import { parseListQuery } from "../utils/pagination.js";
import { User } from "../models/User.js";

const router = Router();

// GET list dengan paginasi & search
router.get("/", async (req, res) => {
  const { page, pageSize, sort, order, search } = parseListQuery(req.query);
  const where = search
    ? {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone_number: { [Op.like]: `%${search}%` } },
        ],
      }
    : {};
  const { rows, count } = await User.findAndCountAll({
    where: { ...where, role: "customer" },
    order: [[sort, order]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
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

// GET detail
router.get("/:id", async (req, res) => {
  const c = await User.findOne({
    where: { id: req.params.id, role: "customer" },
  });
  if (!c) return res.status(404).json({ message: "Customer not found" });
  res.json(c);
});

// POST create
router.post("/", async (req, res) => {
  // Creation of users/customers should likely go through a more robust registration flow
  // For this admin CRUD, we'll assume updates and deletions are more common.
  // A simple creation is omitted to prevent creating users without passwords.
  res
    .status(405)
    .json({
      message: "Customer creation should be done via user registration.",
    });
});

// PUT update
router.put("/:id", async (req, res) => {
  const c = await User.findOne({
    where: { id: req.params.id, role: "customer" },
  });
  if (!c) return res.status(404).json({ message: "Customer not found" });
  await c.update(req.body);
  res.json(c);
});

// DELETE
router.delete("/:id", async (req, res) => {
  const c = await User.findOne({
    where: { id: req.params.id, role: "customer" },
  });
  if (!c) return res.status(404).json({ message: "Customer not found" });
  await c.destroy();
  res.json({ message: "deleted" });
});

export default router;
