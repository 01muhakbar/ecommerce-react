import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
const asSingle = (v) => (Array.isArray(v) ? v[0] : v);
const toId = (v) => {
    const raw = asSingle(v);
    const id = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(id) ? id : null;
};
export const getMe = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const user = await User.findByPk(userId, {
            attributes: ["id", "name", "email", "role"],
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
    }
    catch (error) {
        next(error);
    }
};
// --- ADMIN FUNCTIONS ---
/**
 * Mendapatkan semua pengguna (Admin only).
 */
export const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ["password"] },
            order: [["createdAt", "DESC"]],
        });
        res
            .status(200)
            .json({ status: "success", results: users.length, data: users });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Mendapatkan satu pengguna berdasarkan ID (Admin only).
 */
export const getUserById = async (req, res, next) => {
    try {
        const id = toId(req.params.id);
        if (id === null)
            return res.status(400).json({ message: "Invalid id" });
        const user = await User.findByPk(id, {
            attributes: { exclude: ["password"] },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ status: "success", data: user });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Membuat pengguna baru (Admin only).
 */
export const createUser = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || "pembeli",
            status: "active",
        });
        newUser.password = undefined;
        res.status(201).json({ status: "success", data: newUser });
    }
    catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            return res
                .status(400)
                .json({ status: "fail", message: "Email sudah terdaftar." });
        }
        next(error);
    }
};
/**
 * Memperbarui pengguna (Admin only).
 */
export const updateUser = async (req, res, next) => {
    try {
        const { name, role } = req.body;
        const updateData = {};
        if (name)
            updateData.name = name;
        // Type guard for role
        const isValidRole = (role) => role === "Admin" || role === "Super Admin" || role === "User";
        if (role && isValidRole(role)) {
            updateData.role = role;
        }
        const id = toId(req.params.id);
        if (id === null)
            return res.status(400).json({ message: "Invalid id" });
        const [updatedRows] = await User.update(updateData, {
            where: { id },
        });
        if (updatedRows === 0) {
            return res.status(404).json({ message: "User not found to update." });
        }
        const updatedUser = await User.findByPk(id, {
            attributes: { exclude: ["password"] },
        });
        res.status(200).json({ status: "success", data: updatedUser });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Menghapus pengguna (Admin only).
 */
export const deleteUser = async (req, res, next) => {
    try {
        const id = toId(req.params.id);
        if (id === null)
            return res.status(400).json({ message: "Invalid id" });
        const deletedRows = await User.destroy({ where: { id } });
        if (deletedRows === 0) {
            return res.status(404).json({ message: "User not found to delete." });
        }
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
};
export const updateMe = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { name } = req.body;
        const [updatedRows] = await User.update({ name }, { where: { id: userId } });
        if (updatedRows === 0) {
            return res.status(404).json({ message: "User not found to update." });
        }
        const updatedUser = await User.findByPk(userId, {
            attributes: ["id", "name", "email", "role"],
        });
        res.status(200).json({ status: "success", data: updatedUser });
    }
    catch (error) {
        next(error);
    }
};
