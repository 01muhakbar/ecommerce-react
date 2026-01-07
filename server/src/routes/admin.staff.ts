// server/src/routes/admin.staff.ts
import { Router } from "express";
import { Op } from "sequelize";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const models = require("../../../models/index.js");

const { User } = models;
const router = Router();

// GET /api/admin/staff?page=1&pageSize=10&q=
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
    const q = String(req.query.q ?? "").trim();

    const where: any = { role: "staff" };
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await (User as any).findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [["created_at", "DESC"]],
    });

    res.json({ data: rows, page, pageSize, total: count });
  } catch (err) {
    next(err);
  }
});

export default router;