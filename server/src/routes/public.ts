import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import path from "path";
import fs from "fs";
import multer from "multer";
import bcrypt from "bcrypt";
import { Category, Product, User } from "../models/index.js";
import { protect } from "../middleware/authMiddleware.js";
import { buildPublicOperationalStoreInclude } from "../services/sharedContracts/publicStoreIdentity.js";
import {
  clearUserNotifications,
  getUserNotifications,
  streamUserNotifications,
  getUserUnreadNotificationCount,
  readAllUserNotifications,
  removeUserNotification,
  readUserNotification,
} from "../controllers/user/userNotificationsController.js";
import { getUserMe, updateUserMe } from "../controllers/user/userMeController.js";
import {
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  getUserDefaultAddress,
  updateUserAddress,
} from "../controllers/user/userAddressController.js";

const router = Router();

const toNumber = (value: any) => (value == null ? null : Number(value));

const toSafeNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPlain = (value: any) => (value?.get ? value.get({ plain: true }) : value);

const normalizeImagePaths = (value: any) => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed)
      ? parsed.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
  } catch {
    return [trimmed];
  }
};

const toProductListItem = (product: any) => {
  const plain = getPlain(product);
  const imagePaths = normalizeImagePaths(plain?.imagePaths);
  const imageUrl = plain?.promoImagePath || imagePaths[0] || null;
  const basePrice = toSafeNumber(plain?.price, 0);
  const salePriceRaw = toNumber(plain?.salePrice);
  const hasDiscount =
    salePriceRaw !== null && Number.isFinite(salePriceRaw) && salePriceRaw > 0 && salePriceRaw < basePrice;
  const store = plain?.store
    ? {
        id: plain.store.id ?? null,
        name: plain.store.name ?? null,
        slug: plain.store.slug ?? null,
        status: plain.store.status ?? null,
      }
    : null;
  const category = plain.category
    ? {
        id: plain.category.id,
        name: plain.category.name,
        slug: plain.category.code,
      }
    : null;

  return {
    id: plain.id,
    name: plain.name,
    slug: plain.slug,
    sku: plain.sku ?? null,
    price: hasDiscount ? salePriceRaw : basePrice,
    originalPrice: hasDiscount ? basePrice : null,
    salePrice: hasDiscount ? salePriceRaw : null,
    imageUrl,
    imagePaths,
    imageUrls: imagePaths,
    categoryId: plain.categoryId ?? null,
    category,
    stock: plain.stock ?? null,
    storeId: plain.storeId ?? store?.id ?? null,
    storeSlug: store?.slug ?? null,
    store,
    status: plain.status ?? null,
    published: plain.isPublished ?? plain.published ?? false,
  };
};

const buildPublicProductWhere = (extraWhere: Record<string, any> = {}) => ({
  isPublished: { [Op.in]: [1, true] },
  status: "active",
  sellerSubmissionStatus: "none",
  storeId: { [Op.not]: null },
  ...extraWhere,
});

const listQuerySchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include letters and numbers"),
});

// POST /api/user/change-password
router.post("/user/change-password", protect, async (req: Request, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid password input",
    });
  }

  const userId = Number((req as any)?.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = parsed.data;
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      String(user.password || "")
    );

    if (!isCurrentPasswordValid) {
      return res
        .status(422)
        .json({ success: false, message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    return res.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("[user/change-password] failed", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/user/notifications?limit=20
router.get("/user/notifications", protect, getUserNotifications);
router.get("/user/notifications/stream", protect, streamUserNotifications);
router.get("/user/notifications/unread-count", protect, getUserUnreadNotificationCount);
router.delete("/user/notifications", protect, clearUserNotifications);
router.patch("/user/notifications/read-all", protect, readAllUserNotifications);

// PATCH /api/user/notifications/:id/read
router.patch("/user/notifications/:id/read", protect, readUserNotification);
router.delete("/user/notifications/:id", protect, removeUserNotification);

// Backward-compatible customer notification aliases.
router.get("/notifications", protect, getUserNotifications);
router.get("/notifications/stream", protect, streamUserNotifications);
router.get("/notifications/unread-count", protect, getUserUnreadNotificationCount);
router.delete("/notifications", protect, clearUserNotifications);
router.patch("/notifications/read-all", protect, readAllUserNotifications);
router.patch("/notifications/:id/read", protect, readUserNotification);
router.delete("/notifications/:id", protect, removeUserNotification);

// GET /api/user/me
router.get("/user/me", protect, getUserMe);

// PUT /api/user/me
router.put("/user/me", protect, updateUserMe);

// GET /api/user/addresses
router.get("/user/addresses", protect, getUserAddresses);

// GET /api/user/addresses/default
router.get("/user/addresses/default", protect, getUserDefaultAddress);

// POST /api/user/addresses
router.post("/user/addresses", protect, createUserAddress);

// PUT /api/user/addresses/:id
router.put("/user/addresses/:id", protect, updateUserAddress);

// DELETE /api/user/addresses/:id
router.delete("/user/addresses/:id", protect, deleteUserAddress);

// GET /api/categories
router.get("/categories", async (_req: Request, res: Response) => {
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
          parentId: category.parentId ?? null,
          parent_id: category.parentId ?? null,
          published: Boolean(category.published),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/products?category=&q=&page=&limit=
router.get("/products", async (req: Request, res: Response) => {
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
    const where: any = buildPublicProductWhere();
    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    if (categoryParam) {
      const categoryId = Number(categoryParam);
      if (Number.isFinite(categoryId)) {
        where.categoryId = categoryId;
      } else {
          const category = await Category.findOne({
            where: {
              published: true,
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
        include: [
          { model: Category, as: "category", attributes: ["id", "name", "code"] },
          buildPublicOperationalStoreInclude({
            attributes: ["id", "name", "slug", "status"],
          }),
        ],
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
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/products/:slug
router.get("/products/:slug", async (req: Request, res: Response) => {
  const raw = String(req.params.slug || "").trim();
  if (!raw) {
    return res.status(400).json({ success: false, message: "Invalid slug" });
  }

  try {
    const isNumericId = /^\d+$/.test(raw);
    const where = isNumericId
      ? buildPublicProductWhere({ id: Number(raw) })
      : buildPublicProductWhere({ slug: raw });
    const product = await Product.findOne({
      where,
      include: [
        { model: Category, as: "category", attributes: ["id", "name", "code"] },
        buildPublicOperationalStoreInclude({
          attributes: ["id", "name", "slug", "status"],
        }),
      ],
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
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const UPLOAD_BASE_DIR = path.resolve(process.cwd(), "uploads");
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
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

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Only .jpeg and .png files are allowed."));
      return;
    }
    cb(null, true);
  },
});

// POST /api/upload (multipart)
router.post("/upload", (req: Request, res: Response) => {
  upload.single("file")(req, res, (error: any) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Image too large (max 2MB).",
        });
      }
      return res.status(400).json({
        success: false,
        message: error?.message || "Invalid upload payload.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "File is required" });
    }

    const url = `/uploads/products/${req.file.filename}`;
    return res.status(201).json({ success: true, data: { url } });
  });
});

export default router;


