import { Router } from "express";
import { Op } from "sequelize";
import { parseListQuery } from "../utils/pagination.js";
import { Staff } from "../models/Staff.js";
const router = Router();
const validRoles = [
    "admin",
    "super_admin",
    "editor",
    "viewer",
];
// GET list with pagination & search
router.get("/", async (req, res) => {
    const { page, pageSize, sort, order, search } = parseListQuery(req.query);
    const where = search
        ? {
            [Op.or]: [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
            ],
        }
        : {};
    const { rows, count } = await Staff.findAndCountAll({
        where,
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
    const staff = await Staff.findByPk(req.params.id);
    if (!staff)
        return res.status(404).json({ message: "Staff not found" });
    res.json(staff);
});
// PUT update
router.put("/:id", async (req, res) => {
    const staff = await Staff.findByPk(req.params.id);
    if (!staff)
        return res.status(404).json({ message: "Staff not found" });
    const { role } = req.body;
    if (role && !validRoles.includes(role)) {
        return res
            .status(400)
            .json({
            message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        });
    }
    await staff.update(req.body);
    res.json(staff);
});
// Other CRUD endpoints (POST, DELETE) can be added here following a similar pattern.
// For simplicity, I'm focusing on GET and PUT as requested.
export default router;
