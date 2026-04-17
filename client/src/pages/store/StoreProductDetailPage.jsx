import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Facebook,
  House,
  ImageIcon,
  Instagram,
  MapPin,
  Minus,
  PhoneCall,
  Plus,
  RotateCcw,
  ShieldX,
  Sparkles,
  Star,
  Truck,
  Twitter,
  X,
} from "lucide-react";
import { useCart } from "../../hooks/useCart.ts";
import { useProduct, useProducts } from "../../storefront.jsx";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import QueryState from "../../components/primitives/ui/QueryState.jsx";
import { UiEmptyState, UiErrorState, UiSkeleton } from "../../components/primitives/state/index.js";
import ProductSellerInfoCard from "../../components/store/ProductSellerInfoCard.jsx";
import SearchProductCard from "../../components/store/SearchProductCard.jsx";
import { formatCurrency } from "../../utils/format.js";
import { ensureProductImageUrl, resolveProductImageUrl } from "../../utils/productImage.js";
import { getProductVisibleImageUrls, normalizeProductDisplayTags } from "../../utils/productDisplay.js";
import {
  buildPublicProductVariationGroups,
  normalizePublicProductVariationState,
  resolvePublicSelectedVariant,
} from "../../utils/publicProductVariations.js";
import { GENERIC_ERROR } from "../../constants/uiMessages.js";

const DEFAULT_PRODUCT_SLUG_LANG = "en";
const RIGHT_BOX_ICONS = [Truck, House, Banknote, RotateCcw, ShieldX, Sparkles, MapPin];
const DEFAULT_RIGHT_BOX_DESCRIPTIONS = [
  "Shipping fee is calculated at checkout.",
  "Delivery coverage depends on your address.",
  "Cash on delivery is available when the store supports it.",
  "Follow store policy for return and support requests.",
  "Warranty terms depend on the product category.",
  "Product details are shown from the current public listing.",
  "Pickup and dispatch details may vary by store location.",
];

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeProductRightBox = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const rawDescriptions = Array.isArray(source.descriptions)
    ? source.descriptions
    : Array.from({ length: 7 }, (_, index) => source[`description${index + 1}`] ?? "");
  const descriptions = Array.from({ length: 7 }, (_, index) => {
    const fallback = DEFAULT_RIGHT_BOX_DESCRIPTIONS[index] || "";
    const value = rawDescriptions[index];
    return typeof value === "string" ? value.trim() : fallback;
  });
  const items = descriptions
    .map((text, index) => ({
      icon: RIGHT_BOX_ICONS[index] || Sparkles,
      text,
    }))
    .filter((item) => Boolean(item.text));

  return {
    enabled: toBool(source.enabled, true),
    items,
  };
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

