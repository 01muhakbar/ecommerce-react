import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import multer from "multer";
import { col, fn, where as sequelizeWhere } from "sequelize";
import { requireAdmin } from "../middleware/requireRole.js";
import { Coupon, Store } from "../models/index.js";
import { parseCouponInteger } from "../services/coupon.service.js";
import {
  normalizeCouponAssetUrl,
  serializeAdminCouponGovernance,
} from "../services/sharedContracts/couponGovernance.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(requireAdmin);

const parseDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseNullableId = (value: any) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const createSchema = z.object({
  code: z.string().min(1),
  campaignName: z.string().trim().min(1).max(255).optional().nullable(),
  discountType: z.enum(["percent", "fixed"]).default("percent"),
  amount: z
    .union([z.string(), z.number()])
    .transform(parseCouponInteger)
    .refine((value) => value > 0, { message: "Amount must be greater than 0." }),
  minSpend: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => parseCouponInteger(value ?? 0))
    .refine((value) => value >= 0, { message: "Min spend must be >= 0." })
    .default(0),
  active: z.coerce.boolean().optional().default(true),
  bannerImageUrl: z.string().max(255).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  scopeType: z.enum(["PLATFORM", "STORE"]).optional().default("PLATFORM"),
  storeId: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value) => parseNullableId(value)),
});

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  campaignName: z.string().trim().min(1).max(255).optional().nullable(),
  discountType: z.enum(["percent", "fixed"]).optional(),
  amount: z
    .union([z.string(), z.number()])
    .transform(parseCouponInteger)
    .refine((value) => value > 0, { message: "Amount must be greater than 0." })
    .optional(),
  minSpend: z
    .union([z.string(), z.number()])
    .transform(parseCouponInteger)
    .refine((value) => value >= 0, { message: "Min spend must be >= 0." })
    .optional(),
  active: z.coerce.boolean().optional(),
  bannerImageUrl: z.string().max(255).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  scopeType: z.enum(["PLATFORM", "STORE"]).optional(),
  storeId: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value) => parseNullableId(value)),
});

const bulkActionSchema = z.object({
  action: z.enum(["activate", "deactivate", "delete"]),
  ids: z.array(z.coerce.number().int().positive()).min(1),
});

const importRowSchema = z.object({
  code: z.string().min(1),
  campaignName: z.string().trim().min(1).max(255).optional().nullable(),
  discountType: z.enum(["percent", "fixed"]).optional(),
  amount: z
    .union([z.string(), z.number()])
    .transform(parseCouponInteger)
    .optional(),
  minSpend: z
    .union([z.string(), z.number()])
    .transform((value) => parseCouponInteger(value))
    .optional(),
  active: z.coerce.boolean().optional(),
  bannerImageUrl: z.string().max(255).optional().nullable(),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  scopeType: z.enum(["PLATFORM", "STORE"]).optional(),
  storeId: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value) => parseNullableId(value)),
});

const serializeAdminCoupon = (coupon: any) => {
  const plain = coupon?.get ? coupon.get({ plain: true }) : coupon;
  return {
    id: plain?.id,
    code: String(plain?.code || "").trim().toUpperCase(),
    campaignName:
      String(plain?.campaignName ?? plain?.campaign_name ?? plain?.name ?? plain?.code ?? "").trim() ||
      null,
    discountType: plain?.discountType || "percent",
    amount: parseCouponInteger(plain?.amount || 0),
    minSpend: parseCouponInteger(plain?.minSpend || 0),
    active: Boolean(plain?.active),
    published: Boolean(plain?.active),
    bannerImageUrl: normalizeCouponAssetUrl(
      plain?.bannerImageUrl ?? plain?.banner_image_url ?? null
    ),
    startsAt: plain?.startsAt ?? null,
    expiresAt: plain?.expiresAt ?? null,
    createdAt: plain?.createdAt ?? null,
    updatedAt: plain?.updatedAt ?? null,
    governance: serializeAdminCouponGovernance(plain),
  };
};

