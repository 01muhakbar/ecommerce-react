import { api } from "./axios.ts";

type SellerProductsQuery = {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: string;
  published?: "" | "true" | "false";
};

const PRODUCT_STATUSES = new Set(["active", "inactive", "draft"]);

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeProductStatus = (value: unknown) => {
  const status = normalizeText(value).toLowerCase();
  return PRODUCT_STATUSES.has(status) ? status : "draft";
};

const buildStatusMeta = (status: string) => ({
  code: status,
  label: status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Draft",
  storefrontEligible: status === "active",
  operationalMeaning:
    status === "active"
      ? "Product is operationally active and can become public when publish is on."
      : status === "inactive"
        ? "Product stays attached to the store but is blocked from public storefront queries."
        : "Product is still draft and blocked from public storefront queries.",
});

const buildVisibility = (
  published: boolean,
  status: string,
  fallback: Record<string, any> = {}
) => {
  const storefrontVisible = published && status === "active";
  const reasonCode = !published
    ? "UNPUBLISHED"
    : storefrontVisible
      ? "STOREFRONT_VISIBLE"
      : "STATUS_NOT_ACTIVE";
  const blockingSignals = Array.isArray(fallback?.blockingSignals)
    ? fallback.blockingSignals
    : [
        ...(!published ? ["PUBLISH_OFF"] : []),
        ...(status !== "active" ? ["STATUS_NOT_ACTIVE"] : []),
      ];
  const stateCode =
    fallback?.stateCode ||
    (!published ? "INTERNAL_ONLY" : storefrontVisible ? "STOREFRONT_VISIBLE" : "PUBLISHED_BLOCKED");

  return {
    ...fallback,
    isPublished: published,
    storefrontVisible,
    stateCode,
    label: published ? "Published" : "Private",
    publishLabel: published ? "Published" : "Private",
    sellerLabel:
      fallback?.sellerLabel ||
      (!published
        ? "Private to seller and admin"
        : storefrontVisible
          ? "Visible in storefront"
          : "Published but blocked"),
    storefrontLabel: storefrontVisible ? "Visible in storefront" : "Hidden from storefront",
    storefrontReason:
      fallback?.storefrontReason ||
      (!published
        ? "Public storefront queries exclude this product because the publish flag is off."
        : storefrontVisible
          ? "Public storefront queries include this product because publish is on and status is active."
          : "Publish is on, but public storefront queries still exclude this product until status becomes active."),
    sellerHint:
      fallback?.sellerHint ||
      (!published
        ? "Seller can still review this product here, but customers cannot see it yet."
        : storefrontVisible
          ? "Seller and customer views are aligned for visibility."
          : "Seller can review this product here, but customers will not see it until status becomes active."),
    blockingSignals,
    reasonCode,
  };
};

const normalizeAvailability = (availability: any, inventory: any = {}) => {
  const stock = asNumber(availability?.stock ?? inventory?.stock, 0);
  const preOrder = Boolean(availability?.preOrder ?? inventory?.preOrder);
  const preorderDaysValue = Number(
    availability?.preorderDays ?? inventory?.preorderDays ?? 0
  );
  const preorderDays =
    Number.isFinite(preorderDaysValue) && preorderDaysValue > 0 ? preorderDaysValue : null;
  const inStock = stock > 0;
  const stateCode =
    availability?.stateCode ||
    (preOrder ? "PREORDER" : inStock ? "IN_STOCK" : "OUT_OF_STOCK");

  return {
    ...availability,
    stock,
    inStock,
    preOrder,
    preorderDays,
    stateCode,
    label:
      availability?.label ||
      (preOrder
        ? `Pre-order${preorderDays ? ` (${preorderDays} day${preorderDays === 1 ? "" : "s"})` : ""}`
        : inStock
          ? "In stock"
          : "Out of stock"),
    storefrontImpact: availability?.storefrontImpact || "NO_VISIBILITY_CHANGE",
    storefrontReason:
      availability?.storefrontReason ||
      "Current storefront product queries do not hide products based on stock or pre-order flags.",
  };
};

const normalizeCategorySummary = (category: any) => {
  if (!category || typeof category !== "object") return null;

  const id = asNumber(category.id, 0);
  const name = normalizeText(category.name);
  const code = normalizeText(category.code);

  if (!id && !name && !code) return null;

  return {
    id: id || null,
    name: name || "-",
    code: code || null,
  };
};

const normalizePricing = (pricing: any) => {
  const price = asNumber(pricing?.price, 0);
  const salePriceValue = Number(pricing?.salePrice);
  const salePrice =
    Number.isFinite(salePriceValue) && salePriceValue > 0 ? salePriceValue : null;
  return {
    price,
    salePrice,
    effectivePrice: salePrice && salePrice > 0 ? salePrice : price,
  };
};

