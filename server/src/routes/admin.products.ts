import { Router, Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import multer from "multer";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Product } from "../models/Product.js";
import { Category, ProductCategory, sequelize } from "../models/index.js";

const router = Router();
router.use(requireStaffOrAdmin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

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
const parseOptionalPositiveId = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const normalizeCategoryIdsInput = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(value.map((entry) => parseOptionalPositiveId(entry)).filter((entry) => entry !== null))) as number[];
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
const asOptionalString = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};
const toBooleanOrUndefined = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};
const normalizeImportedSalePrice = (salePrice: unknown, basePrice: number) => {
  if (salePrice === null) return null;
  if (typeof salePrice === "undefined" || salePrice === "") return undefined;
  const parsed = Number(salePrice);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= basePrice) {
    return null;
  }
  return parsed;
};
const buildProductsWhere = (query: Request["query"]) => {
  const q = String(asSingle(query.q) ?? "").trim();
  const categoryIdParam = String(asSingle(query.categoryId) ?? "").trim();
  const where: any = {};
  const categoryFilterId = parseOptionalPositiveId(categoryIdParam);

  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { slug: { [Op.like]: `%${q}%` } },
    ];
  }

  return { where, q, categoryIdParam, categoryFilterId };
};

const toAdminCategorySummary = (category: any) => {
  if (!category) return null;
  const plain = category?.get ? category.get({ plain: true }) : category;
  return {
    id: plain?.id ?? null,
    name: plain?.name ?? null,
    code: plain?.code ?? null,
    parentId: plain?.parentId ?? plain?.parent_id ?? plain?.parent?.id ?? null,
  };
};

const resolveProductSelectedCategories = (plain: any) => {
  const selected = Array.isArray(plain?.categories) ? plain.categories : [];
  return selected.map(toAdminCategorySummary).filter(Boolean);
};

const resolveProductDefaultCategory = (plain: any) =>
  toAdminCategorySummary(plain?.defaultCategory ?? plain?.category);

const buildAdminProductIncludes = (categoryFilterId?: number | null) => [
  {
    model: Category,
    as: "category",
    attributes: ["id", "name", "code", "parentId"],
    required: false,
  },
  {
    model: Category,
    as: "defaultCategory",
    attributes: ["id", "name", "code", "parentId"],
    required: false,
  },
  {
    model: Category,
    as: "categories",
    attributes: ["id", "name", "code", "parentId"],
    through: { attributes: [] },
    required: Boolean(categoryFilterId),
    ...(categoryFilterId ? { where: { id: categoryFilterId } } : {}),
  },
];

const createCategoryContractError = (message: string) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
};

const assertCategoryIdsExist = async (categoryIds: number[]) => {
  if (!categoryIds.length) return;
  const rows = await Category.findAll({
    where: { id: { [Op.in]: categoryIds } } as any,
    attributes: ["id"],
  });
  const existingIds = new Set(rows.map((row: any) => Number(row.id)));
  const missing = categoryIds.filter((id) => !existingIds.has(Number(id)));
  if (missing.length > 0) {
    throw createCategoryContractError(
      `Selected categories were not found: ${missing.join(", ")}`
    );
  }
};

