import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Store as StoreIcon } from "lucide-react";
import {
  fetchStoreProducts,
  getStoreMicrositeRichAboutBySlug,
  getStorePublicIdentityBySlug,
} from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { normalizePublicStoreIdentity } from "../../utils/storePublicIdentity.ts";
import { UiEmptyState, UiErrorState } from "../../components/ui-states/index.js";
import StoreMicrositeShell, {
  buildStoreMicrositeProductHref,
} from "../../components/store/StoreMicrositeShell.jsx";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

function MicrositeSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="h-24 w-24 animate-pulse rounded-3xl bg-slate-200" />
          <div className="flex-1 space-y-3">
            <div className="h-10 w-56 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`microsite-skeleton-${index}`}
              className="h-28 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      </div>
      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`microsite-product-skeleton-${index}`}
              className="h-72 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MicrositeProductCard({ product }) {
  const productName = toText(product?.name, "Product");
  const productSlug = toText(product?.slug, String(product?.id || ""));
  const imageSrc = resolveAssetUrl(product?.imageUrl);
  const price = Number(product?.price || 0);
  const originalPrice = Number(product?.originalPrice || 0);
  const hasDiscount = originalPrice > price && price > 0;
  const safeUnit = toText(product?.unit, "Available");
  const safeRating =
    Number.isFinite(Number(product?.ratingAvg)) && Number(product?.ratingAvg) > 0
      ? Number(product.ratingAvg).toFixed(1)
      : null;
  const safeReviewCount = Math.max(0, Number(product?.reviewCount || 0));

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <Link
        to={buildStoreMicrositeProductHref(
          product?.storeSlug || "",
          productSlug || String(product?.id || "")
        )}
      >
        <div className="aspect-square overflow-hidden bg-slate-100">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={productName}
              className="h-full w-full object-contain p-6"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
              <StoreIcon className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <p className="line-clamp-2 text-sm font-semibold text-slate-900">{productName}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-base font-bold text-slate-900">{formatCurrency(price)}</p>
            {hasDiscount ? (
              <span className="text-xs text-slate-400 line-through">
                {formatCurrency(originalPrice)}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">{safeUnit}</p>
          {safeRating ? (
            <p className="text-xs text-amber-600">
              {safeRating} rating • {safeReviewCount} review{safeReviewCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export default function StoreMicrositePage() {
  const { slug } = useParams();
  const safeSlug = useMemo(() => toText(slug).toLowerCase(), [slug]);

  const micrositeQuery = useQuery({
    queryKey: ["store-public-identity", "slug", safeSlug],
    queryFn: () => getStorePublicIdentityBySlug(safeSlug),
    enabled: Boolean(safeSlug),
    staleTime: 60_000,
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ["storefront", "products", "store-slug", safeSlug],
    queryFn: () =>
      fetchStoreProducts({
        storeSlug: safeSlug,
        page: 1,
        limit: 12,
      }),
    enabled: Boolean(safeSlug),
    staleTime: 60_000,
    retry: 1,
  });
  const richAboutQuery = useQuery({
    queryKey: ["store-customization", "microsite-rich-about", safeSlug, "en"],
    queryFn: () => getStoreMicrositeRichAboutBySlug(safeSlug, { lang: "en" }),
    enabled: Boolean(safeSlug),
    staleTime: 60_000,
    retry: 1,
  });

  const identity = useMemo(
    () => normalizePublicStoreIdentity(micrositeQuery.data),
    [micrositeQuery.data]
  );
  const richAbout = richAboutQuery.data?.data?.richAbout;
  const aboutTitle = useMemo(
    () => toText(richAbout?.title, "About This Store"),
    [richAbout?.title]
  );
  const aboutDescription = useMemo(() => {
    const primary = toText(richAbout?.body);
    if (primary) return primary;
    return toText(identity.description);
  }, [identity.description, richAbout?.body]);
  const isUsingRichAbout = Boolean(toText(richAbout?.body) || toText(richAbout?.title));
  const storeProducts = productsQuery.data?.data?.items ?? [];
  const isNotFound = micrositeQuery.error?.response?.status === 404;
  const errorMessage =
    micrositeQuery.error?.response?.data?.message ||
    micrositeQuery.error?.message ||
    "Failed to load store microsite.";

  if (!safeSlug) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <UiEmptyState
          title="Store slug is missing."
          description="Use a valid /store/:slug route to open a seller microsite."
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

  if (micrositeQuery.isLoading) {
    return <MicrositeSkeleton />;
  }

  if (isNotFound) {
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

  if (micrositeQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <UiErrorState
          title="Failed to load store microsite."
          message={errorMessage}
          onRetry={() => micrositeQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <StoreMicrositeShell
      identity={identity}
      safeSlug={safeSlug}
      description="Basic identity and public product listing now share the same store shell. Heavy branding and content pages remain intentionally out of scope."
    >
      <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            {isUsingRichAbout ? "Rich About" : "About This Store"}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {aboutTitle || `About ${identity.name || "this store"}`}
          </h2>
          {aboutDescription ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
              <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
                {aboutDescription}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-500">
              This store has not published rich about content yet. If a short store description is
              also unavailable, the microsite stays intentionally empty instead of borrowing the
              global marketplace About page.
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {isUsingRichAbout
              ? "This store-specific about content is resolved from the microsite customization read path."
              : "This section currently falls back to the store profile description until rich about content is provided."}
          </p>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Public Products
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Products from {identity.name || "this store"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Only active and published products from this store are shown here.
              </p>
            </div>
          </div>

          {productsQuery.isLoading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`microsite-products-loading-${index}`}
                  className="h-72 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : productsQuery.isError ? (
            <div className="mt-6">
              <UiErrorState
                title="Failed to load store products."
                message={
                  productsQuery.error?.response?.data?.message ||
                  productsQuery.error?.message ||
                  "Store product listing is temporarily unavailable."
                }
                onRetry={() => productsQuery.refetch()}
              />
            </div>
          ) : storeProducts.length === 0 ? (
            <div className="mt-6">
              <UiEmptyState
                title="No public products yet."
                description="This store is active, but it has not published any public products."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {storeProducts.map((product) => (
                <MicrositeProductCard
                  key={product.id || product.slug}
                  product={{ ...product, storeSlug: identity.slug || safeSlug }}
                />
              ))}
            </div>
          )}
      </section>
    </StoreMicrositeShell>
  );
}
