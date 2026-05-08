import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  Filter,
  Grid2X2,
  List,
  SearchX,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { Pagination, useCategories, useProducts } from "../../storefront.jsx";
import SearchProductCard from "../../components/store/SearchProductCard.jsx";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/primitives/state/index.js";
import { GENERIC_ERROR, UPDATING } from "../../constants/uiMessages.js";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "highest_rated", label: "Highest Rated" },
  { value: "newest", label: "Newest" },
];

const RATING_OPTIONS = [4, 3, 2, 1];

const toPositiveNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function RatingOption({ value, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-1 text-sm text-slate-600 transition hover:text-emerald-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(checked ? "" : String(value))}
        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span className="inline-flex items-center gap-1 text-amber-400">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={`${value}-${index}`}
            className={`h-3.5 w-3.5 ${
              index < value ? "fill-current text-amber-400" : "text-slate-200"
            }`}
          />
        ))}
      </span>
      <span className="text-slate-500">& up</span>
    </label>
  );
}

function SidebarSection({ title, children }) {
  return (
    <section className="space-y-4 border-b border-slate-200 pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function StoreSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [minPriceDraft, setMinPriceDraft] = useState("");
  const [maxPriceDraft, setMaxPriceDraft] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || 12));
  const query = String(
    searchParams.get("q") ?? searchParams.get("query") ?? searchParams.get("search") ?? ""
  ).trim();
  const category = String(searchParams.get("category") || "").trim();
  const sort = String(searchParams.get("sort") || "featured").trim();
  const minPrice = toPositiveNumber(searchParams.get("minPrice"));
  const maxPrice = toPositiveNumber(searchParams.get("maxPrice"));
  const minRating = toPositiveNumber(searchParams.get("minRating"));

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    error: categoriesErrorObj,
  } = useCategories({ parentsOnly: true });
  const categories = categoriesData?.data?.items ?? [];

  useEffect(() => {
    setMinPriceDraft(minPrice != null ? String(minPrice) : "");
    setMaxPriceDraft(maxPrice != null ? String(maxPrice) : "");
  }, [minPrice, maxPrice]);

  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching: productsFetching,
    isError: productsError,
    error: productsErrorObj,
    refetch: refetchProducts,
  } = useProducts({
    q: query || undefined,
    category: category || undefined,
    minPrice: minPrice ?? undefined,
    maxPrice: maxPrice ?? undefined,
    minRating: minRating ?? undefined,
    sort,
    page,
    limit,
    enabled: true,
    keepPreviousData: true,
  });

  const products = productsData?.data?.items ?? [];
  const meta = productsData?.meta;
  const totalCount = Number(meta?.total ?? products.length);
  const safeTotalCount = Number.isFinite(totalCount) ? totalCount : products.length;
  const isInitialLoading = productsLoading && !productsData;
  const isRefetching = productsFetching && !isInitialLoading;
  const hasProducts = products.length > 0;
  const isErrorState = productsError && !hasProducts;
  const showInlineError = productsError && hasProducts;
  const isEmpty = !isInitialLoading && !productsError && !hasProducts;
  const errorMessage =
    productsErrorObj?.response?.data?.message ||
    productsErrorObj?.message ||
    GENERIC_ERROR;
  const categoriesErrorMessage =
    categoriesErrorObj?.response?.data?.message ||
    categoriesErrorObj?.message ||
    "Category list unavailable right now.";

  const selectedCategory = categories.find((item) => {
    const slug = String(item?.slug || item?.code || "").trim();
    const code = String(item?.code || item?.slug || "").trim();
    return category && (category === slug || category === code);
  });

  const activeFilterCount = [
    Boolean(query),
    Boolean(category),
    minPrice != null,
    maxPrice != null,
    minRating != null && minRating > 0,
    sort !== "featured",
  ].filter(Boolean).length;

  const displayStart = safeTotalCount > 0 ? (page - 1) * limit + 1 : 0;
  const displayEnd =
    safeTotalCount > 0 ? Math.min(safeTotalCount, displayStart + products.length - 1) : 0;

  const updateParams = (next) => {
    const params = new URLSearchParams(searchParams);

    const assign = (key, value) => {
      if (value === undefined) return;
      if (value === null || value === "" || value === false) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    };

    if (next.search !== undefined) {
      assign("q", next.search);
      params.delete("query");
      params.delete("search");
    }

    assign("category", next.category);
    assign("minPrice", next.minPrice);
    assign("maxPrice", next.maxPrice);
    assign("minRating", next.minRating);

    if (next.sort !== undefined) {
      if (!next.sort || next.sort === "featured") {
        params.delete("sort");
      } else {
        params.set("sort", String(next.sort));
      }
    }

    if (next.page !== undefined) {
      params.set("page", String(next.page));
    }

    if (next.limit !== undefined) {
      params.set("limit", String(next.limit));
    }

    setSearchParams(params, { replace: true });
  };

  const handleCategorySelect = (value) => {
    updateParams({
      category: value || "",
      page: 1,
    });
    setIsFilterOpen(false);
  };

  const handleSortChange = (event) => {
    updateParams({
      sort: event.target.value,
      page: 1,
    });
  };

  const handleRatingChange = (value) => {
    updateParams({
      minRating: value || "",
      page: 1,
    });
    setIsFilterOpen(false);
  };

  const applyPriceRange = () => {
    const nextMin = toPositiveNumber(minPriceDraft);
    const nextMax = toPositiveNumber(maxPriceDraft);
    updateParams({
      minPrice: nextMin ?? "",
      maxPrice: nextMax ?? "",
      page: 1,
    });
  };

  const clearAllFilters = () => {
    setMinPriceDraft("");
    setMaxPriceDraft("");
    updateParams({
      search: "",
      category: "",
      minPrice: "",
      maxPrice: "",
      minRating: "",
      sort: "featured",
      page: 1,
    });
    setIsFilterOpen(false);
  };

  const categoryChips = useMemo(
    () => [{ id: "all", name: "All", slug: "" }, ...categories],
    [categories]
  );

  const filterPanel = (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold uppercase tracking-[0.06em] text-slate-900">
            Filters
          </h2>
          <p className="text-xs text-slate-500">
            {activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}` : "Browse by category, price, and rating."}
          </p>
        </div>
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Clear All Filters
          </button>
        ) : null}
      </div>

      <SidebarSection title="Categories">
        {categoriesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`category-skeleton-${index}`}
                className="h-9 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : categoriesError ? (
          <p className="text-sm text-rose-600">{categoriesErrorMessage}</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {categories.map((item) => {
              const value = String(item?.slug || item?.code || item?.id || "");
              const isActive = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleCategorySelect(isActive ? "" : value)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    isActive
                      ? "bg-emerald-50 font-semibold text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="line-clamp-1">{item?.name || value}</span>
                  {isActive ? <span className="text-xs">Selected</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Price Range">
        <div className="grid grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-2">
          <input
            type="number"
            min="0"
            value={minPriceDraft}
            onChange={(event) => setMinPriceDraft(event.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyPriceRange();
              }
            }}
            placeholder="0"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
          <span className="text-center text-sm text-slate-400">to</span>
          <input
            type="number"
            min="0"
            value={maxPriceDraft}
            onChange={(event) => setMaxPriceDraft(event.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyPriceRange();
              }
            }}
            placeholder="1000"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Rating">
        <div className="space-y-1">
          {RATING_OPTIONS.map((value) => (
            <RatingOption
              key={`rating-${value}`}
              value={value}
              checked={Number(minRating || 0) === value}
              onChange={handleRatingChange}
            />
          ))}
        </div>
      </SidebarSection>

      <button
        type="button"
        onClick={clearAllFilters}
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Clear All Filters
      </button>
    </div>
  );

  return (
    <div className="space-y-6 px-4 pb-24 pt-4 sm:px-5 lg:px-6 xl:px-8">
      <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7 sm:py-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">All Products</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-emerald-600">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <span className="font-medium text-slate-900">Search</span>
          </div>
          {query ? (
            <p className="text-sm text-slate-500">
              Current keyword: <span className="font-semibold text-slate-700">{query}</span>
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1">
        {categoryChips.map((item) => {
          const value = String(item?.slug || item?.code || item?.id || "");
          const isActive = (!value && !category) || category === value;
          return (
            <button
              key={`chip-${value || "all"}`}
              type="button"
              onClick={() => handleCategorySelect(value)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                  : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
              }`}
            >
              <span>{item?.name || "All"}</span>
            </button>
          );
        })}
      </section>

      <section className="lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="hidden lg:sticky lg:top-24 lg:block">{filterPanel}</aside>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      viewMode === "grid"
                        ? "bg-emerald-50 text-emerald-600"
                        : "text-slate-400 hover:bg-white hover:text-slate-600"
                    }`}
                    aria-label="Grid view"
                    aria-pressed={viewMode === "grid"}
                  >
                    <Grid2X2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      viewMode === "list"
                        ? "bg-emerald-50 text-emerald-600"
                        : "text-slate-400 hover:bg-white hover:text-slate-600"
                    }`}
                    aria-label="List view"
                    aria-pressed={viewMode === "list"}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">{safeTotalCount}</span> results
                </div>
                {isRefetching ? <UiUpdatingBadge label={UPDATING} /> : null}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300 lg:hidden"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="search-sort" className="text-sm text-slate-500">
                  Sort by:
                </label>
                <select
                  id="search-sort"
                  value={sort}
                  onChange={handleSortChange}
                  className="h-12 min-w-[210px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isInitialLoading ? <UiSkeleton variant="grid" /> : null}

          {isErrorState ? (
            <UiErrorState
              title={GENERIC_ERROR}
              message={errorMessage}
              onRetry={refetchProducts}
            />
          ) : null}

          {isEmpty ? (
            <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto max-w-xl space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <SearchX className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-semibold text-slate-900">No products found</h2>
                <p className="text-base leading-7 text-slate-500">
                  Try adjusting your search or filter to find what you're looking for.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          ) : null}

          {!isInitialLoading && !isErrorState && hasProducts ? (
            <div className="space-y-6">
              {showInlineError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Could not refresh results. Showing previous data.
                  <button
                    type="button"
                    onClick={() => refetchProducts()}
                    className="ml-2 font-semibold underline underline-offset-2"
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-slate-900">Search results</h2>
                    <p className="text-sm text-slate-500">
                      Showing {displayStart}-{displayEnd} of {safeTotalCount} products
                      {selectedCategory ? (
                        <>
                          {" "}
                          in <span className="font-semibold text-slate-700">{selectedCategory.name}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div
                  className={`grid gap-3.5 sm:gap-4 ${
                    viewMode === "list"
                      ? "grid-cols-1"
                      : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                  }`}
                >
                  {products.map((product, index) => (
                    <SearchProductCard
                      key={
                        product?.id ??
                        product?.slug ??
                        `${product?.name || product?.title || "product"}-${index}`
                      }
                      product={product}
                      variant={viewMode}
                    />
                  ))}
                </div>
              </div>

              <Pagination
                page={meta?.page ?? page}
                total={meta?.total ?? products.length}
                limit={meta?.limit ?? limit}
                onPageChange={(nextPage) => updateParams({ page: nextPage })}
              />
            </div>
          ) : null}
        </div>
      </section>

      {isFilterOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsFilterOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close filter panel"
          />
          <div className="absolute left-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                Filters
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      ) : null}
    </div>
  );
}
