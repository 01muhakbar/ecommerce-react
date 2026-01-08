import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { Op } from "sequelize";
import { requireAdmin } from "../middleware/requireRole";
import { Product } from "../models";
import { z } from "zod";

const router = Router();
router.use(requireAdmin);

// ===== Multer (upload images) =====
const UPLOAD_DIR = path.resolve(process.cwd(), "server/uploads/products");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb: any) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb: any) => {
    const ext = path.extname(file.originalname); // keep original ext
    const base = path.basename(file.originalname, ext).replace(/[^\w-]+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb: any) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Invalid file type"), ok);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/upload", upload.array("files", 8), (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const urls = files.map((f) => `/uploads/products/${f.filename}`);
  res.json({ urls });
});

// ===== Validation schema (server-side) =====
const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  categoryId: z.number().int().nonnegative().optional(),
  price: z.number().min(0),
  salePrice: z.number().min(0).optional(),
  quantity: z.number().int().min(0),
  slug: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

// GET /api/admin/products?page=&pageSize=&q=&sort=&order=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize || "10"), 10))
    );
    const q = String(req.query.q || "").trim();
    const sort = String(req.query.sort || "createdAt");
    const order =
      String(req.query.order || "desc").toUpperCase() === "ASC"
        ? "ASC"
        : "DESC";

    const where: any = {};
    if (q) {
      where.name = { [Op.like]: `%${q}%` };
    }

    const offset = (page - 1) * pageSize;

    const { rows, count } = await Product.findAndCountAll({
      where,
      limit: pageSize,
      offset,
      order: [[sort, order]],
  });

  res.json({
    items: rows,
    page,
    pageSize,
    total: count,
    totalPages: Math.ceil(count / pageSize),
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
      const p = await Product.findByPk(req.params.id as any);
      if (!p) return res.status(404).json({ message: "Not found" });
      res.json(p);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/admin/products/:id/images — update promoImagePath and imagePaths
router.put(
  "/:id/images",
  async (
    req: Request<{ id: string }, {}, { promoImagePath?: string | null; images?: string[] }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { promoImagePath, images } = req.body;
      const p = await Product.findByPk(id as any);
      if (!p) return res.status(404).json({ message: "Not found" });
      const patch: any = {};
      if (promoImagePath !== undefined) patch.promoImagePath = promoImagePath;
      if (images !== undefined) patch.imagePaths = Array.isArray(images) ? images : [];
      await p.update(patch);
      res.json(p);
    } catch (err) {
      next(err);
    }
  }
);

type ProductBody = {
  name?: string;
  slug?: string;
  price?: number;
  categoryId?: number;
  description?: string;
  stock?: number;
  images?: string[] | string;
  status?: "active" | "inactive" | "draft";
};

router.post(
  "/",
  async (
    req: Request<{}, {}, ProductBody>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        name,
        slug,
        price,
        categoryId,
        description,
        stock,
        images,
        status,
        promoImagePath,
      } = req.body;
      const created = await Product.create({
        name,
        slug: slug ?? (name || "").toLowerCase().replace(/\s+/g, "-"),
        price: price ?? 0,
        categoryId,
        description,
        stock: stock ?? 0,
        imagePaths: Array.isArray(images)
          ? images
          : images
          ? [images as string]
          : [],
        promoImagePath:
          promoImagePath || (Array.isArray(images) ? images[0] : images || null),
        status: status ?? "draft",
        userId: (req as any).user?.id ?? 0,
        isPublished: false,
      } as any);
      return res.status(201).json({ ok: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id",
  async (
    req: Request<{ id: string }, {}, ProductBody>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const {
        name,
        slug,
        price,
        categoryId,
        description,
        stock,
        images,
        status,
        promoImagePath,
        salePrice,
        isPublished,
      } = req.body as any;

      const product = await Product.findByPk(id as any);
      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }

      const patch: any = {
        name,
        slug,
        price,
        categoryId,
        description,
        stock,
        status,
        salePrice,
      };

      if (typeof isPublished === "boolean") {
        patch.isPublished = isPublished;
      }

      if (images !== undefined) {
        patch.imagePaths = Array.isArray(images)
          ? images
          : images
          ? [images as string]
          : [];
      }
      if (promoImagePath !== undefined) {
        patch.promoImagePath = promoImagePath;
      }

      await product.update(patch);
      return res.json({ ok: true, data: product });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const product = await Product.findByPk(id as any);
      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }
      await product.destroy();
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
