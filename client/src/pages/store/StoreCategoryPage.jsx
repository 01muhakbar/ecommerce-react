import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchStoreProducts } from "../../api/store.service.ts";
import { useCart } from "../../hooks/useCart.ts";
import QueryState from "../../components/UI/QueryState.jsx";
import { formatCurrency } from "../../utils/format.js";
import { resolveProductImageUrl } from "../../utils/productImage.js";
import { useStoreCategories } from "../../hooks/useStoreCategories.ts";
import CategoryAccordion from "../../components/store/CategoryAccordion.jsx";
import { buildCategoryTree } from "../../utils/categoryTree.ts";

export default function StoreCategoryPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const isCategoryListMode = !slug;
  let safeSlug = "";
  if (slug) {
    try {
      safeSlug = decodeURIComponent(slug).trim();
    } catch {
      safeSlug = slug.trim();
    }
  }
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const invalidSlug =
    !safeSlug || safeSlug.includes("<") || safeSlug.includes(">");
  const { add } = useCart();
  const {
    data: categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    error: categoriesErrorObj,
    refetch: refetchCategories,
  } = useStoreCategories();
  const categoryTree = useMemo(() => buildCategoryTree(categories || []), [categories]);

  useEffect(() => {
    if (isCategoryListMode) {
      return;
    }
    if (!safeSlug || invalidSlug) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError("");

    fetchStoreProducts({ category: safeSlug })
      .then((response) => {
        if (!isActive) return;
        setProducts(response.data ?? response?.data?.data ?? []);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Failed to load category products.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [isCategoryListMode, safeSlug, invalidSlug, retryKey]);

  const handleCategoryClick = (category) => {
    const categoryKey = String(category?.code || category?.slug || category?.id || "").trim();
    if (!categoryKey) return;
    navigate(`/search?category=${encodeURIComponent(categoryKey)}`);
  };

  if (isCategoryListMode) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-5 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            Browse categories and jump to filtered products.
          </p>
        </div>

        {categoriesLoading ? (
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="h-[70vh] space-y-2 overflow-y-auto pr-1">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={`category-skeleton-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3"
                >
                  <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ) : categoriesError ? (
          <QueryState
            isLoading={false}
            isError={true}
            error={categoriesErrorObj}
            isEmpty={false}
            onRetry={refetchCategories}
          />
        ) : categoryTree.length === 0 ? (
          <QueryState
            isLoading={false}
            isError={false}
            error={null}
            isEmpty={true}
            emptyTitle="No categories found"
            emptyHint="Please add categories from admin dashboard."
          />
        ) : (
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="border-b border-slate-200 px-1 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Shop by category
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Expand a parent category to view subcategories.
              </p>
            </div>
            <div className="mt-2 h-[68vh] overflow-y-auto">
              <CategoryAccordion
                nodes={categoryTree}
                onSelect={handleCategoryClick}
                defaultExpandedIds={categoryTree.slice(0, 1).map((item) => item.id)}
                className="px-0.5"
              />
            </div>
          </div>
        )}
      </section>
    );
  }

  if (invalidSlug) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Invalid category slug</h1>
        <p className="text-sm text-slate-500">
          Please choose a category from the storefront home.
        </p>
        <Link to="/" className="text-sm font-semibold text-slate-900">
          Back to Store Home
        </Link>
      </section>
    );
  }

  const isEmpty = !isLoading && !error && products.length === 0;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Category: {safeSlug || "Unknown"}</h1>
        <p className="text-sm text-slate-500">Browse products in this category.</p>
      </div>
      <QueryState
        isLoading={isLoading}
        isError={Boolean(error)}
        error={error ? new Error(error) : null}
        isEmpty={isEmpty}
        emptyTitle="Tidak ada produk di kategori ini"
        emptyHint="Coba pilih kategori lain atau kembali ke beranda."
        onRetry={() => setRetryKey((prev) => prev + 1)}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="text-sm font-semibold">{product.name}</div>
              <div className="text-xs text-slate-500">
                {formatCurrency(Number(product.price || 0))}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  add(product.id, 1, {
                    name: product?.name || product?.title,
                    price: product?.salePrice ?? product?.sellingPrice ?? product?.price,
                    imageUrl: resolveProductImageUrl(product),
                  });
                }}
                className="mt-auto self-start rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                Add to cart
              </button>
            </Link>
          ))}
        </div>
      </QueryState>
    </section>
  );
}
