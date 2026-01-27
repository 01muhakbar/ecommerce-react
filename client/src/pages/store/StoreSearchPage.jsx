import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CategoryDropdown,
  Pagination,
  ProductCard,
  useCategories,
  useProducts,
} from "../../storefront.jsx";

export default function StoreSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || 12));

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setCategory(searchParams.get("category") ?? "");
  }, [searchParams]);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useCategories();
  const categories = categoriesData?.data?.items ?? [];

  const {
    data: productsData,
    isLoading: productsLoading,
    isError: productsError,
  } = useProducts({ q: query || undefined, category: category || undefined, page, limit });

  const products = productsData?.data?.items ?? [];
  const meta = productsData?.data?.meta;

  const updateParams = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next.q !== undefined) {
      if (next.q) {
        params.set("q", next.q);
      } else {
        params.delete("q");
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
    setSearchParams(params, { replace: true });
  };

  const handleQueryChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    updateParams({ q: value.trim(), page: 1 });
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    updateParams({ category: value || "", page: 1 });
  };

  const isLoading = productsLoading || categoriesLoading;
  const isError = productsError || categoriesError;

  const resultLabel = useMemo(() => {
    if (meta?.total != null) {
      return `${meta.total} results`;
    }
    return "";
  }, [meta?.total]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Search products</h1>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
          <input
            type="search"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search by name"
            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <div className="w-full md:w-64">
            <CategoryDropdown
              categories={categories}
              value={category}
              onChange={handleCategoryChange}
              isLoading={isLoading}
              inline
            />
          </div>
          <div className="text-xs text-slate-500 md:ml-auto">{resultLabel}</div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading products...</p>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load products.
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          No products found.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination
            page={meta?.page ?? page}
            total={meta?.total ?? products.length}
            limit={meta?.limit ?? limit}
            onPageChange={(nextPage) => updateParams({ page: nextPage })}
          />
        </div>
      )}
    </div>
  );
}