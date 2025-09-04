"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.togglePublishStatus = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getAllProducts = void 0;
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
/**
 * Mendapatkan semua produk dengan paginasi, pencarian, dan filter.
 * GET /api/v1/admin/products
 */
const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { search, category, price_min, price_max } = req.query;
        const whereClause = {};
        if (search) {
            whereClause.name = { [sequelize_1.Op.like]: `%${search}%` };
        }
        if (category) {
            whereClause.categoryId = category;
        }
        if (price_min) {
            whereClause.price = { ...whereClause.price, [sequelize_1.Op.gte]: price_min };
        }
        if (price_max) {
            whereClause.price = { ...whereClause.price, [sequelize_1.Op.lte]: price_max };
        }
        const { count, rows } = await models_1.Product.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: models_1.User,
                    as: "seller",
                    attributes: ["id", "name"],
                },
                { model: models_1.Category, as: "category", attributes: ["name"] },
            ],
            limit,
            offset,
            order: [["createdAt", "DESC"]],
            distinct: true, // Menambahkan distinct untuk penghitungan yang benar saat join
        });
        res.status(200).json({
            status: "success",
            data: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            message: "Gagal mengambil data produk.",
            error: error.message,
        });
    }
};
exports.getAllProducts = getAllProducts;
/**
 * Mendapatkan satu produk berdasarkan ID.
 * GET /api/v1/admin/products/:id
 */
const getProductById = async (req, res) => {
    try {
        const product = await models_1.Product.findByPk(req.params.id, {
            include: [{ model: models_1.Category, as: "category" }],
        });
        if (!product) {
            return res.status(404).json({ message: "Produk tidak ditemukan." });
        }
        res.status(200).json({ status: "success", data: product });
    }
    catch (error) {
        res
            .status(500)
            .json({ status: "error", message: "Gagal mengambil produk." });
    }
};
exports.getProductById = getProductById;
/**
 * Membuat produk baru.
 * POST /api/v1/admin/products
 */
const createProduct = async (req, res) => {
    try {
        // Logika untuk membuat produk baru akan ditambahkan di sini.
        // Untuk saat ini, kita asumsikan req.body valid.
        const newProduct = await models_1.Product.create(req.body);
        res.status(201).json({ status: "success", data: newProduct });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Gagal membuat produk." });
    }
};
exports.createProduct = createProduct;
/**
 * Memperbarui produk.
 * PUT /api/v1/admin/products/:id
 */
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const [updatedRows] = await models_1.Product.update(req.body, { where: { id } });
        if (updatedRows === 0) {
            return res.status(404).json({ message: "Produk tidak ditemukan." });
        }
        const updatedProduct = await models_1.Product.findByPk(id);
        res.status(200).json({ status: "success", data: updatedProduct });
    }
    catch (error) {
        res
            .status(500)
            .json({ status: "error", message: "Gagal memperbarui produk." });
    }
};
exports.updateProduct = updateProduct;
/**
 * Menghapus produk.
 * DELETE /api/v1/admin/products/:id
 */
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedRows = await models_1.Product.destroy({ where: { id } });
        if (deletedRows === 0) {
            return res.status(404).json({ message: "Produk tidak ditemukan." });
        }
        res.status(204).send();
    }
    catch (error) {
        res
            .status(500)
            .json({ status: "error", message: "Gagal menghapus produk." });
    }
};
exports.deleteProduct = deleteProduct;
/**
 * Mengubah status publish produk.
 * PATCH /api/v1/admin/products/:id/toggle-publish
 */
const togglePublishStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await models_1.Product.findByPk(id);
        if (!product) {
            return res.status(404).json({ message: "Produk tidak ditemukan." });
        }
        product.isPublished = !product.isPublished;
        await product.save();
        res.status(200).json({
            status: "success",
            message: `Status produk berhasil diubah menjadi ${product.isPublished ? "Published" : "Unpublished"}.`,
            data: product,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ status: "error", message: "Gagal mengubah status produk." });
    }
};
exports.togglePublishStatus = togglePublishStatus;