const buildCouponListWhere = (req: any) => {
  const q = String(req.query.q || "").trim();
  const scopeType = String(req.query.scopeType || "").trim().toUpperCase();
  const where: any = {};

  if (q) {
    where[Op.or] = [
      { code: { [Op.like]: `%${q.toUpperCase()}%` } },
      sequelizeWhere(fn("LOWER", col("campaign_name")), {
        [Op.like]: `%${q.toLowerCase()}%`,
      }),
    ];
  }
  if (scopeType === "PLATFORM" || scopeType === "STORE") {
    where.scopeType = scopeType;
  }

  return { q, scopeType, where };
};

const resolveCouponScopePatch = async (
  input: { scopeType?: "PLATFORM" | "STORE"; storeId?: number | null },
  currentCoupon?: any
) => {
  const fallbackScopeType =
    currentCoupon?.scopeType || currentCoupon?.scope_type || (currentCoupon?.storeId ? "STORE" : "PLATFORM");
  const scopeType = input.scopeType ?? fallbackScopeType ?? "PLATFORM";
  const rawStoreId =
    input.storeId !== undefined
      ? input.storeId
      : currentCoupon?.storeId ?? currentCoupon?.store_id ?? null;
  const storeId = scopeType === "STORE" ? parseNullableId(rawStoreId) : null;

  if (scopeType === "STORE" && !storeId) {
    const error: any = new Error("Store-scoped coupon requires a store.");
    error.statusCode = 400;
    throw error;
  }

  if (scopeType === "STORE" && storeId) {
    const store = await Store.findByPk(storeId, {
      attributes: ["id", "name", "slug", "status"],
    });
    if (!store) {
      const error: any = new Error("Store not found for store-scoped coupon.");
      error.statusCode = 404;
      throw error;
    }
    return {
      scopeType,
      storeId,
      store,
    };
  }

  return {
    scopeType: "PLATFORM" as const,
    storeId: null,
    store: null,
  };
};

