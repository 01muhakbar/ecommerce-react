import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { ProductCard, useProduct, useProducts } from "../../storefront.jsx";
import QueryState from "../../components/UI/QueryState.jsx";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreProductDetailPage() {
  const { slug } = useParams();
  const addItem = useCartStore((state) => state.addItem);
  const [qty, setQty] = useState(1);

  const {
    data: productData,
    isLoading,
    isError,
    error,
  } = useProduct(slug);
  const product = productData?.data ?? null;

  const relatedCategoryId = product?.category?.id ?? product?.categoryId ?? null;
  const numericCategoryId = Number(relatedCategoryId);
  const hasCategoryId = Number.isFinite(numericCategoryId) && numericCategoryId > 0;
  const relatedQuery = useProducts({
    page: 1,
    limit: 40,
  });

  const relatedProducts = useMemo(() => {
    const raw =
      relatedQuery.data?.data?.items ??
      relatedQuery.data?.data ??
      relatedQuery.data?.items ??
      relatedQuery.data ??
      [];
    const items = Array.isArray(raw) ? raw : [];
    const currentId = product?.id;
    const currentSlug = product?.slug;
    const norm = (value) => String(value || "").trim().toLowerCase();
    const targetSlug = norm(product?.category?.slug);
    const cleaned = items.filter(Boolean);
    const withoutCurrent = cleaned.filter((item) => {
      if (currentId && item.id === currentId) return false;
      if (currentSlug && item.slug === currentSlug) return false;
      return true;
    });
    const primary = hasCategoryId
      ? withoutCurrent.filter((item) => {
          const itemCategoryId =
            Number(item?.category?.id ?? item?.categoryId ?? item?.category_id) || null;
          return itemCategoryId === numericCategoryId;
        })
      : targetSlug
        ? withoutCurrent.filter((item) => {
            const itemSlug = norm(
              item?.category?.slug ?? item?.category?.code ?? item?.categorySlug
            );
            return itemSlug && itemSlug === targetSlug;
          })
        : [];
    const baseList = primary.length > 0 ? primary : withoutCurrent;
    return baseList.slice(0, 8);
  }, [
    relatedQuery.data,
    product?.id,
    product?.slug,
    product?.category?.slug,
    numericCategoryId,
    hasCategoryId,
  ]);

  const hasStock = typeof product?.stock === "number" ? product.stock > 0 : true;
  const imageSrc =
    product?.imageUrl || product?.image || product?.thumbnail || null;
  const keyword = (product?.name || "").trim().split(/\s+/)[0] || "";
  const safeKeyword = keyword.length >= 3 ? keyword : "";
  const browseUrl = safeKeyword
    ? `/search?q=${encodeURIComponent(safeKeyword)}`
    : "/search";

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading product...</p>;
  }

  if (isError) {
    const status = error?.response?.status;
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {status === 404 ? "Product not found." : "Failed to load product."}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        Product not found.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex h-80 items-center justify-center rounded-3xl bg-slate-100 text-sm text-slate-400">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={product.name}
              className="h-full w-full rounded-3xl object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-3xl bg-slate-100 text-xs uppercase tracking-[0.4em] text-slate-400">
              Img
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {product.category?.name || "Uncategorized"}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
          <div className="text-xl font-semibold text-slate-900">
            {currency.format(Number(product.salePrice || product.price || 0))}
          </div>
          {product.description ? (
            <p className="text-sm text-slate-600">{product.description}</p>
          ) : null}
          {typeof product.stock === "number" ? (
            <div className="text-sm text-slate-500">
              Stock: {product.stock > 0 ? product.stock : "Out of stock"}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-slate-200">
              <button
                type="button"
                onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1 text-sm"
              >
                -
              </button>
              <span className="px-3 text-sm">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((prev) => prev + 1)}
                className="px-3 py-1 text-sm"
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={!hasStock}
              onClick={() =>
                addItem(
                  {
                    id: product.id,
                    name: product.name,
                    price: Number(product.price || 0),
                    imageUrl: product.imageUrl ?? null,
                  },
                  qty
                )
              }
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Add to cart
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-900">
              Back to home
            </Link>
            <Link to="/cart" className="hover:text-slate-900">
              View cart
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Related products</h2>
            <p className="text-sm text-slate-500">You may also like</p>
          </div>
          <Link to={browseUrl} className="text-sm text-slate-500 hover:text-slate-900">
            Browse more
          </Link>
        </div>
        <QueryState
          isLoading={relatedQuery.isLoading}
          isError={false}
          error={relatedQuery.error}
          isEmpty={!relatedQuery.isLoading && (relatedQuery.isError || relatedProducts.length === 0)}
          emptyTitle="No related products"
          emptyHint="Coba jelajahi produk lainnya."
          onRetry={() => relatedQuery.refetch()}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <Link
              to={browseUrl}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Browse more
            </Link>
          </div>
        </QueryState>
      </section>
    </div>
  );
}
