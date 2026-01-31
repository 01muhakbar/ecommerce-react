import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireRole.js";
import { Coupon } from "../models/index.js";
const router = Router();
router.use(requireAdmin);
const createSchema = z.object({
    code: z.string().min(1),
    discountType: z.enum(["percent", "fixed"]).default("percent"),
    amount: z.coerce.number().positive(),
    minSpend: z.coerce.number().min(0).default(0),
    active: z.coerce.boolean().optional().default(true),
    expiresAt: z.string().datetime().optional().nullable(),
});
const updateSchema = createSchema.partial();
const parseExpiresAt = (value) => {
    if (!value)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
// GET /api/admin/coupons?q=&page=&limit=
router.get("/", async (req, res, next) => {
    try {
        const q = String(req.query.q || "").trim();
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || "10"), 10)));
        const where = {};
        if (q)
            where.code = { [Op.like]: `%${q.toUpperCase()}%` };
        const offset = (page - 1) * limit;
        const { rows, count } = await Coupon.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        res.json({
            success: true,
            data: {
                items: rows,
                meta: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
            },
        });
    }
    catch (err) {
        const error = err;
        // eslint-disable-next-line no-console
        console.error("[admin.coupons list] error", {
            name: error?.name,
            message: error?.message,
            code: error?.original?.code,
            errno: error?.original?.errno,
            sqlMessage: error?.original?.sqlMessage,
            sql: error?.sql,
        });
        next(err);
    }
});
// POST /api/admin/coupons
router.post("/", async (req, res, next) => {
    try {
        const body = createSchema.parse(req.body);
        const code = body.code.trim().toUpperCase();
        const expiresAt = parseExpiresAt(body.expiresAt ?? null);
        const created = await Coupon.create({
            code,
            discountType: body.discountType,
            amount: body.amount,
            minSpend: body.minSpend ?? 0,
            active: body.active ?? true,
            expiresAt,
        });
        res.status(201).json({ success: true, data: created });
    }
    catch (err) {
        if (err?.name === "SequelizeUniqueConstraintError") {
            return res.status(409).json({ success: false, message: "Coupon code already exists" });
        }
        next(err);
    }
});
// PATCH /api/admin/coupons/:id
router.patch("/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, message: "Invalid id" });
        }
        const body = updateSchema.parse(req.body);
        const coupon = await Coupon.findByPk(id);
        if (!coupon)
            return res.status(404).json({ success: false, message: "Not found" });
        const patch = {};
        if (body.code !== undefined)
            patch.code = body.code.trim().toUpperCase();
        if (body.discountType !== undefined)
            patch.discountType = body.discountType;
        if (body.amount !== undefined)
            patch.amount = body.amount;
        if (body.minSpend !== undefined)
            patch.minSpend = body.minSpend;
        if (body.active !== undefined)
            patch.active = body.active;
        if (body.expiresAt !== undefined)
            patch.expiresAt = parseExpiresAt(body.expiresAt);
        await coupon.update(patch);
        res.json({ success: true, data: coupon });
    }
    catch (err) {
        if (err?.name === "SequelizeUniqueConstraintError") {
            return res.status(409).json({ success: false, message: "Coupon code already exists" });
        }
        next(err);
    }
});
// DELETE /api/admin/coupons/:id
router.delete("/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, message: "Invalid id" });
        }
        const coupon = await Coupon.findByPk(id);
        if (!coupon)
            return res.status(404).json({ success: false, message: "Not found" });
        await coupon.destroy();
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
export default router;
