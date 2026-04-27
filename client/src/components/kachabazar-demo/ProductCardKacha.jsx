import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, ShoppingCart, Star } from "lucide-react";
import { useCart } from "../../hooks/useCart.ts";
import { formatCurrency } from "../../utils/format.js";
import { resolveProductImageUrl } from "../../utils/productImage.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { productHasVariantSelections } from "../../utils/publicProductVariations.js";
import VariantQuickAddModal from "../store/VariantQuickAddModal.jsx";

const FALLBACK_IMAGE = "/demo/placeholder-product.svg";

function StarRating({ value = 0 }) {
  const rating = Number.isFinite(Number(value)) ? Math.max(0, Math.min(5, Number(value))) : 0;
  const filledStars = Math.floor(rating);

  return (
    <div className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < filledStars;
        return (
          <Star
            key={`rating-star-${index}`}
            className={`h-3.5 w-3.5 ${filled ? "fill-current" : "text-slate-300"}`}
          />
        );
      })}
    </div>
  );
}

export default function ProductCardKacha({ product }) {
  const { add, isLoading } = useCart();
  const resolvedSrc = useMemo(
    () => resolveAssetUrl(resolveProductImageUrl(product)),
    [product]
  );
  const [imageSrc, setImageSrc] = useState(resolvedSrc || FALLBACK_IMAGE);
  const [isAdding, setIsAdding] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const timerRef = useRef(null);

  const productName = product?.name || product?.title || "Product";
  const productSlug = product?.slug || product?.id;
  const price = Number(product?.price || 0);
  const originalPriceValue = Number(product?.originalPrice || 0);
  const salePriceValue = Number(product?.salePrice || 0);
  const hasDiscountByPrice =
    originalPriceValue > 0 &&
    ((salePriceValue > 0 && salePriceValue < originalPriceValue) || price < originalPriceValue);
  const discountPercentValue = Number(product?.discountPercent || 0);
  const discountPercent =
    discountPercentValue > 0
      ? Math.round(discountPercentValue)
      : hasDiscountByPrice && originalPriceValue > 0
      ? Math.round(((originalPriceValue - price) / originalPriceValue) * 100)
      : 0;
  const originalPrice =
    originalPriceValue > 0 ? originalPriceValue : hasDiscountByPrice ? price : null;
  const ratingAvg = Number(product?.ratingAvg || 0);
  const reviewCount = Number(product?.reviewCount || 0);
  const soldCount = Math.max(0, Number(product?.soldCount || 0));
  const variant = String(product?.variant || "default");
  const hasVisibleDiscount = discountPercent > 0 || (originalPriceValue > price && price > 0);
  const showDiscountMeta = variant === "discounted" && hasVisibleDiscount;
  const showStruckPrice = originalPriceValue > price && price > 0;
  const displayRating = ratingAvg > 0 ? ratingAvg.toFixed(1) : "0.0";
  const displayReviewCount = Number.isFinite(reviewCount) ? reviewCount : 0;
  const soldLabel = soldCount > 0 ? `${soldCount} Sold` : null;
  const stockValue = Number(product?.stock);
  const isOutOfStock = Number.isFinite(stockValue) && stockValue <= 0;
  const purchaseState = product?.purchaseState || null;
  const isPurchasable =
    typeof purchaseState?.isPurchasable === "boolean"
      ? purchaseState.isPurchasable
      : !isOutOfStock;
  const purchaseLabel = isPurchasable
    ? null
    : purchaseState?.label || (isOutOfStock ? "Out of stock" : "Unavailable");
  const hasVariants = productHasVariantSelections(product?.variations);

  const handleAdd = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (hasVariants) {
      setIsVariantModalOpen(true);
      return;
    }
    if (isAdding || !product?.id || !isPurchasable) return;
    setIsAdding(true);
    add(product.id, 1, {
      name: productName,
      price,
      imageUrl: imageSrc,
    });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsAdding(false);
    }, 600);
  };

  useEffect(() => {
    setImageSrc(resolvedSrc || FALLBACK_IMAGE);
  }, [resolvedSrc]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)] sm:p-3.5">
      <div className="flex h-full flex-col">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
          <Link to={`/product/${productSlug}`} className="block h-full">
            <img
              src={imageSrc}
              alt={productName}
              onError={() => setImageSrc(FALLBACK_IMAGE)}
              className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.025] sm:p-6"
            />
          </Link>
          {showDiscountMeta ? (
            <span className="absolute left-2.5 top-2.5 inline-flex rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-semibold leading-none text-white">
              {discountPercent}% Off
            </span>
          ) : null}
          <Link
            to={`/product/${productSlug}`}
            aria-label={`View ${productName}`}
            title="View product"
            className="absolute bottom-3 left-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:h-10 sm:w-10"
          >
            <Eye className="h-4.5 w-4.5" />
          </Link>
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              aria-label={
                hasVariants
                  ? "Select variant options"
                  : !isPurchasable
                    ? "Unavailable"
                    : "Add to cart"
              }
              title={
                hasVariants
                  ? "Select variant options"
                  : !isPurchasable
                    ? purchaseLabel || "Unavailable"
                    : "Add to cart"
              }
              disabled={isAdding || isLoading || !isPurchasable}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-70 sm:h-10 sm:w-10"
            >
              {!isPurchasable ? "!" : isAdding ? "✓" : <ShoppingCart className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Link to={`/product/${productSlug}`} className="block">
            <h3 className="line-clamp-2 min-h-[2.75rem] text-[13px] font-medium leading-[1.35rem] text-slate-900 transition group-hover:text-emerald-700 sm:text-sm">
              {productName}
            </h3>
          </Link>
          <div className="flex items-center gap-1 text-[11px] sm:text-xs">
            <StarRating value={ratingAvg} />
            <span className="font-semibold text-slate-600">{displayRating}</span>
            <span className="text-slate-400">({displayReviewCount} reviews)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-bold text-slate-900 sm:text-[15px]">
              {formatCurrency(price)}
            </p>
            {showStruckPrice && originalPrice ? (
              <span className="text-xs text-slate-400 line-through">
                {formatCurrency(originalPrice)}
              </span>
            ) : null}
          </div>
          {soldLabel ? (
            <p className="text-[11px] font-medium text-slate-500">{soldLabel}</p>
          ) : !isPurchasable && purchaseLabel ? (
            <p className="text-[11px] text-slate-500">{purchaseLabel}</p>
          ) : null}
        </div>
      </div>
      <VariantQuickAddModal
        open={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        product={product}
        fallbackImageSrc={imageSrc}
      />
    </article>
  );
}
