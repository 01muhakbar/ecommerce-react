import { Op } from "sequelize";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { Category } from "../models/Category.js";
const asSingle = (v) => (Array.isArray(v) ? v[0] : v);
const toId = (v) => {
    const raw = asSingle(v);
    const id = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(id) ? id : null;
};
// Fungsi untuk membuat produk baru
export const createProduct = async (req, res) => {
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
        const slug = name
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "");
        const newProduct = await Product.create({
            name,
            slug,
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
// Fungsi untuk mengambil semua produk
export const getAllProducts = async (req, res) => {
    try {
        let where = {};
        const { categoryId, userId, search } = req.query;
        if (categoryId)
            where.categoryId = categoryId;
        if (userId)
            where.userId = userId;
        if (search)
            where.name = { [Op.like]: `%${search}%` };
        const products = await Product.findAll({
            where,
            include: [
                { model: User, as: "seller", attributes: ["name"] },
                { model: Category, as: "category", attributes: ["name"] },
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
        res.status(500).json({
            message: "Failed to fetch products",
            error: error.message,
        });
    }
};
// Fungsi untuk mengambil detail satu produk berdasarkan ID
export const getProductById = async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const product = await Product.findByPk(id);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        res.status(200).json(product);
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to fetch product details",
            error: error.message,
        });
    }
};
// [REFACTORED] Get all products for the logged-in seller
export const getSellerProducts = async (req, res) => {
    try {
        const user = req.user;
        if (!user?.id) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const products = await Product.findAll({
            where: { userId: user.id },
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({ success: true, data: products });
    }
    catch (error) {
        res.status(500).json({
            message: "Error loading products",
            error: error.message,
        });
    }
};
// [REFACTORED] Get product data for the edit page
export const getEditProductPage = async (req, res) => {
    try {
        const user = req.user;
        if (!user?.id) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const product = await Product.findOne({
            where: { id, userId: user.id },
        });
        if (!product) {
            res.status(404).json({
                message: "Product not found or you don't have permission to edit it.",
            });
            return;
        }
        res.status(200).json({ success: true, data: product });
    }
    catch (error) {
        res.status(500).json({
            message: "Error loading product for editing",
            error: error.message,
        });
    }
};
// [REFACTORED] Get product and categories data for admin edit page
export const renderAdminEditProductPage = async (req, res) => {
    try {
        const { id } = req.query;
        // Validate that the ID from the query string is a valid string
        if (typeof id !== "string" || !id) {
            res
                .status(400)
                .json({ success: false, message: "Product ID is required." });
            return;
        }
        const product = await Product.findByPk(id, {
            include: [{ model: Category, as: "category" }],
        });
        const categories = await Category.findAll();
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        res.status(200).json({ success: true, data: { product, categories } });
    }
    catch (error) {
        res.status(500).json({
            message: "Error loading product for editing",
            error: error.message,
        });
    }
};
// Update a product
export const updateProduct = async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const { name, description, price, stock, categoryId } = req.body;
        const product = await Product.findByPk(id);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        const updateData = { name, description, price, stock, categoryId };
        if (name) {
            updateData.slug = name
                .toLowerCase()
                .replace(/ /g, "-")
                .replace(/[^\w-]+/g, "");
        }
        await product.update(updateData);
        res.status(200).json({ message: "Product updated successfully.", product });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to update product",
            error: error.message,
        });
    }
};
// Delete a product
export const deleteProduct = async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const product = await Product.findByPk(id);
        if (!product) {
            res.status(404).json({ message: "Product not found." });
            return;
        }
        await product.destroy();
        // 204 No Content is appropriate for a successful deletion with no body
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to delete product",
            error: error.message,
        });
    }
};
// [REFACTORED] Get data for admin products page (categories and sellers)
export const renderAdminProductsPage = async (req, res) => {
    try {
        const categories = await Category.findAll();
        const sellers = await User.findAll({
            where: { role: "penjual" },
            attributes: ["id", "name"],
        });
        res.status(200).json({ success: true, data: { categories, sellers } });
    }
    catch (error) {
        res.status(500).json({
            message: "Error loading page data",
            error: error.message,
        });
    }
};
// [REFACTORED] Get categories for the add product page
export const renderAddProductPageAdmin = async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.status(200).json({ success: true, data: { categories } });
    }
    catch (error) {
        res.status(500).json({
            message: "Error loading page data",
            error: error.message,
        });
    }
};
// Fungsi untuk mengambil detail satu produk untuk preview
export const getProductDetailsForPreview = async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const product = await Product.findByPk(id, {
            include: [
                { model: User, as: "seller", attributes: ["name", "storeName"] },
                { model: Category, as: "category", attributes: ["name"] },
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
// [REFACTORED] Render all products
export const renderAllProducts = async (req, res) => {
    try {
        const products = await Product.findAll({
            order: [["createdAt", "DESC"]],
        });
        res.status(200).json({ success: true, data: products });
    }
    catch (error) {
        res.status(500).json({
            message: "Error memuat halaman produk",
            error: error.message,
        });
    }
};
