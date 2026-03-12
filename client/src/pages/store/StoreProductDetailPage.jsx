import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Banknote,
  Facebook,
  House,
  ImageIcon,
  Instagram,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  ShieldX,
  Sparkles,
  Star,
  Truck,
  Twitter,
} from "lucide-react";
import { useCart } from "../../hooks/useCart.ts";
import { useProduct, useProducts } from "../../storefront.jsx";
import QueryState from "../../components/UI/QueryState.jsx";
import { UiEmptyState, UiErrorState, UiSkeleton } from "../../components/ui-states/index.js";
import ProductSellerInfoCard from "../../components/store/ProductSellerInfoCard.jsx";
import { formatCurrency } from "../../utils/format.js";
import { resolveProductImageUrl } from "../../utils/productImage.js";
import { GENERIC_ERROR } from "../../constants/uiMessages.js";

const HIGHLIGHT_ITEMS = [
  { icon: Truck, text: "Shipping fee is calculated at checkout." },
  { icon: House, text: "Delivery coverage depends on your address." },
  { icon: Banknote, text: "Cash on delivery is available when the store supports it." },
  { icon: RotateCcw, text: "Follow store policy for return and support requests." },
  { icon: ShieldX, text: "Warranty terms depend on the product category." },
  { icon: Sparkles, text: "Product details are shown from the current public listing." },
  {
    icon: MapPin,
    text: "Pickup and dispatch details may vary by store location.",
  },
];

const PURCHASE_POINTS = [
  { icon: Truck, title: "Shipping at checkout" },
  { icon: Banknote, title: "Store payment options apply" },
  { icon: RotateCcw, title: "Support follows store policy" },
];

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTags = (product, categoryName) => {
  const source = product?.tags;
  const tags = [];
  if (Array.isArray(source)) {
    source.forEach((item) => {
      const value = String(item || "").trim();
      if (value) tags.push(value);
    });
  } else if (typeof source === "string") {
    source
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => tags.push(item));
  } else if (source && typeof source === "object") {
    Object.values(source).forEach((item) => {
      const value = String(item || "").trim();
      if (value) tags.push(value);
    });
  }
  if (categoryName) {
    tags.push(String(categoryName).toLowerCase().replace(/\s+/g, "-"));
  }
  return Array.from(new Set(tags)).slice(0, 3);
};

const toDateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const normalizeReviews = (rawReviews) => {
  if (!Array.isArray(rawReviews)) return [];
  return rawReviews
    .map((review, index) => {
      const rating = Math.min(5, Math.max(0, toSafeNumber(review?.rating, 0)));
      const userName = String(
        review?.user?.name ||
          review?.customer?.name ||
          review?.name ||
          review?.author ||
          `Customer ${index + 1}`
      ).trim();
      const comment = String(review?.comment || review?.review || "").trim();
      const createdAt = review?.createdAt || review?.updatedAt || null;
      const images = Array.isArray(review?.images)
        ? review.images
        : review?.images
          ? [review.images]
          : [];
      return {
        id: review?.id ?? `${userName}-${index}`,
        userName,
        rating,
        comment,
        createdAt,
        images: images.filter(Boolean).slice(0, 4),
      };
    })
    .filter((review) => Boolean(review.userName));
};

const normalizeVariationGroups = (rawVariations) => {
  if (!rawVariations) return [];

  const source = Array.isArray(rawVariations)
    ? rawVariations
    : Array.isArray(rawVariations?.groups)
      ? rawVariations.groups
      : rawVariations && typeof rawVariations === "object"
        ? Object.entries(rawVariations).map(([key, value]) => ({
            name: key,
            options: Array.isArray(value) ? value : [],
          }))
        : [];

  return source
    .map((group, index) => {
      if (!group || typeof group !== "object") return null;
      const label = String(
        group.name || group.label || group.title || group.attribute || `Option ${index + 1}`
      ).trim();
      const optionsSource = Array.isArray(group.options)
        ? group.options
        : Array.isArray(group.values)
          ? group.values
          : Array.isArray(group.items)
            ? group.items
            : [];
      const options = optionsSource
        .map((option, optionIndex) => {
          const rawValue =
            typeof option === "string"
              ? option
              : option?.label || option?.value || option?.name || option?.title || "";
          const value = String(rawValue || "").trim();
          if (!value) return null;
          return {
            id: `${label}-${optionIndex}-${value}`.toLowerCase(),
            value,
          };
        })
        .filter(Boolean);

      if (!label || options.length === 0) return null;
      return {
        id: `${label}-${index}`.toLowerCase(),
        label,
        options,
      };
    })
    .filter(Boolean);
};