// GET /api/admin/coupons/meta
router.get("/meta", async (_req, res, next) => {
  try {
    const stores = await Store.findAll({
      attributes: ["id", "name", "slug", "status"],
      order: [["name", "ASC"]],
    });
    res.json({
      success: true,
      data: {
        stores: stores.map((store: any) => ({
          id: Number(store.id),
          name: String(store.name || "").trim() || `Store #${store.id}`,
          slug: String(store.slug || "").trim() || null,
          status: String(store.status || "").trim().toUpperCase() || null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/coupons?q=&page=&limit=
router.get("/", async (req, res, next) => {
  try {
    const { where } = buildCouponListWhere(req);
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || "10"), 10))
    );

    const offset = (page - 1) * limit;
    const { rows, count } = await Coupon.findAndCountAll({
      where,
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        items: rows.map((row) => serializeAdminCoupon(row)),
        meta: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
      },
    });
  } catch (err) {
    const error: any = err;
    // eslint-disable-next-line no-console
    console.error("[admin.coupons list] error", {
      name: error?.name,
      message: error?.message,
      code: error?.original?.code,
      errno: error?.original?.errno,
      sqlMessage: error?.original?.sqlMessage,
      sql: error?.sql,
    });
    next(err);
  }
});

// GET /api/admin/coupons/export
router.get("/export", async (req, res, next) => {
  try {
    const { q, scopeType, where } = buildCouponListWhere(req);
    const rows = await Coupon.findAll({
      where,
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const payload = {
      format: "admin-coupons.v1",
      exportedAt: new Date().toISOString(),
      total: rows.length,
      filters: {
        q: q || null,
        scopeType: scopeType || null,
      },
      items: rows.map((row) => serializeAdminCoupon(row)),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="coupons-export-${timestamp}.json"`
    );
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/coupons
router.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const code = body.code.trim().toUpperCase();
    const campaignName = String(body.campaignName || "").trim() || code;
    const startsAt = parseDateTime(body.startsAt ?? null);
    const expiresAt = parseDateTime(body.expiresAt ?? null);
    if (startsAt && expiresAt && expiresAt.getTime() < startsAt.getTime()) {
      return res.status(400).json({ success: false, message: "Expiry must be after start date." });
    }
    const scope = await resolveCouponScopePatch({
      scopeType: body.scopeType,
      storeId: body.storeId,
    });

    const created = await Coupon.create({
      code,
      campaignName,
      discountType: body.discountType,
      amount: body.amount,
      minSpend: body.minSpend ?? 0,
      active: body.active ?? true,
      bannerImageUrl: normalizeCouponAssetUrl(body.bannerImageUrl),
      startsAt,
      expiresAt,
      scopeType: scope.scopeType,
      storeId: scope.storeId,
    } as any);

    const hydrated = await Coupon.findByPk(created.id, {
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: false,
        },
      ],
    });
    res.status(201).json({ success: true, data: serializeAdminCoupon(hydrated || created) });
  } catch (err) {
    if ((err as any)?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }
    const statusCode = (err as any)?.statusCode;
    if (statusCode) {
      return res.status(statusCode).json({ success: false, message: (err as any)?.message });
    }
    next(err);
  }
});

// POST /api/admin/coupons/import
router.post("/import", upload.single("file"), async (req, res, next) => {
  try {
    const buf = req.file?.buffer;
    if (!buf) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(buf.toString("utf8"));
    } catch {
      return res.status(400).json({ success: false, message: "Invalid JSON file." });
    }

    const items = Array.isArray(parsedPayload)
      ? parsedPayload
      : Array.isArray(parsedPayload?.items)
        ? parsedPayload.items
        : null;

    if (!items) {
      return res.status(400).json({
        success: false,
        message: "Import file must be a JSON array or an object with an `items` array.",
      });
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ row: number; code: string | null; message: string }> = [];

    for (let index = 0; index < items.length; index += 1) {
      const rawRow = items[index];
      try {
        const row = importRowSchema.parse(rawRow || {});
        const code = row.code.trim().toUpperCase();
        const campaignName = String(row.campaignName || "").trim() || code;
        if (!code) {
          throw new Error("Coupon code is required.");
        }

        const existing = await Coupon.findOne({
          where: { code },
          include: [
            {
              model: Store,
              as: "store",
              attributes: ["id", "name", "slug", "status"],
              required: false,
            },
          ],
        });

        const startsAt =
          row.startsAt !== undefined
            ? parseDateTime(row.startsAt ?? null)
            : existing?.get("startsAt") ?? null;
        const expiresAt =
          row.expiresAt !== undefined
            ? parseDateTime(row.expiresAt ?? null)
            : existing?.get("expiresAt") ?? null;

        if (startsAt && expiresAt && expiresAt.getTime() < startsAt.getTime()) {
          throw new Error("Expiry must be after start date.");
        }

        const scope = await resolveCouponScopePatch(
          {
            scopeType: row.scopeType,
            storeId: row.storeId,
          },
          existing
        );

        if (existing) {
          const patch: any = {};
          if (row.campaignName !== undefined) patch.campaignName = campaignName;
          if (row.discountType !== undefined) patch.discountType = row.discountType;
          if (row.amount !== undefined) patch.amount = row.amount;
          if (row.minSpend !== undefined) patch.minSpend = row.minSpend;
          if (row.active !== undefined) patch.active = row.active;
          if (row.bannerImageUrl !== undefined) {
            patch.bannerImageUrl = normalizeCouponAssetUrl(row.bannerImageUrl);
          }
          if (row.startsAt !== undefined) patch.startsAt = startsAt;
          if (row.expiresAt !== undefined) patch.expiresAt = expiresAt;
          if (row.scopeType !== undefined || row.storeId !== undefined) {
            patch.scopeType = scope.scopeType;
            patch.storeId = scope.storeId;
          }
          await existing.update(patch);
          updated += 1;
          continue;
        }

        if (row.amount === undefined) {
          throw new Error("New coupon rows require `amount`.");
        }

        await Coupon.create({
          code,
          campaignName,
          discountType: row.discountType || "percent",
          amount: row.amount,
          minSpend: row.minSpend ?? 0,
          active: row.active ?? true,
          bannerImageUrl: normalizeCouponAssetUrl(row.bannerImageUrl),
          startsAt,
          expiresAt,
          scopeType: scope.scopeType,
          storeId: scope.storeId,
        } as any);
        created += 1;
      } catch (error: any) {
        failed += 1;
        errors.push({
          row: index + 1,
          code: String(rawRow?.code || "").trim().toUpperCase() || null,
          message: error?.message || "Import row failed.",
        });
      }
    }

    return res.json({
      success: true,
      data: {
        totalRows: items.length,
        created,
        updated,
        failed,
        errors,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/coupons/:id
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const body = updateSchema.parse(req.body);
    const coupon = await Coupon.findByPk(id, {
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: false,
        },
      ],
    });
    if (!coupon) return res.status(404).json({ success: false, message: "Not found" });

    const startsAt =
      body.startsAt !== undefined
        ? parseDateTime(body.startsAt)
        : coupon.get("startsAt");
    const expiresAt =
      body.expiresAt !== undefined
        ? parseDateTime(body.expiresAt)
        : coupon.get("expiresAt");
    if (startsAt && expiresAt && expiresAt.getTime() < startsAt.getTime()) {
      return res.status(400).json({ success: false, message: "Expiry must be after start date." });
    }

    const scope = await resolveCouponScopePatch(
      {
        scopeType: body.scopeType,
        storeId: body.storeId,
      },
      coupon
    );

    const patch: any = {};
    if (body.code !== undefined) patch.code = body.code.trim().toUpperCase();
    if (body.campaignName !== undefined) {
      patch.campaignName = String(body.campaignName || "").trim() || patch.code || coupon.get("code");
    }
    if (body.discountType !== undefined) patch.discountType = body.discountType;
    if (body.amount !== undefined) patch.amount = body.amount;
    if (body.minSpend !== undefined) patch.minSpend = body.minSpend;
    if (body.active !== undefined) patch.active = body.active;
    if (body.bannerImageUrl !== undefined) {
      patch.bannerImageUrl = normalizeCouponAssetUrl(body.bannerImageUrl);
    }
    if (body.startsAt !== undefined) patch.startsAt = startsAt;
    if (body.expiresAt !== undefined) patch.expiresAt = expiresAt;
    if (body.scopeType !== undefined || body.storeId !== undefined) {
      patch.scopeType = scope.scopeType;
      patch.storeId = scope.storeId;
    }

    await coupon.update(patch);
    const refreshed = await Coupon.findByPk(id, {
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: false,
        },
      ],
    });
    res.json({ success: true, data: serializeAdminCoupon(refreshed || coupon) });
  } catch (err) {
    if ((err as any)?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }
    const statusCode = (err as any)?.statusCode;
    if (statusCode) {
      return res.status(statusCode).json({ success: false, message: (err as any)?.message });
    }
    next(err);
  }
});

// POST /api/admin/coupons/bulk
router.post("/bulk", async (req, res, next) => {
  try {
    const { action, ids } = bulkActionSchema.parse(req.body || {});
    const uniqueIds = Array.from(new Set(ids.map((value) => Number(value))));

    let affected = 0;
    if (action === "delete") {
      affected = await Coupon.destroy({ where: { id: { [Op.in]: uniqueIds } } as any });
    } else {
      const [updatedCount] = await Coupon.update(
        { active: action === "activate" } as any,
        { where: { id: { [Op.in]: uniqueIds } } as any }
      );
      affected = Number(updatedCount || 0);
    }

    return res.json({ success: true, affected });
  } catch (err) {
    if ((err as any)?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: (err as any)?.issues?.[0]?.message || "Invalid bulk action payload.",
      });
    }
    next(err);
  }
});

// DELETE /api/admin/coupons/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.status(404).json({ success: false, message: "Not found" });
    await coupon.destroy();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
