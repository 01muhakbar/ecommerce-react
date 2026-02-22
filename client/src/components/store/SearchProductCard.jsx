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
    <article className="h-full w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
        className="group block w-full text-left focus:outline-none"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-slate-50 p-3">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={productName}
              onError={() => setImageSrc("")}
              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
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

          <span className="absolute bottom-3 left-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
            <Eye className="h-4 w-4" />
          </span>
          <button
            type="button"
            aria-label={`Add ${productName} to cart`}
            onClick={handleAdd}
            disabled={isAdding || isLoading}
            className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAdding ? <span className="text-base">✓</span> : <Plus className="h-5 w-5" />}
          </button>
        </div>

        <div className="space-y-0.5 p-3">
          <h3 className="line-clamp-1 text-sm font-semibold leading-5 text-slate-900">
            {productName}
          </h3>
          <p className="text-xs leading-4 text-amber-500">{"★".repeat(4)}☆ {safeRating}</p>
          <p className="text-sm font-semibold leading-5 text-slate-900">{formatCurrency(price)}</p>
        </div>
      </div>
    </article>
  );
}
