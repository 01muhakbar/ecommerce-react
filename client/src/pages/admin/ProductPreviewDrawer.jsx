import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit2, X } from "lucide-react";
import { getAdminProduct } from "../../lib/adminApi.js";
import { moneyIDR } from "../../utils/money.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const FALLBACK_THUMBNAIL = "/demo/placeholder-product.svg";
const MAX_VISIBLE_TAGS = 6;
const INTERNAL_TAG_PATTERN = /^(source:|__)|seed:/i;
const MAX_VARIANTS = 9;
const DEFAULT_COLORS = ["Red", "Green", "Blue"];
const DEFAULT_SIZES = ["Small", "Medium", "Large"];
const COLOR_CANDIDATES = new Set([
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "black",
  "white",
  "brown",
  "pink",
]);
const SIZE_CANDIDATES = new Set(["xs", "s", "small", "m", "medium", "l", "large", "xl", "xxl"]);

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const truncateTag = (value, max = 32) =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const isInternalTag = (value) => INTERNAL_TAG_PATTERN.test(String(value || "").trim());
const tryParseJson = (value) => {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value: null };
  }
};

const toTitle = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const toSeed = (value) =>
  String(value ?? "")
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

const extractCandidates = (tags, dictionary) => {
  const found = [];
  const seen = new Set();

  tags.forEach((tag) => {
    String(tag || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .forEach((token) => {
        if (!dictionary.has(token) || seen.has(token)) return;
        seen.add(token);
        found.push(token);
      });
  });

  return found;
};

const normalizeTags = (raw) => {
  const result = [];
  const seen = new Set();

  const pushTag = (candidate) => {
    const text = String(candidate || "").trim();
    if (!text || isInternalTag(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(truncateTag(text));
  };

  const consumeObject = (obj) => {
    if (!obj || typeof obj !== "object") return;
    const unitValue = obj.unit ?? obj.Unit;
    if (unitValue != null && String(unitValue).trim()) {
      pushTag(String(unitValue).trim());
    }

    Object.entries(obj).forEach(([key, value]) => {
      if (["source", "Source", "unit", "Unit"].includes(key)) return;
      if (/^(source|seed|__)/i.test(key)) return;
      if (value == null) return;
      if (typeof value === "object") return;
      pushTag(value);
    });
  };

  const consumeEntry = (entry) => {
    if (entry == null) return;

    if (typeof entry === "string") {
      let normalized = entry.trim();
      if (!normalized) return;

      // Handle raw JSON, double-encoded JSON, and escaped JSON-like string from legacy seed data.
      for (let depth = 0; depth < 3; depth += 1) {
        const parsed = tryParseJson(normalized);
        if (!parsed.ok) break;

        if (typeof parsed.value === "string") {
          const next = parsed.value.trim();
          if (!next || next === normalized) break;
          normalized = next;
          continue;
        }

        consumeEntry(parsed.value);
        return;
      }

      // Example fallback: {\"unit\":\"1 kg\"} -> {"unit":"1 kg"}
      for (let depth = 0; depth < 3; depth += 1) {
        const unescaped = normalized
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, "\\")
          .trim();
        if (!unescaped || unescaped === normalized) break;
        normalized = unescaped;

        const reparsed = tryParseJson(normalized);
        if (!reparsed.ok) continue;

        if (typeof reparsed.value === "string") {
          const next = reparsed.value.trim();
          if (!next || next === normalized) break;
          normalized = next;
          continue;
        }

        consumeEntry(reparsed.value);
        return;
      }

      if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
      ) {
        normalized = normalized.slice(1, -1).trim();
        const reparsed = tryParseJson(normalized);
        if (reparsed.ok) {
          consumeEntry(reparsed.value);
          return;
        }
      }

      pushTag(normalized);
      return;
    }

    if (Array.isArray(entry)) {
      entry.forEach((item) => consumeEntry(item));
      return;
    }

    if (typeof entry === "object") {
      consumeObject(entry);
      return;
    }

    pushTag(entry);
  };

  if (Array.isArray(raw)) {
    raw.forEach((entry) => consumeEntry(entry));
  } else {
    consumeEntry(raw);
  }

  return result;
};

const buildVariants = (product, normalizedTags, baseImageUrl) => {
  if (!product) return [];

  const seed = toSeed(product.id || product.slug || product.name || "variant");
  const colorTokens = extractCandidates(normalizedTags, COLOR_CANDIDATES);
  const sizeTokens = extractCandidates(normalizedTags, SIZE_CANDIDATES);
  const colors = colorTokens.length > 0 ? colorTokens.map(toTitle) : DEFAULT_COLORS;
  const sizes = sizeTokens.length > 0 ? sizeTokens.map(toTitle) : DEFAULT_SIZES;

  const combinations = [];
  for (let i = 0; i < sizes.length && combinations.length < MAX_VARIANTS; i += 1) {
    for (let j = 0; j < colors.length && combinations.length < MAX_VARIANTS; j += 1) {
      combinations.push(`${colors[j]} ${sizes[i]}`);
    }
  }

  if (combinations.length === 0) {
    combinations.push("Default Variant");
  }

  const originalPrice = asNumber(product.originalPrice || product.price);
  const salePrice = asNumber(product.salePrice);
  const effectiveSale = salePrice > 0 ? salePrice : asNumber(product.price);
  const stock = Math.max(0, asNumber(product.stock));
  const rowCount = combinations.length;
  const avgQty = rowCount > 0 ? Math.floor(stock / rowCount) : 0;
  const restQty = rowCount > 0 ? stock % rowCount : 0;
  const skuBase = String(product.slug || product.id || "product").replace(/\s+/g, "-");
  const barcodeBase = String(product.id || seed || "0").replace(/\D/g, "") || String(seed || 1000);

  return combinations.slice(0, MAX_VARIANTS).map((combination, index) => {
    const variation = ((seed + index * 5) % 3) - 1;
    const computedQty =
      stock > 0 ? Math.max(0, avgQty + (index < restQty ? 1 : 0) + variation) : 0;

    return {
      sr: index + 1,
      imageUrl: baseImageUrl || FALLBACK_THUMBNAIL,
      combination,
      sku: `${skuBase}-${index + 1}`,
      barcode: `${barcodeBase}${String(index + 1).padStart(2, "0")}`,
      originalPrice,
      salePrice: effectiveSale,
      quantity: computedQty,
    };
  });
};

const getProductCategoryContext = (product) => {
  const selectedCategories = Array.isArray(product?.categories)
    ? product.categories.filter(Boolean)
    : [];
  const fallbackDefaultId = Number(product?.defaultCategoryId ?? product?.categoryId ?? 0);
  const defaultCategory =
    product?.defaultCategory ||
    product?.category ||
    selectedCategories.find((category) => Number(category?.id) === fallbackDefaultId) ||
    null;
  const relatedCategories = selectedCategories.filter(
    (category) => Number(category?.id) !== Number(defaultCategory?.id ?? 0)
  );

  return {
    defaultCategory,
    relatedCategories,
    selectedCategories,
  };
};

export default function ProductPreviewDrawer({ productId, onClose, onEdit }) {
  const detailQuery = useQuery({
    queryKey: ["admin-product-preview", productId],
    queryFn: () => getAdminProduct(productId),
    enabled: Boolean(productId),
  });

  const product = detailQuery.data?.data || null;
  const displayTags = useMemo(() => normalizeTags(product?.tags), [product?.tags]);
  const visibleTags = displayTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagsCount = Math.max(0, displayTags.length - visibleTags.length);
  const price = asNumber(product?.price);
  const salePrice = asNumber(product?.salePrice);
  const hasSalePrice = salePrice > 0 && salePrice < price;
  const published = Boolean(product?.published ?? product?.isPublished);
  const skuValue = String(product?.sku ?? "").trim();
  const skuDisplay = skuValue && skuValue !== "-" ? skuValue : "N/A";
  const imageUrl = resolveAssetUrl(
    product?.imageUrl || product?.promoImagePath || product?.imagePaths?.[0] || FALLBACK_THUMBNAIL
  );
  const categoryContext = useMemo(() => getProductCategoryContext(product), [product]);
  const variants = useMemo(
    () => buildVariants(product, displayTags, imageUrl),
    [product, displayTags, imageUrl]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[32px] font-semibold leading-tight text-slate-900">
              Product Details
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              View your product information from here
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select className="h-10 min-w-[82px] rounded-[10px] border border-emerald-500 bg-white px-3 text-sm font-medium text-slate-700 focus:outline-none">
              <option value="en">en</option>
            </select>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-500 shadow-[0_6px_14px_-8px_rgba(15,23,42,0.3)] transition hover:bg-slate-50"
              aria-label="Close product preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        {detailQuery.isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
            Loading product details...
          </div>
        ) : detailQuery.isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            {detailQuery.error?.response?.data?.message || "Failed to load product detail."}
          </div>
        ) : !product ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Product detail is not available.
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex h-[260px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                  <img
                    src={imageUrl}
                    alt={product.name || "Product image"}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = FALLBACK_THUMBNAIL;
                    }}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <p
                  className={`text-sm font-semibold ${
                    published ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  Status: {published ? "Published" : "This product Hidden"}
                </p>

                <h2 className="text-3xl font-semibold leading-tight text-slate-900">
                  {product.name || "-"}
                </h2>

                <p className="text-sm text-slate-500">SKU: {skuDisplay}</p>

                <div className="flex flex-wrap items-end gap-3">
                  <span className="text-3xl font-bold text-slate-900">
                    {moneyIDR(hasSalePrice ? salePrice : price)}
                  </span>
                  {hasSalePrice ? (
                    <span className="text-sm text-slate-400 line-through">{moneyIDR(price)}</span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      Number(product.stock || 0) > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {Number(product.stock || 0) > 0 ? "In Stock" : "Out of Stock"}
                  </span>
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    QUANTITY: {asNumber(product.stock)}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700">Description</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {product.description || "-"}
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Default Category
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {categoryContext.defaultCategory?.name || "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Primary storefront placement for this product.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Selected Categories
                    </p>
                    {categoryContext.selectedCategories.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {categoryContext.selectedCategories.map((category) => (
                          <span
                            key={category.id}
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              Number(category.id) ===
                              Number(categoryContext.defaultCategory?.id ?? 0)
                                ? "border border-sky-200 bg-sky-50 text-sky-700"
                                : "border border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">No categories assigned.</p>
                    )}
                    {categoryContext.relatedCategories.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {categoryContext.relatedCategories.length} secondary category
                        {categoryContext.relatedCategories.length > 1 ? "ies" : "y"} linked.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Tags</p>
                  {displayTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {visibleTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                      {hiddenTagsCount > 0 ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          +{hiddenTagsCount}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No tags</p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onEdit?.(product.id)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Product
                  </button>
                </div>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="text-xl font-semibold text-slate-900">Product Variant List</h3>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[980px] table-auto">
                    <thead className="bg-slate-100">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">SR</th>
                        <th className="px-4 py-3">IMAGE</th>
                        <th className="px-4 py-3">COMBINATION</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">BARCODE</th>
                        <th className="px-4 py-3">ORIGINALPRICE</th>
                        <th className="px-4 py-3">SALE PRICE</th>
                        <th className="px-4 py-3">QUANTITY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant) => (
                        <tr key={variant.sr} className="border-t border-slate-200 text-sm text-slate-700">
                          <td className="px-4 py-3 font-medium">{variant.sr}</td>
                          <td className="px-4 py-3">
                            <div className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              <img
                                src={variant.imageUrl}
                                alt={variant.combination}
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src = FALLBACK_THUMBNAIL;
                                }}
                                className="h-full w-full object-contain p-1"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{variant.combination}</td>
                          <td className="px-4 py-3 text-slate-600">{variant.sku}</td>
                          <td className="px-4 py-3 text-slate-600">{variant.barcode}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {moneyIDR(variant.originalPrice)}
                          </td>
                          <td className="px-4 py-3 font-medium text-emerald-600">
                            {moneyIDR(variant.salePrice)}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">{variant.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
