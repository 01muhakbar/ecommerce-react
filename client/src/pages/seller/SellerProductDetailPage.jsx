import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  ImageIcon,
  Layers3,
  Package,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { getSellerProductDetail } from "../../api/sellerProducts.ts";
import {
  sellerSecondaryButtonClass,
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

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

const getStatusTone = (status) =>
  status === "active" ? "emerald" : status === "draft" ? "amber" : "stone";

const getVisibilityTone = (visibility) => {
  if (visibility?.stateCode === "STOREFRONT_VISIBLE") return "emerald";
  if (visibility?.stateCode === "PUBLISHED_BLOCKED") return "amber";
  return "stone";
};

const getAvailabilityTone = (availability) => {
  if (availability?.stateCode === "PREORDER") return "sky";
  if (availability?.stateCode === "IN_STOCK") return "emerald";
  return "amber";
};

export default function SellerProductDetailPage() {
  const { storeId, productId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");
  const numericProductId = Number(productId);
  const hasValidProductId = Number.isInteger(numericProductId) && numericProductId > 0;

  const productQuery = useQuery({
    queryKey: ["seller", "products", "detail", storeId, productId],
    queryFn: () => getSellerProductDetail(storeId, productId),
    enabled: Boolean(storeId) && hasValidProductId && canViewProducts,
    retry: false,
  });

  const backButton = (
    <Link
      key="back"
      to={`/seller/stores/${storeId}/catalog`}
      className={sellerSecondaryButtonClass}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to catalog
    </Link>
  );

  if (!canViewProducts) {
    return (
      <SellerWorkspaceSectionCard
        title="Catalog visibility is unavailable"
        hint="Your current seller access does not include catalog visibility."
        Icon={ShieldCheck}
      />
    );
  }

  if (!hasValidProductId) {
    return (
      <SellerWorkspaceSectionCard
        title="Seller product detail needs a valid product id"
        hint="Open this page from the catalog list with a valid product row."
        Icon={Package}
        actions={backButton}
      />
    );
  }

  if (productQuery.isLoading) {
    return (
      <SellerWorkspaceSectionCard
        title="Loading seller product detail"
        hint="Fetching the seller-scoped product snapshot for the active store."
        Icon={Package}
        actions={backButton}
      />
    );
  }

  if (productQuery.isError) {
    return (
      <SellerWorkspaceSectionCard
        title="Failed to load seller product detail"
        hint={getSellerRequestErrorMessage(productQuery.error, {
          notFoundMessage: "Product not found for this seller store.",
          forbiddenMessage: "This account cannot access the selected seller workspace.",
          permissionMessage: "Your current seller access does not include catalog visibility.",
          fallbackMessage: "Failed to load seller product detail.",
        })}
        Icon={ShieldCheck}
        actions={backButton}
      />
    );
  }

  const product = productQuery.data;

  if (!product) {
    return (
      <SellerWorkspaceSectionCard
        title="Seller product detail is not available"
        hint="This product row is not available for the current seller store."
        Icon={Package}
        actions={backButton}
      />
    );
  }

  const assignedCategories = Array.isArray(product?.category?.assigned)
    ? product.category.assigned
    : [];
  const imageUrls = Array.isArray(product?.media?.imageUrls) ? product.media.imageUrls : [];
  const contractNotes = Array.isArray(product?.contract?.notes) ? product.contract.notes : [];

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        eyebrow="Seller Product Detail"
        title={product?.name || "Product"}
        description="Seller-scoped detail view using Product.storeId as the tenant boundary. Status comes from Product.status and public visibility follows the existing storefront rule: published plus active."
        actions={[
          backButton,
          <SellerWorkspaceBadge key="mode" label="Read-only" tone="amber" />,
          <SellerWorkspaceBadge
            key="status"
            label={product?.statusMeta?.label || String(product?.status || "draft").toUpperCase()}
            tone={getStatusTone(product?.statusMeta?.code || product?.status)}
          />,
          <SellerWorkspaceBadge
            key="publish"
            label={
              product?.visibility?.sellerLabel ||
              product?.visibility?.publishLabel ||
              product?.visibility?.label ||
              (product?.published ? "Published" : "Private")
            }
            tone={getVisibilityTone(product?.visibility)}
          />,
          <SellerWorkspaceBadge
            key="availability"
            label={product?.availability?.label || "Availability unknown"}
            tone={getAvailabilityTone(product?.availability)}
          />,
        ]}
      >
        <div className="mt-1 flex flex-wrap gap-2">
          {product?.sku ? <SellerWorkspaceBadge label={`SKU ${product.sku}`} tone="stone" /> : null}
          {product?.category?.default?.name ? (
            <SellerWorkspaceBadge label={product.category.default.name} tone="sky" />
          ) : null}
        </div>
      </SellerWorkspaceSectionHeader>

      {contractNotes.length ? (
        <SellerWorkspaceNotice type="info">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">
              Catalog Read Contract
            </p>
            {contractNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </SellerWorkspaceNotice>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SellerWorkspaceDetailItem label="Slug" value={product?.slug} />
        <SellerWorkspaceDetailItem
          label="Updated"
          value={formatDateTime(product?.updatedAt)}
        />
        <SellerWorkspaceDetailItem
          label="Store Scope"
          value={
            product?.ownership?.storeId
              ? `Store #${product.ownership.storeId}`
              : sellerContext?.store?.name ||
                sellerContext?.store?.slug ||
                `Store #${product?.storeId || storeId}`
          }
        />
        <SellerWorkspaceDetailItem
          label="Public State"
          value={product?.visibility?.storefrontLabel || "-"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <SellerWorkspaceSectionCard
            title="Status and Visibility"
            hint="Operational state and public storefront outcome use the same contract as the catalog list."
            Icon={ShieldCheck}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Status"
                value={product?.statusMeta?.label || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Operational Meaning"
                value={product?.statusMeta?.operationalMeaning || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Seller Visibility"
                value={product?.visibility?.sellerLabel || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Storefront State"
                value={product?.visibility?.storefrontLabel || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Storefront Reason"
                value={product?.visibility?.storefrontReason || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Seller Hint"
                value={product?.visibility?.sellerHint || "-"}
              />
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Pricing and Inventory"
            hint="Operational summary only. No edit lane is opened here."
            Icon={Wallet}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Effective Price"
                value={formatCurrency(product?.pricing?.effectivePrice)}
              />
              <SellerWorkspaceDetailItem
                label="Base Price"
                value={formatCurrency(product?.pricing?.price)}
              />
              <SellerWorkspaceDetailItem
                label="Sale Price"
                value={
                  product?.pricing?.salePrice
                    ? formatCurrency(product.pricing.salePrice)
                    : "-"
                }
              />
              <SellerWorkspaceDetailItem
                label="Availability"
                value={product?.availability?.label || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Stock"
                value={
                  String(product?.inventory?.stock ?? product?.availability?.stock ?? 0)
                }
              />
              <SellerWorkspaceDetailItem
                label="Pre-order"
                value={
                  product?.availability?.preOrder
                    ? `Yes${
                        product?.availability?.preorderDays
                          ? ` · ${product.availability.preorderDays} day(s)`
                          : ""
                      }`
                    : "No"
                }
              />
              <SellerWorkspaceDetailItem
                label="Availability Impact"
                value={product?.availability?.storefrontReason || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Publish Flag"
                value={product?.visibility?.publishLabel || "-"}
              />
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Descriptions"
            hint="Read-only text and notes as stored in the existing product representation."
            Icon={FileText}
          >
            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Description
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {product?.descriptions?.description || "No description stored for this product."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Internal Notes
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {product?.descriptions?.notes || "No internal notes stored."}
                </p>
              </div>
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Media"
            hint="Existing media representation only. No upload or mutation lane is opened."
            Icon={ImageIcon}
          >
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <SellerWorkspaceDetailItem
                  label="Promo Image"
                  value={product?.media?.promoImageUrl || "-"}
                />
                <SellerWorkspaceDetailItem
                  label="Video URL"
                  value={product?.media?.videoUrl || "-"}
                />
              </div>
              {imageUrls.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {imageUrls.map((imageUrl) => (
                    <div
                      key={imageUrl}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={imageUrl}
                        alt={product?.name || "Product"}
                        className="h-40 w-full object-cover"
                      />
                      <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
                        {imageUrl}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <SellerWorkspaceEmptyState
                  title="No additional images stored"
                  description="This product does not expose extra media rows in the current seller snapshot."
                  icon={<ImageIcon className="h-5 w-5" />}
                />
              )}
            </div>
          </SellerWorkspaceSectionCard>
        </div>

        <div className="space-y-6">
          <SellerWorkspaceSectionCard
            title="Catalog Metadata"
            hint="Safe seller-facing snapshot from the current product schema."
            Icon={Package}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Primary Category"
                value={product?.category?.primary?.name || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Default Category"
                value={product?.category?.default?.name || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Store Scope"
                value={
                  sellerContext?.store?.name ||
                  sellerContext?.store?.slug ||
                  `Store #${product?.storeId || storeId}`
                }
              />
              <SellerWorkspaceDetailItem
                label="Barcode"
                value={product?.attributes?.barcode || "-"}
              />
              <SellerWorkspaceDetailItem label="GTIN" value={product?.attributes?.gtin || "-"} />
              <SellerWorkspaceDetailItem
                label="Condition"
                value={product?.attributes?.condition || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Parent SKU"
                value={product?.attributes?.parentSku || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Weight"
                value={
                  product?.attributes?.weight ? `${product.attributes.weight}` : "-"
                }
              />
              <SellerWorkspaceDetailItem
                label="Dimensions"
                value={
                  product?.attributes?.dimensions
                    ? [product.attributes.dimensions.length, product.attributes.dimensions.width, product.attributes.dimensions.height]
                        .map((value) => (value ? String(value) : null))
                        .filter(Boolean)
                        .join(" x ") || "-"
                    : "-"
                }
              />
              <SellerWorkspaceDetailItem
                label="Dangerous Product"
                value={product?.attributes?.dangerousProduct ? "Yes" : "No"}
              />
              <SellerWorkspaceDetailItem
                label="YouTube Link"
                value={product?.attributes?.youtubeLink || "-"}
              />
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Assigned Categories
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {assignedCategories.length > 0 ? (
                  assignedCategories.map((category) => (
                    <SellerWorkspaceBadge
                      key={`${category.id}-${category.code || category.name}`}
                      label={category.name}
                      tone="sky"
                    />
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    No assigned categories recorded.
                  </span>
                )}
              </div>
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Variants and Structured Data"
            hint="Existing JSON-based representations are exposed read-only for seller visibility."
            Icon={Layers3}
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Variations
                </p>
                {product?.variations?.hasVariations ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {prettyJson(product.variations.raw)}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No variation data stored.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Wholesale
                </p>
                {product?.wholesale?.hasWholesale ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {prettyJson(product.wholesale.raw)}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No wholesale configuration stored.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tags
                </p>
                {product?.attributes?.tags ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {prettyJson(product.attributes.tags)}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No tag data stored.</p>
                )}
              </div>
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Timestamps"
            hint="Operational timestamps from the current product row."
            Icon={ShieldCheck}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Created At"
                value={formatDateTime(product?.createdAt)}
              />
              <SellerWorkspaceDetailItem
                label="Updated At"
                value={formatDateTime(product?.updatedAt)}
              />
            </div>
            <SellerWorkspaceNotice type="info" className="mt-4">
              This detail page remains read-only. Seller-safe mutation lanes such as stock updates
              are still separate from this snapshot view.
            </SellerWorkspaceNotice>
          </SellerWorkspaceSectionCard>
        </div>
      </section>
    </div>
  );
}
