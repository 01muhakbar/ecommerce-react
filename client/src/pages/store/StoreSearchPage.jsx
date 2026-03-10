import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Filter, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { Pagination, useCategories, useProducts } from "../../storefront.jsx";
import SearchProductCard from "../../components/store/SearchProductCard.jsx";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
import {
  GENERIC_ERROR,
  UPDATING,
} from "../../constants/uiMessages.js";

export default function StoreSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [category, setCategory] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [sort, setSort] = useState("default");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || 12));

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useCategories();
  const categories = categoriesData?.data?.items ?? [];

  useEffect(() => {
    const nextQuery =
      searchParams.get("q") ?? searchParams.get("query") ?? searchParams.get("search") ?? "";
    const nextCategory = searchParams.get("category") ?? "";
    const nextSort = searchParams.get("sort") ?? "default";
    setQuery(nextQuery);
    setQueryDraft(nextQuery);
    setCategory(nextCategory);
    setCategoryDraft(nextCategory);
    setSort(nextSort);
  }, [searchParams]);

  const activeQuery = query.trim();
  const shouldFetchProducts = Boolean(activeQuery || category);

  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching: productsFetching,
    isError: productsError,
    error: productsErrorObj,
    refetch: refetchProducts,
  } = useProducts({
    q: activeQuery || undefined,
    category: category || undefined,
    page,
    limit,
    enabled: shouldFetchProducts,
    keepPreviousData: false,
  });

  const normalizedProducts = productsData?.data?.items ?? [];
  const meta = productsData?.meta;

  const updateParams = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next.search !== undefined) {
      if (next.search) {
        params.set("q", next.search);
      } else {
        params.delete("q");
      }
      params.delete("query");
      params.delete("search");
    }
    if (next.category !== undefined) {
      if (next.category) {
        params.set("category", next.category);
      } else {
        params.delete("category");
      }
    }
    if (next.page !== undefined) {
      params.set("page", String(next.page));
    }
    if (next.limit !== undefined) {
      params.set("limit", String(next.limit));
    }
    if (next.sort !== undefined) {
      if (next.sort && next.sort !== "default") {
        params.set("sort", next.sort);
      } else {
        params.delete("sort");
      }
    }
    setSearchParams(params, { replace: true });
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    updateParams({
      search: queryDraft.trim(),
      category: categoryDraft,
      page: 1,
    });
    setIsFilterOpen(false);
  };

  const handleSortChange = (event) => {
    const selectedValue = event.target.value;
    const value = selectedValue === "__placeholder" ? "default" : selectedValue;
    setSort(value);
  };

  const clearFilters = () => {
    setQueryDraft("");
    setCategoryDraft("");
    setSort("default");
    updateParams({ search: "", category: "", sort: "default", page: 1 });
    setIsFilterOpen(false);
  };

  const sortedProducts = useMemo(() => normalizedProducts, [normalizedProducts]);

  const hasProducts = sortedProducts.length > 0;
  const isInitialLoading = shouldFetchProducts && productsLoading && !productsData;
  const isRefetching = shouldFetchProducts && productsFetching && !isInitialLoading;
  const isErrorState = shouldFetchProducts && productsError && !hasProducts;
  const showInlineError = shouldFetchProducts && productsError && hasProducts;
  const isEmpty =
    shouldFetchProducts && !isInitialLoading && !isRefetching && !productsError && !hasProducts;
  const isPromptState = !shouldFetchProducts;

  const errorMessage = useMemo(() => {
    const fromResponse = productsErrorObj?.response?.data?.message;
    if (typeof fromResponse === "string" && fromResponse.trim()) {
      return fromResponse.trim();
    }
    const fromError = productsErrorObj?.message;
    if (typeof fromError === "string" && fromError.trim()) {
      return fromError.trim();
    }
    return GENERIC_ERROR;
  }, [productsErrorObj]);

  const totalCount = Number(
    shouldFetchProducts
      ? meta?.total ??
          meta?.totalCount ??
          meta?.count ??
          productsData?.data?.total ??
          normalizedProducts.length
      : 0
  );
  const safeTotalCount = Number.isFinite(totalCount) ? totalCount : normalizedProducts.length;
  const metaPage = Number(meta?.page);
  const metaLimit = Number(meta?.limit);
  const hasPagedMeta =
    Number.isFinite(metaPage) && metaPage > 0 && Number.isFinite(metaLimit) && metaLimit > 0;
  const currentItemsCount = sortedProducts.length;
  const displayStart =
    safeTotalCount > 0
      ? hasPagedMeta
        ? (metaPage - 1) * metaLimit + 1
        : 1
      : 0;
  const displayEnd =
    safeTotalCount > 0
      ? hasPagedMeta
        ? Math.min(safeTotalCount, Math.max(displayStart, displayStart + currentItemsCount - 1))
        : currentItemsCount
      : 0;

  const hasActiveFilter = Boolean(query.trim() || category);
  const activeCategoryLabel = categories.find((item) => {
    const code = String(item?.code || item?.slug || "").trim();
    const slug = String(item?.slug || "").trim();
    return category && (category === code || category === slug);
  })?.name;

  const filterPanel = (
    <form
      onSubmit={handleApplyFilters}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Search
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Search products..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Category
        </p>
        <select
          value={categoryDraft}
          onChange={(event) => setCategoryDraft(event.target.value)}
          disabled={categoriesLoading}
          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
        >
          <option value="">{categoriesLoading ? "Loading categories..." : "All categories"}</option>
          {categories.map((item) => {
            const value = String(item?.code || item?.slug || item?.id || "");
            return (
              <option key={value} value={value}>
                {item?.name || value}
              </option>
            );
          })}
        </select>
        {categoriesError ? (
          <p className="mt-2 text-xs text-rose-600">Category list unavailable right now.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          Reset
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4 px-3 pb-28 sm:px-4 sm:pb-10 lg:px-6 xl:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
              Store Search
            </p>
            <h1 className="text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">
              {activeQuery ? `Search results for "${activeQuery}"` : "Find products quickly"}
            </h1>
            <p className="text-sm text-slate-500">
              {isPromptState ? (
                "Type a keyword or choose a category to start searching."
              ) : (
                <>
                  Found <span className="font-semibold text-slate-800">{safeTotalCount}</span>{" "}
                  items
                  {activeCategoryLabel ? ` in ${activeCategoryLabel}` : ""}
                </>
              )}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300 lg:hidden"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
            {isRefetching ? <UiUpdatingBadge label={UPDATING} /> : null}
          </div>
        </div>

        {hasActiveFilter ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeQuery ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Query: {activeQuery}
              </span>
            ) : null}
            {activeCategoryLabel ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Category: {activeCategoryLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              Filters
            </div>
            {filterPanel}
          </div>
        </aside>

        <div className="space-y-5">
          {isPromptState ? (
            <UiEmptyState
              title="Start your search"
              description="Type product keywords and click Apply to see matching results."
            />
          ) : null}

          {isInitialLoading ? <UiSkeleton variant="grid" /> : null}

          {isErrorState ? (
            <UiErrorState
              title={GENERIC_ERROR}
              message={errorMessage}
              onRetry={refetchProducts}
            />
          ) : null}

          {shouldFetchProducts && !isInitialLoading && !isErrorState ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Search results</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Showing {displayStart}-{displayEnd} of {safeTotalCount} results
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isRefetching ? <UiUpdatingBadge label={UPDATING} /> : null}
                  <select
                    id="search-sort"
                    value={sort}
                    onChange={handleSortChange}
                    className="h-10 min-w-[208px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="default">Default sorting</option>
                    <option value="latest">Sort by latest</option>
                    <option value="price_asc">Sort by price: low to high</option>
                    <option value="price_desc">Sort by price: high to low</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          {isEmpty ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center shadow-sm sm:px-6">
              <div className="mx-auto max-w-md space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <SearchX className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">No products found</h3>
                <p className="text-sm leading-6 text-slate-500 sm:text-base">
                  {activeQuery
                    ? `No results for "${activeQuery}". Try a different keyword or remove filters.`
                    : "Try a different keyword or remove filters to discover products."}
                </p>
                <div className="flex flex-col items-center justify-center gap-2 pt-1 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => clearFilters()}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Reset Search
                  </button>
                  <Link
                    to="/"
                    className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {!isPromptState && !isInitialLoading && !isErrorState && !isEmpty ? (
            <div className="space-y-6">
              {showInlineError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:text-sm">
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
              <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {sortedProducts.map((product, index) => (
                  <SearchProductCard
                    key={
                      product?.id ??
                      product?.slug ??
                      `${product?.name || product?.title || "product"}-${index}`
                    }
                    product={product}
                  />
                ))}
              </div>
              <Pagination
                page={meta?.page ?? page}
                total={meta?.total ?? sortedProducts.length}
                limit={meta?.limit ?? limit}
                onPageChange={(nextPage) => updateParams({ page: nextPage })}
              />
            </div>
          ) : null}
        </div>
      </div>

      {isFilterOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsFilterOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close filter panel"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                Filter Products
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
