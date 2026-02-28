import { Link } from "react-router-dom";
import ProductCardKacha from "./ProductCardKacha.jsx";

const isDiscounted = (product) => {
  const discountPercent = Number(product?.discountPercent || 0);
  const salePrice = Number(product?.salePrice || 0);
  const originalPrice = Number(product?.originalPrice || 0);
  return (
    discountPercent > 0 ||
    (originalPrice > 0 && salePrice > 0 && salePrice < originalPrice)
  );
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
  products = [],
  isLoading = false,
  isError = false,
  onRetry,
}) {
  const discountedProducts = (Array.isArray(products) ? products : [])
    .filter(isDiscounted)
    .slice(0, 12)
    .map((product) => ({ ...product, variant: "discounted" }));

  return (
    <section className="space-y-6">
      <header className="text-center">
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Latest Discounted Products
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Don&apos;t miss out the latest discounted products from this week.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <ProductSkeletonCard key={`discounted-skeleton-${index}`} />
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
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {discountedProducts.map((product, index) => (
              <ProductCardKacha
                key={`${product?.id ?? product?.slug ?? "discounted"}-${index}`}
                product={product}
              />
            ))}
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
