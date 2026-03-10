import { Op } from "sequelize";
import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Category, Product } from "../models/index.js";

const router = Router();

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePositiveInt = (
  raw: unknown,
  fallback: number,
  min: number,
  max: number
) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const normalizeString = (value: unknown) => String(value || "").trim();

const parseBooleanFilter = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return null;
};

const allowedStatuses = new Set(["active", "inactive", "draft"]);

const resolveProductPreviewImage = (product: any) => {
  const promoImagePath = normalizeString(getAttr(product, "promoImagePath"));
  if (promoImagePath) return promoImagePath;

  const imagePaths = getAttr(product, "imagePaths");
  if (Array.isArray(imagePaths) && imagePaths.length > 0) {
    const firstImage = normalizeString(imagePaths[0]);
    return firstImage || null;
  }

  return null;
};

const normalizeJsonValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  return value;
};

const serializeCategorySummary = (category: any) => {
  if (!category) return null;
  return {
    id: toNumber(getAttr(category, "id"), 0) || null,
    name: String(getAttr(category, "name") || ""),
    code: getAttr(category, "code") ? String(getAttr(category, "code")) : null,
  };
};

const serializeProductListItem = (product: any) => {
  const category =
    product?.defaultCategory ??
    product?.category ??
    product?.get?.("defaultCategory") ??
    product?.get?.("category") ??
    null;

  const price = toNumber(getAttr(product, "price"));
  const salePriceRaw = getAttr(product, "salePrice");
  const salePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : toNumber(salePriceRaw, 0);
  const stock = toNumber(getAttr(product, "stock"));
  const isPublished = Boolean(getAttr(product, "isPublished"));
  const status = String(getAttr(product, "status") || "draft");

  return {
    id: toNumber(getAttr(product, "id")),
    storeId: toNumber(getAttr(product, "storeId")),
    name: String(getAttr(product, "name") || ""),
    slug: String(getAttr(product, "slug") || ""),
    sku: getAttr(product, "sku") ? String(getAttr(product, "sku")) : null,
    status,
    published: isPublished,
    visibility: {
      isPublished,
      storefrontVisible: isPublished && status === "active",
      label: isPublished ? "Published" : "Private",
    },
    pricing: {
      price,
      salePrice: salePrice && salePrice > 0 ? salePrice : null,
      effectivePrice: salePrice && salePrice > 0 ? salePrice : price,
    },
    inventory: {
      stock,
      inStock: stock > 0,
    },
    mediaPreviewUrl: resolveProductPreviewImage(product),
    category: serializeCategorySummary(category),
    createdAt: getAttr(product, "createdAt") || null,
    updatedAt: getAttr(product, "updatedAt") || null,
  };
};

const serializeProductDetail = (product: any) => {
  const defaultCategory =
    product?.defaultCategory ?? product?.get?.("defaultCategory") ?? null;
  const primaryCategory = product?.category ?? product?.get?.("category") ?? null;
  const categories = Array.isArray(product?.categories)
    ? product.categories
    : Array.isArray(product?.get?.("categories"))
      ? product.get("categories")
      : [];
  const imagePaths = Array.isArray(getAttr(product, "imagePaths"))
    ? getAttr(product, "imagePaths").map((entry: unknown) => normalizeString(entry)).filter(Boolean)
    : [];
  const promoImageUrl = resolveProductPreviewImage(product);
  const price = toNumber(getAttr(product, "price"));
  const salePriceRaw = getAttr(product, "salePrice");
  const salePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : toNumber(salePriceRaw, 0);
  const status = String(getAttr(product, "status") || "draft");
  const isPublished = Boolean(getAttr(product, "isPublished"));
  const stock = toNumber(getAttr(product, "stock"));
  const variations = normalizeJsonValue(getAttr(product, "variations"));
  const wholesale = normalizeJsonValue(getAttr(product, "wholesale"));
  const tags = normalizeJsonValue(getAttr(product, "tags"));

  return {
    id: toNumber(getAttr(product, "id")),
    storeId: toNumber(getAttr(product, "storeId")),
    name: String(getAttr(product, "name") || ""),
    slug: String(getAttr(product, "slug") || ""),
    sku: getAttr(product, "sku") ? String(getAttr(product, "sku")) : null,
    status,
    published: isPublished,
    visibility: {
      isPublished,
      storefrontVisible: isPublished && status === "active",
      label: isPublished ? "Published" : "Private",
    },
    descriptions: {
      description: getAttr(product, "description")
        ? String(getAttr(product, "description"))
        : null,
      notes: getAttr(product, "notes") ? String(getAttr(product, "notes")) : null,
    },
    pricing: {
      price,
      salePrice: salePrice && salePrice > 0 ? salePrice : null,
      effectivePrice: salePrice && salePrice > 0 ? salePrice : price,
    },
    inventory: {
      stock,
      inStock: stock > 0,
      preOrder: Boolean(getAttr(product, "preOrder")),
      preorderDays: toNumber(getAttr(product, "preorderDays"), 0) || null,
    },
    category: {
      primary: serializeCategorySummary(primaryCategory),
      default: serializeCategorySummary(defaultCategory),
      assigned: categories.map(serializeCategorySummary).filter(Boolean),
    },
    media: {
      promoImageUrl,
      imageUrls: imagePaths,
      videoUrl: getAttr(product, "videoPath") ? String(getAttr(product, "videoPath")) : null,
      totalImages: imagePaths.length,
    },
    attributes: {
      weight: toNumber(getAttr(product, "weight"), 0) || null,
      dimensions: {
        length: toNumber(getAttr(product, "length"), 0) || null,
        width: toNumber(getAttr(product, "width"), 0) || null,
        height: toNumber(getAttr(product, "height"), 0) || null,
      },
      condition: getAttr(product, "condition") ? String(getAttr(product, "condition")) : null,
      dangerousProduct: Boolean(getAttr(product, "dangerousProduct")),
      youtubeLink: getAttr(product, "youtubeLink")
        ? String(getAttr(product, "youtubeLink"))
        : null,
      parentSku: getAttr(product, "parentSku") ? String(getAttr(product, "parentSku")) : null,
      barcode: getAttr(product, "barcode") ? String(getAttr(product, "barcode")) : null,
      gtin: getAttr(product, "gtin") ? String(getAttr(product, "gtin")) : null,
      tags,
    },
    variations: {
      hasVariations: Array.isArray(variations)
        ? variations.length > 0
        : Boolean(variations && Object.keys(variations as Record<string, unknown>).length > 0),
      raw: variations,
    },
    wholesale: {
      hasWholesale: Array.isArray(wholesale)
        ? wholesale.length > 0
        : Boolean(wholesale && Object.keys(wholesale as Record<string, unknown>).length > 0),
      raw: wholesale,
    },
    createdAt: getAttr(product, "createdAt") || null,
    updatedAt: getAttr(product, "updatedAt") || null,
  };
};

