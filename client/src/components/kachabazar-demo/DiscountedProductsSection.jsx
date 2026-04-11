import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCardKacha from "./ProductCardKacha.jsx";

const DISCOUNTED_PRODUCTS_LIMIT = 10;

const isDiscounted = (product) => {
  const discountPercent = Number(product?.discountPercent || 0);
  const salePrice = Number(product?.salePrice || 0);
  const originalPrice = Number(product?.originalPrice || 0);
  return (
    discountPercent > 0 ||
    (originalPrice > 0 && salePrice > 0 && salePrice < originalPrice)
  );
};

const toProductTimestamp = (product) => {
  const timestamp = Date.parse(
    String(product?.updatedAt || product?.createdAt || product?.publishedAt || "")
  );
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareNewestProducts = (left, right) => {
  const timestampDiff = toProductTimestamp(right) - toProductTimestamp(left);
  if (timestampDiff !== 0) return timestampDiff;
  return Number(right?.id || 0) - Number(left?.id || 0);
};

function ProductSkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5">
      <div className="aspect-square rounded-xl bg-slate-200" />
      <div className="mt-3 h-4 w-4/5 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-1/3 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
    </div>
  );
}

export default function DiscountedProductsSection({
  title = "Latest Discounted Products",
  description = "Don't miss out the latest discounted products from this week.",
  products = [],
  isLoading = false,
  isError = false,
  onRetry,
}) {
  const sliderRef = useRef(null);
  const discountedProducts = useMemo(
    () =>
      (Array.isArray(products) ? products : [])
        .filter(isDiscounted)
        .sort(compareNewestProducts)
        .slice(0, DISCOUNTED_PRODUCTS_LIMIT)
        .map((product) => ({ ...product, variant: "discounted" })),
    [products]
  );

  const scrollSlider = (direction) => {
    const element = sliderRef.current;
    if (!element) return;
    const scrollAmount = Math.max(260, Math.floor(element.clientWidth * 0.86));
    element.scrollBy({
      left: direction === "previous" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="space-y-6">
      <header>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: DISCOUNTED_PRODUCTS_LIMIT }).map((_, index) => (
            <div
              key={`discounted-skeleton-${index}`}
              className="w-[220px] shrink-0 sm:w-[228px] lg:w-[214px] xl:w-[220px]"
            >
              <ProductSkeletonCard />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          <div>Failed to load discounted products.</div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : discountedProducts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No discounted products available right now.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollSlider("previous")}
              aria-label="Show previous discounted products"
              className="absolute left-0 top-1/2 z-20 inline-flex h-10 w-10 -translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-[0_16px_30px_-18px_rgba(15,23,42,0.65)] backdrop-blur transition hover:bg-white hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:h-11 sm:w-11 sm:-translate-x-3"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div
              ref={sliderRef}
              className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-1"
            >
              {discountedProducts.map((product, index) => (
                <div
                  key={`${product?.id ?? product?.slug ?? "discounted"}-${index}`}
                  className="w-[220px] shrink-0 snap-start sm:w-[228px] lg:w-[214px] xl:w-[220px]"
                >
                  <ProductCardKacha product={product} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollSlider("next")}
              aria-label="Show next discounted products"
              className="absolute right-0 top-1/2 z-20 inline-flex h-10 w-10 translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-[0_16px_30px_-18px_rgba(15,23,42,0.65)] backdrop-blur transition hover:bg-white hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:h-11 sm:w-11 sm:translate-x-3"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex justify-center">
            <Link
              to="/search"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              View All Discounted
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
