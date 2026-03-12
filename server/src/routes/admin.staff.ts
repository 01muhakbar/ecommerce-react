import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import multer from "multer";
import { Router } from "express";
import { Op } from "sequelize";
import * as models from "../models/index.js";
import { SELLER_PERMISSION_KEYS } from "../services/seller/permissionMap.js";

const { User } = models as { User?: any };
const router = Router();

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads/staff");
fs.mkdirSync(uploadDir, { recursive: true });

const MANAGED_ROLES = ["staff", "admin", "super_admin", "seller"] as const;
const MANAGED_ROLE_SET = new Set<string>(MANAGED_ROLES);
const SAFE_SELLER_PERMISSION_KEYS = [
  SELLER_PERMISSION_KEYS.STORE_VIEW,
  SELLER_PERMISSION_KEYS.STORE_EDIT,
  SELLER_PERMISSION_KEYS.STOREFRONT_VIEW,
  SELLER_PERMISSION_KEYS.PRODUCT_VIEW,
  SELLER_PERMISSION_KEYS.PRODUCT_CREATE,
  SELLER_PERMISSION_KEYS.PRODUCT_EDIT,
  SELLER_PERMISSION_KEYS.PRODUCT_MEDIA_MANAGE,
  SELLER_PERMISSION_KEYS.INVENTORY_VIEW,
  SELLER_PERMISSION_KEYS.INVENTORY_MANAGE,
  SELLER_PERMISSION_KEYS.ORDER_VIEW,
  SELLER_PERMISSION_KEYS.ORDER_FULFILLMENT_MANAGE,
  SELLER_PERMISSION_KEYS.PAYMENT_PROFILE_VIEW,
  SELLER_PERMISSION_KEYS.PAYMENT_STATUS_VIEW,
] as const;
const SAFE_SELLER_PERMISSION_SET = new Set<string>(SAFE_SELLER_PERMISSION_KEYS);
const DEFAULT_SELLER_ROLE_CODE = "CATALOG_MANAGER";
const SELLER_ROLE_PRESETS: Record<string, readonly string[]> = {
  CATALOG_MANAGER: [
    SELLER_PERMISSION_KEYS.STORE_VIEW,
    SELLER_PERMISSION_KEYS.PRODUCT_VIEW,
    SELLER_PERMISSION_KEYS.PRODUCT_CREATE,
    SELLER_PERMISSION_KEYS.PRODUCT_EDIT,
    SELLER_PERMISSION_KEYS.PRODUCT_MEDIA_MANAGE,
    SELLER_PERMISSION_KEYS.INVENTORY_VIEW,
    SELLER_PERMISSION_KEYS.INVENTORY_MANAGE,
  ],
  ORDER_MANAGER: [
    SELLER_PERMISSION_KEYS.STORE_VIEW,
    SELLER_PERMISSION_KEYS.ORDER_VIEW,
    SELLER_PERMISSION_KEYS.ORDER_FULFILLMENT_MANAGE,
    SELLER_PERMISSION_KEYS.PAYMENT_STATUS_VIEW,
  ],
  FINANCE_VIEWER: [
    SELLER_PERMISSION_KEYS.STORE_VIEW,
    SELLER_PERMISSION_KEYS.ORDER_VIEW,
    SELLER_PERMISSION_KEYS.PAYMENT_PROFILE_VIEW,
    SELLER_PERMISSION_KEYS.PAYMENT_STATUS_VIEW,
  ],
  CONTENT_MANAGER: [
    SELLER_PERMISSION_KEYS.STORE_VIEW,
    SELLER_PERMISSION_KEYS.STORE_EDIT,
    SELLER_PERMISSION_KEYS.STOREFRONT_VIEW,
  ],
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const isAllowed = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    if (isAllowed) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPG, PNG, or WEBP images are allowed."));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

const staffImageUpload = (req: any, res: any, next: any) => {
  upload.single("image")(req, res, (error: any) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Profile image is too large. Maximum size is 2 MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: error?.message || "Invalid profile image upload payload.",
    });
  });
};

