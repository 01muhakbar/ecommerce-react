// server/src/routes/admin.catalog.ts
import { Router } from "express";
import { Product } from "../models/index.js";
const router = Router();
/**
 * Semua endpoint di sini sengaja dibuat sederhana & self-contained,
 * tanpa mengimpor controller legacy yang menyebabkan error typing.
 */
// GET /api/admin/catalog/products
router.get("/products", async (_req, res, next) => {
    try {
        const products = await Product.findAll({
            limit: 50,
            order: [["id", "DESC"]],
        });
        res.json({ data: products, total: products.length });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/catalog/products
router.post("/products", async (req, res, next) => {
    try {
        const { name } = req.body ?? {};
        if (!name)
            return res.status(400).json({ message: "name is required" });
        const created = await Product.create({
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            price: 0,
            stock: 0,
            userId: req.user?.id ?? 0,
            isPublished: false,
        });
        res.status(201).json(created);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/catalog/products/:id
router.get("/products/:id", async (req, res, next) => {
    try {
        const p = await Product.findByPk(req.params.id);
        if (!p)
            return res.status(404).json({ message: "Not found" });
        res.json(p);
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/catalog/products/:id
router.put("/products/:id", async (req, res, next) => {
    try {
        const p = await Product.findByPk(req.params.id);
        if (!p)
            return res.status(404).json({ message: "Not found" });
        await p.update({ ...req.body });
        res.json(p);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/catalog/products/:id
router.delete("/products/:id", async (req, res, next) => {
    try {
        const p = await Product.findByPk(req.params.id);
        if (!p)
            return res.status(404).json({ message: "Not found" });
        await p.destroy();
        res.status(204).end();
    }
    catch (err) {
        next(err);
    }
});
export default router;
