"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMe = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = exports.getMe = void 0;
const models_1 = require("../models");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getMe = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            // Seharusnya tidak terjadi jika middleware isAuth bekerja
            return res.status(401).json({ message: "Not authorized" });
        }
        const user = await models_1.User.findByPk(userId, {
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
exports.getMe = getMe;
// --- ADMIN FUNCTIONS ---
/**
 * Mendapatkan semua pengguna (Admin only).
 */
const getAllUsers = async (req, res, next) => {
    try {
        const users = await models_1.User.findAll({
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
exports.getAllUsers = getAllUsers;
/**
 * Mendapatkan satu pengguna berdasarkan ID (Admin only).
 */
const getUserById = async (req, res, next) => {
    try {
        const user = await models_1.User.findByPk(req.params.id, {
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
exports.getUserById = getUserById;
/**
 * Membuat pengguna baru (Admin only).
 */
const createUser = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const newUser = await models_1.User.create({
            name,
            email,
            password: hashedPassword,
            role: role || "pembeli",
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
exports.createUser = createUser;
/**
 * Memperbarui pengguna (Admin only).
 */
const updateUser = async (req, res, next) => {
    try {
        const [updatedRows] = await models_1.User.update(req.body, {
            where: { id: req.params.id },
        });
        if (updatedRows === 0) {
            return res.status(404).json({ message: "User not found to update." });
        }
        const updatedUser = await models_1.User.findByPk(req.params.id, {
            attributes: { exclude: ["password"] },
        });
        res.status(200).json({ status: "success", data: updatedUser });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUser = updateUser;
/**
 * Menghapus pengguna (Admin only).
 */
const deleteUser = async (req, res, next) => {
    try {
        const deletedRows = await models_1.User.destroy({ where: { id: req.params.id } });
        if (deletedRows === 0) {
            return res.status(404).json({ message: "User not found to delete." });
        }
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
const updateMe = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { name } = req.body;
        const [updatedRows] = await models_1.User.update({ name }, { where: { id: userId } });
        if (updatedRows === 0) {
            return res.status(404).json({ message: "User not found to update." });
        }
        const updatedUser = await models_1.User.findByPk(userId, {
            attributes: ["id", "name", "email", "role"],
        });
        res.status(200).json({ status: "success", data: updatedUser });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMe = updateMe;
