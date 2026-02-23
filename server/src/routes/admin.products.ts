import { Router, Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Product } from "../models/Product.js";
import { Category, sequelize } from "../models/index.js";

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
const normalizeUploadsUrl = (v?: string | null) => {
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/uploads/")) return v;
  if (v.startsWith("/")) return v;
  return `/uploads/${v}`;
};
const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toAdminProductListItem = (product: any) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const rawImage = plain?.promoImagePath || plain?.imagePaths?.[0] || null;
  const imageUrl = normalizeUploadsUrl(rawImage);

  const basePrice = toNumber(plain?.price, 0);
  const salePrice = toNumber(plain?.salePrice, 0);
  const hasDiscount = salePrice > 0 && salePrice < basePrice;
  const price = hasDiscount ? salePrice : basePrice;
  const originalPrice = hasDiscount ? basePrice : null;
  const discountPercent =
    hasDiscount && basePrice > 0 ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0;

  const ratingAvgRaw = toNumber(plain?.ratingAvg ?? plain?.rating_avg, 0);
  const ratingAvg = Number(ratingAvgRaw.toFixed(1));
  const reviewCount = Math.max(0, Math.round(toNumber(plain?.reviewCount ?? plain?.review_count, 0)));
  const unit = String(plain?.tags?.unit || "").trim() || null;

  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
    categoryId: plain?.categoryId ?? null,
    category: plain?.category
      ? {
          id: plain.category.id,
          name: plain.category.name,
          code: plain.category.code ?? null,
        }
      : null,
    imageUrl,
    promoImagePath: imageUrl,
    price,
    originalPrice,
    salePrice: hasDiscount ? salePrice : null,
    discountPercent,
    ratingAvg,
    reviewCount,
    unit,
    stock: plain?.stock ?? 0,
    status: plain?.status ?? "draft",
    published:
      typeof plain?.published !== "undefined"
        ? Boolean(plain.published)
        : Boolean(plain?.isPublished),
    createdAt: plain?.createdAt ?? null,
    updatedAt: plain?.updatedAt ?? null,
  };
};

const toAdminProductDetail = (product: any) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const rawImage = plain?.promoImagePath || plain?.imagePaths?.[0] || null;
  const imageUrl = normalizeUploadsUrl(rawImage);

  const tagsRaw = plain?.tags;
  let tags: string[] = [];
  if (Array.isArray(tagsRaw)) {
    tags = tagsRaw.map((tag) => String(tag)).filter(Boolean);
  } else if (tagsRaw && typeof tagsRaw === "object") {
    tags = Object.values(tagsRaw)
      .map((tag) => String(tag || "").trim())
      .filter(Boolean);
  } else if (typeof tagsRaw === "string") {
    tags = tagsRaw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
    sku: plain?.sku ?? null,
    barcode: plain?.barcode ?? null,
    description: plain?.description ?? "",
    price: toNumber(plain?.price, 0),
    salePrice:
      plain?.salePrice === null || typeof plain?.salePrice === "undefined"
        ? null
        : toNumber(plain?.salePrice, 0),
    stock: plain?.stock ?? 0,
    status: plain?.status ?? "draft",
    published:
      typeof plain?.published !== "undefined"
        ? Boolean(plain.published)
        : Boolean(plain?.isPublished),
    categoryId: plain?.categoryId ?? null,
    category: plain?.category
      ? {
          id: plain.category.id,
          name: plain.category.name,
          code: plain.category.code ?? null,
        }
      : null,
    imageUrl,
    promoImagePath: imageUrl,
    imagePaths: Array.isArray(plain?.imagePaths)
      ? plain.imagePaths.map((value: string) => normalizeUploadsUrl(value)).filter(Boolean)
      : imageUrl
      ? [imageUrl]
      : [],
    tags,
    createdAt: plain?.createdAt ?? null,
    updatedAt: plain?.updatedAt ?? null,
  };
};


const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0).nullable().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  categoryId: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  published: z.boolean().optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  slug: z.string().min(1).max(255).optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().max(255).optional().nullable(),
  imageUrls: z.array(z.string().max(255)).optional(),
});