function ProductImageLightbox({ images, activeIndex, onChangeIndex, onClose, productName }) {
  const activeImage = images[activeIndex] || "";

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && images.length > 1) {
        onChangeIndex((activeIndex - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        onChangeIndex((activeIndex + 1) % images.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length, onChangeIndex, onClose]);

  if (!activeImage) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
        aria-label="Close image preview"
      >
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChangeIndex((activeIndex - 1 + images.length) % images.length);
            }}
            className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChangeIndex((activeIndex + 1) % images.length);
            }}
            className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
      <div
        className="flex max-h-full max-w-6xl flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-[82vh] w-full items-center justify-center">
          <img
            src={activeImage}
            alt={productName || "Product image"}
            className="max-h-[82vh] max-w-full object-contain"
          />
        </div>
        {images.length > 1 ? (
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
            {images.map((image, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => onChangeIndex(index)}
                  className={`overflow-hidden rounded-2xl border transition ${
                    active
                      ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                      : "border-white/15 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={image} alt={`${productName || "Product"} ${index + 1}`} className="h-16 w-16 object-cover" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductSummaryPanel({
  product,
  variationGroups,
  selectedVariant,
  qty,
  hasStock,
  hasFiniteStock,
  stockValue,
  isAtStockLimit,
  purchaseState,
  isPurchasable,
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
  sellerInfo,
}) {
  const ratingAvg = Math.max(0, toSafeNumber(product?.ratingAvg, 0));
  const reviewCount = Math.max(0, Math.round(toSafeNumber(product?.reviewCount, 0)));
  const variantBasePrice = toSafeNumber(selectedVariant?.price, 0);
  const variantSalePrice = toSafeNumber(selectedVariant?.salePrice, 0);
  const productBasePrice = toSafeNumber(product?.price, 0);
  const productSalePrice = toSafeNumber(product?.salePrice, 0);
  const currentPrice =
    variantSalePrice > 0
      ? variantSalePrice
      : variantBasePrice > 0
        ? variantBasePrice
        : productSalePrice > 0
          ? productSalePrice
          : productBasePrice;
  const originalPrice =
    variantBasePrice > 0
      ? variantBasePrice
      : toPositiveNumber(product?.originalPrice, 0) || productBasePrice;
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
  const normalizedSku = String(
    selectedVariant?.sku ?? product?.sku ?? product?.skuCode ?? product?.code ?? ""
  ).trim();
  const weightValue = Number(product?.weight);
  const hasWeight = Number.isFinite(weightValue) && weightValue > 0;
  const supportsPreOrder = Boolean(product?.preOrder);
  const preorderDays = Number(product?.preorderDays || 0);
  const categoryHref = categorySlug
    ? `/search?category=${encodeURIComponent(String(categorySlug))}&page=1`
    : null;
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
  const purchaseLabel = purchaseState?.label || (isPurchasable ? "Ready to order" : "Unavailable");
  const purchaseDescription =
    purchaseState?.description ||
    (isPurchasable
      ? "Choose a quantity and add this item to your cart."
      : "This product is not available for checkout right now.");
  const supportPhone = String(
    sellerInfo?.phone ||
      sellerInfo?.whatsapp ||
      product?.store?.phone ||
      ""
  ).trim();
  const tagList = tags.slice(0, 4);
  const ratingText =
    ratingAvg > 0 ? `${ratingAvg.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})` : "No reviews yet";

  return (
    <div className="space-y-5 rounded-[26px] border border-[#ece7df] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex h-8 items-center rounded-full border px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              hasStock
                ? "border-emerald-200 bg-[#f2fbf5] text-[#14925b]"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {hasStock ? `${stockLabel} in stock` : availabilityLabel}
          </span>
          <span className="inline-flex h-8 items-center rounded-full border border-[#ece7df] bg-[#faf8f4] px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {categoryName}
          </span>
          {discountLabel ? (
            <span className="inline-flex h-8 items-center rounded-full border border-[#ffd8cc] bg-[#fff3ee] px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f06522]">
              {discountLabel}
            </span>
          ) : null}
        </div>
        <h1 className="break-words text-[32px] font-extrabold leading-[1.02] tracking-[-0.03em] text-slate-900 sm:text-[42px]">
          {product?.name || "Product"}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-500">
          <RatingStars rating={ratingAvg} className="h-4 w-4" />
          <span className="font-medium text-slate-600">{ratingText}</span>
          {normalizedBrand ? (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-medium text-slate-600">{normalizedBrand}</span>
            </>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3.5">
            <span className="text-[38px] font-extrabold leading-none tracking-[-0.03em] text-slate-900 sm:text-[48px]">
              {formatCurrency(currentPrice)}
            </span>
            {hasDiscount ? (
              <span className="pb-1 text-xl font-medium text-slate-400 line-through">
                {formatCurrency(originalPrice)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {variationGroups.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-[#ece7df] bg-white p-4 sm:p-5">
          {variationGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.label}
                </p>
                <span className="text-xs text-slate-500">
                  {group.options.find((option) => option.selectionKey === selectedOptions[group.id])
                    ?.value ||
                    "-"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const active = selectedOptions[group.id] === option.selectionKey;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelectOption(group.id, option.selectionKey)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        active
                          ? "border-[#e67e00] bg-[#e67e00] text-white"
                          : "border-[#ece7df] bg-white text-slate-700 hover:border-[#e7d5c1] hover:bg-[#faf8f4]"
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

      <div className="space-y-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="grid h-13 w-full grid-cols-3 overflow-hidden rounded-2xl border border-[#dfd6cb] bg-white md:w-[300px]">
            <button
              type="button"
              disabled={!isPurchasable || qty <= 1}
              onClick={onDecreaseQty}
              className="inline-flex items-center justify-center border-r border-[#dfd6cb] text-slate-600 transition hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-4.5 w-4.5" />
            </button>
            <span className="inline-flex items-center justify-center text-lg font-semibold text-slate-900">
              {qty}
            </span>
            <button
              type="button"
              disabled={!isPurchasable || !hasStock || isAtStockLimit}
              onClick={onIncreaseQty}
              className="inline-flex items-center justify-center border-l border-[#dfd6cb] text-slate-600 transition hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>
          <button
            type="button"
            disabled={!isPurchasable || !hasStock || cartLoading || isProductLoading}
            onClick={onAddToCart}
            className="inline-flex h-13 w-full items-center justify-center rounded-2xl bg-[#df7f00] px-8 text-base font-semibold text-white transition hover:bg-[#c96f00] disabled:cursor-not-allowed disabled:bg-slate-300 md:flex-1"
          >
            {isPurchasable ? "Add to Cart" : purchaseLabel}
          </button>
        </div>

        <div className="space-y-3 border-t border-[#efe8de] pt-4">
          <div className="flex flex-wrap items-center gap-2 text-[15px] text-slate-600">
            <span className="font-semibold text-slate-700">Category:</span>
            {categoryHref ? (
              <Link to={categoryHref} className="font-medium text-slate-600 hover:text-slate-900">
                {categoryName}
              </Link>
            ) : (
              <span className="font-medium text-slate-600">{categoryName}</span>
            )}
          </div>
          {tagList.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-[#ece7df] bg-[#f7f5f1] px-3 py-1 text-[13px] font-medium text-slate-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {selectedVariant?.sku || selectedVariant?.barcode ? (
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {selectedVariant?.sku ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  SKU {selectedVariant.sku}
                </span>
              ) : null}
              {selectedVariant?.barcode ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  Barcode {selectedVariant.barcode}
                </span>
              ) : null}
            </div>
          ) : null}
          {supportPhone ? (
            <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-600">
              <PhoneCall className="h-4 w-4 text-slate-400" />
              <span>Call Us for Order</span>
              <span className="font-semibold text-emerald-600">{supportPhone}</span>
            </div>
          ) : null}
        </div>

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
  const relatedShelfRef = useRef(null);

  const {
    data: productData,
    isLoading,
    isError,
    error,
    refetch: refetchProduct,
  } = useProduct(slug);
  const product = productData?.data ?? null;
  const productSlugCustomizationQuery = useQuery({
    queryKey: ["store-customization", "product-slug-page", DEFAULT_PRODUCT_SLUG_LANG],
    queryFn: () =>
      getStoreCustomization({
        lang: DEFAULT_PRODUCT_SLUG_LANG,
        include: "product-slug-page",
      }),
    staleTime: 60_000,
    retry: 1,
  });

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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const keyword = (product?.name || "").trim().split(/\s+/)[0] || "";
  const safeKeyword = keyword.length >= 3 ? keyword : "";
  const browseUrl = safeKeyword ? `/search?q=${encodeURIComponent(safeKeyword)}` : "/search";
  const productErrorMessage =
    error?.response?.data?.message ||
    error?.message ||
    GENERIC_ERROR;

  const categoryName = product?.category?.name || "Uncategorized";
  const categorySlug = product?.category?.slug ?? product?.category?.code ?? null;
  const tags = useMemo(
    () =>
      normalizeProductDisplayTags(product?.tags, {
        filterInternal: true,
        maxLength: 32,
      }),
    [product?.tags]
  );
  const ratingAvg = Math.max(0, toSafeNumber(product?.ratingAvg, 0));
  const reviewCount = Math.max(0, Math.round(toSafeNumber(product?.reviewCount, 0)));
  const descriptionText = String(product?.description || "").trim();
  const reviews = useMemo(
    () => normalizeReviews(productData?.data?.reviews ?? product?.reviews ?? []),
    [productData?.data?.reviews, product?.reviews]
  );
  const sellerInfo = productData?.data?.sellerInfo ?? product?.sellerInfo ?? null;
  const purchaseState = product?.purchaseState || null;
  const variationState = useMemo(
    () => normalizePublicProductVariationState(product?.variations),
    [product?.variations]
  );
  const variationGroups = useMemo(
    () => buildPublicProductVariationGroups(product?.variations),
    [product?.variations]
  );
  const selectedVariant = useMemo(
    () => resolvePublicSelectedVariant(product?.variations, selectedOptions),
    [product?.variations, selectedOptions]
  );
  const galleryImages = useMemo(() => {
    const selectedVariantImage = ensureProductImageUrl(selectedVariant?.image || "");
    const productImages = getProductVisibleImageUrls(product)
      .map((value) => ensureProductImageUrl(value))
      .filter(Boolean);
    const combined = [selectedVariantImage, ...productImages].filter(Boolean);
    return Array.from(new Set(combined));
  }, [product, selectedVariant?.image]);
  const activeImageSrc = galleryImages[activeImageIndex] || resolvedImageSrc;
  const selectedVariantPrice = Number(
    selectedVariant?.price ?? product?.price ?? 0
  );
  const selectedVariantSalePrice = Number(
    selectedVariant?.salePrice ?? selectedVariant?.price ?? product?.salePrice ?? product?.price ?? 0
  );
  const selectedVariantStockValue = Number(
    selectedVariant?.quantity ?? product?.stock
  );
  const selectedVariantHasFiniteStock = Number.isFinite(selectedVariantStockValue);
  const selectedVariantHasStock = selectedVariantHasFiniteStock ? selectedVariantStockValue > 0 : true;
  const isPurchasable =
    typeof purchaseState?.isPurchasable === "boolean"
      ? purchaseState.isPurchasable && (!variationState.hasVariants || Boolean(selectedVariant)) && selectedVariantHasStock
      : (!variationState.hasVariants || Boolean(selectedVariant)) && selectedVariantHasStock;
  const productRightBox = useMemo(() => {
    const customizationRaw =
      productSlugCustomizationQuery.data?.customization?.productSlugPage?.rightBox;
    if (customizationRaw && typeof customizationRaw === "object") {
      return normalizeProductRightBox(customizationRaw);
    }
    return normalizeProductRightBox({
      enabled: true,
      descriptions: DEFAULT_RIGHT_BOX_DESCRIPTIONS,
    });
  }, [productSlugCustomizationQuery.data]);
  const shouldRenderProductRightBox =
    productRightBox.enabled && productRightBox.items.length > 0;

  useEffect(() => {
    setActiveImageIndex(0);
  }, [galleryImages]);

  useEffect(() => {
    if (galleryImages.length <= 1 || isImageLightboxOpen) return undefined;

    const timer = window.setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % galleryImages.length);
    }, 15000);

    return () => window.clearInterval(timer);
  }, [galleryImages.length, isImageLightboxOpen]);

  useEffect(() => {
    if (!selectedVariantHasFiniteStock) return;
    if (selectedVariantStockValue <= 0) {
      setQty(1);
      return;
    }
    setQty((prev) => Math.min(Math.max(1, prev), selectedVariantStockValue));
  }, [selectedVariantHasFiniteStock, selectedVariantStockValue]);

  useEffect(() => {
    if (variationGroups.length === 0) {
      setSelectedOptions({});
      return;
    }
    setSelectedOptions((prev) => {
      const next = {};
      variationGroups.forEach((group) => {
        const existing = prev[group.id];
        const hasExisting = group.options.some((option) => option.selectionKey === existing);
        next[group.id] = hasExisting ? existing : group.options[0]?.selectionKey ?? "";
      });
      return next;
    });
  }, [variationGroups]);

  const handleAddMainProduct = () => {
    if (!isPurchasable || (selectedVariantHasFiniteStock && selectedVariantStockValue <= 0)) return;
    add(product.id, qty, {
      name: product?.name || product?.title,
      price: selectedVariantSalePrice,
      imageUrl: selectedVariant?.image || activeImageSrc,
      variantKey: selectedVariant?.combinationKey || null,
      variantLabel: selectedVariant?.combination || null,
      variantSelections: selectedVariant?.selections || [],
      variantSku: selectedVariant?.sku || null,
      variantBarcode: selectedVariant?.barcode || null,
      variantPrice: selectedVariantPrice,
      variantSalePrice: selectedVariantSalePrice,
      variantImage: selectedVariant?.image || activeImageSrc || null,
      stock: selectedVariant?.quantity ?? null,
    });
  };

  const scrollRelatedProducts = (direction) => {
    const element = relatedShelfRef.current;
    if (!element) return;
    const scrollAmount = Math.max(element.clientWidth * 0.82, 260) * direction;
    element.scrollBy({ left: scrollAmount, behavior: "smooth" });
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
    <div className="space-y-7 lg:space-y-8">
      <section className="space-y-4">
        <nav className="flex flex-wrap items-center gap-2 pb-0.5 text-sm text-slate-500">
          <Link to="/" className="font-semibold text-slate-800 hover:text-slate-900">
            Home
          </Link>
          <span>&gt;</span>
          {categorySlug ? (
            <Link
              to={`/search?category=${encodeURIComponent(String(categorySlug))}&page=1`}
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

        <div className="rounded-[34px] border border-[#ece7df] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(390px,0.98fr)] lg:items-start lg:gap-7 xl:gap-6">
            <div className="order-1 overflow-hidden rounded-[28px] border border-[#efe8de] bg-[#fcfaf7] p-3.5 sm:p-4">
              <div className="space-y-3">
                <div className="group relative block w-full overflow-hidden rounded-[22px] bg-[#fcfaf7] text-left">
                  <button
                    type="button"
                    onClick={() => {
                      if (galleryImages.length > 0) setIsImageLightboxOpen(true);
                    }}
                    className="block w-full"
                  >
                    <div className="aspect-square min-h-[300px] w-full overflow-hidden lg:min-h-[460px] xl:min-h-[430px] 2xl:min-h-[520px]">
                      <ImageWithFallback
                        src={activeImageSrc}
                        alt={product.name}
                        wrapperClassName="h-full w-full"
                        imageClassName="h-full w-full object-contain p-4 sm:p-5 lg:p-5 xl:p-4 2xl:p-6 transition duration-300 group-hover:scale-[1.02]"
                        iconClassName="h-9 w-9"
                      />
                    </div>
                  </button>
                  {galleryImages.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveImageIndex(
                            (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
                          );
                        }}
                        className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveImageIndex((prev) => (prev + 1) % galleryImages.length);
                        }}
                        className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 shadow-sm">
                        {galleryImages.map((_, index) => (
                          <span
                            key={`gallery-dot-${index}`}
                            className={`h-1.5 w-1.5 rounded-full transition ${
                              index === activeImageIndex ? "bg-[#e68600]" : "bg-slate-300"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
                {galleryImages.length > 1 ? (
                  <div className="grid grid-cols-5 gap-2">
                    {galleryImages.slice(0, 5).map((image, index) => {
                      const active = index === activeImageIndex;
                      return (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          className={`aspect-square overflow-hidden rounded-2xl border bg-white transition ${
                            active
                              ? "border-[#e68600] shadow-[0_0_0_2px_rgba(230,134,0,0.12)]"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          aria-label={`Show product image ${index + 1}`}
                        >
                          <img
                            src={image}
                            alt={`${product.name} ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="order-2 lg:sticky lg:top-24 lg:self-start">
              <ProductSummaryPanel
                product={product}
                variationGroups={variationGroups}
                selectedVariant={selectedVariant}
                qty={qty}
                hasStock={selectedVariantHasStock}
                hasFiniteStock={selectedVariantHasFiniteStock}
                stockValue={selectedVariantStockValue}
                isAtStockLimit={
                  selectedVariantHasFiniteStock ? qty >= selectedVariantStockValue : false
                }
                purchaseState={purchaseState}
                isPurchasable={isPurchasable}
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
                    if (!selectedVariantHasFiniteStock) return prev + 1;
                    return Math.min(selectedVariantStockValue, prev + 1);
                  })
                }
                onAddToCart={handleAddMainProduct}
                categoryName={categoryName}
                categorySlug={categorySlug}
                tags={tags}
                sellerInfo={sellerInfo}
              />
            </aside>
          </div>
        </div>

        <div className="px-1 pt-1">
          <ProductSellerInfoCard sellerInfo={sellerInfo} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-10">
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
              {shouldRenderProductRightBox ? (
                <div
                  id="product-highlights"
                  className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <h3 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
                    Highlights
                  </h3>
                  <ul className="mt-4 space-y-3 text-[15px] text-slate-600">
                    {productRightBox.items.map((item) => (
                      <li key={item.text} className="flex items-start gap-3">
                        <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
          <div className="space-y-3">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden items-center sm:flex">
                <button
                  type="button"
                  onClick={() => scrollRelatedProducts(-1)}
                  className="pointer-events-auto inline-flex h-11 w-11 -translate-x-3 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                  aria-label="Scroll related products left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden items-center sm:flex">
                <button
                  type="button"
                  onClick={() => scrollRelatedProducts(1)}
                  className="pointer-events-auto inline-flex h-11 w-11 translate-x-3 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                  aria-label="Scroll related products right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div
                ref={relatedShelfRef}
                className="flex gap-4 overflow-x-auto px-1 pb-2 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {relatedProducts.map((item) => (
                  <div
                    key={item.id || item.slug}
                    className="w-[220px] shrink-0 snap-start sm:w-[228px] lg:w-[214px] xl:w-[204px]"
                  >
                    <SearchProductCard product={item} variant="grid" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 sm:hidden">
              <button
                type="button"
                onClick={() => scrollRelatedProducts(-1)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => scrollRelatedProducts(1)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </QueryState>
      </section>

      {isImageLightboxOpen && galleryImages.length > 0 ? (
        <ProductImageLightbox
          images={galleryImages}
          activeIndex={activeImageIndex}
          onChangeIndex={setActiveImageIndex}
          onClose={() => setIsImageLightboxOpen(false)}
          productName={product?.name}
        />
      ) : null}
    </div>
  );
}
