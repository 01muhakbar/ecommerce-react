import { Router, Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireRole";
import { Category, Product } from "../models";

const router = Router();
router.use(requireAdmin);

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

const ALLOWED_SORT = new Set(["createdAt", "updatedAt", "name", "price", "stock"]);

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  categoryId: z.coerce.number().int().nonnegative().optional(),
  imageUrl: z.string().max(255).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({
  isPublished: z.coerce.boolean().optional(),
  status: z.enum(["active", "inactive", "draft"]).optional(),
});

// GET /api/admin/products?page=&limit=&q=&category=&sort=&order=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || "10"), 10))
    );
    const q = String(req.query.q || "").trim();
    const categoryParam = String(req.query.category || "").trim();
    const sortRaw = String(req.query.sort || "createdAt");
    const sort = ALLOWED_SORT.has(sortRaw) ? sortRaw : "createdAt";
    const order =
      String(req.query.order || "desc").toUpperCase() === "ASC"
        ? "ASC"
        : "DESC";

    const where: any = {};
    if (q) {
      where.name = { [Op.like]: `%${q}%` };
    }

    if (categoryParam) {
      const categoryId = Number(categoryParam);
      if (Number.isFinite(categoryId)) {
        where.categoryId = categoryId;
      } else {
        const category = await Category.findOne({
          where: { [Op.or]: [{ code: categoryParam }, { name: categoryParam }] },
        });
        if (category) {
          where.categoryId = category.id;
        }
      }
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sort, order]],
    });

    res.json({
      success: true,
      data: {
        items: rows,
        meta: {
          page,
          limit,
          total: count,
        },
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
      const idNum = parseId(req.params.id);
      if (!idNum) return res.status(400).json({ success: false, message: "Invalid id" });
      const p = await Product.findByPk(idNum);
      if (!p) return res.status(404).json({ success: false, message: "Not found" });
      res.json({ success: true, data: p });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSchema.parse(req.body);
      const name = body.name.trim();
      const slug = body.slug?.trim() || slugify(name);
      const imageUrl = body.imageUrl || null;
      const created = await Product.create({
        name,
        slug,
        price: body.price ?? 0,
        categoryId: body.categoryId,
        stock: body.stock ?? 0,
        promoImagePath: imageUrl,
        imagePaths: imageUrl ? [imageUrl] : [],
        status: "active",
        userId: (req as any).user?.id ?? 0,
        isPublished: true,
      } as any);
      return res.status(201).json({ success: true, data: created });
    } catch (err) {
      if ((err as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "Slug already exists" });
      }
      next(err);
    }
  }
);

router.patch(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const idNum = parseId(id);
      if (!idNum) return res.status(400).json({ success: false, message: "Invalid id" });
      const body = updateSchema.parse(req.body);

      const product = await Product.findByPk(idNum);
      if (!product) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      const patch: any = {};
      if (body.name) {
        patch.name = body.name;
        if (!body.slug) {
          patch.slug = slugify(body.name);
        }
      }
      if (body.slug !== undefined) patch.slug = body.slug;
      if (body.price !== undefined) patch.price = body.price;
      if (body.stock !== undefined) patch.stock = body.stock;
      if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
      if (body.imageUrl !== undefined) {
        patch.promoImagePath = body.imageUrl;
        patch.imagePaths = body.imageUrl ? [body.imageUrl] : [];
      }
      if (body.isPublished !== undefined) patch.isPublished = body.isPublished;
      if (body.status !== undefined) patch.status = body.status;

      await product.update(patch);
      return res.json({ success: true, data: product });
    } catch (err) {
      if ((err as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "Slug already exists" });
      }
      next(err);
    }
  }
);

router.delete(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const idNum = parseId(id);
      if (!idNum) return res.status(400).json({ success: false, message: "Invalid id" });
      const product = await Product.findByPk(idNum);
      if (!product) return res.status(404).json({ success: false, message: "Not found" });
      await product.destroy();
      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