function fail(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function sendRouteError(res: any, error: any, fallbackMessage: string) {
  const status = typeof error?.status === "number" ? error.status : 500;
  if (status >= 500) {
    console.error(error);
  }
  return res.status(status).json({
    success: false,
    message: error?.message || fallbackMessage,
  });
}

function normalizeRole(input?: string | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return "staff";
  const lower = raw.toLowerCase();
  if (["super admin", "super_admin", "super-admin", "superadmin"].includes(lower)) {
    return "super_admin";
  }
  if (["admin", "administrator"].includes(lower)) return "admin";
  if (["staff", "employee"].includes(lower)) return "staff";
  if (["seller", "merchant"].includes(lower)) return "seller";
  return lower.replace(/\s+/g, "_");
}

function toOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseBooleanField(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
      }
    } catch {
      // fall through to comma-separated parsing
    }
    return [...new Set(text.split(",").map((entry) => entry.trim()).filter(Boolean))];
  }
  return [];
}

function normalizeAvatarUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/uploads/")) return text;
  if (text.startsWith("uploads/")) return `/${text}`;
  return null;
}

function resolveSellerAccess(input: {
  role: string;
  permissionKeys?: unknown;
  sellerRoleCode?: unknown;
}) {
  if (input.role !== "seller") {
    return { sellerRoleCode: null, permissionKeys: [] as string[] };
  }

  const requestedRoleCode = toOptionalText(input.sellerRoleCode) ?? DEFAULT_SELLER_ROLE_CODE;
  if (!Object.prototype.hasOwnProperty.call(SELLER_ROLE_PRESETS, requestedRoleCode)) {
    throw fail("Invalid seller role preset.");
  }

  const requestedPermissionKeys = parseStringArray(input.permissionKeys);
  if (requestedPermissionKeys.some((permissionKey) => !SAFE_SELLER_PERMISSION_SET.has(permissionKey))) {
    throw fail("Seller permissions include admin-only access.");
  }

  const permissionKeys =
    requestedPermissionKeys.length > 0
      ? requestedPermissionKeys
      : [...SELLER_ROLE_PRESETS[requestedRoleCode]];

  return {
    sellerRoleCode: requestedRoleCode,
    permissionKeys: [...new Set(permissionKeys)],
  };
}

function toStaffItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phoneNumber: row.phoneNumber ?? row.phone_number ?? null,
    avatarUrl: normalizeAvatarUrl(row.avatarUrl ?? row.avatar_url),
    role: row.role,
    sellerRoleCode: row.sellerRoleCode ?? row.seller_role_code ?? null,
    permissionKeys: parseStringArray(row.permissionKeys ?? row.permission_keys),
    isActive: String(row.status ?? "").toLowerCase() !== "inactive",
    isPublished:
      typeof row.isPublished === "boolean"
        ? row.isPublished
        : typeof row.is_published === "boolean"
          ? row.is_published
          : true,
    createdAt: row.created_at
      ? new Date(row.created_at).toISOString()
      : row.createdAt
        ? new Date(row.createdAt).toISOString()
        : null,
    updatedAt: row.updated_at
      ? new Date(row.updated_at).toISOString()
      : row.updatedAt
        ? new Date(row.updatedAt).toISOString()
        : null,
  };
}

async function ensureEmailAvailable(email: string, excludeId?: number) {
  const where: any = { email };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await (User as any).findOne({ where });
  if (existing) {
    throw fail("Email is already used by another staff account.", 409);
  }
}

function buildAvatarPath(file?: Express.Multer.File) {
  if (!file) return null;
  return `/uploads/staff/${file.filename}`;
}

function toWhereRole(role: string | null) {
  if (!role) {
    return { [Op.in]: MANAGED_ROLES };
  }
  if (!MANAGED_ROLE_SET.has(role)) {
    return { [Op.in]: [] };
  }
  return role;
}

// GET /api/admin/staff?page=1&limit=10&q=
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? req.query.pageSize ?? 10)));
    const q = String(req.query.q ?? "").trim();
    const role = req.query.role ? normalizeRole(String(req.query.role)) : null;
    const sortByRaw = String(req.query.sortBy ?? "createdAt");
    const sortBy =
      sortByRaw === "name" || sortByRaw === "email" || sortByRaw === "role"
        ? sortByRaw
        : "created_at";
    const sortDir = String(req.query.sort ?? "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const where: any = { role: toWhereRole(role) };
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { phoneNumber: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await (User as any).findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit,
      order: [[sortBy, sortDir]],
      attributes: { exclude: ["password"] },
    });

    return res.json({
      rows: rows.map(toStaffItem),
      count,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    });
  } catch (error) {
    return sendRouteError(res, error, "Failed to load staff.");
  }
});

// GET /api/admin/staff/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await (User as any).findByPk(id, { attributes: { exclude: ["password"] } });
    if (!user) return res.status(404).json({ success: false, message: "Staff record not found." });
    return res.json(toStaffItem(user));
  } catch (error) {
    return sendRouteError(res, error, "Failed to load staff detail.");
  }
});

