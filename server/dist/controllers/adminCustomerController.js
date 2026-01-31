import { Op } from "sequelize";
import { User } from "../models/User.js";
// Helper untuk membersihkan string untuk CSV
const csv = (v) => v ? `"${String(v).replace(/"/g, '""')}"` : "";
/**
 * GET /api/v1/admin/customers
 * Mendapatkan daftar pelanggan dengan paginasi, pencarian, dan filter.
 */
export const getCustomers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 10, 1);
        const offset = (page - 1) * limit;
        const q = req.query.q?.trim();
        const sortBy = req.query.sortBy || "created_at";
        const sort = (req.query.sort || "DESC").toUpperCase() === "ASC"
            ? "ASC"
            : "DESC";
        const from = req.query.from; // ISO date
        const to = req.query.to;
        const sortMap = {
            created_at: "created_at",
            name: "name",
            email: "email",
        };
        const orderField = sortMap[sortBy] ?? "created_at";
        const where = {
            role: "customer",
            ...(q
                ? {
                    [Op.or]: [
                        { name: { [Op.like]: `%${q}%` } },
                        { email: { [Op.like]: `%${q}%` } },
                    ],
                }
                : {}),
            ...(from || to
                ? {
                    created_at: {
                        ...(from ? { [Op.gte]: new Date(from) } : {}),
                        ...(to ? { [Op.lte]: new Date(to) } : {}),
                    },
                }
                : {}),
        };
        const { rows, count } = await User.findAndCountAll({
            attributes: ["id", "name", "email", "created_at"],
            where,
            limit,
            offset,
            order: [[orderField, sort]],
        });
        res.json({
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
            data: rows.map((u) => {
                const phoneNumber = u.phoneNumber ?? null;
                return {
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    phone: phoneNumber,
                    joiningDate: u.created_at,
                };
            }),
        });
    }
    catch (err) {
        console.error("ADMIN CUSTOMERS ERROR:", err);
        if (err?.parent)
            console.error("PARENT:", err.parent);
        if (err?.sql)
            console.error("SQL:", err.sql);
        return res.status(500).json({ message: "Failed to fetch customers" });
    }
};
/**
 * GET /api/v1/admin/customers/:id
 * Mendapatkan detail satu pelanggan.
 */
export const getCustomerById = async (req, res) => {
    try {
        const customer = await User.findOne({
            where: { id: req.params.id, role: "customer" },
            attributes: ["id", "name", "email", "created_at"],
        });
        if (!customer)
            return res.status(404).json({ message: "Customer not found" });
        const phoneNumber = customer.phoneNumber ?? null;
        res.json({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: phoneNumber,
            joiningDate: customer.created_at,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Failed to get customer",
            error: error.message,
        });
    }
};
/**
 * PATCH /api/v1/admin/customers/:id
 * Memperbarui data pelanggan.
 */
export const updateCustomer = async (req, res) => {
    try {
        const { name, email } = req.body;
        const [count] = await User.update({ name, email }, { where: { id: req.params.id, role: "customer" } });
        if (!count)
            return res.status(404).json({ message: "Customer not found" });
        res.json({ message: "Customer updated successfully" });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Failed to update customer",
            error: error.message,
        });
    }
};
/**
 * DELETE /api/v1/admin/customers/:id
 * Menghapus pelanggan.
 */
export const deleteCustomer = async (req, res) => {
    try {
        const count = await User.destroy({
            where: { id: req.params.id, role: "customer" },
        });
        if (!count)
            return res.status(404).json({ message: "Customer not found" });
        res.status(200).json({ message: "Customer deleted successfully" });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Failed to delete customer",
            error: error.message,
        });
    }
};
/**
 * GET /api/v1/admin/customers/export
 * Mengekspor data pelanggan ke format CSV.
 */
export const exportCustomersCsv = async (_, res) => {
    try {
        const rows = await User.findAll({
            attributes: ["id", "name", "email", "created_at"],
            where: { role: "customer" },
            order: [["created_at", "DESC"]],
        });
        const header = "id,joiningDate,name,email,phone\n";
        const body = rows
            .map((r) => `${r.id},${r.created_at.toISOString()},${csv(r.name)},${csv(r.email)},${csv(r.phoneNumber ?? null)}`)
            .join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="customers.csv"');
        res.send(header + body);
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Failed to export customers",
            error: error.message,
        });
    }
};
/**
 * POST /api/v1/admin/customers/import
 * Mengimpor data pelanggan dari CSV.
 */
export const importCustomersCsv = async (req, res) => {
    // Asumsikan middleware multer sudah ada; kalau belum, tambahkan untuk route import
    res.status(501).json({ message: "Import endpoint not implemented yet." });
};
