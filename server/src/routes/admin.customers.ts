import { Router } from "express";
import { Op } from "sequelize";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { User } from "../models/User.js";

const router = Router();

const ALLOWED_SORT = new Set(["createdAt", "name", "email"]);
const parseId = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// GET list dengan paginasi & search
router.get("/", requireStaffOrAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || "10"), 10))
  );
  const q = String(req.query.q || "").trim();
  const sortRaw = String(req.query.sort || "createdAt");
  const sort = ALLOWED_SORT.has(sortRaw) ? sortRaw : "createdAt";
  const order =
    String(req.query.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const where = q
    ? {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { phone_number: { [Op.like]: `%${q}%` } },
        ],
      }
    : {};
  const { rows, count } = await User.findAndCountAll({
    where: { ...where, role: "customer" },
    order: [[sort, order]],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({
    data: rows,
    meta: {
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    },
  });
});

// GET detail
router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  const idNum = parseId(req.params.id);
  if (!idNum) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const c = await User.findOne({
    where: { id: idNum, role: "customer" },
  });
  if (!c) return res.status(404).json({ success: false, message: "Not found" });
  res.json({
    data: {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: (c as any).phone_number ?? (c as any).phone ?? null,
      role: c.role,
      createdAt: (c as any).createdAt ?? (c as any).created_at ?? null,
      updatedAt: (c as any).updatedAt ?? (c as any).updated_at ?? null,
    },
  });
});

// POST create
router.post("/", requireAdmin, async (req, res) => {
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
router.put("/:id", requireAdmin, async (req, res) => {
  const c = await User.findOne({
    where: { id: req.params.id, role: "customer" },
  });
  if (!c) return res.status(404).json({ message: "Customer not found" });
  await c.update(req.body);
  res.json({ data: c });
});

// DELETE
router.delete("/:id", requireAdmin, async (req, res) => {
  const c = await User.findOne({
    where: { id: req.params.id, role: "customer" },
  });
  if (!c) return res.status(404).json({ message: "Customer not found" });
  await c.destroy();
  res.json({ ok: true });
});

export default router;
