import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Category } from "../models/index.js";

const router = Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const toText = (value: unknown) => String(value ?? "").trim();

const parsePublishedFilter = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return undefined;
};

const buildCategoryCode = (name: string, suffix = "") => {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 24);
  const base = slug || "category";
  const nextSuffix = suffix
    ? suffix.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6)
    : Math.random().toString(36).slice(2, 6);
  return `${base}-${nextSuffix}`.slice(0, 32);
};

const resolveUniqueCategoryCode = async (name: string) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildCategoryCode(name, attempt === 0 ? "" : String(attempt));
    const existing = await Category.findOne({ where: { code } });
    if (!existing) return code;
  }
  return buildCategoryCode(name, String(Date.now()).slice(-4));
};

const createHttpError = (statusCode: number, message: string, code?: string) =>
  Object.assign(new Error(message), { statusCode, code });

const ensureParentExists = async (parentId: number | null) => {
  if (!parentId) return null;
  const parent = await Category.findByPk(parentId);
  if (!parent) {
    throw createHttpError(400, "Parent category was not found.", "SELLER_CATEGORY_PARENT_INVALID");
  }
  return parent;
};

const wouldCauseCycle = async (id: number, parentId: number | null) => {
  if (!parentId) return false;
  if (parentId === id) return true;
  let current = await Category.findByPk(parentId);
  while (current && (current as any).parentId) {
    if (Number((current as any).parentId) === id) return true;
    current = await Category.findByPk(Number((current as any).parentId));
  }
  return false;
};

const serializeCategory = (category: any) => {
  const parent = category?.parent ?? category?.get?.("parent") ?? null;
  const image = toText(category?.icon || category?.image || "");
  return {
    id: Number(category?.id || 0),
    code: toText(category?.code) || null,
    name: toText(category?.name) || "-",
    description: toText(category?.description) || null,
    image: image || null,
    icon: image || null,
    parentId: Number(category?.parentId ?? category?.parent_id ?? 0) || null,
    parent:
      parent && Number(parent?.id || 0) > 0
        ? {
            id: Number(parent.id),
            name: toText(parent.name) || "-",
            code: toText(parent.code) || null,
          }
        : null,
    isPublished: Boolean(category?.published ?? category?.isPublished),
    published: Boolean(category?.published ?? category?.isPublished),
    createdAt: category?.createdAt ?? null,
    updatedAt: category?.updatedAt ?? null,
  };
};

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(255).optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  image: z.string().trim().max(255).optional().nullable(),
  icon: z.string().trim().max(255).optional().nullable(),
  isPublished: z.boolean().optional(),
  published: z.boolean().optional(),
});

router.get(
  "/stores/:storeId/categories",
  requireSellerStoreAccess(["CATEGORY_VIEW"]),
  async (req, res, next) => {
    try {
      const q = toText(req.query.q);
      const published = parsePublishedFilter(req.query.published);
      const page = Math.max(1, Number(req.query.page || 1) || 1);
      const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT));
      const offset = (page - 1) * limit;

      const where: Record<string, any> = {};
      if (q) where.name = { [Op.like]: `%${q}%` };
      if (typeof published === "boolean") where.published = published;

      const { rows, count } = await Category.findAndCountAll({
        where,
        include: [{ model: Category, as: "parent", attributes: ["id", "name", "code"] }],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      return res.json({
        success: true,
        data: {
          items: rows.map(serializeCategory),
          meta: {
            page,
            limit,
            total: count,
            totalPages: Math.max(1, Math.ceil(count / limit)),
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/stores/:storeId/categories",
  requireSellerStoreAccess(["CATEGORY_MANAGE"]),
  async (req, res, next) => {
    try {
      const body = categoryCreateSchema.parse(req.body);
      const parentId = body.parentId ?? null;
      await ensureParentExists(parentId);
      const code = await resolveUniqueCategoryCode(body.name);
      const created = await Category.create({
        code,
        name: body.name,
        description: toText(body.description) || null,
        icon: toText(body.image || body.icon) || null,
        parentId,
        published: body.isPublished ?? body.published ?? true,
      } as any);

      const detail = await Category.findByPk((created as any).id, {
        include: [{ model: Category, as: "parent", attributes: ["id", "name", "code"] }],
      });

      return res.status(201).json({
        success: true,
        data: serializeCategory(detail || created),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  "/stores/:storeId/categories/:categoryId",
  requireSellerStoreAccess(["CATEGORY_MANAGE"]),
  async (req, res, next) => {
    try {
      const categoryId = Number(req.params.categoryId || 0);
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          code: "SELLER_CATEGORY_NOT_FOUND",
          message: "Category was not found.",
        });
      }

      const body = categoryCreateSchema.partial().parse(req.body);
      const patch: Record<string, any> = {};

      if (typeof body.name === "string" && toText(body.name)) {
        patch.name = toText(body.name);
      }
      if (Object.prototype.hasOwnProperty.call(body, "description") && toText(body.description)) {
        patch.description = toText(body.description);
      }
      if (Object.prototype.hasOwnProperty.call(body, "image") && toText(body.image)) {
        patch.icon = toText(body.image);
      } else if (Object.prototype.hasOwnProperty.call(body, "icon") && toText(body.icon)) {
        patch.icon = toText(body.icon);
      }
      if (Object.prototype.hasOwnProperty.call(body, "isPublished")) {
        patch.published = Boolean(body.isPublished);
      } else if (Object.prototype.hasOwnProperty.call(body, "published")) {
        patch.published = Boolean(body.published);
      }
      if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
        const nextParentId = body.parentId ?? null;
        await ensureParentExists(nextParentId);
        if (await wouldCauseCycle(categoryId, nextParentId)) {
          throw createHttpError(400, "Invalid parent category selection.", "SELLER_CATEGORY_PARENT_CYCLE");
        }
        patch.parentId = nextParentId;
      }

      await (category as any).update(patch);

      const detail = await Category.findByPk(categoryId, {
        include: [{ model: Category, as: "parent", attributes: ["id", "name", "code"] }],
      });

      return res.json({
        success: true,
        data: serializeCategory(detail || category),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/stores/:storeId/categories/:categoryId/publish",
  requireSellerStoreAccess(["CATEGORY_MANAGE"]),
  async (req, res, next) => {
    try {
      const categoryId = Number(req.params.categoryId || 0);
      const parsed = z
        .object({
          isPublished: z.boolean().optional(),
          published: z.boolean().optional(),
        })
        .parse(req.body);

      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          code: "SELLER_CATEGORY_NOT_FOUND",
          message: "Category was not found.",
        });
      }

      const published =
        typeof parsed.isPublished === "boolean"
          ? parsed.isPublished
          : Boolean(parsed.published);
      await (category as any).update({ published });

      const detail = await Category.findByPk(categoryId, {
        include: [{ model: Category, as: "parent", attributes: ["id", "name", "code"] }],
      });

      return res.json({
        success: true,
        data: serializeCategory(detail || category),
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