// POST /api/admin/staff
router.post("/", staffImageUpload, async (req, res) => {
  try {
    const name = toOptionalText(req.body.name);
    const email = toOptionalText(req.body.email);
    const phoneNumber = toOptionalText(req.body.phoneNumber);
    const password = toOptionalText(req.body.password);
    const role = normalizeRole(req.body.role);
    const isActive = parseBooleanField(req.body.isActive);
    const isPublished = parseBooleanField(req.body.isPublished);

    if (!name || !email || !password) {
      throw fail("Name, email, and password are required.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw fail("Please enter a valid email address.");
    }
    if (password.length < 6) {
      throw fail("Password must be at least 6 characters.");
    }
    if (!MANAGED_ROLE_SET.has(role)) {
      throw fail("Unsupported staff role.");
    }

    await ensureEmailAvailable(email);

    const sellerAccess = resolveSellerAccess({
      role,
      permissionKeys: req.body.permissionKeys,
      sellerRoleCode: req.body.sellerRoleCode,
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await (User as any).create({
      name,
      email,
      phoneNumber,
      avatarUrl: buildAvatarPath(req.file ?? undefined),
      role,
      sellerRoleCode: sellerAccess.sellerRoleCode,
      permissionKeys: sellerAccess.permissionKeys.length
        ? JSON.stringify(sellerAccess.permissionKeys)
        : null,
      status: isActive === false ? "inactive" : "active",
      isPublished: isPublished ?? true,
      password: passwordHash,
    });

    return res.status(201).json(toStaffItem(created));
  } catch (error) {
    return sendRouteError(res, error, "Failed to create staff.");
  }
});

// PATCH /api/admin/staff/:id
router.patch("/:id", staffImageUpload, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await (User as any).findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: "Staff record not found." });

    const update: any = {};

    const name = toOptionalText(req.body.name);
    const email = toOptionalText(req.body.email);
    const phoneNumberProvided = Object.prototype.hasOwnProperty.call(req.body, "phoneNumber");
    const roleProvided = Object.prototype.hasOwnProperty.call(req.body, "role");
    const isActive = parseBooleanField(req.body.isActive);
    const isPublished = parseBooleanField(req.body.isPublished);
    const password = toOptionalText(req.body.password);

    if (name) update.name = name;
    if (email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw fail("Please enter a valid email address.");
      }
      await ensureEmailAvailable(email, id);
      update.email = email;
    }
    if (phoneNumberProvided) {
      update.phoneNumber = toOptionalText(req.body.phoneNumber);
    }
    if (password) {
      if (password.length < 6) {
        throw fail("Password must be at least 6 characters.");
      }
      update.password = await bcrypt.hash(password, 10);
    }
    if (typeof isActive === "boolean") {
      update.status = isActive ? "active" : "inactive";
    }
    if (typeof isPublished === "boolean") {
      update.isPublished = isPublished;
    }
    if (req.file) {
      update.avatarUrl = buildAvatarPath(req.file);
    }

    const normalizedRole = roleProvided ? normalizeRole(req.body.role) : String(user.role ?? "staff");
    if (!MANAGED_ROLE_SET.has(normalizedRole)) {
      throw fail("Unsupported staff role.");
    }
    if (roleProvided) {
      update.role = normalizedRole;
    }

    if (
      roleProvided ||
      Object.prototype.hasOwnProperty.call(req.body, "permissionKeys") ||
      Object.prototype.hasOwnProperty.call(req.body, "sellerRoleCode")
    ) {
      const sellerAccess = resolveSellerAccess({
        role: normalizedRole,
        permissionKeys: req.body.permissionKeys,
        sellerRoleCode: req.body.sellerRoleCode,
      });
      update.sellerRoleCode = sellerAccess.sellerRoleCode;
      update.permissionKeys = sellerAccess.permissionKeys.length
        ? JSON.stringify(sellerAccess.permissionKeys)
        : null;
    } else if (normalizedRole !== "seller") {
      update.sellerRoleCode = null;
      update.permissionKeys = null;
    }

    await user.update(update);
    return res.json(toStaffItem(user));
  } catch (error) {
    return sendRouteError(res, error, "Failed to update staff.");
  }
});

// DELETE /api/admin/staff/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await (User as any).findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: "Staff record not found." });
    await user.destroy();
    return res.json({ success: true });
  } catch (error) {
    return sendRouteError(res, error, "Failed to delete staff.");
  }
});

export default router;