const updateSchema = createSchema.partial();
const updatePublishedSchema = z.object({
  published: z.boolean(),
});
const bulkActionSchema = z.object({
  action: z.enum(["delete", "publish", "unpublish"]),
  ids: z.array(z.coerce.number().int().positive()).min(1),
});

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
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { slug: { [Op.like]: `%${q}%` } },
      ];
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
      attributes: [
        "id",
        "name",
        "slug",
        "price",
        "salePrice",
        "stock",
        "status",
        "published",
        "categoryId",
        "promoImagePath",
        "imagePaths",
        "tags",
        "createdAt",
        "updatedAt",
        [
          sequelize.literal(
            "(SELECT ROUND(AVG(pr.rating), 1) FROM product_reviews pr WHERE pr.product_id = Product.id)"
          ),
          "ratingAvg",
        ],
        [
          sequelize.literal(
            "(SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = Product.id)"
          ),
          "reviewCount",
        ],
      ],
      include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.json({
      data: rows.map(toAdminProductListItem),
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

router.post(
  "/bulk",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action, ids } = bulkActionSchema.parse(req.body);
      const uniqueIds = Array.from(new Set(ids.map((value) => Number(value))));

      if (uniqueIds.length === 0) {
        return res.status(400).json({ success: false, message: "ids must not be empty" });
      }

      let affected = 0;

      if (action === "delete") {
        affected = await Product.destroy({ where: { id: { [Op.in]: uniqueIds } } as any });
      } else {
        const nextPublished = action === "publish";
        const [updatedCount] = await Product.update(
          { isPublished: nextPublished } as any,
          { where: { id: { [Op.in]: uniqueIds } } as any }
        );
        affected = Number(updatedCount || 0);
      }

      return res.json({ success: true, affected });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/products/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idNum = parseId(String(asSingle(req.params.id) ?? ""));
      if (!idNum) return res.status(400).json({ success: false, message: "Invalid id" });
      const p = await Product.findByPk(idNum, {
        include: [{ model: Category, as: "category", attributes: ["id", "name", "code"] }],
      });
      if (!p) return res.status(404).json({ success: false, message: "Not found" });
      res.json({ data: toAdminProductDetail(p) });
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
      const slug = body.slug ? slugify(body.slug) : slugify(name);
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
        salePrice: body.salePrice ?? null,
        categoryId: body.categoryId,
        stock: body.stock ?? 0,
        sku: body.sku ?? null,
        barcode: body.barcode ?? null,
        tags: body.tags ?? [],
        promoImagePath: imageUrls[0] || null,
        imagePaths: imageUrls,
        status: body.status || "active",
        userId: (req as any).user?.id ?? 0,
        isPublished: body.published ?? true,
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
      if (body.salePrice !== undefined) patch.salePrice = body.salePrice;
      if (body.stock !== undefined) patch.stock = body.stock;
      if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
      if (body.description !== undefined) patch.description = body.description;
      if (body.sku !== undefined) patch.sku = body.sku || null;
      if (body.barcode !== undefined) patch.barcode = body.barcode || null;
      if (body.tags !== undefined) patch.tags = body.tags;
      if (body.imageUrls !== undefined) {
        patch.imagePaths = body.imageUrls;
        patch.promoImagePath = body.imageUrls?.[0] || null;
      } else if (body.imageUrl !== undefined) {
        patch.promoImagePath = body.imageUrl;
        patch.imagePaths = body.imageUrl ? [body.imageUrl] : [];
      }
      if (body.status !== undefined) patch.status = body.status;
      if (body.published !== undefined) patch.isPublished = body.published;
      if (body.slug !== undefined) {
        const normalizedSlug = String(body.slug || "").trim();
        if (normalizedSlug) patch.slug = slugify(normalizedSlug);
      }

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

router.patch(
  "/:id/published",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const idNum = parseId(req.params.id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });

      const { published } = updatePublishedSchema.parse(req.body);
      const product = await Product.findByPk(idNum);
      if (!product) return res.status(404).json({ message: "Not found" });

      await product.update({ isPublished: published } as any);
      return res.json({
        data: {
          id: idNum,
          published: Boolean(
            product.get?.("published") ?? product.get?.("isPublished") ?? published
          ),
        },
      });
    } catch (err) {
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