const resolveCategorySelection = async (
  input: any,
  options: {
    mode: "create" | "update";
    existingCategoryIds?: number[];
    existingDefaultCategoryId?: number | null;
  }
) => {
  const hasCategoryIds = typeof input?.categoryIds !== "undefined";
  const hasCompatibilityCategoryId = typeof input?.categoryId !== "undefined";
  const hasDefaultCategoryId = typeof input?.defaultCategoryId !== "undefined";

  if (
    options.mode === "update" &&
    !hasCategoryIds &&
    !hasCompatibilityCategoryId &&
    !hasDefaultCategoryId
  ) {
    return null;
  }

  const normalizedCategoryIds = normalizeCategoryIdsInput(input?.categoryIds);
  const compatibilityCategoryId = parseOptionalPositiveId(input?.categoryId);
  const providedDefaultCategoryId = hasDefaultCategoryId
    ? parseOptionalPositiveId(input?.defaultCategoryId)
    : undefined;

  let categoryIds: number[];
  if (hasCategoryIds) {
    categoryIds = normalizedCategoryIds || [];
  } else if (hasCompatibilityCategoryId) {
    categoryIds = compatibilityCategoryId ? [compatibilityCategoryId] : [];
  } else {
    categoryIds = Array.isArray(options.existingCategoryIds) ? [...options.existingCategoryIds] : [];
  }

  let defaultCategoryId: number | null;
  if (hasDefaultCategoryId) {
    defaultCategoryId = providedDefaultCategoryId ?? null;
  } else if (hasCompatibilityCategoryId) {
    defaultCategoryId = compatibilityCategoryId;
  } else {
    defaultCategoryId = options.existingDefaultCategoryId ?? null;
  }

  if (defaultCategoryId !== null && categoryIds.length === 0) {
    throw createCategoryContractError(
      "defaultCategoryId requires at least one selected category in categoryIds."
    );
  }

  if (categoryIds.length > 0 && defaultCategoryId === null) {
    throw createCategoryContractError(
      "defaultCategoryId is required when categoryIds are provided."
    );
  }

  if (defaultCategoryId !== null && !categoryIds.includes(defaultCategoryId)) {
    throw createCategoryContractError("defaultCategoryId must belong to categoryIds.");
  }

  await assertCategoryIdsExist(categoryIds);

  return {
    categoryIds,
    defaultCategoryId,
    categoryId: defaultCategoryId,
  };
};

const syncProductCategoryAssignments = async (
  productId: number,
  categoryIds: number[],
  transaction?: any
) => {
  const existingRows = await ProductCategory.findAll({
    where: { productId } as any,
    attributes: ["categoryId"],
    transaction,
  });
  const existingIds = existingRows
    .map((row: any) => Number(row.categoryId))
    .filter((id) => id > 0);
  const nextIds = Array.from(
    new Set(categoryIds.map((id) => Number(id)).filter((id) => id > 0))
  );
  const idsToDelete = existingIds.filter((id) => !nextIds.includes(id));
  const idsToCreate = nextIds.filter((id) => !existingIds.includes(id));

  if (idsToDelete.length > 0) {
    await ProductCategory.destroy({
      where: { productId, categoryId: { [Op.in]: idsToDelete } } as any,
      transaction,
    });
  }

  if (idsToCreate.length > 0) {
    await ProductCategory.bulkCreate(
      idsToCreate.map((categoryId) => ({ productId, categoryId })) as any,
      { ignoreDuplicates: true, transaction }
    );
  }
};

const resolveAdminPriceFields = (plain: any) => {
  const basePrice = toNumber(plain?.price, 0);
  const salePriceRaw = plain?.salePrice;
  const normalizedSalePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : toNumber(salePriceRaw, 0);
  const hasDiscount =
    normalizedSalePrice !== null &&
    normalizedSalePrice > 0 &&
    normalizedSalePrice < basePrice;

  return {
    // Admin CRUD keeps `price` as the source-of-truth base price.
    price: basePrice,
    salePrice: hasDiscount ? normalizedSalePrice : null,
    originalPrice: hasDiscount ? basePrice : null,
    discountPercent:
      hasDiscount && basePrice > 0
        ? Math.round(((basePrice - Number(normalizedSalePrice)) / basePrice) * 100)
        : 0,
  };
};

