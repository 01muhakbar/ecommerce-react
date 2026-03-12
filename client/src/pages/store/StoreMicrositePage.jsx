import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowUpDown,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers3,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import {
  fetchStoreProducts,
  getStoreMicrositeRichAboutBySlug,
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

const normalizeCategoryKey = (product) =>
  toText(product?.category?.slug || product?.category?.code || product?.categorySlug).toLowerCase();

const normalizeCategoryName = (product) =>
  toText(product?.category?.name || product?.categoryName, "Uncategorized");

const getDiscountPercent = (product) => {
  const price = toSafeNumber(product?.price, 0);
  const originalPrice = toSafeNumber(product?.originalPrice, 0);
  if (!(originalPrice > price && price > 0)) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};

function MicrositeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-[32px] bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`store-home-skeleton-${index}`} className="h-36 animate-pulse rounded-3xl bg-slate-100" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`store-product-skeleton-${index}`} className="h-80 animate-pulse rounded-3xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description = "", action = null }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[32px]">
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function MicrositeProductCard({ product }) {
  const productName = toText(product?.name, "Product");
  const productSlug = toText(product?.routeSlug || product?.slug);
  const productHref =
    toText(product?.productHref) ||
    (productSlug ? `/product/${encodeURIComponent(productSlug)}` : "");
  const imageSrc = resolveAssetUrl(product?.imageUrl);
  const price = toSafeNumber(product?.price, 0);
  const originalPrice = toSafeNumber(product?.originalPrice, 0);
  const hasDiscount = originalPrice > price && price > 0;
  const discountPercent = getDiscountPercent(product);
  const categoryName = normalizeCategoryName(product);
  const safeRating =
    Number.isFinite(Number(product?.ratingAvg)) && Number(product?.ratingAvg) > 0
      ? Number(product.ratingAvg).toFixed(1)
      : null;
  const safeReviewCount = Math.max(0, Number(product?.reviewCount || 0));

  const isClickable = Boolean(productHref);

  const cardBody = (
    <>
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          {hasDiscount ? (
            <span className="absolute left-4 top-4 z-20 inline-flex h-7 items-center rounded-full bg-rose-500 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm">
              -{discountPercent}%
            </span>
          ) : null}
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={productName}
              className="relative z-0 h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
              <StoreIcon className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5">
              {categoryName}
            </span>
            {safeRating ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-50 px-2.5 text-amber-700">
                <Star className="h-3 w-3 fill-current" />
                {safeRating}
              </span>
            ) : null}
          </div>

          <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-900 transition group-hover:text-emerald-700">
            {productName}
          </p>

          <div className="flex items-end gap-2">
            <p className="text-lg font-bold text-slate-900">{formatCurrency(price)}</p>
            {hasDiscount ? (
              <span className="pb-0.5 text-xs text-slate-400 line-through">
                {formatCurrency(originalPrice)}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {safeReviewCount} review{safeReviewCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <Eye className="h-3.5 w-3.5" />
              View
            </span>
          </div>
        </div>
    </>
  );

  return (
    <article
      className={`relative isolate overflow-hidden rounded-[28px] border border-slate-200 bg-white transition ${
        isClickable
          ? "group hover:z-[1] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          : ""
      }`}
    >
      {isClickable ? (
        <Link to={productHref} className="block h-full cursor-pointer" aria-label={`Open ${productName}`}>
          {cardBody}
        </Link>
      ) : (
        <div className="block h-full">{cardBody}</div>
      )}
    </article>
  );
}

function CategoryRail({
  title = "Categories",
  description = "",
  categories = [],
  totalCount = 0,
  selectedCategory = "all",
  onSelect,
}) {
  const railRef = useRef(null);

  const scrollRail = (direction) => {
    const element = railRef.current;
    if (!element) return;
    const scrollAmount = Math.max(element.clientWidth * 0.72, 220) * direction;
    element.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <section
      id="store-categories"
      className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8"
    >
      <SectionHeader
        eyebrow="Store browse"
        title={title}
        description={description}
        action={
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollRail(-1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="Scroll categories left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollRail(1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="Scroll categories right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="mt-6 space-y-3">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden items-center sm:flex">
            <button
              type="button"
              onClick={() => scrollRail(-1)}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
              aria-label="Previous categories"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden items-center sm:flex">
            <button
              type="button"
              onClick={() => scrollRail(1)}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
              aria-label="Next categories"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={railRef}
            className="flex gap-3 overflow-x-auto px-1 pb-2 pt-1 snap-x snap-mandatory sm:px-14 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => onSelect?.("all")}
              className={`flex h-12 min-w-[184px] shrink-0 snap-start items-center justify-between rounded-[20px] px-4 text-left text-sm font-semibold transition ${
                selectedCategory === "all"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
              }`}
            >
              <span>All Products</span>
              <span className={selectedCategory === "all" ? "text-white/80" : "text-slate-400"}>
                {totalCount}
              </span>
            </button>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => onSelect?.(category.key)}
                className={`flex h-12 min-w-[184px] shrink-0 snap-start items-center justify-between rounded-[20px] px-4 text-left text-sm font-semibold transition ${
                  selectedCategory === category.key
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                }`}
              >
                <span className="line-clamp-1">{category.name}</span>
                <span className={selectedCategory === category.key ? "text-white/80" : "text-slate-400"}>
                  {category.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => scrollRail(-1)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => scrollRail(1)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function ProductShelf({
  shelfId,
  eyebrow,
  title,
  description = "",
  products = [],
  loading = false,
  error = null,
  onRetry = null,
  emptyTitle,
  emptyDescription,
  headerAction = null,
}) {
  const shelfRef = useRef(null);

  const scrollShelf = (direction) => {
    const element = shelfRef.current;
    if (!element) return;
    const scrollAmount = Math.max(element.clientWidth * 0.82, 240) * direction;
    element.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <section
      id={shelfId}
      className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8"
    >
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={headerAction}
      />

      {loading ? (
        <div className="mt-6 flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`${shelfId}-loading-${index}`}
              className="h-72 w-[220px] shrink-0 animate-pulse rounded-[28px] bg-slate-100 xl:w-[204px]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6">
          <UiErrorState
            title="Failed to load store products."
            message={
              error?.response?.data?.message ||
              error?.message ||
              "Store products are temporarily unavailable."
            }
            onRetry={onRetry}
          />
        </div>
      ) : products.length === 0 ? (
        <div className="mt-6">
          <UiEmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden items-center sm:flex">
              <button
                type="button"
                onClick={() => scrollShelf(-1)}
                className="pointer-events-auto inline-flex h-11 w-11 -translate-x-3 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                aria-label={`Scroll ${title} left`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden items-center sm:flex">
              <button
                type="button"
                onClick={() => scrollShelf(1)}
                className="pointer-events-auto inline-flex h-11 w-11 translate-x-3 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                aria-label={`Scroll ${title} right`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={shelfRef}
              className="flex gap-4 overflow-x-auto px-1 pb-2 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {products.map((product) => (
                <div
                  key={`${shelfId}-${product.id || product.slug}`}
                  className="w-[220px] shrink-0 snap-start sm:w-[228px] lg:w-[214px] xl:w-[204px]"
                >
                  <MicrositeProductCard product={product} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => scrollShelf(-1)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => scrollShelf(1)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function StoreMicrositePage() {
  const { slug } = useParams();
  const location = useLocation();
  const safeSlug = useMemo(() => toText(slug).toLowerCase(), [slug]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeHomeSection, setActiveHomeSection] = useState("store-home");
  const productsSectionRef = useRef(null);
  const selectedView = toText(searchParams.get("view"), "home").toLowerCase();
  const catalogMode = selectedView === "products";
  const selectedSort = toText(searchParams.get("sort"), "newest").toLowerCase();
  const activeSearchQuery = toText(
    searchParams.get("q") || searchParams.get("query") || searchParams.get("search")
  );

  const micrositeQuery = useQuery({
    queryKey: ["store-public-identity", "slug", safeSlug],
    queryFn: () => getStorePublicIdentityBySlug(safeSlug),
    enabled: Boolean(safeSlug),
    staleTime: 60_000,
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ["storefront", "products", "store-slug", safeSlug, activeSearchQuery],
    queryFn: () =>
      fetchStoreProducts({
        storeSlug: safeSlug,
        q: activeSearchQuery || undefined,
        page: 1,
        limit: 24,
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
  const effectiveRichAbout = richAboutQuery.data?.data?.effective;
  const aboutTitle = useMemo(
    () => toText(effectiveRichAbout?.title, "About Store"),
    [effectiveRichAbout?.title]
  );
  const aboutDescription = useMemo(() => {
    const primary = toText(effectiveRichAbout?.body);
    if (primary) return primary;
    return toText(identity.description);
  }, [effectiveRichAbout?.body, identity.description]);
  const storeProducts = productsQuery.data?.data?.items ?? [];
  const isNotFound = micrositeQuery.error?.response?.status === 404;
  const errorMessage =
    micrositeQuery.error?.response?.data?.message ||
    micrositeQuery.error?.message ||
    "Failed to load the store page.";

  const categoryOptions = useMemo(() => {
    const map = new Map();
    storeProducts.forEach((product) => {
      const key = normalizeCategoryKey(product);
      const name = normalizeCategoryName(product);
      if (!key) return;
      const existing = map.get(key);
      map.set(key, {
        key,
        name,
        count: (existing?.count || 0) + 1,
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [storeProducts]);

  useEffect(() => {
    const categoryFromQuery = toText(searchParams.get("category"), "all").toLowerCase();
    setSelectedCategory(categoryFromQuery || "all");
  }, [searchParams]);

  useEffect(() => {
    if (selectedCategory === "all") return;
    const exists = categoryOptions.some((category) => category.key === selectedCategory);
    if (!exists) {
      setSelectedCategory("all");
    }
  }, [categoryOptions, selectedCategory]);

  const filteredProducts = useMemo(() => {
    const base =
      selectedCategory === "all"
        ? storeProducts
        : storeProducts.filter((product) => normalizeCategoryKey(product) === selectedCategory);

    const sorted = [...base];
    if (selectedSort === "popular") {
      sorted.sort((a, b) => {
        const reviewDiff = toSafeNumber(b?.reviewCount, 0) - toSafeNumber(a?.reviewCount, 0);
        if (reviewDiff !== 0) return reviewDiff;
        return toSafeNumber(b?.ratingAvg, 0) - toSafeNumber(a?.ratingAvg, 0);
      });
      return sorted;
    }
    if (selectedSort === "top-rated") {
      sorted.sort((a, b) => {
        const ratingDiff = toSafeNumber(b?.ratingAvg, 0) - toSafeNumber(a?.ratingAvg, 0);
        if (ratingDiff !== 0) return ratingDiff;
        return toSafeNumber(b?.reviewCount, 0) - toSafeNumber(a?.reviewCount, 0);
      });
      return sorted;
    }
    if (selectedSort === "price") {
      sorted.sort((a, b) => toSafeNumber(a?.price, 0) - toSafeNumber(b?.price, 0));
      return sorted;
    }
    sorted.sort((a, b) => {
      const dateA = Date.parse(String(a?.updatedAt || "")) || 0;
      const dateB = Date.parse(String(b?.updatedAt || "")) || 0;
      return dateB - dateA;
    });
    return sorted;
  }, [storeProducts, selectedCategory, selectedSort]);

  const topPicks = useMemo(() => {
    return [...storeProducts]
      .sort((a, b) => {
        const ratingDiff = toSafeNumber(b?.ratingAvg, 0) - toSafeNumber(a?.ratingAvg, 0);
        if (ratingDiff !== 0) return ratingDiff;
        const reviewDiff = toSafeNumber(b?.reviewCount, 0) - toSafeNumber(a?.reviewCount, 0);
        if (reviewDiff !== 0) return reviewDiff;
        return toSafeNumber(b?.price, 0) - toSafeNumber(a?.price, 0);
      })
      .slice(0, 6);
  }, [storeProducts]);

  const bestDeals = useMemo(() => {
    return storeProducts
      .filter((product) => getDiscountPercent(product) > 0)
      .sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a))
      .slice(0, 6);
  }, [storeProducts]);

  const updateCatalogSearch = (updates = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "" || value === "all") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!catalogMode || !productsSectionRef.current) return;
    productsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [catalogMode]);

  useEffect(() => {
    if (catalogMode) return undefined;

    const sectionIds = ["store-home", "store-categories", "about-store"];
    const sectionElements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (sectionElements.length === 0) return undefined;

    const initialHash = toText(location.hash).replace(/^#/, "");
    if (initialHash && sectionIds.includes(initialHash)) {
      setActiveHomeSection(initialHash);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) return;

        visibleEntries.sort((a, b) => {
          const topDistanceDiff = Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top);
          if (topDistanceDiff !== 0) return topDistanceDiff;
          return b.intersectionRatio - a.intersectionRatio;
        });

        const nextId = visibleEntries[0]?.target?.id;
        if (!nextId) return;

        setActiveHomeSection((currentId) => {
          if (currentId === nextId) return currentId;
          const nextUrl = `${location.pathname}${location.search}#${nextId}`;
          window.history.replaceState(window.history.state, "", nextUrl);
          return nextId;
        });
      },
      {
        root: null,
        rootMargin: "-18% 0px -58% 0px",
        threshold: [0.15, 0.3, 0.55],
      }
    );

    sectionElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [catalogMode, location.hash, location.pathname, location.search]);

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "popular", label: "Popular" },
    { value: "top-rated", label: "Top Rated" },
    { value: "price", label: "Price" },
  ];
  const selectedCategoryName =
    selectedCategory === "all"
      ? "Products"
      : normalizeCategoryName(
          storeProducts.find((product) => normalizeCategoryKey(product) === selectedCategory)
        );
  const catalogTitle = activeSearchQuery ? "Search Results" : selectedCategoryName;
  const catalogDescription = activeSearchQuery
    ? `${filteredProducts.length} item${filteredProducts.length === 1 ? "" : "s"} for "${activeSearchQuery}"`
    : `${filteredProducts.length} item${filteredProducts.length === 1 ? "" : "s"}`;

  const navItems = useMemo(
    () => [
      {
        label: "Store Home",
        href: `?view=home#store-home`,
        active: !catalogMode && activeHomeSection === "store-home",
      },
      {
        label: "Products",
        href: `?view=products${activeSearchQuery ? `&q=${encodeURIComponent(activeSearchQuery)}` : ""}${
          selectedCategory !== "all" ? `&category=${encodeURIComponent(selectedCategory)}` : ""
        }${
          selectedSort !== "newest" ? `&sort=${encodeURIComponent(selectedSort)}` : ""
        }#store-products`,
        active: catalogMode,
      },
      ...(categoryOptions.length > 0
        ? [
            {
              label: "Categories",
              href: `?view=home#store-categories`,
              active: !catalogMode && activeHomeSection === "store-categories",
            },
          ]
        : []),
      {
        label: "About",
        href: `?view=home#about-store`,
        active: !catalogMode && activeHomeSection === "about-store",
      },
    ],
    [activeHomeSection, activeSearchQuery, categoryOptions.length, catalogMode, selectedCategory, selectedSort]
  );
  if (!safeSlug) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <UiEmptyState
          title="Store slug is missing."
          description="Use a valid /store/:slug route."
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
          description={`We could not find an active store for "${safeSlug}".`}
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
          title="Failed to load store page."
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
      description={toText(identity.description, "Shop public products from this store.")}
      navigationItems={navItems}
    >
      {!catalogMode && categoryOptions.length > 0 ? (
        <CategoryRail
          title="Categories"
          description="Browse the main groups from this store."
          categories={categoryOptions}
          totalCount={storeProducts.length}
          selectedCategory={selectedCategory}
          onSelect={(categoryKey) =>
            updateCatalogSearch({
              view: "products",
              category: categoryKey === "all" ? null : categoryKey,
            })
          }
        />
      ) : null}

      {!catalogMode ? (
        <>
          <ProductShelf
            shelfId="store-top-picks"
            eyebrow="Store shelf"
            title="Top Picks"
            description="Popular products from this store."
            products={topPicks.map((product) => ({ ...product, storeSlug: identity.slug || safeSlug }))}
            loading={productsQuery.isLoading}
            error={productsQuery.isError ? productsQuery.error : null}
            onRetry={() => productsQuery.refetch()}
            emptyTitle="No products yet."
            emptyDescription="This store has not published public products."
            headerAction={
              <Link
                to="?view=products#store-products"
                className="hidden h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex"
              >
                See All
              </Link>
            }
          />

          {bestDeals.length > 0 ? (
            <ProductShelf
              shelfId="store-best-deals"
              eyebrow="Store deals"
              title="Best Deals"
              description="Current discounted products from this store."
              products={bestDeals.map((product) => ({ ...product, storeSlug: identity.slug || safeSlug }))}
              emptyTitle="No deals right now."
              emptyDescription="Discounted products will appear here when available."
              headerAction={
                <span className="inline-flex h-10 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-600">
                  <BadgePercent className="h-4 w-4" />
                  {bestDeals.length} deal{bestDeals.length === 1 ? "" : "s"}
                </span>
              }
            />
          ) : null}

          <section
            id="about-store"
            className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8"
          >
            <SectionHeader
              eyebrow="Store intro"
              title={aboutTitle || "About Store"}
              description="Short public information for this store."
            />
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                {aboutDescription ? (
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
                    {aboutDescription}
                  </p>
                ) : (
                  <p className="text-sm leading-7 text-slate-500">
                    This store has not added an about section yet.
                  </p>
                )}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Layers3 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Store Notes
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      <li>Public products are filtered from active listings only.</li>
                      <li>Store identity follows the public store profile contract.</li>
                      <li>Metrics only appear when a real public source exists.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {catalogMode ? (
        <section
          id="store-products"
          ref={productsSectionRef}
          className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8"
        >
          <SectionHeader
            eyebrow="Catalog"
            title={catalogTitle}
            description={catalogDescription}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-600">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </span>
                {categoryOptions.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => updateCatalogSearch({ view: "products", category: null })}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    See All
                  </button>
                ) : null}
              </div>
            }
          />

          <div className="mt-5 flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateCatalogSearch({ view: "products", sort: option.value })}
                className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition ${
                  selectedSort === option.value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-24 lg:self-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Categories
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => updateCatalogSearch({ view: "products", category: null })}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                    selectedCategory === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>All Products</span>
                  <span className={selectedCategory === "all" ? "text-white/80" : "text-slate-400"}>
                    {storeProducts.length}
                  </span>
                </button>
                {categoryOptions.map((category) => (
                  <button
                    key={`catalog-${category.key}`}
                    type="button"
                    onClick={() => updateCatalogSearch({ view: "products", category: category.key })}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      selectedCategory === category.key
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="line-clamp-1">{category.name}</span>
                    <span
                      className={selectedCategory === category.key ? "text-white/80" : "text-slate-400"}
                    >
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div>
              {filteredProducts.length === 0 ? (
                <UiEmptyState
                  title="No products in this category."
                  description="Pick another category to keep browsing this store."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {filteredProducts.map((product) => (
                    <MicrositeProductCard
                      key={`product-${product.id || product.slug}`}
                      product={{ ...product, storeSlug: identity.slug || safeSlug }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <ProductShelf
          shelfId="store-products"
          eyebrow="Store catalog"
          title="Products"
          description={
            selectedCategory === "all"
              ? "Browse more from this store."
              : "More products from this category."
          }
          products={filteredProducts.map((product) => ({ ...product, storeSlug: identity.slug || safeSlug }))}
          loading={productsQuery.isLoading}
          error={productsQuery.isError ? productsQuery.error : null}
          onRetry={() => productsQuery.refetch()}
          emptyTitle="No products in this category."
          emptyDescription="Pick another category to keep browsing this store."
          headerAction={
            <div className="flex items-center gap-2">
              <span className="hidden h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-600 md:inline-flex">
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </span>
              <Link
                to={`?view=products${selectedCategory !== "all" ? `&category=${encodeURIComponent(selectedCategory)}` : ""}#store-products`}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                See All
              </Link>
            </div>
          }
        />
      )}
    </StoreMicrositeShell>
  );
}
