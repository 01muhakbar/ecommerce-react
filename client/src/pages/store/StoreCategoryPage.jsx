import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchStoreProducts } from "../../api/store.service.ts";
import { useCartStore } from "../../store/cart.store.ts";
import QueryState from "../../components/UI/QueryState.jsx";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreCategoryPage() {
  const { slug } = useParams();
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
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
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
  }, [safeSlug, invalidSlug, retryKey]);

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
                {currency.format(Number(product.price || 0))}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  addItem({
                    id: product.id,
                    name: product.name,
                    price: Number(product.price || 0),
                    imageUrl: product.imageUrl ?? null,
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