const toAdminProductListItem = (product: any) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const rawImage = plain?.promoImagePath || plain?.imagePaths?.[0] || null;
  const imageUrl = normalizeUploadsUrl(rawImage);
  const priceFields = resolveAdminPriceFields(plain);

  const ratingAvgRaw = toNumber(plain?.ratingAvg ?? plain?.rating_avg, 0);
  const ratingAvg = Number(ratingAvgRaw.toFixed(1));
  const reviewCount = Math.max(0, Math.round(toNumber(plain?.reviewCount ?? plain?.review_count, 0)));
  const unit = String(plain?.tags?.unit || "").trim() || null;

  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
    categoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    defaultCategoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    category: resolveProductDefaultCategory(plain),
    defaultCategory: resolveProductDefaultCategory(plain),
    categoryIds: resolveProductSelectedCategories(plain).map((category: any) => Number(category.id)),
    categories: resolveProductSelectedCategories(plain),
    imageUrl,
    promoImagePath: imageUrl,
    price: priceFields.price,
    originalPrice: priceFields.originalPrice,
    salePrice: priceFields.salePrice,
    discountPercent: priceFields.discountPercent,
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
  const priceFields = resolveAdminPriceFields(plain);

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
    price: priceFields.price,
    salePrice: priceFields.salePrice,
    stock: plain?.stock ?? 0,
    status: plain?.status ?? "draft",
    published:
      typeof plain?.published !== "undefined"
        ? Boolean(plain.published)
        : Boolean(plain?.isPublished),
    categoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    defaultCategoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    category: resolveProductDefaultCategory(plain),
    defaultCategory: resolveProductDefaultCategory(plain),
    categoryIds: resolveProductSelectedCategories(plain).map((category: any) => Number(category.id)),
    categories: resolveProductSelectedCategories(plain),
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

const toAdminProductExportItem = (product: any) => {
  const detail = toAdminProductDetail(product);
  return {
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
    sku: detail.sku,
    barcode: detail.barcode,
    description: detail.description,
    price: detail.price,
    salePrice: detail.salePrice,
    stock: detail.stock,
    status: detail.status,
    published: detail.published,
    categoryId: detail.categoryId,
    defaultCategoryId: detail.defaultCategoryId,
    categoryIds: detail.categoryIds,
    categoryCode: detail.category?.code ?? null,
    categoryName: detail.category?.name ?? null,
    defaultCategoryCode: detail.defaultCategory?.code ?? null,
    defaultCategoryName: detail.defaultCategory?.name ?? null,
    categoryCodes: detail.categories.map((category: any) => category?.code).filter(Boolean),
    categoryNames: detail.categories.map((category: any) => category?.name).filter(Boolean),
    category: detail.category,
    defaultCategory: detail.defaultCategory,
    categories: detail.categories,
    imageUrl: detail.imageUrl,
    imagePaths: detail.imagePaths,
    tags: detail.tags,
  };
};

const resolveImportCategoryId = async (input: {
  categoryId?: number | null;
  categoryCode?: string | null;
  categoryName?: string | null;
}) => {
  if (input.categoryId) {
    const category = await Category.findByPk(input.categoryId);
    if (!category) {
      throw new Error(`Category id ${input.categoryId} was not found.`);
    }
    return Number((category as any).id);
  }

  if (input.categoryCode) {
    const category = await Category.findOne({ where: { code: input.categoryCode } as any });
    if (!category) {
      throw new Error(`Category code ${input.categoryCode} was not found.`);
    }
    return Number((category as any).id);
  }

  if (input.categoryName) {
    const category = await Category.findOne({ where: { name: input.categoryName } as any });
    if (!category) {
      throw new Error(`Category name ${input.categoryName} was not found.`);
    }
    return Number((category as any).id);
  }

  return undefined;
};

const normalizeImportCategoryReference = (value: any) => {
  if (value === null || typeof value === "undefined" || value === "") return null;

  if (typeof value === "number" || typeof value === "string") {
    const numericId = parseOptionalPositiveId(value);
    if (numericId) {
      return { categoryId: numericId, categoryCode: null, categoryName: null };
    }

    const textValue = asOptionalString(value);
    if (textValue) {
      return { categoryId: null, categoryCode: textValue, categoryName: null };
    }

    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return {
      categoryId: parseOptionalPositiveId(value.categoryId ?? value.id),
      categoryCode: asOptionalString(value.categoryCode ?? value.code),
      categoryName: asOptionalString(value.categoryName ?? value.name),
    };
  }

  return null;
};

