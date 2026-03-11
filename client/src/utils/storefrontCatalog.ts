import { resolveProductImageUrl } from "./productImage.js";

const toText = (value: unknown) => String(value ?? "").trim();

const toSlug = (value: unknown) =>
  toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "published", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "draft", "inactive"].includes(normalized)) return false;
  return fallback;
};

const coerceArray = (value: unknown) => (Array.isArray(value) ? value : []);

const normalizeCategoryRef = (rawCategory: any) => {
  if (!rawCategory || typeof rawCategory !== "object") return null;
  const id = rawCategory?.id ?? rawCategory?._id ?? null;
  const code = toText(rawCategory?.code || rawCategory?.slug || id);
  const name = toText(
    rawCategory?.name ||
      rawCategory?.title ||
      rawCategory?.label ||
      rawCategory?.categoryName ||
      code
  );
  if (!name) return null;
  const parentIdRaw =
    rawCategory?.parentId ?? rawCategory?.parent_id ?? rawCategory?.parent?.id ?? null;
  const parentId = toNumberOrNull(parentIdRaw) ?? parentIdRaw ?? null;
  return {
    id: id ?? code,
    name,
    slug: toText(rawCategory?.slug || rawCategory?.code || toSlug(name) || id),
    code: code || toText(rawCategory?.slug || toSlug(name)),
    image:
      toText(
        rawCategory?.image ||
          rawCategory?.imageUrl ||
          rawCategory?.iconUrl ||
          rawCategory?.icon
      ) || null,
    icon: toText(rawCategory?.iconEmoji || rawCategory?.icon) || null,
    parentId,
    parent_id: parentId,
    published: toBoolean(
      rawCategory?.published ?? rawCategory?.status ?? rawCategory?.isPublished,
      true
    ),
    status: toText(rawCategory?.status) || (toBoolean(rawCategory?.published, true) ? "active" : "draft"),
  };
};

export const normalizeStorefrontCategory = (rawCategory: any, index = 0) => {
  const normalized = normalizeCategoryRef(rawCategory);
  if (!normalized) return null;
  const id = normalized.id ?? `category-${index + 1}`;
  const slug = normalized.slug || normalized.code || `category-${index + 1}`;
  return {
    ...rawCategory,
    ...normalized,
    id,
    slug,
    code: normalized.code || slug,
  };
};

export const normalizeStorefrontCategoriesResponse = (payload: any) => {
  const root = payload?.data ?? payload;
  const rawItems = Array.isArray(root?.items)
    ? root.items
    : Array.isArray(root?.categories)
      ? root.categories
      : Array.isArray(root)
        ? root
      : Array.isArray(root?.data)
        ? root.data
        : Array.isArray(payload?.categories)
          ? payload.categories
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload)
              ? payload
              : [];
  const items = rawItems
    .map((item: any, index: number) => normalizeStorefrontCategory(item, index))
    .filter(Boolean);
  const meta = payload?.meta ?? root?.meta ?? {
    page: 1,
    limit: items.length,
    total: items.length,
    totalPages: 1,
  };
  const metaLimit = meta?.limit ?? meta?.pageSize ?? items.length;
  return {
    ...payload,
    data: {
      ...(root && typeof root === "object" && !Array.isArray(root) ? root : {}),
      items,
    },
    meta: {
      page: Number(meta?.page || 1),
      limit: Number(metaLimit || items.length),
      total: Number(meta?.total ?? items.length),
      totalPages: Number(meta?.totalPages ?? 1),
    },
  };
};

