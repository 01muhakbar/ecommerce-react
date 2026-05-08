const toText = (value) => String(value ?? "").trim();

const toNumber = (value, fallback = 0) => {
  if (value === null || typeof value === "undefined" || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const firstDefined = (...values) =>
  values.find((value) => value !== null && typeof value !== "undefined");

const firstArrayValue = (value) =>
  Array.isArray(value) && value.length > 0 ? value[0] : null;

const validateProduct = (product, source) => {
  const errors = [];

  if (!product?.id) errors.push("Missing id");
  if (!product?.name) errors.push("Missing name");
  if (typeof product?.price === "undefined") errors.push("Missing price");

  if (errors.length > 0) {
    console.warn(`[Product Validation][${source}]`, errors, product);
  }

  return product;
};

const resolveProductId = (raw) =>
  raw?.id ??
  raw?._id ??
  (() => {
    console.warn("Missing product id", raw);
    return null;
  })();

const resolveProductName = (raw) => {
  const resolvedName = toText(firstDefined(raw?.name, raw?.title, raw?.productName, ""));
  if (resolvedName) return resolvedName;
  console.warn("Missing product name", raw);
  return "Untitled product";
};

const resolveProductPrice = (raw) => {
  const directPrice = firstDefined(
    raw?.price,
    raw?.pricing?.price,
    raw?.pricing?.effectivePrice,
    raw?.salePrice,
    raw?.pricing?.salePrice,
    0
  );
  if (
    typeof raw?.price === "undefined" &&
    typeof raw?.pricing?.price === "undefined" &&
    typeof raw?.pricing?.effectivePrice === "undefined" &&
    typeof raw?.salePrice === "undefined" &&
    typeof raw?.pricing?.salePrice === "undefined"
  ) {
    console.warn("Missing product price", raw);
  }
  return toNumber(directPrice, 0);
};

const resolveProductSalePrice = (raw) => {
  const salePrice = firstDefined(raw?.salePrice, raw?.pricing?.salePrice, null);
  if (salePrice === null || typeof salePrice === "undefined" || salePrice === "") return null;
  return toNumber(salePrice, 0);
};

const resolveProductAttributes = (raw) => {
  if (typeof raw?.attributes !== "undefined") return raw.attributes;
  if (typeof raw?.variations !== "undefined") return raw.variations;
  return [];
};

const resolveProductVendor = (raw) => {
  const vendorCandidate = firstDefined(
    raw?.vendor,
    raw?.seller,
    raw?.sellerInfo,
    raw?.ownership,
    raw?.store,
    null
  );

  if (!vendorCandidate) {
    console.warn("Missing vendor", raw);
    return null;
  }

  if (typeof vendorCandidate === "object") {
    return vendorCandidate?.id ?? vendorCandidate?._id ?? vendorCandidate;
  }

  return vendorCandidate;
};

const resolveProductStock = (raw) =>
  toNumber(
    firstDefined(raw?.stock, raw?.quantity, raw?.inventory?.stock, raw?.availability?.stock, 0),
    0
  );

const resolveProductImage = (raw) =>
  toText(
    firstDefined(
      raw?.image,
      raw?.thumbnail,
      raw?.imageUrl,
      raw?.mediaPreviewUrl,
      raw?.media?.promoImageUrl,
      firstArrayValue(raw?.media?.imageUrls),
      raw?.promoImagePath,
      firstArrayValue(raw?.imagePaths),
      firstArrayValue(raw?.images)
    )
  ) || null;

const resolveProductSeo = (raw, fallbackImage) => {
  const seoSource = isPlainObject(raw?.seo) ? raw.seo : {};
  const tags = Array.isArray(raw?.tags)
    ? raw.tags
    : Array.isArray(raw?.attributes?.tags)
      ? raw.attributes.tags
      : [];

  return {
    metaTitle:
      toText(firstDefined(seoSource?.metaTitle, raw?.metaTitle, raw?.name, raw?.title, "")) || "",
    metaDescription:
      toText(
        firstDefined(
          seoSource?.metaDescription,
          raw?.metaDescription,
          raw?.description,
          raw?.descriptions?.description,
          "",
        ),
      ) || "",
    keywords:
      Array.isArray(seoSource?.keywords) && seoSource.keywords.length > 0
        ? seoSource.keywords
            .map((entry) => toText(entry))
            .filter(Boolean)
        : Array.isArray(tags)
          ? tags.map((entry) => toText(entry)).filter(Boolean)
          : [],
    ogImageUrl:
      toText(
        firstDefined(
          seoSource?.ogImageUrl,
          raw?.ogImageUrl,
          raw?.image,
          raw?.imageUrl,
          raw?.media?.promoImageUrl,
          fallbackImage,
          "",
        ),
      ) || "",
  };
};

const buildDebugSnapshot = (value) => {
  if (Array.isArray(value)) {
    return {
      count: value.length,
      sample: value[0] ?? null,
    };
  }

  return value ?? null;
};

const normalizeAttributeOwnershipWarnings = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => {
          if (!isPlainObject(entry)) return null;
          return {
            code: toText(entry.code) || "ATTRIBUTE_STORE_SCOPE_MISMATCH",
            attributeId: toNumber(entry.attributeId, 0) || null,
            attributeName: toText(entry.attributeName) || "",
            attributeScope: toText(entry.attributeScope) || "",
            attributeStoreId: toNumber(entry.attributeStoreId, 0) || null,
            productStoreId: toNumber(entry.productStoreId, 0) || null,
            message: toText(entry.message) || "",
          };
        })
        .filter(Boolean)
    : [];

export const logProductNormalization = (scope, before, after) => {
  console.log(`[product-adapter][${scope}][before]`, buildDebugSnapshot(before));
  console.log(`[product-adapter][${scope}][after]`, buildDebugSnapshot(after));
};

export const normalizeProduct = (raw) => {
  if (!isPlainObject(raw)) return null;

  const normalized = {
    id: resolveProductId(raw),
    name: resolveProductName(raw),
    price: resolveProductPrice(raw),
    attributes: resolveProductAttributes(raw),
    vendor: resolveProductVendor(raw),
    stock: resolveProductStock(raw),
    image: resolveProductImage(raw),
  };
  const seo = resolveProductSeo(raw, normalized.image);

  const salePrice = resolveProductSalePrice(raw);

  return validateProduct(
    {
    ...raw,
    id: normalized.id,
    name: normalized.name,
    title: toText(raw?.title) || normalized.name,
    price: normalized.price,
    salePrice:
      salePrice === null && typeof raw?.salePrice !== "undefined" ? raw.salePrice : salePrice,
    attributes: normalized.attributes,
    vendor: raw?.vendor ?? normalized.vendor,
    seller: raw?.seller ?? normalized.vendor,
    stock: normalized.stock,
    quantity:
      typeof raw?.quantity !== "undefined" && raw.quantity !== null
        ? raw.quantity
        : normalized.stock,
    image: normalized.image,
    thumbnail: raw?.thumbnail ?? normalized.image,
    seo,
    attributeOwnershipWarnings: normalizeAttributeOwnershipWarnings(
      raw?.attributeOwnershipWarnings
    ),
    productReadModel: normalized,
    },
    "adapter"
  );
};