const resolveImportCategorySelection = async (
  row: any,
  options: {
    mode: "create" | "update";
    existingCategoryIds?: number[];
    existingDefaultCategoryId?: number | null;
  }
) => {
  const categoryRefs = [
    ...(Array.isArray(row.categoryIds) ? row.categoryIds.map((value: any) => ({ categoryId: value })) : []),
    ...(Array.isArray(row.categories)
      ? row.categories.map((value: any) => normalizeImportCategoryReference(value)).filter(Boolean)
      : []),
    ...(Array.isArray(row.categoryCodes)
      ? row.categoryCodes
          .map((value: any) => ({ categoryCode: asOptionalString(value) }))
          .filter((value: any) => value.categoryCode)
      : []),
    ...(Array.isArray(row.categoryNames)
      ? row.categoryNames
          .map((value: any) => ({ categoryName: asOptionalString(value) }))
          .filter((value: any) => value.categoryName)
      : []),
  ];

  const legacyCategoryRef = normalizeImportCategoryReference({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode,
    categoryName: row.categoryName,
  });
  if (legacyCategoryRef) {
    categoryRefs.push(legacyCategoryRef);
  }

  const hasCategorySelectionInput =
    categoryRefs.length > 0 ||
    typeof row.defaultCategoryId !== "undefined" ||
    typeof row.defaultCategory !== "undefined" ||
    typeof row.defaultCategoryCode !== "undefined" ||
    typeof row.defaultCategoryName !== "undefined";

  if (options.mode === "update" && !hasCategorySelectionInput) {
    return null;
  }

  const resolvedCategoryIds = Array.from(
    new Set(
      (
        await Promise.all(
          categoryRefs.map((reference) =>
            resolveImportCategoryId({
              categoryId: reference?.categoryId ?? null,
              categoryCode: reference?.categoryCode ?? null,
              categoryName: reference?.categoryName ?? null,
            })
          )
        )
      ).filter(
        (value): value is number =>
          typeof value === "number" && Number.isInteger(value) && value > 0
      )
    )
  );

  const defaultCategoryReference = normalizeImportCategoryReference(
    row.defaultCategory ?? {
      categoryId: row.defaultCategoryId,
      categoryCode: row.defaultCategoryCode,
      categoryName: row.defaultCategoryName,
    }
  );

  const resolvedDefaultCategoryId = defaultCategoryReference
    ? await resolveImportCategoryId({
        categoryId: defaultCategoryReference.categoryId ?? null,
        categoryCode: defaultCategoryReference.categoryCode ?? null,
        categoryName: defaultCategoryReference.categoryName ?? null,
      })
    : resolvedCategoryIds.length === 1
      ? resolvedCategoryIds[0]
      : undefined;

  return resolveCategorySelection(
    {
      categoryIds: resolvedCategoryIds,
      defaultCategoryId:
        typeof resolvedDefaultCategoryId !== "undefined" ? resolvedDefaultCategoryId : undefined,
      categoryId:
        resolvedCategoryIds.length === 1
          ? resolvedCategoryIds[0]
          : legacyCategoryRef?.categoryId ?? undefined,
    },
    options
  );
};

