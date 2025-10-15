import { Router } from "express";
import { requireAdmin } from "../middleware/requireRole";
import { Category } from "../models";
import { z } from "zod";

const router = Router();

// Lindungi semua rute di file ini agar hanya bisa diakses oleh admin
router.use(requireAdmin);

// GET /api/admin/categories
router.get("/", async (req, res, next) => {
  try {
    const list = await Category.findAll({
      order: [["name", "ASC"]],
    });
    // Menggunakan format respons yang konsisten
    res.json({
      status: "success",
      data: list,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories
router.post("/", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const created = await Category.create({ name });
    res.status(201).json({ status: "success", data: created });
  } catch (err) {
    next(err);
  }
});

export default router;
