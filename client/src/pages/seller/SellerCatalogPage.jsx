import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { Boxes, EyeOff, Package, Search, Store, Tag } from "lucide-react";
import { getSellerProducts } from "../../api/sellerProducts.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import {
  sellerFieldClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceFilterBar,
  SellerWorkspacePanel,
  SellerWorkspaceStatePanel,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";

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

const getStatusTone = (status) =>
  status === "active" ? "emerald" : status === "draft" ? "amber" : "stone";

const getVisibilityTone = (visibility) => {
  if (visibility?.storefrontVisible) return "emerald";
  if (visibility?.isPublished) return "amber";
  return "rose";
};

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
    const storefrontReadyCount = items.filter((item) => item.visibility?.storefrontVisible).length;
    const publishedHiddenCount = publishedCount - storefrontReadyCount;
    const draftCount = items.filter((item) => item.status === "draft").length;
    const inactiveCount = items.filter((item) => item.status === "inactive").length;
    return {
      publishedCount,
      privateCount,
      storefrontReadyCount,
      publishedHiddenCount,
      draftCount,
      inactiveCount,
    };
  }, [productsQuery.data]);

  const hasActiveFilters = Boolean(filters.keyword.trim() || filters.status || filters.published);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  if (!canViewProducts) {
    return (
      <SellerWorkspaceStatePanel
        title="Catalog visibility is unavailable"
        description="Your current seller access does not include catalog visibility."
        tone="error"
        Icon={Package}
      />
    );
  }

  if (productsQuery.isLoading) {
    return (
      <SellerWorkspaceStatePanel
        title="Loading seller catalog"
        description="Loading store products from the seller catalog."
        Icon={Package}
      />
    );
  }

  if (productsQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        title="Failed to load seller products"
        description={getSellerRequestErrorMessage(productsQuery.error, {
          permissionMessage:
            "Your current seller access does not include catalog visibility.",
          fallbackMessage: "Failed to load seller products.",
        })}
        tone="error"
        Icon={Package}
      />
    );
  }

  const items = productsQuery.data?.items || [];
  const pagination = productsQuery.data?.pagination || { page: 1, limit: 20, total: 0 };
  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 20)));

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        eyebrow="Seller Catalog"
        title="Read-only product list for this store"
        description={
          <>
            This seller-scoped list uses <code className="mx-1">Product.storeId</code> as the
            tenant boundary. It can show non-public products owned by the current store without
            changing admin or storefront contracts.
          </>
        }
        actions={[
          <SellerWorkspaceBadge key="role" label={sellerContext?.access?.roleCode || "UNKNOWN"} tone="emerald" />,
          <SellerWorkspaceBadge key="store" label={sellerContext?.store?.slug || "store"} tone="sky" />,
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SellerWorkspaceStatCard
          label="Visible Rows"
          value={String(pagination.total || 0)}
          hint="Tenant-scoped product rows for this store."
          Icon={Package}
        />
        <SellerWorkspaceStatCard
          label="Published Flag On"
          value={String(productStats.publishedCount)}
          hint={`Private or unpublished in page: ${productStats.privateCount}`}
          Icon={Store}
          tone="emerald"
        />
        <SellerWorkspaceStatCard
          label="Storefront Ready"
          value={String(productStats.storefrontReadyCount)}
          hint={`Published but still blocked by status: ${productStats.publishedHiddenCount}`}
          Icon={Tag}
          tone="amber"
        />
        <SellerWorkspaceStatCard
          label="Draft / Inactive"
          value={String(productStats.draftCount + productStats.inactiveCount)}
          hint={`Draft: ${productStats.draftCount} · Inactive: ${productStats.inactiveCount}`}
          Icon={EyeOff}
        />
      </section>

      <SellerWorkspaceFilterBar>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Keyword
            </span>
            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={filters.keyword}
                onChange={(event) => handleFilterChange("keyword", event.target.value)}
                placeholder="Search name, slug, or SKU"
                className="w-full bg-transparent px-3 text-sm text-slate-700 outline-none"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
              className={sellerFieldClass}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Publish Flag
            </span>
            <select
              value={filters.published}
              onChange={(event) => handleFilterChange("published", event.target.value)}
              className={sellerFieldClass}
            >
              <option value="">All publish states</option>
              <option value="true">Published flag on</option>
              <option value="false">Published flag off</option>
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
              className={sellerSecondaryButtonClass}
            >
              Clear filters
            </button>
          </div>
        </div>
      </SellerWorkspaceFilterBar>

      <SellerWorkspacePanel className="p-5 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Store Products</h3>
            <p className="mt-1 text-sm text-slate-500">
              Read-only seller list scoped by active store. Status controls storefront eligibility,
              while the publish flag controls whether the product can ever surface publicly.
            </p>
          </div>
          <SellerWorkspaceBadge label="Read-only" tone="amber" />
        </div>

        {items.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.8fr_0.9fr_0.9fr_1fr_1fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Product</span>
              <span>Status</span>
              <span>Visibility</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Action</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.8fr_0.9fr_0.9fr_1fr_1fr_0.8fr] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      {item.mediaPreviewUrl ? (
                        <img
                          src={item.mediaPreviewUrl}
                          alt={item.name}
                          className="h-12 w-12 rounded-xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                          <Boxes className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{item.slug}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.sku ? <SellerWorkspaceBadge label={`SKU ${item.sku}`} /> : null}
                          {item.category?.name ? <SellerWorkspaceBadge label={item.category.name} tone="sky" /> : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Updated {formatDateTime(item.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <SellerWorkspaceBadge
                      label={item.statusMeta?.label || String(item.status || "draft").toUpperCase()}
                      tone={getStatusTone(item.statusMeta?.code || item.status)}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {item.statusMeta?.storefrontEligible
                        ? "Eligible for storefront when publish is on."
                        : "Blocked from storefront until status becomes active."}
                    </p>
                  </div>
                  <div>
                    <SellerWorkspaceBadge
                      label={
                        item.visibility?.publishLabel ||
                        item.visibility?.label ||
                        (item.published ? "Published" : "Private")
                      }
                      tone={getVisibilityTone(item.visibility)}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {item.visibility?.storefrontLabel || "Hidden from storefront"}
                    </p>
                    {item.visibility?.storefrontReason ? (
                      <p className="mt-1 text-xs text-slate-400">{item.visibility.storefrontReason}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatCurrency(item.pricing?.effectivePrice)}
                    </p>
                    {item.pricing?.salePrice ? (
                      <p className="mt-1 text-xs text-slate-500 line-through">
                        {formatCurrency(item.pricing.price)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">Base price</p>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{item.inventory?.stock ?? 0}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.inventory?.inStock ? "In stock" : "Out of stock"}
                    </p>
                  </div>
                  <div className="flex items-start">
                    <Link
                      to={`/seller/stores/${storeId}/catalog/${item.id}`}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
          <div className="mt-5">
            <SellerWorkspaceEmptyState
              title={
                hasActiveFilters
                  ? "No products match the current seller filters"
                  : "No products found for this store"
              }
              description={
                hasActiveFilters
                  ? "Try widening the keyword, status, or publish filters for this store."
                  : "Confirm whether this store already owns product rows in the current workspace."
              }
              icon={<Boxes className="h-5 w-5" />}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {totalPages} · Total rows {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleFilterChange("page", Math.max(1, filters.page - 1))}
              disabled={filters.page <= 1}
              className={sellerSecondaryButtonClass}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("page", Math.min(totalPages, filters.page + 1))}
              disabled={filters.page >= totalPages}
              className={sellerSecondaryButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      </SellerWorkspacePanel>
    </div>
  );
}