const normalizeImportProductRow = (raw: any) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Each product row must be an object.");
  }

  const category =
    raw.category && typeof raw.category === "object" && !Array.isArray(raw.category)
      ? raw.category
      : null;
  const defaultCategory =
    raw.defaultCategory && typeof raw.defaultCategory === "object" && !Array.isArray(raw.defaultCategory)
      ? raw.defaultCategory
      : null;
  const name = asOptionalString(raw.name);
  const slugSource = asOptionalString(raw.slug) || name;
  const slug = slugSource ? slugify(slugSource) : "";
  if (!slug) {
    throw new Error("Each product row requires a valid `slug` or `name`.");
  }

  const price =
    raw.price === null || typeof raw.price === "undefined" || raw.price === ""
      ? undefined
      : toNumber(raw.price, Number.NaN);
  if (typeof price !== "undefined" && !Number.isFinite(price)) {
    throw new Error("`price` must be a valid number.");
  }

  const stock =
    raw.stock === null || typeof raw.stock === "undefined" || raw.stock === ""
      ? undefined
      : Math.max(0, Math.round(toNumber(raw.stock, Number.NaN)));
  if (typeof stock !== "undefined" && !Number.isFinite(stock)) {
    throw new Error("`stock` must be a valid integer.");
  }

  const status = asOptionalString(raw.status);
  if (status && !["active", "inactive", "draft"].includes(status)) {
    throw new Error("`status` must be active, inactive, or draft.");
  }

  const categoryIdRaw =
    raw.categoryId ?? category?.id ?? null;
  const categoryId =
    categoryIdRaw === null || typeof categoryIdRaw === "undefined" || categoryIdRaw === ""
      ? undefined
      : toNumber(categoryIdRaw, Number.NaN);
  if (typeof categoryId !== "undefined" && !Number.isFinite(categoryId)) {
    throw new Error("`categoryId` must be a valid number.");
  }

  const imagePaths = Array.isArray(raw.imagePaths)
    ? raw.imagePaths.map((value: unknown) => asOptionalString(value)).filter(Boolean)
    : [];
  const imageUrl = asOptionalString(raw.imageUrl);

  const tagsRaw = raw.tags ?? [];
  const tags =
    typeof raw.tags === "undefined"
      ? undefined
      : Array.isArray(tagsRaw)
      ? tagsRaw.map((tag) => String(tag || "").trim()).filter(Boolean)
      : typeof tagsRaw === "string"
      ? tagsRaw
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
  const salePrice =
    raw.salePrice === undefined
      ? undefined
      : raw.salePrice === null || raw.salePrice === ""
      ? null
      : toNumber(raw.salePrice, Number.NaN);
  if (typeof salePrice !== "undefined" && salePrice !== null && !Number.isFinite(salePrice)) {
    throw new Error("`salePrice` must be a valid number.");
  }

  return {
    name,
    slug,
    sku: asOptionalString(raw.sku),
    barcode: asOptionalString(raw.barcode),
    description:
      typeof raw.description === "undefined" ? undefined : asOptionalString(raw.description) ?? "",
    price,
    salePrice,
    stock,
    status: status ?? undefined,
    published: toBooleanOrUndefined(raw.published),
    categoryId:
      typeof categoryId !== "undefined" ? Math.max(1, Math.round(categoryId)) : undefined,
    categoryIds: normalizeCategoryIdsInput(raw.categoryIds),
    categoryCode: asOptionalString(raw.categoryCode ?? category?.code),
    categoryName: asOptionalString(raw.categoryName ?? category?.name),
    categoryCodes: Array.isArray(raw.categoryCodes) ? raw.categoryCodes : undefined,
    categoryNames: Array.isArray(raw.categoryNames) ? raw.categoryNames : undefined,
    categories: Array.isArray(raw.categories) ? raw.categories : undefined,
    defaultCategoryId: parseOptionalPositiveId(raw.defaultCategoryId ?? defaultCategory?.id),
    defaultCategoryCode: asOptionalString(raw.defaultCategoryCode ?? defaultCategory?.code),
    defaultCategoryName: asOptionalString(raw.defaultCategoryName ?? defaultCategory?.name),
    defaultCategory,
    imageUrls: imagePaths.length ? imagePaths : imageUrl ? [imageUrl] : undefined,
    tags,
  };
};


const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0).nullable().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  categoryId: z.coerce.number().int().nonnegative().optional(),
  categoryIds: z.array(z.coerce.number().int().positive()).optional(),
  defaultCategoryId: z.preprocess(
    (value) => (value === "" ? null : value),
    z.union([z.coerce.number().int().positive(), z.null()])
  ).optional(),
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
    const { where, categoryFilterId } = buildProductsWhere(req.query);

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
        "defaultCategoryId",
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
      include: buildAdminProductIncludes(categoryFilterId),
      distinct: true,
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