export const normalizeStorefrontProduct = (rawProduct: any) => {
  if (!rawProduct || typeof rawProduct !== "object") return null;
  const id = rawProduct?.id ?? rawProduct?._id ?? null;
  const name = toText(rawProduct?.name || rawProduct?.title || rawProduct?.productName);
  if (!name) return null;
  const slug = toText(rawProduct?.slug || id || toSlug(name));
  const category = normalizeCategoryRef(
    rawProduct?.category ?? rawProduct?.Category ?? rawProduct?.defaultCategory ?? null
  );
  const subcategory = normalizeCategoryRef(
    rawProduct?.subcategory ??
      rawProduct?.subCategory ??
      rawProduct?.secondaryCategory ??
      null
  );
  const resolvedImageUrl = resolveProductImageUrl(rawProduct);
  const imagePaths = coerceArray(
    rawProduct?.imagePaths ?? rawProduct?.images ?? rawProduct?.image_paths
  )
    .map((item) => resolveProductImageUrl({ imageUrl: item }))
    .filter(Boolean);
  const priceCandidate = toNumberOrNull(rawProduct?.price);
  const salePriceCandidate = toNumberOrNull(
    rawProduct?.salePrice ?? rawProduct?.sellingPrice ?? rawProduct?.sale_price
  );
  const originalPriceCandidate = toNumberOrNull(rawProduct?.originalPrice);
  const originalPrice =
    originalPriceCandidate ??
    (priceCandidate !== null &&
    salePriceCandidate !== null &&
    salePriceCandidate > 0 &&
    salePriceCandidate < priceCandidate
      ? priceCandidate
      : null);
  const price =
    salePriceCandidate !== null &&
    originalPrice !== null &&
    salePriceCandidate > 0 &&
    salePriceCandidate < originalPrice
      ? salePriceCandidate
      : priceCandidate ?? salePriceCandidate ?? 0;
  const discountPercentRaw =
    toNumberOrNull(rawProduct?.discountPercent ?? rawProduct?.discount) ?? null;
  const computedDiscountPercent =
    originalPrice && originalPrice > price && price >= 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;
  const discountPercent = discountPercentRaw ?? computedDiscountPercent;
  const ratingAvg = Number(
    toSafeNumber(
      rawProduct?.ratingAvg ?? rawProduct?.averageRating ?? rawProduct?.rating,
      0
    ).toFixed(1)
  );
  const reviewCount = Math.max(
    0,
    Math.round(toSafeNumber(rawProduct?.reviewCount ?? rawProduct?.reviewsCount, 0))
  );
  const published = toBoolean(
    rawProduct?.published ?? rawProduct?.isPublished ?? rawProduct?.status,
    true
  );
  const status = toText(rawProduct?.status) || (published ? "active" : "draft");

  return {
    ...rawProduct,
    id,
    slug,
    name,
    title: name,
    description: rawProduct?.description ?? null,
    price,
    originalPrice,
    salePrice:
      salePriceCandidate !== null && salePriceCandidate > 0 ? salePriceCandidate : null,
    discount: discountPercent,
    discountPercent,
    imageUrl: resolvedImageUrl || null,
    thumbnail: resolvedImageUrl || null,
    images:
      imagePaths.length > 0
        ? imagePaths
        : resolvedImageUrl
          ? [resolvedImageUrl]
          : [],
    categoryId: rawProduct?.categoryId ?? category?.id ?? null,
    category,
    subcategoryId: rawProduct?.subcategoryId ?? subcategory?.id ?? null,
    subcategory,
    stock: toNumberOrNull(rawProduct?.stock),
    published,
    status,
    rating: ratingAvg,
    ratingAvg,
    reviewCount,
    badgeLabel:
      toText(rawProduct?.badgeLabel ?? rawProduct?.label ?? rawProduct?.badge) || null,
    unit: toText(rawProduct?.unit ?? rawProduct?.tags?.unit) || null,
    updatedAt: rawProduct?.updatedAt ?? null,
    reviews: Array.isArray(rawProduct?.reviews) ? rawProduct.reviews : [],
  };
};

export const normalizeStorefrontProductsResponse = (payload: any) => {
  const root = payload?.data ?? payload;
  const rawItems = Array.isArray(root?.items)
    ? root.items
    : Array.isArray(root?.products)
      ? root.products
      : Array.isArray(root)
        ? root
      : Array.isArray(root?.data)
        ? root.data
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.products)
            ? payload.products
            : Array.isArray(payload)
              ? payload
              : [];
  const items = rawItems
    .map((item: any) => normalizeStorefrontProduct(item))
    .filter(Boolean);
  const metaSource = payload?.meta ?? root?.meta ?? {};
  const metaLimit = metaSource?.limit ?? metaSource?.pageSize ?? items.length;
  const metaTotal = metaSource?.total ?? items.length;
  return {
    ...payload,
    data: {
      ...(root && typeof root === "object" && !Array.isArray(root) ? root : {}),
      items,
    },
    meta: {
      page: Number(metaSource?.page || 1),
      limit: Number(metaLimit || items.length),
      total: Number(metaTotal),
      totalPages: Number(
        metaSource?.totalPages ??
          Math.max(
            1,
            Math.ceil(
              Number(metaTotal) / Math.max(1, Number(metaLimit || 1))
            )
          )
      ),
    },
  };
};

export const normalizeStorefrontProductDetailResponse = (payload: any) => {
  const root = payload?.data ?? payload;
  const normalized = normalizeStorefrontProduct(root);
  return {
    ...payload,
    data: {
      ...(root && typeof root === "object" && !Array.isArray(root) ? root : {}),
      ...(normalized || {}),
      description:
        normalized?.description ??
        (root && typeof root === "object" ? root.description : null) ??
        null,
      reviews: Array.isArray(root?.reviews) ? root.reviews : normalized?.reviews ?? [],
    },
  };
};
