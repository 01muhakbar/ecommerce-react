import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { Boxes, EyeOff, Package, Search, Store, Tag } from "lucide-react";
import { getSellerProducts } from "../../api/sellerProducts.ts";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

function Badge({ children, tone = "stone" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "sky"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : tone === "rose"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-stone-200 bg-stone-100 text-stone-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, hint, Icon }) {
  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-stone-950">{value}</p>
          {hint ? <p className="mt-2 text-sm leading-6 text-stone-600">{hint}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

export default function SellerCatalogPage() {
  const { storeId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    published: "",
    page: 1,
    limit: 20,
  });

  const productsQuery = useQuery({
    queryKey: ["seller", "products", storeId, filters],
    queryFn: () => getSellerProducts(storeId, filters),
    enabled: Boolean(storeId) && canViewProducts,
    retry: false,
  });

  const productStats = useMemo(() => {
    const items = productsQuery.data?.items || [];
    const publishedCount = items.filter((item) => item.published).length;
    const privateCount = items.length - publishedCount;
    const draftCount = items.filter((item) => item.status === "draft").length;
    return {
      publishedCount,
      privateCount,
      draftCount,
    };
  }, [productsQuery.data]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  if (!canViewProducts) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include catalog visibility.
        </p>
      </section>
    );
  }

  if (productsQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading store products from seller catalog...</p>
      </section>
    );
  }

  if (productsQuery.isError) {
    const statusCode = Number(productsQuery.error?.response?.status || 0);
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {statusCode === 404
            ? "Store not found."
            : productsQuery.error?.response?.data?.message ||
              productsQuery.error?.message ||
              "Failed to load seller products."}
        </p>
      </section>
    );
  }

  const items = productsQuery.data?.items || [];
  const pagination = productsQuery.data?.pagination || { page: 1, limit: 20, total: 0 };
  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 20)));

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#ffffff_40%,#ecfeff_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Seller Catalog
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Read-only product list for this store
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              This seller-scoped list uses <code className="mx-1">Product.storeId</code> as the
              tenant boundary. It can show non-public products owned by the current store without
              changing admin or storefront contracts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="emerald">{sellerContext?.access?.roleCode || "UNKNOWN"}</Badge>
            <Badge tone="sky">{sellerContext?.store?.slug || "store"}</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Visible Rows"
          value={String(pagination.total || 0)}
          hint="Tenant-scoped product rows for this store."
          Icon={Package}
        />
        <StatCard
          label="Published In Page"
          value={String(productStats.publishedCount)}
          hint={`Private/unpublished in page: ${productStats.privateCount}`}
          Icon={Store}
        />
        <StatCard
          label="Draft In Page"
          value={String(productStats.draftCount)}
          hint="Draft products remain visible to seller operators."
          Icon={EyeOff}
        />
      </section>

      <section className={cardClass}>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Keyword
            </span>
            <div className="flex items-center rounded-2xl border border-stone-200 bg-stone-50 px-3">
              <Search className="h-4 w-4 text-stone-400" />
              <input
                value={filters.keyword}
                onChange={(event) => handleFilterChange("keyword", event.target.value)}
                placeholder="Search name, slug, or SKU"
                className="w-full bg-transparent px-3 py-3 text-sm text-stone-900 outline-none"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Publish
            </span>
            <select
              value={filters.published}
              onChange={(event) => handleFilterChange("published", event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none"
            >
              <option value="">All visibility</option>
              <option value="true">Published</option>
              <option value="false">Private</option>
            </select>
          </label>

          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() =>
                setFilters({
                  keyword: "",
                  status: "",
                  published: "",
                  page: 1,
                  limit: 20,
                })
              }
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-950">Store Products</h3>
            <p className="mt-1 text-sm text-stone-500">
              Read-only seller list view. Product detail read lane is now available.
            </p>
          </div>
          <Badge tone="amber">Read-only</Badge>
        </div>

        {items.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200">
            <div className="grid grid-cols-[1.8fr_0.9fr_0.9fr_1fr_1fr_0.8fr] gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              <span>Product</span>
              <span>Status</span>
              <span>Visibility</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Action</span>
            </div>
            <div className="divide-y divide-stone-200 bg-white">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.8fr_0.9fr_0.9fr_1fr_1fr_0.8fr] gap-3 px-4 py-4 text-sm text-stone-700"
                >
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      {item.mediaPreviewUrl ? (
                        <img
                          src={item.mediaPreviewUrl}
                          alt={item.name}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                          <Boxes className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-stone-950">{item.name}</p>
                        <p className="mt-1 truncate text-xs text-stone-500">{item.slug}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.sku ? <Badge tone="stone">SKU {item.sku}</Badge> : null}
                          {item.category?.name ? <Badge tone="sky">{item.category.name}</Badge> : null}
                        </div>
                        <p className="mt-2 text-xs text-stone-500">
                          Updated {formatDateTime(item.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Badge tone={item.status === "active" ? "emerald" : item.status === "draft" ? "amber" : "stone"}>
                      {item.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Badge tone={item.published ? "sky" : "rose"}>
                      {item.visibility?.label || (item.published ? "Published" : "Private")}
                    </Badge>
                    <p className="mt-2 text-xs text-stone-500">
                      {item.visibility?.storefrontVisible
                        ? "Currently visible in storefront filters."
                        : "Not public in storefront right now."}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-950">
                      {formatCurrency(item.pricing?.effectivePrice)}
                    </p>
                    {item.pricing?.salePrice ? (
                      <p className="mt-1 text-xs text-stone-500 line-through">
                        {formatCurrency(item.pricing.price)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-stone-500">Base price</p>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-stone-950">{item.inventory?.stock ?? 0}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.inventory?.inStock ? "In stock" : "Out of stock"}
                    </p>
                  </div>
                  <div className="flex items-start">
                    <Link
                      to={`/seller/stores/${storeId}/catalog/${item.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      View detail
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-stone-950">No products found for this store</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Try widening the filters, or confirm whether this store already has catalog rows.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5">
          <p className="text-sm text-stone-500">
            Page {pagination.page} of {totalPages} · Total rows {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleFilterChange("page", Math.max(1, filters.page - 1))}
              disabled={filters.page <= 1}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("page", Math.min(totalPages, filters.page + 1))}
              disabled={filters.page >= totalPages}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
