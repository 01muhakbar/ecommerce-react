// server/src/routes/admin.staff.ts
import { Router } from "express";
import { Op } from "sequelize";
import * as models from "../models/index.js";
import { z } from "zod";
import bcrypt from "bcrypt";
const { User } = models;
const router = Router();
function normalizeRole(input) {
    const raw = String(input ?? "").trim();
    if (!raw)
        return "staff";
    const lower = raw.toLowerCase();
    if (["super admin", "super_admin", "super-admin"].includes(lower))
        return "super_admin";
    if (["admin", "administrator"].includes(lower))
        return "admin";
    if (["staff", "employee"].includes(lower))
        return "staff";
    return lower.replace(/\s+/g, "_");
}
function toStaffItem(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phoneNumber: row.phoneNumber ?? null,
        role: row.role,
        isActive: String(row.status ?? "").toLowerCase() !== "inactive",
        isPublished: row.isPublished ?? true,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}
// GET /api/admin/staff?page=1&limit=10&q=
router.get("/", async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? req.query.pageSize ?? 10)));
        const q = String(req.query.q ?? "").trim();
        const role = req.query.role ? normalizeRole(String(req.query.role)) : "staff";
        const sortByRaw = String(req.query.sortBy ?? "created_at");
        const sortBy = sortByRaw === "name" || sortByRaw === "email" || sortByRaw === "role"
            ? sortByRaw
            : "created_at";
        const sortDir = String(req.query.sort ?? "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
        const where = role ? { role } : {};
        if (q) {
            where[Op.or] = [
                { name: { [Op.like]: `%${q}%` } },
                { email: { [Op.like]: `%${q}%` } },
            ];
        }
        const { rows, count } = await User.findAndCountAll({
            where,
            offset: (page - 1) * limit,
            limit,
            order: [[sortBy, sortDir]],
            attributes: { exclude: ["password"] },
        });
        res.json({
            rows: rows.map(toStaffItem),
            count,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(count / limit)),
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/staff/:id
router.get("/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const user = await User.findByPk(id, { attributes: { exclude: ["password"] } });
        if (!user)
            return res.status(404).json({ success: false, message: "Not found" });
        res.json(toStaffItem(user));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/staff
router.post("/", async (req, res, next) => {
    try {
        const body = z
            .object({
            name: z.string().min(1),
            email: z.string().email(),
            role: z.string().optional(),
            isActive: z.boolean().optional(),
            password: z.string().min(6).optional(),
        })
            .parse(req.body);
        const role = normalizeRole(body.role);
        const status = body.isActive === false ? "inactive" : "active";
        const rawPassword = body.password ?? Math.random().toString(36).slice(2);
        const password = await bcrypt.hash(rawPassword, 10);
        const created = await User.create({
            name: body.name,
            email: body.email,
            role,
            status,
            password,
        });
        res.status(201).json(toStaffItem(created));
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/staff/:id
router.patch("/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const body = z
            .object({
            name: z.string().min(1).optional(),
            email: z.string().email().optional(),
            role: z.string().optional(),
            isActive: z.boolean().optional(),
            password: z.string().min(6).optional(),
        })
            .parse(req.body);
        const user = await User.findByPk(id);
        if (!user)
            return res.status(404).json({ success: false, message: "Not found" });
        const update = {};
        if (body.name !== undefined)
            update.name = body.name;
        if (body.email !== undefined)
            update.email = body.email;
        if (body.role !== undefined)
            update.role = normalizeRole(body.role);
        if (body.isActive !== undefined)
            update.status = body.isActive ? "active" : "inactive";
        if (body.password)
            update.password = await bcrypt.hash(body.password, 10);
        await user.update(update);
        res.json(toStaffItem(user));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/staff/:id
router.delete("/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const user = await User.findByPk(id);
        if (!user)
            return res.status(404).json({ success: false, message: "Not found" });
        await user.destroy();
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
export default router;