const normalizeInventory = (inventory: any) => {
  const stock = asNumber(inventory?.stock, 0);
  return {
    ...inventory,
    stock,
    inStock: stock > 0,
    preOrder: Boolean(inventory?.preOrder),
    preorderDays: inventory?.preorderDays ? asNumber(inventory.preorderDays, 0) || null : null,
  };
};

const normalizeProductListItem = (item: any) => {
  if (!item || typeof item !== "object") return null;

  const status = normalizeProductStatus(item.status ?? item.statusMeta?.code);
  const published = Boolean(item.published ?? item.visibility?.isPublished);

  return {
    ...item,
    id: asNumber(item.id, 0),
    storeId: asNumber(item.storeId, 0),
    name: normalizeText(item.name) || "Untitled product",
    slug: normalizeText(item.slug),
    sku: normalizeText(item.sku) || null,
    status,
    statusMeta: {
      ...buildStatusMeta(status),
      ...(item.statusMeta && typeof item.statusMeta === "object" ? item.statusMeta : {}),
    },
    published,
    visibility: buildVisibility(published, status, item.visibility),
    pricing: normalizePricing(item.pricing),
    availability: normalizeAvailability(item.availability, item.inventory),
    inventory: {
      ...normalizeInventory(item.inventory),
      ...normalizeAvailability(item.availability, item.inventory),
    },
    category: normalizeCategorySummary(item.category),
    ownership: item.ownership && typeof item.ownership === "object" ? item.ownership : null,
    mediaPreviewUrl: normalizeText(item.mediaPreviewUrl) || null,
  };
};

const normalizeAssignedCategories = (value: unknown) =>
  Array.isArray(value) ? value.map(normalizeCategorySummary).filter(Boolean) : [];

const normalizeProductDetail = (item: any) => {
  if (!item || typeof item !== "object") return null;

  const status = normalizeProductStatus(item.status ?? item.statusMeta?.code);
  const published = Boolean(item.published ?? item.visibility?.isPublished);
  const category = item.category && typeof item.category === "object" ? item.category : {};
  const media = item.media && typeof item.media === "object" ? item.media : {};

  return {
    ...item,
    id: asNumber(item.id, 0),
    storeId: asNumber(item.storeId, 0),
    name: normalizeText(item.name) || "Untitled product",
    slug: normalizeText(item.slug),
    sku: normalizeText(item.sku) || null,
    status,
    statusMeta: {
      ...buildStatusMeta(status),
      ...(item.statusMeta && typeof item.statusMeta === "object" ? item.statusMeta : {}),
    },
    published,
    visibility: buildVisibility(published, status, item.visibility),
    pricing: normalizePricing(item.pricing),
    availability: normalizeAvailability(item.availability, item.inventory),
    inventory: {
      ...normalizeInventory(item.inventory),
      ...normalizeAvailability(item.availability, item.inventory),
    },
    ownership: item.ownership && typeof item.ownership === "object" ? item.ownership : null,
    category: {
      primary: normalizeCategorySummary(category.primary),
      default: normalizeCategorySummary(category.default),
      assigned: normalizeAssignedCategories(category.assigned),
    },
    media: {
      ...media,
      promoImageUrl: normalizeText(media.promoImageUrl) || null,
      videoUrl: normalizeText(media.videoUrl) || null,
      imageUrls: Array.isArray(media.imageUrls)
        ? media.imageUrls
            .map((entry: unknown) => normalizeText(entry))
            .filter(Boolean)
        : [],
      totalImages: asNumber(media.totalImages, 0),
    },
  };
};

export const getSellerProducts = async (
  storeId: number | string,
  query: SellerProductsQuery = {}
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/products`, {
    params: {
      page: query.page,
      limit: query.limit,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      published: query.published || undefined,
    },
  });
  const payload = data?.data ?? null;
  if (!payload || typeof payload !== "object") return null;

  return {
    ...payload,
    contract: payload.contract && typeof payload.contract === "object" ? payload.contract : null,
    items: Array.isArray(payload.items)
      ? payload.items.map(normalizeProductListItem).filter(Boolean)
      : [],
    pagination: {
      page: asNumber(payload.pagination?.page, asNumber(query.page, 1)),
      limit: asNumber(payload.pagination?.limit, asNumber(query.limit, 20)),
      total: asNumber(payload.pagination?.total, 0),
    },
  };
};

export const getSellerProductDetail = async (
  storeId: number | string,
  productId: number | string
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/products/${productId}`);
  return normalizeProductDetail(data?.data ?? null);
};
