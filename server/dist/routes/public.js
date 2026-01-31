import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import path from "path";
import fs from "fs";
import multer from "multer";
import { Category, Product } from "../models/index.js";
const router = Router();
const toNumber = (value) => (value == null ? null : Number(value));
const toProductListItem = (product) => {
    const imageUrl = product.promoImagePath || product.imagePaths?.[0] || null;
    const category = product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.code,
        }
        : null;
    return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: toNumber(product.price) ?? 0,
        imageUrl,
        categoryId: product.categoryId ?? null,
        category,
        stock: product.stock ?? null,
    };
};
const listQuerySchema = z.object({
    category: z.string().optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
});
// GET /api/categories
router.get("/categories", async (_req, res) => {
    try {
        const categories = await Category.findAll({
            where: { published: true },
            order: [["createdAt", "DESC"]],
        });
        return res.json({
            success: true,
            data: {
                items: categories.map((category) => ({
                    id: category.id,
                    name: category.name,
                    slug: category.code,
                    image: category.icon ?? null,
                })),
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
// GET /api/products?category=&q=&page=&limit=
router.get("/products", async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid query" });
    }
    const page = Math.max(1, parsed.data.page ?? 1);
    const pageSize = Math.min(100, parsed.data.pageSize ?? parsed.data.limit ?? 12);
    const limit = pageSize;
    const search = (parsed.data.q ?? "").trim();
    const categoryParam = (parsed.data.category ?? "").trim();
    try {
        const where = { isPublished: true, status: "active" };
        if (search) {
            where.name = { [Op.like]: `%${search}%` };
        }
        if (categoryParam) {
            const categoryId = Number(categoryParam);
            if (Number.isFinite(categoryId)) {
                where.categoryId = categoryId;
            }
            else {
                const category = await Category.findOne({
                    where: {
                        [Op.or]: [{ code: categoryParam }, { name: categoryParam }],
                    },
                });
                if (!category) {
                    return res.json({
                        success: true,
                        data: { items: [], meta: { page, limit, total: 0 } },
                    });
                }
                where.categoryId = category.id;
            }
        }
        const offset = (page - 1) * limit;
        const { rows, count } = await Product.findAndCountAll({
            where,
            include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        return res.json({
            success: true,
            data: {
                items: rows.map(toProductListItem),
                meta: {
                    page,
                    pageSize,
                    total: count,
                    totalPages: Math.max(1, Math.ceil(count / pageSize)),
                },
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
// GET /api/products/:slug
router.get("/products/:slug", async (req, res) => {
    const raw = String(req.params.slug || "").trim();
    if (!raw) {
        return res.status(400).json({ success: false, message: "Invalid slug" });
    }
    try {
        const isNumericId = /^\d+$/.test(raw);
        const where = isNumericId
            ? { id: Number(raw), isPublished: true, status: "active" }
            : { slug: raw, isPublished: true, status: "active" };
        const product = await Product.findOne({
            where,
            include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
        });
        if (!product) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        return res.json({
            success: true,
            data: {
                ...toProductListItem(product),
                slug: product.slug,
                description: product.description ?? null,
                salePrice: toNumber(product.salePrice),
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
const UPLOAD_BASE_DIR = path.resolve(process.cwd(), "uploads");
const uploadStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const targetDir = path.join(UPLOAD_BASE_DIR, "products");
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        const safeExt = ext && ext.length <= 10 ? ext : "";
        const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
        cb(null, name);
    },
});
const upload = multer({ storage: uploadStorage });
// POST /api/upload (multipart)
router.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "File is required" });
    }
    const url = `/uploads/products/${req.file.filename}`;
    return res.status(201).json({ success: true, data: { url } });
});
export default router;
