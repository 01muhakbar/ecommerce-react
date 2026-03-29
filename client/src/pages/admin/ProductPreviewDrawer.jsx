import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Edit2, MessageSquareWarning, Send, X } from "lucide-react";
import {
  getAdminProduct,
  requestAdminProductRevision,
  updateAdminProductPublished,
} from "../../lib/adminApi.js";
import { moneyIDR } from "../../utils/money.js";
import {
  getPrimaryProductImageUrl,
  normalizeProductDisplayTags,
} from "../../utils/productDisplay.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const FALLBACK_THUMBNAIL = "/demo/placeholder-product.svg";
const MAX_VISIBLE_TAGS = 6;
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

const getLifecycleMeta = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active") {
    return {
      label: "Active",
      toneClass: "bg-emerald-100 text-emerald-700",
    };
  }
  if (normalized === "inactive") {
    return {
      label: "Inactive",
      toneClass: "bg-stone-100 text-stone-700",
    };
  }
  return {
    label: "Draft",
    toneClass: "bg-amber-100 text-amber-800",
  };
};

const getStorefrontMeta = (visibility, published, status, submissionStatus) => {
  const stateCode = String(visibility?.stateCode || "")
    .trim()
    .toUpperCase();
  const reasonCode = String(visibility?.reasonCode || "")
    .trim()
    .toUpperCase();
  const normalized = String(status || "").trim().toLowerCase();
  const normalizedSubmission = String(submissionStatus || "none")
    .trim()
    .toLowerCase();
  if (stateCode === "STOREFRONT_VISIBLE") {
    return {
      label: "Visible in storefront",
      toneClass: "bg-emerald-100 text-emerald-700",
      description:
        visibility?.storefrontReason ||
        "Publish is on and lifecycle is active, so storefront visibility is live.",
    };
  }
  if (stateCode === "PUBLISHED_BLOCKED" && reasonCode === "REVIEW_PENDING") {
    return {
      label: "Published but review-blocked",
      toneClass: "bg-sky-100 text-sky-700",
      description:
        visibility?.storefrontReason ||
        "Publish is on, but storefront visibility stays hidden until admin review is completed.",
    };
  }
  if (stateCode === "PUBLISHED_BLOCKED" && reasonCode === "REVISION_REQUIRED") {
    return {
      label: "Published but revision-blocked",
      toneClass: "bg-amber-100 text-amber-800",
      description:
        visibility?.storefrontReason ||
        "Publish is on, but storefront visibility stays hidden until seller revisions are resubmitted and approved.",
    };
  }
  if (stateCode === "PUBLISHED_BLOCKED" && reasonCode === "STORE_NOT_ACTIVE") {
    return {
      label: "Published but store-blocked",
      toneClass: "bg-amber-100 text-amber-800",
      description:
        visibility?.storefrontReason ||
        "Publish is on, but the store is not active so storefront visibility stays blocked.",
    };
  }
  if (!published) {
    return {
      label: "Hidden from storefront",
      toneClass: "bg-rose-100 text-rose-700",
      description: "Publish is off, so customers cannot see this product yet.",
    };
  }
  if (normalizedSubmission === "submitted") {
    return {
      label: "Published but review-blocked",
      toneClass: "bg-sky-100 text-sky-700",
      description:
        "Publish is on, but storefront visibility stays hidden until admin review is completed.",
    };
  }
  if (normalizedSubmission === "needs_revision") {
    return {
      label: "Published but revision-blocked",
      toneClass: "bg-amber-100 text-amber-800",
      description:
        "Publish is on, but storefront visibility stays hidden until seller revisions are resubmitted and approved.",
    };
  }
  if (normalized === "active") {
    return {
      label: "Visible in storefront",
      toneClass: "bg-emerald-100 text-emerald-700",
      description: "Publish is on and lifecycle is active, so storefront visibility is live.",
    };
  }
  return {
    label: "Published but blocked",
    toneClass: "bg-amber-100 text-amber-800",
    description: "Publish is on, but storefront visibility stays blocked until lifecycle returns to active.",
  };
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
  const queryClient = useQueryClient();
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionStatus, setRevisionStatus] = useState(null);
  const [publishStatus, setPublishStatus] = useState(null);
  const detailQuery = useQuery({
    queryKey: ["admin-product-preview", productId],
    queryFn: () => getAdminProduct(productId),
    enabled: Boolean(productId),
  });

  const product = detailQuery.data?.data || null;
  const displayTags = useMemo(
    () =>
      normalizeProductDisplayTags(product?.tags, {
        filterInternal: true,
        maxLength: 32,
      }),
    [product?.tags]
  );
  const visibleTags = displayTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagsCount = Math.max(0, displayTags.length - visibleTags.length);
  const price = asNumber(product?.price);
  const salePrice = asNumber(product?.salePrice);
  const hasSalePrice = salePrice > 0 && salePrice < price;
  const published = Boolean(product?.published ?? product?.isPublished);
  const lifecycleMeta = getLifecycleMeta(product?.status);
  const sellerSubmission = product?.sellerSubmission || null;
  const storefrontMeta = getStorefrontMeta(
    product?.visibility,
    published,
    product?.status,
    sellerSubmission?.status
  );
  const skuValue = String(product?.sku ?? "").trim();
  const skuDisplay = skuValue && skuValue !== "-" ? skuValue : "N/A";
  const imageUrl = resolveAssetUrl(getPrimaryProductImageUrl(product, FALLBACK_THUMBNAIL));
  const categoryContext = useMemo(() => getProductCategoryContext(product), [product]);
  const variants = useMemo(
    () => buildVariants(product, displayTags, imageUrl),
    [product, displayTags, imageUrl]
  );
  const publishGate = sellerSubmission?.publishGate || null;
  const canRequestRevision = sellerSubmission?.status === "submitted";
  const canPublishReviewOutcome =
    Boolean(publishGate?.canPublishFromReview) && !published;

  useEffect(() => {
    setRevisionNote(String(sellerSubmission?.revisionNote || ""));
    setRevisionStatus(null);
  }, [sellerSubmission?.revisionNote, productId]);

  useEffect(() => {
    setPublishStatus(null);
  }, [productId]);

  const revisionMutation = useMutation({
    mutationFn: () => requestAdminProductRevision(productId, revisionNote),
    onSuccess: async (response) => {
      setRevisionStatus({
        type: "success",
        message: "Seller revision requested. The product is reopened for seller corrections.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-product", productId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-product-preview", productId] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
      ]);
      if (response?.data) {
        queryClient.setQueryData(["admin-product-preview", productId], { data: response.data });
      }
    },
    onError: (error) => {
      setRevisionStatus({
        type: "error",
        message:
          error?.response?.data?.message || "Failed to request seller revision for this product.",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => updateAdminProductPublished(productId, true),
    onSuccess: async () => {
      setPublishStatus({
        type: "success",
        message:
          "Product published as the final admin review outcome. Seller submission state has been cleared.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-product", productId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-product-preview", productId] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
      ]);
    },
    onError: (error) => {
      setPublishStatus({
        type: "error",
        message:
          error?.response?.data?.message ||
          "Failed to publish this seller product from the review lane.",
      });
    },
  });

  const submissionToneClass =
    sellerSubmission?.status === "submitted"
      ? "bg-sky-100 text-sky-700"
      : sellerSubmission?.status === "needs_revision"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";

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
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${lifecycleMeta.toneClass}`}
                  >
                    Lifecycle: {lifecycleMeta.label}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${storefrontMeta.toneClass}`}
                  >
                    Storefront: {storefrontMeta.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{storefrontMeta.description}</p>

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
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${submissionToneClass}`}>
                    {sellerSubmission?.label || "Not submitted"}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Seller Review Loop
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {sellerSubmission?.reviewState || "NOT_SUBMITTED"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {publishGate?.hint ||
                          "Submitted products can be sent back as needs revision. Publish authority stays with admin."}
                      </p>
                    </div>
                    {sellerSubmission?.submittedAt ? (
                      <div className="text-right text-xs text-slate-500">
                        <p>Submitted at</p>
                        <p className="mt-1 font-medium text-slate-700">
                          {new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(sellerSubmission.submittedAt))}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {sellerSubmission?.revisionNote ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                        Current Revision Note
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">{sellerSubmission.revisionNote}</p>
                    </div>
                  ) : null}

                  {revisionStatus ? (
                    <div
                      className={`mt-4 rounded-xl border px-3 py-3 text-sm ${
                        revisionStatus.type === "error"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {revisionStatus.message}
                    </div>
                  ) : null}

                  {publishStatus ? (
                    <div
                      className={`mt-4 rounded-xl border px-3 py-3 text-sm ${
                        publishStatus.type === "error"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {publishStatus.message}
                    </div>
                  ) : null}

                  {canRequestRevision ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => publishMutation.mutate()}
                          disabled={publishMutation.isPending || !canPublishReviewOutcome}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {publishMutation.isPending ? "Publishing..." : "Publish as Final Outcome"}
                        </button>
                        <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          Publish will clear the seller submission review state.
                        </span>
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Revision Note
                        </span>
                        <textarea
                          value={revisionNote}
                          onChange={(event) => setRevisionNote(event.target.value)}
                          maxLength={1000}
                          rows={4}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:border-amber-400 focus:outline-none"
                          placeholder="Explain what seller needs to correct before resubmission."
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => revisionMutation.mutate()}
                        disabled={revisionMutation.isPending}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MessageSquareWarning className="h-4 w-4" />
                        {revisionMutation.isPending ? "Requesting..." : "Request Revision"}
                      </button>
                    </div>
                  ) : sellerSubmission?.status === "needs_revision" ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <Send className="h-4 w-4" />
                      Seller can edit and resubmit this product again. Publish stays locked until resubmission.
                    </div>
                  ) : null}
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
