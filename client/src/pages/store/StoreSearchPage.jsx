import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Pagination,
  useCategories,
  useProducts,
} from "../../storefront.jsx";
import QueryState from "../../components/UI/QueryState.jsx";
import SearchProductCard from "../../components/store/SearchProductCard.jsx";

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
    isLoading: categoriesLoading,
    isFetching: categoriesFetching,
    isError: categoriesError,
    error: categoriesErrorObj,
    refetch: refetchCategories,
  } = useCategories();
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

  const isLoading = productsLoading || categoriesLoading || productsFetching || categoriesFetching;
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

  const totalCount = Number(
    meta?.total ?? meta?.totalCount ?? meta?.count ?? productsData?.data?.total ?? sortedProducts.length
  );
  const safeTotalCount = Number.isFinite(totalCount) ? totalCount : sortedProducts.length;

  return (
    <div className="space-y-4 px-3 pb-28 sm:px-4 sm:pb-10 lg:px-6">
      <div className="rounded-sm border border-[#F3D4B6] bg-[#FDEEDC] px-3 py-1.5">
        <div className="flex items-center justify-between gap-2 whitespace-nowrap">
          <p className="truncate whitespace-nowrap text-xs font-medium text-slate-700 sm:text-sm">
            Total <span className="font-semibold text-slate-900">{safeTotalCount}</span> Items Found
          </p>
          <div className="shrink-0">
            <select
              id="search-sort"
              value={sort === "default" ? "__placeholder" : sort}
              onChange={handleSortChange}
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

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={isEmpty}
        emptyTitle="No products found"
        emptyHint="Try adjusting your search or filters."
        emptyActionLabel="Clear search"
        onEmptyAction={clearFilters}
        onRetry={() => {
          refetchProducts();
          refetchCategories();
        }}
      >
        <div className="space-y-6">
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
      </QueryState>
    </div>
  );
}