function RatingStars({ rating, className = "h-4 w-4", showValue = false }) {
  const safeRating = Math.max(0, Math.min(5, toSafeNumber(rating, 0)));
  const rounded = Math.round(safeRating);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= rounded;
          return (
            <Star
              key={star}
              className={`${className} ${
                active ? "fill-amber-400 text-amber-400" : "text-slate-300"
              }`}
            />
          );
        })}
      </div>
      {showValue ? (
        <span className="text-sm font-semibold text-slate-700">{safeRating.toFixed(1)}</span>
      ) : null}
    </div>
  );
}

function ImageWithFallback({
  src,
  alt = "",
  wrapperClassName = "",
  imageClassName = "",
  placeholderClassName = "",
  iconClassName = "h-7 w-7",
}) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-slate-100 text-slate-400 ${wrapperClassName} ${placeholderClassName}`}
      >
        <ImageIcon className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={`${wrapperClassName} ${imageClassName}`}
    />
  );
}

function ProductSummaryPanel({
  product,
  qty,
  hasStock,
  hasFiniteStock,
  stockValue,
  isAtStockLimit,
  cartLoading,
  isProductLoading,
  selectedOptions,
  onSelectOption,
  onDecreaseQty,
  onIncreaseQty,
  onAddToCart,
  categoryName,
  categorySlug,
  tags,
}) {
  const ratingAvg = Math.max(0, toSafeNumber(product?.ratingAvg, 0));
  const reviewCount = Math.max(0, Math.round(toSafeNumber(product?.reviewCount, 0)));
  const currentPrice = toSafeNumber(product?.price, 0);
  const originalPrice = toPositiveNumber(product?.originalPrice, 0);
  const hasDiscount = originalPrice > currentPrice && currentPrice > 0;
  const computedDiscount =
    hasDiscount && originalPrice > 0
      ? ((originalPrice - currentPrice) / originalPrice) * 100
      : 0;
  const discountPercent = Math.max(
    0,
    toPositiveNumber(product?.discountPercent, computedDiscount)
  );
  const stockLabel = hasFiniteStock ? stockValue : "N/A";
  const normalizedBrand = String(product?.brand?.name ?? product?.brandName ?? "").trim();
  const normalizedSku = String(product?.sku ?? product?.skuCode ?? product?.code ?? "").trim();
  const weightValue = Number(product?.weight);
  const hasWeight = Number.isFinite(weightValue) && weightValue > 0;
  const supportsPreOrder = Boolean(product?.preOrder);
  const preorderDays = Number(product?.preorderDays || 0);
  const variationGroups = normalizeVariationGroups(product?.variations);
  const categoryHref = categorySlug
    ? `/category/${encodeURIComponent(String(categorySlug))}`
    : null;
  const trustMeta = [
    {
      label: "Rating",
      value:
        ratingAvg > 0
          ? `${ratingAvg.toFixed(1)} · ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`
          : "No reviews yet",
      tone: "amber",
    },
    {
      label: "Stock",
      value: hasStock ? (hasFiniteStock ? `${stockValue} available` : "Available") : "Out of stock",
      tone: hasStock ? "emerald" : "rose",
    },
    ...(supportsPreOrder
      ? [
          {
            label: "Pre-order",
            value: preorderDays > 0 ? `${preorderDays} day lead time` : "Available",
            tone: "sky",
          },
        ]
      : []),
  ];
  const detailItems = [
    {
      label: "Category",
      value: categoryName,
      href: categoryHref,
    },
    ...(normalizedBrand
      ? [
          {
            label: "Brand",
            value: normalizedBrand,
          },
        ]
      : []),
    ...(product?.unit
      ? [
          {
            label: "Unit",
            value: product.unit,
          },
        ]
      : []),
    ...(hasWeight
      ? [
          {
            label: "Weight",
            value: `${weightValue} g`,
          },
        ]
      : []),
    ...(normalizedSku
      ? [
          {
            label: "SKU",
            value: normalizedSku,
          },
        ]
      : []),
  ];
  const availabilityLabel = supportsPreOrder
    ? preorderDays > 0
      ? `Pre-order · ${preorderDays} day lead time`
      : "Pre-order available"
    : hasStock
      ? hasFiniteStock
        ? `${stockValue} in stock`
        : "Ready to order"
      : "Out of stock";
  const discountLabel = hasDiscount ? `-${discountPercent.toFixed(0)}%` : null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center rounded-full bg-slate-100 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            {categoryName}
          </span>
          <span
            className={`inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              hasStock
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {availabilityLabel}
          </span>
          {discountLabel ? (
            <span className="inline-flex h-7 items-center rounded-full border border-rose-200 bg-rose-50 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600">
              {discountLabel}
            </span>
          ) : null}
        </div>
        <h1 className="break-words text-[30px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[34px] xl:text-[40px]">
          {product?.name || "Product"}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
          {trustMeta.map((item, index) => (
            <div key={`${item.label}-${item.value}`} className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  item.tone === "amber"
                    ? "bg-amber-50 text-amber-700"
                    : item.tone === "emerald"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.tone === "rose"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-sky-50 text-sky-700"
                }`}
              >
                {item.label}
              </span>
              <span className="font-medium text-slate-600">{item.value}</span>
              {index < trustMeta.length - 1 ? <span className="text-slate-300">|</span> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Price
            </p>
            <div className="flex flex-wrap items-end gap-2.5">
              <span className="text-[34px] font-bold leading-none text-slate-900 sm:text-[42px]">
                {formatCurrency(currentPrice)}
              </span>
              {hasDiscount ? (
                <span className="pb-1 text-base font-medium text-slate-400 line-through sm:text-lg">
                  {formatCurrency(originalPrice)}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">Shipping and payment options appear at checkout.</p>
          </div>
          <div className="grid gap-2 sm:min-w-[240px]">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Order note
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{availabilityLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Quick summary
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {hasDiscount ? `Save ${discountPercent.toFixed(0)}% today` : "Standard marketplace pricing"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {variationGroups.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          {variationGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.label}
                </p>
                <span className="text-xs text-slate-500">
                  {selectedOptions[group.id] || group.options[0]?.value || "-"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const active = selectedOptions[group.id] === option.value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelectOption(group.id, option.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {option.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Buy now
            </p>
            <p className="mt-1 text-sm text-slate-500">Choose a quantity and add this item to your cart.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {hasStock ? "Ready to order" : "Unavailable"}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid h-12 w-full grid-cols-3 overflow-hidden rounded-full border border-slate-300 bg-white sm:w-[188px]">
            <button
              type="button"
              disabled={qty <= 1}
              onClick={onDecreaseQty}
              className="inline-flex items-center justify-center border-r border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="inline-flex items-center justify-center text-lg font-semibold text-slate-900">
              {qty}
            </span>
            <button
              type="button"
              disabled={!hasStock || isAtStockLimit}
              onClick={onIncreaseQty}
              className="inline-flex items-center justify-center border-l border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            disabled={!hasStock || cartLoading || isProductLoading}
            onClick={onAddToCart}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-8 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
          >
            Add to Cart
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {hasFiniteStock
            ? `Stock available: ${stockLabel}`
            : "Stock is confirmed during checkout."}
        </p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {PURCHASE_POINTS.map((benefit) => (
            <div
              key={benefit.title}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <benefit.icon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-slate-900">{benefit.title}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
          {detailItems.map((meta) => (
            <div key={meta.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {meta.label}
              </dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {meta.href ? (
                  <Link to={meta.href} className="hover:text-slate-900">
                    {meta.value}
                  </Link>
                ) : (
                  meta.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        {tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StoreProductDetailPage() {
  const { slug } = useParams();
  const { add, isLoading: cartLoading } = useCart();
  const [qty, setQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [activeTab, setActiveTab] = useState("reviews");
  const [addingRelatedId, setAddingRelatedId] = useState(null);
  const addingTimerRef = useRef(null);

  const {
    data: productData,
    isLoading,
    isError,
    error,
    refetch: refetchProduct,
  } = useProduct(slug);
  const product = productData?.data ?? null;

  const relatedCategoryId = product?.category?.id ?? product?.categoryId ?? null;
  const numericCategoryId = Number(relatedCategoryId);
  const hasCategoryId = Number.isFinite(numericCategoryId) && numericCategoryId > 0;
  const relatedQuery = useProducts({
    page: 1,
    limit: 40,
  });

  const relatedProducts = useMemo(() => {
    const items = relatedQuery.data?.data?.items ?? [];
    const currentId = product?.id;
    const currentSlug = product?.slug;
    const norm = (value) => String(value || "").trim().toLowerCase();
    const targetSlug = norm(product?.category?.slug);
    const cleaned = items.filter(Boolean);
    const withoutCurrent = cleaned.filter((item) => {
      if (currentId && item.id === currentId) return false;
      if (currentSlug && item.slug === currentSlug) return false;
      return true;
    });
    const primary = hasCategoryId
      ? withoutCurrent.filter((item) => {
          const itemCategoryId =
            Number(item?.category?.id ?? item?.categoryId ?? item?.category_id) || null;
          return itemCategoryId === numericCategoryId;
        })
      : targetSlug
        ? withoutCurrent.filter((item) => {
            const itemSlug = norm(
              item?.category?.slug ?? item?.category?.code ?? item?.categorySlug
            );
            return itemSlug && itemSlug === targetSlug;
          })
        : [];
    const baseList = primary.length >= 4 ? primary : withoutCurrent;
    return baseList.slice(0, 8);
  }, [
    relatedQuery.data,
    product?.id,
    product?.slug,
    product?.category?.slug,
    numericCategoryId,
    hasCategoryId,
  ]);

  const stockValue = Number(product?.stock);
  const hasFiniteStock = Number.isFinite(stockValue);
  const hasStock = hasFiniteStock ? stockValue > 0 : true;
  const isAtStockLimit = hasFiniteStock ? qty >= stockValue : false;
  const resolvedImageSrc = useMemo(() => resolveProductImageUrl(product), [product]);
  const [imageSrc, setImageSrc] = useState(resolvedImageSrc);
  const keyword = (product?.name || "").trim().split(/\s+/)[0] || "";
  const safeKeyword = keyword.length >= 3 ? keyword : "";
  const browseUrl = safeKeyword ? `/search?q=${encodeURIComponent(safeKeyword)}` : "/search";
  const productErrorMessage =
    error?.response?.data?.message ||
    error?.message ||
    GENERIC_ERROR;

  const categoryName = product?.category?.name || "Uncategorized";
  const categorySlug = product?.category?.slug ?? product?.category?.code ?? null;
  const tags = useMemo(() => normalizeTags(product, categoryName), [product, categoryName]);
  const ratingAvg = Math.max(0, toSafeNumber(product?.ratingAvg, 0));
  const reviewCount = Math.max(0, Math.round(toSafeNumber(product?.reviewCount, 0)));
  const descriptionText = String(product?.description || "").trim();
  const reviews = useMemo(
    () => normalizeReviews(productData?.data?.reviews ?? product?.reviews ?? []),
    [productData?.data?.reviews, product?.reviews]
  );
  const sellerInfo = productData?.data?.sellerInfo ?? product?.sellerInfo ?? null;
  const variationGroups = useMemo(
    () => normalizeVariationGroups(product?.variations),
    [product?.variations]
  );

  useEffect(() => {
    setImageSrc(resolvedImageSrc);
  }, [resolvedImageSrc]);

  useEffect(() => {
    if (!hasFiniteStock) return;
    if (stockValue <= 0) {
      setQty(1);
      return;
    }
    setQty((prev) => Math.min(Math.max(1, prev), stockValue));
  }, [hasFiniteStock, stockValue]);

  useEffect(
    () => () => {
      if (addingTimerRef.current) {
        clearTimeout(addingTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (variationGroups.length === 0) {
      setSelectedOptions({});
      return;
    }
    setSelectedOptions((prev) => {
      const next = {};
      variationGroups.forEach((group) => {
        const existing = prev[group.id];
        const hasExisting = group.options.some((option) => option.value === existing);
        next[group.id] = hasExisting ? existing : group.options[0]?.value ?? "";
      });
      return next;
    });
  }, [variationGroups]);

  const handleAddMainProduct = () => {
    add(product.id, qty, {
      name: product?.name || product?.title,
      price: product?.salePrice ?? product?.sellingPrice ?? product?.price,
      imageUrl: imageSrc,
    });
  };

  const handleAddRelated = (item) => {
    const relatedImage = resolveProductImageUrl(item);
    add(item?.id, 1, {
      name: item?.name || item?.title,
      price: item?.price,
      imageUrl: relatedImage,
    });
    setAddingRelatedId(item?.id ?? null);
    if (addingTimerRef.current) {
      clearTimeout(addingTimerRef.current);
    }
    addingTimerRef.current = setTimeout(() => {
      setAddingRelatedId(null);
    }, 700);
  };

  if (isLoading) {
    return (
      <section className="space-y-5">
        <UiSkeleton variant="invoice" rows={6} />
      </section>
    );
  }

  if (isError) {
    const status = error?.response?.status;
    if (status === 404) {
      return (
        <section className="space-y-5">
          <UiEmptyState
            className="rounded-2xl py-12"
            title="Product not found"
            description="This product may have been removed or the link is no longer valid."
            actions={
              <>
                <Link
                  to={browseUrl}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Browse Products
                </Link>
                <Link
                  to="/"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  Back to Home
                </Link>
              </>
            }
          />
        </section>
      );
    }
    return (
      <section className="space-y-5">
        <UiErrorState
          title={GENERIC_ERROR}
          message={productErrorMessage}
          onRetry={() => refetchProduct()}
        />
      </section>
    );
  }

  if (!product) {
    return (
      <section className="space-y-5">
        <UiEmptyState
          className="rounded-2xl py-12"
          title="Product not found"
          description="Try opening another product from search results."
          actions={
            <Link
              to={browseUrl}
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Browse Products
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="font-semibold text-slate-800 hover:text-slate-900">
            Home
          </Link>
          <span>&gt;</span>
          {categorySlug ? (
            <Link
              to={`/category/${encodeURIComponent(String(categorySlug))}`}
              className="font-semibold text-slate-700 hover:text-slate-900"
            >
              {categoryName}
            </Link>
          ) : (
            <span className="font-semibold text-slate-700">{categoryName}</span>
          )}
          <span>&gt;</span>
          <span className="font-semibold text-slate-900">{product.name}</span>
        </nav>

        <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-6 lg:p-7">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-10">
            <div className="order-1 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4">
              <div className="aspect-square w-full overflow-hidden rounded-[18px] bg-white">
                <ImageWithFallback
                  src={imageSrc}
                  alt={product.name}
                  wrapperClassName="h-full w-full"
                  imageClassName="h-full w-full object-contain p-4 sm:p-6 lg:p-7"
                  iconClassName="h-9 w-9"
                />
              </div>
            </div>

            <aside className="order-2 lg:self-start">
              <ProductSummaryPanel
                product={product}
                qty={qty}
                hasStock={hasStock}
                hasFiniteStock={hasFiniteStock}
                stockValue={stockValue}
                isAtStockLimit={isAtStockLimit}
                cartLoading={cartLoading}
                isProductLoading={isLoading}
                selectedOptions={selectedOptions}
                onSelectOption={(groupId, value) =>
                  setSelectedOptions((prev) => ({
                    ...prev,
                    [groupId]: value,
                  }))
                }
                onDecreaseQty={() => setQty((prev) => Math.max(1, prev - 1))}
                onIncreaseQty={() =>
                  setQty((prev) => {
                    if (!hasFiniteStock) return prev + 1;
                    return Math.min(stockValue, prev + 1);
                  })
                }
                onAddToCart={handleAddMainProduct}
                categoryName={categoryName}
                categorySlug={categorySlug}
                tags={tags}
              />
            </aside>
          </div>
        </div>

        <div className="px-1">
          <ProductSellerInfoCard sellerInfo={sellerInfo} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-10">
          <div id="product-tabs" className="order-3 lg:col-span-7 lg:self-start">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 pt-5">
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("reviews")}
                    className={`border-b-2 pb-3 text-base font-semibold transition ${
                      activeTab === "reviews"
                        ? "border-emerald-500 text-emerald-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Reviews
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("description")}
                    className={`border-b-2 pb-3 text-base font-semibold transition ${
                      activeTab === "description"
                        ? "border-emerald-500 text-emerald-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Details
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-6">
                {activeTab === "reviews" ? (
                  reviews.length > 0 ? (
                    reviews.map((review) => (
                      <article
                        key={review.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                            {review.userName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-900">
                                {review.userName}
                              </p>
                              <RatingStars rating={review.rating} className="h-3.5 w-3.5" />
                            </div>
                            {review.createdAt ? (
                              <p className="mt-0.5 text-xs text-slate-400">
                                {toDateLabel(review.createdAt)}
                              </p>
                            ) : null}
                            {review.comment ? (
                              <p className="mt-2 text-sm leading-6 text-slate-600">{review.comment}</p>
                            ) : null}
                            {review.images.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {review.images.map((image, index) => (
                                  <div
                                    key={`${review.id}-${index}`}
                                    className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                  >
                                    <ImageWithFallback
                                      src={image}
                                      alt={`review-${index + 1}`}
                                      wrapperClassName="h-full w-full"
                                      imageClassName="h-full w-full object-cover"
                                      iconClassName="h-3.5 w-3.5"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      {reviewCount > 0
                        ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"} available. Full review entries are not shown here yet.`
                        : "No customer reviews yet."}
                    </div>
                  )
                ) : (
                  <div className="space-y-3 text-[15px] leading-8 text-slate-600">
                    {descriptionText ? <p>{descriptionText}</p> : <p>No details yet.</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="order-4 lg:col-span-5 lg:self-start">
            <div className="space-y-6">
              <div
                id="product-highlights"
                className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h3 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
                  Highlights
                </h3>
                <ul className="mt-4 space-y-3 text-[15px] text-slate-600">
                  {HIGHLIGHT_ITEMS.map((item) => (
                    <li key={item.text} className="flex items-start gap-3">
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                id="product-share"
                className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h4 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
                  Share
                </h4>
                <p className="mt-1 text-[15px] text-slate-500">Send this item to someone else.</p>
                <div className="mt-4 flex items-center gap-2">
                  <a
                    href="#"
                    aria-label="Share to Facebook"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    <Facebook className="h-4 w-4" />
                  </a>
                  <a
                    href="#"
                    aria-label="Share to Instagram"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                  <a
                    href="#"
                    aria-label="Share to X"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    <Twitter className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="related-products" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-slate-900">Related Products</h2>
            <p className="text-sm text-slate-500">Discover more items in the same category.</p>
          </div>
          <Link to={browseUrl} className="text-sm font-semibold text-slate-500 hover:text-slate-900">
            Browse more
          </Link>
        </div>
        <QueryState
          isLoading={relatedQuery.isLoading}
          isError={relatedQuery.isError}
          error={relatedQuery.error}
          isEmpty={!relatedQuery.isLoading && !relatedQuery.isError && relatedProducts.length === 0}
          emptyTitle="No related products"
          emptyHint="Browse more items from this category."
          onRetry={() => relatedQuery.refetch()}
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {relatedProducts.map((item) => {
              const relatedRating = Math.max(0, toSafeNumber(item?.ratingAvg ?? item?.rating, 0));
              const relatedReviewCount = Math.max(
                0,
                Math.round(toSafeNumber(item?.reviewCount, 0))
              );
              const relatedImage = resolveProductImageUrl(item);
              const relatedName = item?.name || item?.title || "Product";
              const relatedSlug = item?.slug || item?.id;
              const isAdding = addingRelatedId === item?.id;
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <Link to={`/product/${relatedSlug}`} className="block h-full w-full">
                      <ImageWithFallback
                        src={relatedImage}
                        alt={relatedName}
                        wrapperClassName="h-full w-full"
                        imageClassName="h-full w-full object-contain p-3 sm:p-4"
                        iconClassName="h-6 w-6"
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleAddRelated(item)}
                      aria-label={`Add ${relatedName} to cart`}
                      className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600"
                    >
                      {isAdding ? <span className="text-xs font-semibold">OK</span> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="space-y-1.5 p-4">
                    <Link
                      to={`/product/${relatedSlug}`}
                      className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-slate-700"
                    >
                      {relatedName}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <RatingStars rating={relatedRating} className="h-3.5 w-3.5" />
                      <span>
                        {relatedRating.toFixed(1)} ({relatedReviewCount} reviews)
                      </span>
                    </div>
                    <div className="pt-1 text-lg font-bold text-slate-900">
                      {formatCurrency(toSafeNumber(item?.price, 0))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </QueryState>
      </section>
    </div>
  );
}