router.get("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { where, q, categoryIdParam, categoryFilterId } = buildProductsWhere(req.query);
    const rows = await Product.findAll({
      where,
      attributes: [
        "id",
        "name",
        "slug",
        "sku",
        "barcode",
        "description",
        "price",
        "salePrice",
        "stock",
        "status",
        "published",
        "categoryId",
        "defaultCategoryId",
        "promoImagePath",
        "imagePaths",
        "tags",
        "createdAt",
        "updatedAt",
      ],
      include: buildAdminProductIncludes(categoryFilterId),
      order: [["createdAt", "DESC"]],
    });

    const payload = {
      format: "admin-products.v1",
      exportedAt: new Date().toISOString(),
      total: rows.length,
      filters: {
        q: q || null,
        categoryId: categoryIdParam || null,
      },
      items: rows.map(toAdminProductExportItem),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="products-export-${timestamp}.json"`
    );
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/import",
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
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
      const errors: Array<{ row: number; slug: string | null; message: string }> = [];

      for (let index = 0; index < items.length; index += 1) {
        const rawRow = items[index];

        try {
          const row = normalizeImportProductRow(rawRow);
          const existing = await Product.findOne({
            where: { slug: row.slug } as any,
            include: buildAdminProductIncludes(null),
          });
          const basePrice =
            typeof row.price !== "undefined"
              ? row.price
              : Number(existing?.get?.("price") ?? 0);
          const normalizedSalePrice = normalizeImportedSalePrice(row.salePrice, basePrice);
          const existingCategoryIds = existing
            ? resolveProductSelectedCategories(existing).map((category: any) => Number(category.id))
            : [];
          const categorySelection = await resolveImportCategorySelection(row, {
            mode: existing ? "update" : "create",
            existingCategoryIds,
            existingDefaultCategoryId: existing
              ? parseOptionalPositiveId((existing as any).get?.("defaultCategoryId")) ??
                parseOptionalPositiveId((existing as any).get?.("categoryId"))
              : null,
          });

          if (existing) {
            const patch: any = {};
            if (row.name) patch.name = row.name;
            patch.slug = row.slug;
            if (typeof row.price !== "undefined") patch.price = row.price;
            if (typeof row.salePrice !== "undefined") patch.salePrice = normalizedSalePrice ?? null;
            if (typeof row.stock !== "undefined") patch.stock = row.stock;
            if (typeof row.status !== "undefined") patch.status = row.status;
            if (typeof row.published !== "undefined") patch.isPublished = row.published;
            if (categorySelection) {
              patch.categoryId = categorySelection.categoryId;
              patch.defaultCategoryId = categorySelection.defaultCategoryId;
            }
            if (typeof row.description !== "undefined") patch.description = row.description;
            if (typeof row.sku !== "undefined") patch.sku = row.sku || null;
            if (typeof row.barcode !== "undefined") patch.barcode = row.barcode || null;
            if (typeof row.imageUrls !== "undefined") {
              patch.imagePaths = row.imageUrls;
              patch.promoImagePath = row.imageUrls?.[0] || null;
            }
            if (typeof row.tags !== "undefined") patch.tags = row.tags;

            await sequelize.transaction(async (transaction) => {
              await existing.update(patch, { transaction });
              if (categorySelection) {
                await syncProductCategoryAssignments(
                  Number((existing as any).id),
                  categorySelection.categoryIds,
                  transaction
                );
              }
            });
            updated += 1;
            continue;
          }

          if (!row.name) {
            throw new Error("New products require `name`.");
          }
          if (typeof row.price === "undefined") {
            throw new Error("New products require `price`.");
          }

          await sequelize.transaction(async (transaction) => {
            const createdProduct = await Product.create({
              name: row.name,
              slug: row.slug,
              description: row.description,
              price: row.price,
              salePrice: normalizedSalePrice ?? null,
              stock: row.stock ?? 0,
              categoryId: categorySelection?.categoryId ?? row.categoryId,
              defaultCategoryId: categorySelection?.defaultCategoryId ?? null,
              status: row.status || "active",
              userId: (req as any).user?.id ?? 0,
              isPublished: row.published ?? true,
              sku: row.sku ?? null,
              barcode: row.barcode ?? null,
              tags: row.tags ?? [],
              promoImagePath: row.imageUrls?.[0] || null,
              imagePaths: row.imageUrls ?? [],
            } as any, { transaction });

            if (categorySelection) {
              await syncProductCategoryAssignments(
                Number((createdProduct as any).id),
                categorySelection.categoryIds,
                transaction
              );
            }
          });
          created += 1;
        } catch (error: any) {
          failed += 1;
          errors.push({
            row: index + 1,
            slug: asOptionalString(rawRow?.slug ?? rawRow?.name),
            message: error?.message || "Import row failed.",
          });
        }
      }

      return res.json({
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
  }
);

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
        include: buildAdminProductIncludes(null),
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
      const categorySelection = await resolveCategorySelection(body, { mode: "create" });
      const name = body.name.trim();
      const slug = body.slug ? slugify(body.slug) : slugify(name);
      const imageUrls = body.imageUrls?.length
        ? body.imageUrls
        : body.imageUrl
        ? [body.imageUrl]
        : [];
      const created = await sequelize.transaction(async (transaction) => {
        const nextProduct = await Product.create(
          {
            name,
            slug,
            description: body.description,
            price: body.price,
            salePrice: body.salePrice ?? null,
            categoryId: categorySelection?.categoryId ?? body.categoryId,
            defaultCategoryId: categorySelection?.defaultCategoryId ?? null,
            stock: body.stock ?? 0,
            sku: body.sku ?? null,
            barcode: body.barcode ?? null,
            tags: body.tags ?? [],
            promoImagePath: imageUrls[0] || null,
            imagePaths: imageUrls,
            status: body.status || "active",
            userId: (req as any).user?.id ?? 0,
            isPublished: body.published ?? true,
          } as any,
          { transaction }
        );

        if (categorySelection) {
          await syncProductCategoryAssignments(
            Number((nextProduct as any).id),
            categorySelection.categoryIds,
            transaction
          );
        }

        return Product.findByPk(Number((nextProduct as any).id), {
          include: buildAdminProductIncludes(null),
          transaction,
        });
      });
      return res.status(201).json({ data: created });
    } catch (err) {
      if ((err as any)?.status === 400) {
        return res.status(400).json({ message: (err as any).message });
      }
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

      const product = await Product.findByPk(idNum, {
        include: buildAdminProductIncludes(null),
      });
      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }
      const existingCategoryIds = resolveProductSelectedCategories(product).map((category: any) =>
        Number(category.id)
      );
      const categorySelection = await resolveCategorySelection(body, {
        mode: "update",
        existingCategoryIds,
        existingDefaultCategoryId:
          parseOptionalPositiveId((product as any).get?.("defaultCategoryId")) ??
          parseOptionalPositiveId((product as any).get?.("categoryId")),
      });

      const patch: any = {};
      if (body.name) {
        patch.name = body.name;
      }
      if (body.name) patch.slug = slugify(body.name);
      if (body.price !== undefined) patch.price = body.price;
      if (body.salePrice !== undefined) patch.salePrice = body.salePrice;
      if (body.stock !== undefined) patch.stock = body.stock;
      if (categorySelection) {
        patch.categoryId = categorySelection.categoryId;
        patch.defaultCategoryId = categorySelection.defaultCategoryId;
      }
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

      const updated = await sequelize.transaction(async (transaction) => {
        await product.update(patch, { transaction });
        if (categorySelection) {
          await syncProductCategoryAssignments(
            idNum,
            categorySelection.categoryIds,
            transaction
          );
        }
        return Product.findByPk(idNum, {
          include: buildAdminProductIncludes(null),
          transaction,
        });
      });
      return res.json({ data: updated });
    } catch (err) {
      if ((err as any)?.status === 400) {
        return res.status(400).json({ message: (err as any).message });
      }
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
