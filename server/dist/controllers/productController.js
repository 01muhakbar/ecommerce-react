"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAllProducts = exports.getProductDetailsForPreview = exports.renderAddProductPageAdmin = exports.renderAdminProductsPage = exports.deleteProduct = exports.updateProduct = exports.renderAdminEditProductPage = exports.getEditProductPage = exports.getSellerProducts = exports.getProductById = exports.getAllProducts = exports.createProduct = void 0;
const index_1 = require("../models/index");
const sequelize_1 = require("sequelize");
// Fungsi untuk membuat produk baru
const createProduct = async (req, res) => {
    try {
        const { name, description, price, stock, categoryId, status, gtin, notes, parentSku, condition, weight, length, width, height, dangerousProduct, isPublished, preOrder, preorderDays, youtubeLink, variations, wholesale, } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res
                .status(401)
                .json({ success: false, message: "Unauthorized: User not logged in." });
            return;
        }
        let promoImagePath = undefined;
        if (req.files &&
            req.files
                .promoProductImage) {
            promoImagePath = req.files.promoProductImage[0].path;
        }
        let imagePaths = [];
        if (req.files &&
            req.files
                .productImages) {
            imagePaths = req.files.productImages.map((file) => file.path);
        }
        let videoPath = undefined;
        if (req.files &&
            req.files.productVideo) {
            videoPath = req.files
                .productVideo[0].path;
        }
        const newProduct = await index_1.Product.create({
            name,
            description,
            price: parseFloat(price),
            stock: parseInt(stock, 10),
            categoryId,
            userId,
            status: status || "archived",
            gtin,
            notes,
            parentSku,
            condition,
            weight: parseInt(weight, 10),
            length: length ? parseInt(length, 10) : undefined,
            width: width ? parseInt(width, 10) : undefined,
            height: height ? parseInt(height, 10) : undefined,
            dangerousProduct: dangerousProduct === "true",
            isPublished: isPublished === "true",
            preOrder: preOrder === "true",
            preorderDays: preOrder === "true" ? parseInt(preorderDays, 10) : undefined,
            youtubeLink,
            promoImagePath,
            imagePaths,
            videoPath,
            variations: variations ? JSON.parse(variations) : undefined,
            wholesale: wholesale ? JSON.parse(wholesale) : undefined,
        });
        res.status(201).json({
            success: true,
            message: "Produk berhasil dibuat!",
            product: newProduct,
        });
    }
    catch (error) {
        console.error("CREATE PRODUCT ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Gagal membuat produk",
            error: error.message,
        });
    }
};
exports.createProduct = createProduct;
// Fungsi untuk mengambil semua produk
const getAllProducts = async (req, res) => {
    try {
        let where = {};
        const { categoryId, userId, search } = req.query;
        if (categoryId)
            where.categoryId = categoryId;
        if (userId)
            where.userId = userId;
        if (search)
            where.name = { [sequelize_1.Op.like]: `%${search}%` };
        const products = await index_1.Product.findAll({
            where,
            include: [
                { model: index_1.User, as: "seller", attributes: ["name"] },
                { model: index_1.Category, as: "category", attributes: ["name"] },
            ],
        });
        res.status(200).json({
            status: "success",
            results: products.length,
            data: { products },
        });
    }
    catch (error) {
        console.error("GET ALL PRODUCTS ERROR:", error);
        res
            .status(500)
            .json({
            message: "Failed to fetch products",
            error: error.message,
        });
    }
};
exports.getAllProducts = getAllProducts;
// Fungsi untuk mengambil detail satu produk berdasarkan ID
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await index_1.Product.findByPk(id);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        res.status(200).json(product);
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Failed to fetch product details",
            error: error.message,
        });
    }
};
exports.getProductById = getProductById;
// [REFACTORED] Get all products for the logged-in seller
const getSellerProducts = async (req, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const products = await index_1.Product.findAll({
            where: { userId: req.user.id },
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({ success: true, data: products });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Error loading products",
            error: error.message,
        });
    }
};
exports.getSellerProducts = getSellerProducts;
// [REFACTORED] Get product data for the edit page
const getEditProductPage = async (req, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const product = await index_1.Product.findOne({
            where: { id: req.params.id, userId: req.user.id },
        });
        if (!product) {
            res
                .status(404)
                .json({
                message: "Product not found or you don't have permission to edit it.",
            });
            return;
        }
        res.status(200).json({ success: true, data: product });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Error loading product for editing",
            error: error.message,
        });
    }
};
exports.getEditProductPage = getEditProductPage;
// [REFACTORED] Get product and categories data for admin edit page
const renderAdminEditProductPage = async (req, res) => {
    try {
        const { id } = req.query;
        // Validate that the ID from the query string is a valid string
        if (typeof id !== "string" || !id) {
            res
                .status(400)
                .json({ success: false, message: "Product ID is required." });
            return;
        }
        const product = await index_1.Product.findByPk(id, {
            include: [{ model: index_1.Category, as: "category" }],
        });
        const categories = await index_1.Category.findAll();
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        res.status(200).json({ success: true, data: { product, categories } });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Error loading product for editing",
            error: error.message,
        });
    }
};
exports.renderAdminEditProductPage = renderAdminEditProductPage;
// Update a product
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, stock, categoryId } = req.body;
        const product = await index_1.Product.findByPk(id);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        await product.update({ name, description, price, stock, categoryId });
        res.status(200).json({ message: "Product updated successfully.", product });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Failed to update product",
            error: error.message,
        });
    }
};
exports.updateProduct = updateProduct;
// Delete a product
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await index_1.Product.findByPk(id);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        await product.destroy();
        // 204 No Content is appropriate for a successful deletion with no body
        res.status(204).send();
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Failed to delete product",
            error: error.message,
        });
    }
};
exports.deleteProduct = deleteProduct;
// [REFACTORED] Get data for admin products page (categories and sellers)
const renderAdminProductsPage = async (req, res) => {
    try {
        const categories = await index_1.Category.findAll();
        const sellers = await index_1.User.findAll({
            where: { role: "penjual" },
            attributes: ["id", "name"],
        });
        res.status(200).json({ success: true, data: { categories, sellers } });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Error loading page data",
            error: error.message,
        });
    }
};
exports.renderAdminProductsPage = renderAdminProductsPage;
// [REFACTORED] Get categories for the add product page
const renderAddProductPageAdmin = async (req, res) => {
    try {
        const categories = await index_1.Category.findAll();
        res.status(200).json({ success: true, data: { categories } });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Error loading page data",
            error: error.message,
        });
    }
};
exports.renderAddProductPageAdmin = renderAddProductPageAdmin;
// Fungsi untuk mengambil detail satu produk untuk preview
const getProductDetailsForPreview = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await index_1.Product.findByPk(id, {
            include: [
                { model: index_1.User, as: "seller", attributes: ["name", "storeName"] },
                { model: index_1.Category, as: "category", attributes: ["name"] },
            ],
        });
        if (!product) {
            res
                .status(404)
                .json({ success: false, message: "Produk tidak ditemukan." });
            return;
        }
        res.status(200).json({ success: true, data: product });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail produk.",
            error: error.message,
        });
    }
};
exports.getProductDetailsForPreview = getProductDetailsForPreview;
// [REFACTORED] Render all products
const renderAllProducts = async (req, res) => {
    try {
        const products = await index_1.Product.findAll({
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({ success: true, data: products });
    }
    catch (error) {
        res
            .status(500)
            .json({
            message: "Error memuat halaman produk",
            error: error.message,
        });
    }
};
exports.renderAllProducts = renderAllProducts;
