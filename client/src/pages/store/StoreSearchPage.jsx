import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pagination, useProducts } from "../../storefront.jsx";
import SearchProductCard from "../../components/store/SearchProductCard.jsx";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
import {
  GENERIC_ERROR,
  NO_PRODUCTS_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";

export default function StoreSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("default");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || 12));

  useEffect(() => {
    setQuery(
      searchParams.get("q") ?? searchParams.get("query") ?? searchParams.get("search") ?? ""
    );
    setCategory(searchParams.get("category") ?? "");
    setSort(searchParams.get("sort") ?? "default");
  }, [searchParams]);

  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching: productsFetching,
    isError: productsError,
    error: productsErrorObj,
    refetch: refetchProducts,
  } = useProducts({ q: query || undefined, category: category || undefined, page, limit });

  const rawCandidate =
    productsData?.data?.items ??
    productsData?.data ??
    productsData?.items ??
    productsData?.products ??
    productsData ??
    [];
  const normalizedProducts = Array.isArray(rawCandidate) ? rawCandidate : [];
  const meta = productsData?.meta ?? productsData?.data?.meta;

  const updateParams = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next.search !== undefined) {
      if (next.search) {
        params.set("q", next.search);
        params.set("query", next.search);
        params.delete("search");
      } else {
        params.delete("q");
        params.delete("query");
        params.delete("search");
      }
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

  const handleSortChange = (event) => {
    const selectedValue = event.target.value;
    const value = selectedValue === "__placeholder" ? "default" : selectedValue;
    setSort(value);
    updateParams({ sort: value, page: 1 });
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setSort("default");
    updateParams({ search: "", category: "", sort: "default", page: 1 });
  };

  const sortedProducts = useMemo(() => {
    const items = [...normalizedProducts];
    if (sort === "price_asc") {
      return items.sort(
        (a, b) =>
          Number(a?.price ?? a?.salePrice ?? 0) - Number(b?.price ?? b?.salePrice ?? 0)
      );
    }
    if (sort === "price_desc") {
      return items.sort(
        (a, b) =>
          Number(b?.price ?? b?.salePrice ?? 0) - Number(a?.price ?? a?.salePrice ?? 0)
      );
    }
    if (sort === "name_asc") {
      return items.sort((a, b) =>
        String(a?.name ?? a?.title ?? "").localeCompare(String(b?.name ?? b?.title ?? ""))
      );
    }
    return items;
  }, [normalizedProducts, sort]);

  const hasProducts = sortedProducts.length > 0;
  const isInitialLoading = productsLoading && !productsData;
  const isRefetching = productsFetching && !isInitialLoading;
  const isErrorState = productsError && !hasProducts;
  const showInlineError = productsError && hasProducts;
  const isEmpty = !isInitialLoading && !isRefetching && !productsError && !hasProducts;
  const activeQuery = query.trim();

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
    meta?.total ??
      meta?.totalCount ??
      meta?.count ??
      productsData?.data?.total ??
      sortedProducts.length
  );
  const safeTotalCount = Number.isFinite(totalCount) ? totalCount : sortedProducts.length;

  return (
    <div className="space-y-4 px-3 pb-28 sm:px-4 sm:pb-10 lg:px-6">
      <div className="rounded-sm border border-[#F3D4B6] bg-[#FDEEDC] px-3 py-1.5">
        <div className="flex items-center justify-between gap-2 whitespace-nowrap">
          <p className="truncate whitespace-nowrap text-xs font-medium text-slate-700 sm:text-sm">
            Total <span className="font-semibold text-slate-900">{safeTotalCount}</span> Items Found
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {isRefetching ? <UiUpdatingBadge label={UPDATING} /> : null}
            <select
              id="search-sort"
              value={sort === "default" ? "__placeholder" : sort}
              onChange={handleSortChange}
              disabled={isInitialLoading}
              className="h-8 w-36 rounded-sm border border-[#E9CDAA] bg-white px-2 text-xs font-medium text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="__placeholder">Sort By Price</option>
              <option value="default">Default</option>
              <option value="price_asc">Low to High</option>
              <option value="price_desc">High to Low</option>
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
        <UiEmptyState
          title={NO_PRODUCTS_FOUND}
          description={
            activeQuery
              ? `No results for "${activeQuery}".`
              : "Try adjusting your search or filters."
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => clearFilters()}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Clear search
              </button>
              <Link
                to="/"
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Back to Home
              </Link>
            </>
          }
        />
      ) : null}

      {!isInitialLoading && !isErrorState && !isEmpty ? (
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {sortedProducts.map((product, index) => {
              const title = product?.title ?? product?.name ?? "";
              const category =
                product?.category ??
                (product?.categoryName
                  ? { name: product.categoryName }
                  : { name: "Uncategorized" });
              const imageUrl =
                product?.promoImagePath ?? product?.imageUrl ?? product?.image ?? null;
              return (
                <SearchProductCard
                  key={
                    product?.id ??
                    product?.slug ??
                    `${product?.name || product?.title || "product"}-${index}`
                  }
                  product={{
                    ...product,
                    id: product?.id,
                    name: product?.name ?? title,
                    title,
                    price: Number(product?.price ?? product?.salePrice ?? 0),
                    category,
                    imageUrl,
                  }}
                />
              );
            })}
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
  );
}
