import { Category } from '../models/Category.js';
const asSingle = (v) => (Array.isArray(v) ? v[0] : v);
const toId = (v) => {
    const raw = asSingle(v);
    const id = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(id) ? id : null;
};
export const createCategory = async (req, res) => {
    try {
        const { description } = req.body;
        const name = String(req.body.name ?? "").trim();
        if (!name) {
            res.status(400).json({
                status: "fail",
                message: "Category name is required.",
            });
            return;
        }
        const code = name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .slice(0, 40) || `cat-${Date.now()}`;
        const newCategory = await Category.create({
            name,
            description,
            code,
            published: true,
        });
        res.status(201).json({
            status: "success",
            data: {
                category: newCategory,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            message: "Error creating category.",
            error: error.message,
        });
    }
};
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.status(200).json({
            status: "success",
            results: categories.length,
            data: {
                categories,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            message: "Error fetching categories.",
            error: error.message,
        });
    }
};
export const getCategoryById = async (req, res) => {
    try {
        const id = toId(req.params.id);
        if (id === null) {
            res.status(400).json({ message: "Invalid id" });
            return;
        }
        const category = await Category.findByPk(id);
        if (!category) {
            res.status(404).json({
                status: "fail",
                message: "Category not found.",
            });
            return;
        }
        res.status(200).json({ status: "success", data: { category } });
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            message: "Error fetching category.",
            error: error.message,
        });
    }
};
