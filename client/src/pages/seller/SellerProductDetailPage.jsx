import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  EyeOff,
  FileText,
  ImageIcon,
  Layers3,
  Package,
  ShieldCheck,
  Tag,
  Wallet,
} from "lucide-react";
import { getSellerProductDetail } from "../../api/sellerProducts.ts";

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

function SectionCard({ title, hint, Icon, children }) {
  return (
    <section className={cardClass}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-stone-950">{title}</h3>
          {hint ? <p className="mt-1 text-sm text-stone-500">{hint}</p> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
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

const prettyJson = (value) => JSON.stringify(value, null, 2);

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-stone-900">{value || "-"}</p>
    </div>
  );
}

export default function SellerProductDetailPage() {
  const { storeId, productId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");

  const productQuery = useQuery({
    queryKey: ["seller", "products", "detail", storeId, productId],
    queryFn: () => getSellerProductDetail(storeId, productId),
    enabled: Boolean(storeId) && Boolean(productId) && canViewProducts,
    retry: false,
  });

  if (!canViewProducts) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include catalog visibility.
        </p>
      </section>
    );
  }

  if (productQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading seller product detail...</p>
      </section>
    );
  }

  if (productQuery.isError) {
    const statusCode = Number(productQuery.error?.response?.status || 0);
    return (
      <section className={cardClass}>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/seller/stores/${storeId}/catalog`}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to catalog
          </Link>
        </div>
        <p className="mt-5 text-sm text-rose-600">
          {statusCode === 404
            ? "Product not found for this seller store."
            : statusCode === 403
              ? "This account cannot access the selected seller product."
              : productQuery.error?.response?.data?.message ||
                productQuery.error?.message ||
                "Failed to load seller product detail."}
        </p>
      </section>
    );
  }

  const product = productQuery.data;
  const assignedCategories = Array.isArray(product?.category?.assigned)
    ? product.category.assigned
    : [];
  const imageUrls = Array.isArray(product?.media?.imageUrls) ? product.media.imageUrls : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_42%,#eff6ff_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/seller/stores/${storeId}/catalog`}
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to catalog
              </Link>
              <Badge tone="amber">Read-only</Badge>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Seller Product Detail
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-950">{product?.name || "Product"}</h2>
            <p className="mt-2 text-sm text-stone-600">
              Seller-scoped detail view using <code className="mx-1">Product.storeId</code> as the
              tenant boundary. This can show private or draft rows owned by the current store.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={product?.status === "active" ? "emerald" : product?.status === "draft" ? "amber" : "stone"}>
                {String(product?.status || "draft").toUpperCase()}
              </Badge>
              <Badge tone={product?.published ? "sky" : "rose"}>
                {product?.visibility?.label || (product?.published ? "Published" : "Private")}
              </Badge>
              {product?.sku ? <Badge tone="stone">SKU {product.sku}</Badge> : null}
              {product?.category?.default?.name ? <Badge tone="sky">{product.category.default.name}</Badge> : null}
            </div>
          </div>

          <div className="grid gap-3 sm:min-w-[260px]">
            <DetailRow label="Slug" value={product?.slug} />
            <DetailRow label="Updated" value={formatDateTime(product?.updatedAt)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <SectionCard
            title="Pricing and Inventory"
            hint="Operational summary only. No edit lane is opened here."
            Icon={Wallet}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="Effective Price" value={formatCurrency(product?.pricing?.effectivePrice)} />
              <DetailRow label="Base Price" value={formatCurrency(product?.pricing?.price)} />
              <DetailRow
                label="Sale Price"
                value={product?.pricing?.salePrice ? formatCurrency(product.pricing.salePrice) : "-"}
              />
              <DetailRow label="Stock" value={String(product?.inventory?.stock ?? 0)} />
              <DetailRow
                label="Pre-order"
                value={product?.inventory?.preOrder ? `Yes${product?.inventory?.preorderDays ? ` · ${product.inventory.preorderDays} day(s)` : ""}` : "No"}
              />
              <DetailRow
                label="Storefront Visibility"
                value={product?.visibility?.storefrontVisible ? "Visible in storefront filters" : "Not public in storefront"}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Descriptions"
            hint="Read-only text and notes as stored in the existing product representation."
            Icon={FileText}
          >
            <div className="grid gap-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Description</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {product?.descriptions?.description || "No description stored for this product."}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Internal Notes</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {product?.descriptions?.notes || "No internal notes stored."}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Media"
            hint="Existing media representation only. No upload or mutation lane is opened."
            Icon={ImageIcon}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <DetailRow label="Promo Image" value={product?.media?.promoImageUrl || "-"} />
                <DetailRow label="Video URL" value={product?.media?.videoUrl || "-"} />
              </div>
              {imageUrls.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {imageUrls.map((imageUrl) => (
                    <div key={imageUrl} className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                      <img src={imageUrl} alt={product?.name || "Product"} className="h-40 w-full object-cover" />
                      <div className="border-t border-stone-200 px-3 py-2 text-xs text-stone-500">{imageUrl}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                  No additional images stored for this product.
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Catalog Metadata"
            hint="Safe seller-facing snapshot from the current product schema."
            Icon={Package}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="Primary Category" value={product?.category?.primary?.name || "-"} />
              <DetailRow label="Default Category" value={product?.category?.default?.name || "-"} />
              <DetailRow label="Barcode" value={product?.attributes?.barcode || "-"} />
              <DetailRow label="GTIN" value={product?.attributes?.gtin || "-"} />
              <DetailRow label="Condition" value={product?.attributes?.condition || "-"} />
              <DetailRow label="Parent SKU" value={product?.attributes?.parentSku || "-"} />
              <DetailRow label="Weight" value={product?.attributes?.weight ? `${product.attributes.weight}` : "-"} />
              <DetailRow
                label="Dimensions"
                value={
                  product?.attributes?.dimensions
                    ? [product.attributes.dimensions.length, product.attributes.dimensions.width, product.attributes.dimensions.height]
                        .map((value) => (value ? String(value) : null))
                        .filter(Boolean)
                        .join(" × ") || "-"
                    : "-"
                }
              />
              <DetailRow
                label="Dangerous Product"
                value={product?.attributes?.dangerousProduct ? "Yes" : "No"}
              />
              <DetailRow label="YouTube Link" value={product?.attributes?.youtubeLink || "-"} />
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                Assigned Categories
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {assignedCategories.length > 0 ? (
                  assignedCategories.map((category) => (
                    <Badge key={`${category.id}-${category.code || category.name}`} tone="sky">
                      {category.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-stone-500">No assigned categories recorded.</span>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Variants and Structured Data"
            hint="Existing JSON-based representations are exposed read-only for seller visibility."
            Icon={Layers3}
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Variations</p>
                {product?.variations?.hasVariations ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-stone-950/95 p-4 text-xs leading-6 text-stone-100">
                    {prettyJson(product.variations.raw)}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-stone-500">No variation data stored.</p>
                )}
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Wholesale</p>
                {product?.wholesale?.hasWholesale ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-stone-950/95 p-4 text-xs leading-6 text-stone-100">
                    {prettyJson(product.wholesale.raw)}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-stone-500">No wholesale configuration stored.</p>
                )}
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Tags</p>
                {product?.attributes?.tags ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-stone-950/95 p-4 text-xs leading-6 text-stone-100">
                    {prettyJson(product.attributes.tags)}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-stone-500">No tag data stored.</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Timestamps"
            hint="Operational timestamps from the current product row."
            Icon={ShieldCheck}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="Created At" value={formatDateTime(product?.createdAt)} />
              <DetailRow label="Updated At" value={formatDateTime(product?.updatedAt)} />
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
