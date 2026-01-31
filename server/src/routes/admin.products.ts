import { Router, Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Product } from "../models/Product.js";

const router = Router();
router.use(requireStaffOrAdmin);

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const parseId = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};


const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).optional(),
  categoryId: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  imageUrl: z.string().max(255).optional().nullable(),
  imageUrls: z.array(z.string().max(255)).optional(),
});

const updateSchema = createSchema.partial();

// GET /api/admin/products?page=&limit=&q=&categoryId=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || "10"), 10))
    );
    const q = String(asSingle(req.query.q) ?? "").trim();
    const categoryIdParam = String(asSingle(req.query.categoryId) ?? "").trim();

    const where: any = {};
    if (q) {
      where.name = { [Op.like]: `%${q}%` };
    }

    if (categoryIdParam) {
      const categoryId = Number(categoryIdParam);
      if (Number.isFinite(categoryId)) {
        where.categoryId = categoryId;
      }
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.json({
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/products/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idNum = parseId(String(asSingle(req.params.id) ?? ""));
      if (!idNum) return res.status(400).json({ success: false, message: "Invalid id" });
      const p = await Product.findByPk(idNum);
      if (!p) return res.status(404).json({ success: false, message: "Not found" });
      res.json({ data: p });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSchema.parse(req.body);
      const name = body.name.trim();
      const slug = slugify(name);
      const imageUrls = body.imageUrls?.length
        ? body.imageUrls
        : body.imageUrl
        ? [body.imageUrl]
        : [];
      const created = await Product.create({
        name,
        slug,
        description: body.description,
        price: body.price,
        categoryId: body.categoryId,
        stock: body.stock ?? 0,
        promoImagePath: imageUrls[0] || null,
        imagePaths: imageUrls,
        status: body.status || "active",
        userId: (req as any).user?.id ?? 0,
        isPublished: true,
      } as any);
      return res.status(201).json({ data: created });
    } catch (err) {
      if ((err as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ message: "Slug already exists" });
      }
      next(err);
    }
  }
);

router.patch(
  "/:id",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const idNum = parseId(id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });
      const body = updateSchema.parse(req.body);

      const product = await Product.findByPk(idNum);
      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }

      const patch: any = {};
      if (body.name) {
        patch.name = body.name;
      }
      if (body.name) patch.slug = slugify(body.name);
      if (body.price !== undefined) patch.price = body.price;
      if (body.stock !== undefined) patch.stock = body.stock;
      if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
      if (body.description !== undefined) patch.description = body.description;
      if (body.imageUrls !== undefined) {
        patch.imagePaths = body.imageUrls;
        patch.promoImagePath = body.imageUrls?.[0] || null;
      } else if (body.imageUrl !== undefined) {
        patch.promoImagePath = body.imageUrl;
        patch.imagePaths = body.imageUrl ? [body.imageUrl] : [];
      }
      if (body.status !== undefined) patch.status = body.status;

      await product.update(patch);
      return res.json({ data: product });
    } catch (err) {
      if ((err as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ message: "Slug already exists" });
      }
      next(err);
    }
  }
);

router.delete(
  "/:id",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const idNum = parseId(id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });
      const product = await Product.findByPk(idNum);
      if (!product) return res.status(404).json({ message: "Not found" });
      await product.destroy();
      return res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
