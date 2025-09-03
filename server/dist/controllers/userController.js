"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = exports.updateMyProfile = exports.becomeSeller = exports.getUserProfile = exports.getDashboardInfo = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
// --- REFACTORED CONTROLLERS ---
// [REFACTORED] Menggantikan renderDashboard
const getDashboardInfo = (req, res) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    // Kirim data esensial untuk frontend bisa membangun dashboard yang sesuai
    res.status(200).json({
        status: 'success',
        data: {
            id: user.id,
            name: user.name,
            role: user.role
        }
    });
};
exports.getDashboardInfo = getDashboardInfo;
// Mendapatkan profil user yang sedang login
const getUserProfile = async (req, res) => {
    try {
        // ID user sudah ada di req.user dari middleware
        const user = await models_1.User.findByPk(req.user?.id, {
            attributes: { exclude: ["password"] },
        });
        if (!user) {
            res.status(404).json({ message: "User not found." });
            return;
        }
        res.status(200).json(user);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch user profile.", error: error.message });
    }
};
exports.getUserProfile = getUserProfile;
// Mengubah role user menjadi penjual
const becomeSeller = async (req, res) => {
    try {
        const { storeName } = req.body;
        const user = await models_1.User.findByPk(req.user?.id);
        if (!user) {
            res.status(404).json({ status: "fail", message: "User not found." });
            return;
        }
        if (user.role === "penjual" || user.role === "admin") {
            res.status(400).json({ status: "fail", message: "Anda sudah terdaftar sebagai penjual atau admin." });
            return;
        }
        user.role = "penjual";
        user.storeName = storeName;
        await user.save();
        res.status(200).json({ status: "success", message: "Selamat! Anda sekarang adalah penjual." });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Terjadi kesalahan saat mendaftar sebagai penjual.", error: error.message });
    }
};
exports.becomeSeller = becomeSeller;
// Memperbarui profil user yang sedang login
const updateMyProfile = async (req, res) => {
    try {
        const { name, email, phoneNumber, gender, dateOfBirth, storeName } = req.body;
        const user = await models_1.User.findByPk(req.user?.id);
        if (!user) {
            res.status(404).json({ status: "fail", message: "User not found." });
            return;
        }
        // Update fields
        user.name = name ?? user.name;
        user.email = email ?? user.email;
        user.phoneNumber = phoneNumber ?? user.phoneNumber;
        user.gender = gender ?? user.gender;
        user.dateOfBirth = dateOfBirth ?? user.dateOfBirth;
        user.storeName = storeName ?? user.storeName;
        await user.save();
        res.status(200).json({ status: "success", message: "Profil berhasil diperbarui." });
    }
    catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            res.status(400).json({ status: "fail", message: "Email sudah terdaftar." });
            return;
        }
        res.status(500).json({ status: "error", message: "Terjadi kesalahan saat memperbarui profil.", error: error.message });
    }
};
exports.updateMyProfile = updateMyProfile;
// --- ADMIN FUNCTIONS ---
// Mendapatkan semua pengguna (Admin only)
const getAllUsers = async (req, res) => {
    try {
        let where = {};
        const { role, isActive, gender, search } = req.query;
        if (role)
            where.role = role;
        if (isActive !== undefined)
            where.isActive = isActive === "true";
        if (gender)
            where.gender = gender;
        if (search) {
            where[sequelize_1.Op.or] = [
                { name: { [sequelize_1.Op.like]: `%${search}%` } },
                { email: { [sequelize_1.Op.like]: `%${search}%` } },
            ];
        }
        const users = await models_1.User.findAll({ where, attributes: { exclude: ["password"] } });
        res.status(200).json({ status: "success", results: users.length, data: { users } });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Gagal mengambil data pengguna.", error: error.message });
    }
};
exports.getAllUsers = getAllUsers;
// Mendapatkan user tunggal (Admin only)
const getUserById = async (req, res) => {
    try {
        const user = await models_1.User.findByPk(req.params.id, {
            attributes: { exclude: ["password"] },
        });
        if (!user) {
            res.status(404).json({ status: "fail", message: "Pengguna tidak ditemukan." });
            return;
        }
        res.status(200).json({ status: "success", data: { user } });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Gagal mengambil data pengguna.", error: error.message });
    }
};
exports.getUserById = getUserById;
// Membuat user baru (Admin only)
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, storeName } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ status: "fail", message: "Nama, email, dan password harus diisi." });
            return;
        }
        const newUser = await models_1.User.create({
            name,
            email,
            password,
            role: role || 'pembeli',
            storeName,
        });
        res.status(201).json({ status: "success", message: "Pengguna berhasil ditambahkan.", data: { user: newUser } });
    }
    catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            res.status(400).json({ status: "fail", message: "Email sudah terdaftar." });
            return;
        }
        res.status(500).json({ status: "error", message: "Gagal membuat pengguna.", error: error.message });
    }
};
exports.createUser = createUser;
// Memperbarui user (Admin only)
const updateUser = async (req, res) => {
    try {
        const user = await models_1.User.findByPk(req.params.id);
        if (!user) {
            res.status(404).json({ status: "fail", message: "Pengguna tidak ditemukan." });
            return;
        }
        const { name, email, role, storeName, phoneNumber, gender, dateOfBirth, isActive } = req.body;
        // Update fields
        user.name = name ?? user.name;
        user.email = email ?? user.email;
        user.role = role ?? user.role;
        user.storeName = storeName ?? user.storeName;
        user.phoneNumber = phoneNumber ?? user.phoneNumber;
        user.gender = gender ?? user.gender;
        user.dateOfBirth = dateOfBirth ?? user.dateOfBirth;
        user.isActive = isActive ?? user.isActive;
        await user.save();
        res.status(200).json({ status: "success", message: "Data pengguna berhasil diperbarui.", data: { user } });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Gagal memperbarui pengguna.", error: error.message });
    }
};
exports.updateUser = updateUser;
// Menghapus user (Admin only)
const deleteUser = async (req, res) => {
    try {
        const user = await models_1.User.findByPk(req.params.id);
        if (!user) {
            res.status(404).json({ status: "fail", message: "Pengguna tidak ditemukan." });
            return;
        }
        await user.destroy();
        res.status(204).json({ status: "success", data: null });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Gagal menghapus pengguna.", error: error.message });
    }
};
exports.deleteUser = deleteUser;
