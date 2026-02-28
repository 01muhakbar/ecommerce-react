import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../hooks/useCart.ts";
import { formatCurrency } from "../../utils/format.js";
import { resolveProductImageUrl } from "../../utils/productImage.js";

export default function SearchProductCard({ product }) {
  const navigate = useNavigate();
  const { add, isLoading } = useCart();
  const resolvedImage = useMemo(() => resolveProductImageUrl(product), [product]);
  const [imageSrc, setImageSrc] = useState(resolvedImage);
  const [isAdding, setIsAdding] = useState(false);
  const timerRef = useRef(null);

  const productId = product?.id ?? product?.slug;
  const productName = product?.name || product?.title || "Product";
  const ratingValue = Number(product?.rating ?? product?.averageRating ?? 0);
  const safeRating = Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue : 4.5;
  const price = Number(product?.price ?? product?.salePrice ?? 0);
  const originalPrice = Number(product?.originalPrice ?? 0);
  const discountPercent = Number(product?.discountPercent ?? 0);
  const hasDiscount = discountPercent > 0 || (originalPrice > price && price > 0);

  useEffect(() => {
    setImageSrc(resolvedImage);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resolvedImage]);

  const openProduct = () => {
    if (!productId) return;
    navigate(`/product/${productId}`);
  };

  const handleAdd = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isAdding) return;
    setIsAdding(true);
    add(product?.id, 1, {
      name: product?.name || product?.title,
      price: product?.price,
      imageUrl: imageSrc,
    });
    timerRef.current = setTimeout(() => {
      setIsAdding(false);
    }, 650);
  };

  return (
    <article className="h-full w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)] sm:p-3.5">
      <div
        role="button"
        tabIndex={0}
        onClick={openProduct}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProduct();
          }
        }}
        className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 p-4 sm:p-5">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={productName}
              onError={() => setImageSrc("")}
              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.025]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M7 14l3-3 4 4 3-3 2 2" />
              </svg>
            </div>
          )}
          {hasDiscount ? (
            <span className="absolute left-2.5 top-2.5 inline-flex rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-semibold leading-none text-white">
              {discountPercent > 0 ? `${Math.round(discountPercent)}% Off` : "Deal"}
            </span>
          ) : null}

          <span className="absolute bottom-3 left-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm sm:h-9 sm:w-9">
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
          <button
            type="button"
            aria-label={`Add ${productName} to cart`}
            onClick={handleAdd}
            disabled={isAdding || isLoading}
            className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:w-10"
          >
            {isAdding ? <span className="text-base">✓</span> : <Plus className="h-4.5 w-4.5 sm:h-5 sm:w-5" />}
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-[13px] font-medium leading-[1.35rem] text-slate-900 sm:text-sm">
            {productName}
          </h3>
          <p className="text-[11px] leading-4 text-amber-500 sm:text-xs">
            {"★".repeat(4)}☆ <span className="font-semibold">{safeRating}</span>
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-bold leading-5 text-slate-900">{formatCurrency(price)}</p>
            {originalPrice > price && price > 0 ? (
              <span className="text-xs text-slate-400 line-through">
                {formatCurrency(originalPrice)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
