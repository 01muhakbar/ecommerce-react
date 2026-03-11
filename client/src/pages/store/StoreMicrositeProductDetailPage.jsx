import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ImageIcon, Star } from "lucide-react";
import {
  fetchStoreProductById,
  getStorePublicIdentityBySlug,
} from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { normalizePublicStoreIdentity } from "../../utils/storePublicIdentity.ts";
import { UiEmptyState, UiErrorState } from "../../components/ui-states/index.js";
import StoreMicrositeShell from "../../components/store/StoreMicrositeShell.jsx";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatStockLabel = (stock) => {
  const parsed = Number(stock);
  if (!Number.isFinite(parsed)) return "Availability confirmed on request";
  if (parsed <= 0) return "Out of stock";
  return `${parsed} item${parsed === 1 ? "" : "s"} available`;
};

function MicrositeProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="aspect-square animate-pulse rounded-[32px] bg-slate-200" />
        <div className="space-y-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-12 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function DetailMetaCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-1.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

export default function StoreMicrositeProductDetailPage() {
  const { slug, productSlug } = useParams();
  const safeSlug = useMemo(() => toText(slug).toLowerCase(), [slug]);
  const safeProductSlug = useMemo(() => toText(productSlug), [productSlug]);

  const storeQuery = useQuery({
    queryKey: ["store-public-identity", "slug", safeSlug],
    queryFn: () => getStorePublicIdentityBySlug(safeSlug),
    enabled: Boolean(safeSlug),
    staleTime: 60_000,
    retry: false,
  });
  const productQuery = useQuery({
    queryKey: ["storefront", "product", "microsite", safeSlug, safeProductSlug],
    queryFn: () =>
      fetchStoreProductById(safeProductSlug, {
        storeSlug: safeSlug,
      }),
    enabled: Boolean(safeSlug && safeProductSlug),
    staleTime: 60_000,
    retry: false,
  });

  const store = useMemo(
    () => normalizePublicStoreIdentity(storeQuery.data),
    [storeQuery.data]
  );
  const product = productQuery.data?.data ?? null;
  const productImageSrc = resolveAssetUrl(product?.imageUrl);
  const isStoreNotFound = storeQuery.error?.response?.status === 404;
  const isProductNotFound = productQuery.error?.response?.status === 404;

  if (!safeSlug || !safeProductSlug) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <UiEmptyState
          title="Product route is incomplete."
          description="Use a valid /store/:slug/products/:productSlug route."
          actions={
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Marketplace
            </Link>
          }
        />
      </div>
    );
  }

  if (storeQuery.isLoading || productQuery.isLoading) {
    return <MicrositeProductDetailSkeleton />;
  }

  if (isStoreNotFound) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <UiEmptyState
          title="Store not found."
          description={`We could not find an active store for slug "${safeSlug}".`}
          actions={
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Marketplace
            </Link>
          }
        />
      </div>
    );
  }

  if (storeQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <UiErrorState
          title="Failed to load store context."
          message={
            storeQuery.error?.response?.data?.message ||
            storeQuery.error?.message ||
            "Store context is temporarily unavailable."
          }
          onRetry={() => storeQuery.refetch()}
        />
      </div>
    );
  }

  if (isProductNotFound) {
    return (
      <StoreMicrositeShell
        identity={store}
        safeSlug={safeSlug}
        currentLabel={safeProductSlug}
        compact
        description="This route keeps product detail inside the store context. The requested public product could not be resolved for this store."
      >
        <div className="mx-auto max-w-4xl">
          <UiEmptyState
            title="Product not found in this store."
            description={`We could not find a public product "${safeProductSlug}" inside ${store.name || "this store"}.`}
            actions={
              <Link
                to={`/store/${encodeURIComponent(store.slug || safeSlug)}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Store Microsite
              </Link>
            }
          />
        </div>
      </StoreMicrositeShell>
    );
  }

  if (productQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <UiErrorState
          title="Failed to load store product."
          message={
            productQuery.error?.response?.data?.message ||
            productQuery.error?.message ||
            "Store product detail is temporarily unavailable."
          }
          onRetry={() => productQuery.refetch()}
        />
      </div>
    );
  }

  const currentPrice = toSafeNumber(product?.price, 0);
  const originalPrice = toSafeNumber(product?.originalPrice, 0);
  const hasDiscount = originalPrice > currentPrice && currentPrice > 0;
  const ratingAvg = toSafeNumber(product?.ratingAvg, 0);
  const reviewCount = Math.max(0, Math.round(toSafeNumber(product?.reviewCount, 0)));
  const unit = toText(product?.unit, "Unit not specified");
  const categoryName = toText(product?.category?.name, "Uncategorized");
  const stockLabel = formatStockLabel(product?.stock);
  return (
    <StoreMicrositeShell
      identity={store}
      safeSlug={safeSlug}
      currentLabel={product?.name || safeProductSlug}
      compact
      description="The store identity, breadcrumb, and back path stay consistent while product detail remains isolated from the global product route."
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <div className="aspect-square bg-slate-100">
              {productImageSrc ? (
                <img
                  src={productImageSrc}
                  alt={product?.name || "Product"}
                  className="h-full w-full object-contain p-8"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <ImageIcon className="h-12 w-12" />
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Store Product
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                {product?.name || "Product"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                  {categoryName}
                </span>
                {ratingAvg > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
                    <Star className="h-4 w-4 fill-current" />
                    {ratingAvg.toFixed(1)} • {reviewCount} review{reviewCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Price
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <span className="text-3xl font-bold leading-none text-slate-900 sm:text-[38px]">
                  {formatCurrency(currentPrice)}
                </span>
                {hasDiscount ? (
                  <span className="text-sm text-slate-400 line-through">
                    {formatCurrency(originalPrice)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailMetaCard label="Unit" value={unit} />
              <DetailMetaCard
                label="Availability"
                value={stockLabel}
                tone={toSafeNumber(product?.stock, -1) === 0 ? "default" : "positive"}
              />
            </div>

            {product?.description ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Description
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {product.description}
                </p>
              </div>
            ) : null}
          </section>
      </div>
    </StoreMicrositeShell>
  );
}