router.get(
  "/stores/:storeId/products",
  requireSellerStoreAccess(["PRODUCT_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const page = parsePositiveInt(req.query.page, 1, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 20, 1, 50);
      const offset = (page - 1) * limit;
      const keyword = normalizeString(req.query.keyword);
      const status = normalizeString(req.query.status).toLowerCase();
      const published = parseBooleanFilter(req.query.published);

      const where: any = {
        storeId,
      };

      if (allowedStatuses.has(status)) {
        where.status = status;
      }

      if (published !== null) {
        where.isPublished = published;
      }

      if (keyword) {
        const likeKeyword = `%${keyword}%`;
        where[Op.or] = [
          { name: { [Op.like]: likeKeyword } },
          { slug: { [Op.like]: likeKeyword } },
          { sku: { [Op.like]: likeKeyword } },
        ];
      }

      const result = await Product.findAndCountAll({
        where,
        attributes: [
          "id",
          "storeId",
          "name",
          "slug",
          "sku",
          "status",
          "isPublished",
          "price",
          "salePrice",
          "stock",
          "promoImagePath",
          "imagePaths",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: Category,
            as: "defaultCategory",
            attributes: ["id", "name", "code"],
            required: false,
          },
          {
            model: Category,
            as: "category",
            attributes: ["id", "name", "code"],
            required: false,
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit,
        offset,
        distinct: true,
      });

      return res.json({
        success: true,
        data: {
          items: result.rows.map(serializeProductListItem),
          filters: {
            keyword,
            status: allowedStatuses.has(status) ? status : "",
            published,
          },
          pagination: {
            page,
            limit,
            total: result.count,
          },
        },
      });
    } catch (error) {
      console.error("[seller/products/list] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller products.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/products/:productId",
  requireSellerStoreAccess(["PRODUCT_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const productId = Number(req.params.productId);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product id.",
        });
      }

      const product = await Product.findOne({
        where: {
          id: productId,
          storeId,
        },
        attributes: [
          "id",
          "storeId",
          "name",
          "slug",
          "sku",
          "barcode",
          "gtin",
          "status",
          "isPublished",
          "price",
          "salePrice",
          "stock",
          "description",
          "notes",
          "promoImagePath",
          "imagePaths",
          "videoPath",
          "tags",
          "weight",
          "parentSku",
          "condition",
          "length",
          "width",
          "height",
          "dangerousProduct",
          "preOrder",
          "preorderDays",
          "youtubeLink",
          "variations",
          "wholesale",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: Category,
            as: "category",
            attributes: ["id", "name", "code"],
            required: false,
          },
          {
            model: Category,
            as: "defaultCategory",
            attributes: ["id", "name", "code"],
            required: false,
          },
          {
            model: Category,
            as: "categories",
            attributes: ["id", "name", "code"],
            through: { attributes: [] },
            required: false,
          },
        ],
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      return res.json({
        success: true,
        data: serializeProductDetail(product),
      });
    } catch (error) {
      console.error("[seller/products/detail] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller product detail.",
      });
    }
  }
);

export default router;
