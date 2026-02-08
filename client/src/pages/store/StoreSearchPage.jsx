import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CategoryDropdown,
  Pagination,
  ProductCard,
  useCategories,
  useProducts,
} from "../../storefront.jsx";
import QueryState from "../../components/UI/QueryState.jsx";

export default function StoreSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("default");
  const searchInputRef = useRef(null);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || 12));

  useEffect(() => {
    setQuery(searchParams.get("q") ?? searchParams.get("search") ?? "");
    setCategory(searchParams.get("category") ?? "");
    setSort(searchParams.get("sort") ?? "default");
  }, [searchParams]);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    error: categoriesErrorObj,
    refetch: refetchCategories,
  } = useCategories();
  const categories = categoriesData?.data?.items ?? [];

  const {
    data: productsData,
    isLoading: productsLoading,
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
  if (import.meta.env.DEV) {
    console.log("[search] products len", normalizedProducts.length, productsData);
  }
  const meta = productsData?.meta ?? productsData?.data?.meta;

  const updateParams = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next.search !== undefined) {
      if (next.search) {
        params.set("q", next.search);
        params.delete("search");
      } else {
        params.delete("q");
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

  const handleQueryChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    updateParams({ search: value.trim(), page: 1 });
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    updateParams({ category: value || "", page: 1 });
  };

  const handleSortChange = (event) => {
    const value = event.target.value;
    setSort(value);
    updateParams({ sort: value, page: 1 });
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setSort("default");
    updateParams({ search: "", category: "", sort: "default", page: 1 });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const isLoading = productsLoading || categoriesLoading;
  const isError = productsError || categoriesError;
  const error = productsErrorObj || categoriesErrorObj;
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
  const isEmpty = !isLoading && !isError && sortedProducts.length === 0;
  const shouldShowError = isError && !isLoading;

  const resultLabel = useMemo(
    () => (isLoading ? "Results (loading...)" : `Results: ${sortedProducts.length}`),
    [isLoading, sortedProducts.length]
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 space-y-3 border-b border-slate-200 bg-slate-50/80 pb-4 backdrop-blur">
        <h1 className="text-2xl font-semibold">Search products</h1>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
          <input
            type="search"
            value={query}
            onChange={handleQueryChange}
            ref={searchInputRef}
            placeholder="Search by name"
            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <div className="w-full min-w-[160px] shrink-0 md:w-64">
            <CategoryDropdown
              categories={categories}
              value={category}
              onChange={handleCategoryChange}
              isLoading={isLoading}
              inline
            />
          </div>
          <select
            value={sort}
            onChange={handleSortChange}
            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none md:w-48"
          >
            <option value="default">Sort: Default</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A-Z</option>
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Clear
          </button>
          <div className="text-xs text-slate-500 md:ml-auto">{resultLabel}</div>
        </div>
      </div>

      <QueryState
        isLoading={false}
        isError={shouldShowError}
        error={error}
        isEmpty={false}
        onRetry={() => {
          refetchProducts();
          refetchCategories();
        }}
      >
        <div className="space-y-6">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Loading products...
            </div>
          ) : isEmpty ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <div className="text-sm font-semibold text-slate-900">
                No products found
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Try adjusting your search or filters.
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    <ProductCard
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
            </>
          )}
        </div>
      </QueryState>
    </div>
  );
}
