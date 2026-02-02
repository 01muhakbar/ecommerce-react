import { Link } from "react-router-dom";
import { useCartStore } from "./store/cart.store.ts";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api/axios.ts";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

const getImageSrc = (product) =>
  product?.imageUrl || product?.image || product?.thumbnail || null;

const fetchCategories = async () => {
  const { data } = await api.get("/store/categories");
  const items = Array.isArray(data?.data)
    ? data.data
    : data?.data?.items || [];
  const normalized = {
    ...data,
    data: {
      ...(data?.data && !Array.isArray(data.data) ? data.data : {}),
      items,
    },
  };
  if (process.env.NODE_ENV !== "production" && Array.isArray(data?.data)) {
    console.debug("[storefront] normalized categories response");
  }
  return normalized;
};

const fetchProducts = async ({ q, search, category, page, limit }) => {
  const params = {};
  const keyword = search ?? q;
  if (keyword) params.search = keyword;
  if (category) params.category = category;
  if (page) params.page = page;
  if (limit) {
    params.limit = limit;
    params.pageSize = limit;
  }
  const { data } = await api.get("/store/products", { params });
  const items = Array.isArray(data?.data)
    ? data.data
    : data?.data?.items || [];
  const meta = data?.meta || {};
  const resolvedLimit = meta.pageSize ?? meta.limit ?? limit;
  const normalized = {
    ...data,
    data: {
      ...(data?.data && !Array.isArray(data.data) ? data.data : {}),
      items,
    },
    meta: {
      ...meta,
      page: meta.page ?? page,
      limit: resolvedLimit,
      total: meta.total,
      totalPages: meta.totalPages,
    },
  };
  if (process.env.NODE_ENV !== "production" && Array.isArray(data?.data)) {
    console.debug("[storefront] normalized products response");
  }
  return normalized;
};

const fetchProduct = async (slug) => {
  const { data } = await api.get(`/store/products/${encodeURIComponent(slug)}`);
  return data;
};

export const useCategories = () =>
  useQuery({
    queryKey: ["storefront", "categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 5,
  });

export const useProducts = ({ q, search, category, page, limit }) =>
  useQuery({
    queryKey: [
      "storefront",
      "products",
      search || q || "",
      category || "",
      page || 1,
      limit || 12,
    ],
    queryFn: () => fetchProducts({ q, search, category, page, limit }),
    staleTime: 1000 * 30,
  });

export const useProduct = (slug) =>
  useQuery({
    queryKey: ["storefront", "product", slug],
    queryFn: () => fetchProduct(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 30,
  });

export function CategoryDropdown({
  categories,
  value,
  onChange,
  isLoading,
  mobileOnly,
  inline,
}) {
  const selectedLabel =
    categories.find((item) => item.slug === value)?.name || "All categories";

  if (mobileOnly || inline) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        disabled={isLoading}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
        <span>{selectedLabel}</span>
        <span className="text-xs">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-lg">
        <button
          type="button"
          onClick={() => onChange("")}
          className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100"
        >
          All categories
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.slug)}
            className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100"
          >
            {category.name}
          </button>
        ))}
      </div>
    </details>
  );
}

export function CategoryCard({ category }) {
  return (
    <Link
      to={`/search?category=${encodeURIComponent(category.slug)}`}
      className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
    >
      <div className="text-xs uppercase tracking-[0.15em] text-slate-400">Category</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{category.name}</div>
      <div className="mt-6 text-xs text-slate-500">Explore now →</div>
    </Link>
  );
}

export function ProductCard({ product }) {
  const addItem = useCartStore((state) => state.addItem);
  const imageSrc = getImageSrc(product);
  return (
    <Link
      to={`/product/${product.slug || product.id}`}
      className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex h-36 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="h-full w-full rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-100 text-[11px] uppercase tracking-widest text-slate-400">
            Img
          </div>
        )}
      </div>
      <div className="mt-4 flex-1">
        <div className="text-sm font-semibold text-slate-900">{product.name}</div>
        <div className="mt-1 text-xs text-slate-500">
          {product.category?.name || "Uncategorized"}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          {currency.format(Number(product.price || 0))}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            addItem(
              {
                id: product.id,
                name: product.name,
                price: Number(product.price || 0),
                imageUrl: product.imageUrl ?? null,
              },
              1
            );
          }}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          Add to cart
        </button>
      </div>
    </Link>
  );
}

export function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs"
        disabled={page === 1}
      >
        Prev
      </button>
      {pages.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onPageChange(num)}
          className={`rounded-full px-3 py-1 text-xs ${
            num === page
              ? "bg-slate-900 text-white"
              : "border border-slate-200 text-slate-600"
          }`}
        >
          {num}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs"
        disabled={page === totalPages}
      >
        Next
      </button>
    </div>
  );
}
