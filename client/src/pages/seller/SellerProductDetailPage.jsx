import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Globe2,
  Layers3,
  Package,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  getSellerProductDetail,
  setSellerProductPublished,
  submitSellerProductDraftForReview,
} from "../../api/sellerProducts.ts";
import {
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import SellerProductVariationSummary from "../../components/seller/SellerProductVariationSummary.jsx";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import {
  getProductVisibleImageUrls,
  normalizeProductDisplayTags,
} from "../../utils/productDisplay.js";
import { summarizeProductVariations } from "../../utils/productVariations.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";

const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getStatusTone = (status) =>
  status === "active" ? "emerald" : status === "draft" ? "amber" : "stone";

const getSubmissionTone = (status) =>
  status === "submitted" ? "sky" : status === "needs_revision" ? "amber" : "stone";

const getSubmissionErrorMessage = (error) => {
  const code = String(error?.response?.data?.code || "").trim().toUpperCase();
  const message = String(error?.response?.data?.message || "").trim();

  if (code === "SELLER_PRODUCT_SUBMISSION_DRAFT_REQUIRED") {
    return "Only draft products can be submitted for review.";
  }

  if (code === "SELLER_PRODUCT_ALREADY_SUBMITTED") {
    return "This draft is already waiting in admin review.";
  }

  return (
    message ||
    getSellerRequestErrorMessage(error, {
      permissionMessage:
        "Your current seller access does not include seller draft submission.",
      fallbackMessage: "Failed to submit seller draft for review.",
    })
  );
};

const getSubmissionReason = (submission) =>
  submission?.reviewNote || submission?.revisionReason || submission?.revisionNote || null;

const getPublishErrorMessage = (error) => {
  const code = String(error?.response?.data?.code || "").trim().toUpperCase();
  const message = String(error?.response?.data?.message || "").trim();
  const blockers = Array.isArray(error?.response?.data?.data?.blockers)
    ? error.response.data.data.blockers
    : [];

  if (code === "SELLER_PRODUCT_PUBLISH_NOT_READY" && blockers.length > 0) {
    return blockers.map((entry) => entry?.message).filter(Boolean).join(" ");
  }

  return (
    message ||
    getSellerRequestErrorMessage(error, {
      permissionMessage: "Your current seller access does not include publish control.",
      fallbackMessage: "Failed to update seller product visibility.",
    })
  );
};

export default function SellerProductDetailPage() {
  const queryClient = useQueryClient();
  const { productId } = useParams();
  const {
    sellerContext,
    workspaceStoreId: storeId,
    workspaceRoutes,
  } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");
  const numericProductId = Number(productId);
  const hasValidProductId = Number.isInteger(numericProductId) && numericProductId > 0;
  const [submitStatus, setSubmitStatus] = useState(null);

  const productQuery = useQuery({
    queryKey: ["seller", "products", "detail", storeId, productId],
    queryFn: () => getSellerProductDetail(storeId, productId),
    enabled: Boolean(storeId) && hasValidProductId && canViewProducts,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => submitSellerProductDraftForReview(storeId, productId),
    onSuccess: async (data) => {
      setSubmitStatus({
        type: "success",
        message:
          data?.submission?.status === "submitted" &&
          data?.submission?.reviewState === "PENDING_REVIEW"
            ? "Draft sent for review. Seller editing is now locked while the product waits for the next admin decision."
            : "Draft submitted for review.",
      });
      queryClient.setQueryData(["seller", "products", "detail", storeId, productId], data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["products", "activity", productId],
        }),
      ]);
    },
    onError: (error) => {
      setSubmitStatus({
        type: "error",
        message: getSubmissionErrorMessage(error),
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ published }) => setSellerProductPublished(storeId, productId, published),
    onSuccess: async (data) => {
      setSubmitStatus({
        type: "success",
        message: data?.published
          ? data?.visibility?.storefrontVisible
            ? "Product published and synced to storefront visibility."
            : "Product published, but storefront visibility is still blocked."
          : "Product hidden from storefront.",
      });
      queryClient.setQueryData(["seller", "products", "detail", storeId, productId], data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["products", "activity", productId],
        }),
      ]);
    },
    onError: (error) => {
      setSubmitStatus({
        type: "error",
        message: getPublishErrorMessage(error),
      });
    },
  });

  const backButton = (
    <Link
      key="back"
      to={workspaceRoutes.catalog()}
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
  const normalizedTags = normalizeProductDisplayTags(product?.attributes?.tags);
  const detailImageUrls = getProductVisibleImageUrls({
    promoImageUrl: product?.media?.promoImageUrl,
    imageUrls: product?.media?.imageUrls,
  });
  const variationSummary = summarizeProductVariations(product?.variations?.raw);
  const catalogGovernance = product?.governance ?? null;
  const productAuthoring = product?.authoring ?? null;
  const publishing = product?.publishing ?? null;
  const submission = product?.submission ?? null;
  const submissionGovernance = catalogGovernance?.submissionGovernance ?? null;
  const canSubmitForReview = Boolean(
    submission?.canSubmit || submission?.canResubmit || submissionGovernance?.canSubmitWhenEnabled
  );
  const canEditDraft = Boolean(productAuthoring?.canEditDraft);
  const canPublish = Boolean(publishing?.canPublish);
  const canUnpublish = Boolean(publishing?.canUnpublish);
  const publishBlockers = Array.isArray(publishing?.blockedReasons)
    ? publishing.blockedReasons.filter((entry) => entry?.message)
    : [];
  const revisionReason = getSubmissionReason(submission);
  const isSubmitted = submission?.status === "submitted";
  const isNeedsRevision = submission?.status === "needs_revision";
  const isStorefrontVisible = Boolean(product?.visibility?.storefrontVisible);
  const editActionLabel = isNeedsRevision ? "Continue Revision" : "Edit Product";
  const submitButtonLabel =
    submission?.canResubmit || submission?.status === "needs_revision"
      ? "Resubmit for Review"
      : "Submit for Review";
  const primaryImageUrl = detailImageUrls[0] || null;
  const productSku = product?.sku || product?.attributes?.parentSku || "N/A";
  const effectivePrice =
    product?.pricing?.effectivePrice ??
    product?.pricing?.salePrice ??
    product?.pricing?.price ??
    0;
  const basePrice = product?.pricing?.price ?? null;
  const salePrice = product?.pricing?.salePrice ?? null;
  const stockQuantity = product?.inventory?.stock ?? product?.availability?.stock ?? 0;
  const categoryLabel =
    product?.category?.default?.name ||
    product?.category?.primary?.name ||
    assignedCategories[0]?.name ||
    "-";
  const heroStatusLabel = isStorefrontVisible
    ? "Showing"
    : isSubmitted
      ? "In Review"
      : isNeedsRevision
        ? "Needs Revision"
        : product?.statusMeta?.label || "Draft";
  const heroStatusTone = isStorefrontVisible
    ? "emerald"
    : isSubmitted
      ? "sky"
      : isNeedsRevision
        ? "amber"
        : getStatusTone(product?.statusMeta?.code || product?.status);

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        title="Product Details"
        actions={[
          backButton,
          canPublish ? (
            <button
              key="publish"
              type="button"
              onClick={() => {
                setSubmitStatus(null);
                publishMutation.mutate({ published: true });
              }}
              disabled={publishMutation.isPending}
              className={sellerPrimaryButtonClass}
            >
              <Globe2 className="h-4 w-4" />
              {publishMutation.isPending ? "Publishing..." : "Publish"}
            </button>
          ) : null,
          canUnpublish ? (
            <button
              key="unpublish"
              type="button"
              onClick={() => {
                setSubmitStatus(null);
                publishMutation.mutate({ published: false });
              }}
              disabled={publishMutation.isPending}
              className={sellerSecondaryButtonClass}
            >
              <Package className="h-4 w-4" />
              {publishMutation.isPending ? "Updating..." : "Unpublish"}
            </button>
          ) : null,
          canSubmitForReview ? (
            <button
              key="submit"
              type="button"
              onClick={() => {
                setSubmitStatus(null);
                submitMutation.mutate();
              }}
              disabled={submitMutation.isPending}
              className={sellerPrimaryButtonClass}
            >
              <Send className="h-4 w-4" />
              {submitMutation.isPending ? "Submitting..." : submitButtonLabel}
            </button>
          ) : isSubmitted ? (
            <SellerWorkspaceBadge
              key="waiting"
              label="Submitted for review"
              tone="sky"
            />
          ) : isNeedsRevision ? (
            <SellerWorkspaceBadge key="revision" label="Needs revision" tone="amber" />
          ) : isStorefrontVisible ? (
            <SellerWorkspaceBadge key="live" label="Visible in storefront" tone="emerald" />
          ) : null,
          <SellerWorkspaceBadge
            key="status"
            label={product?.statusMeta?.label || String(product?.status || "draft").toUpperCase()}
            tone={getStatusTone(product?.statusMeta?.code || product?.status)}
          />,
          <SellerWorkspaceBadge
            key="submission"
            label={submission?.label || "Not submitted"}
            tone={getSubmissionTone(submission?.status)}
          />,
        ]}
      />

      {submitStatus ? (
        <SellerWorkspaceNotice type={submitStatus.type}>{submitStatus.message}</SellerWorkspaceNotice>
      ) : null}

      {isSubmitted ? (
        <SellerWorkspaceNotice type="info">
          Admin review is still in progress for this product. Storefront visibility stays blocked, and seller edit or publish controls remain locked until admin completes the review or requests revisions.
        </SellerWorkspaceNotice>
      ) : null}

      {isNeedsRevision ? (
        <SellerWorkspaceNotice type="warning">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">
              Revision requested
            </p>
            <p>
              Admin asked for changes on this product. Revise the draft here and resubmit it for review. Storefront visibility stays blocked during this revision state.
            </p>
            {revisionReason ? <p>{revisionReason}</p> : null}
          </div>
        </SellerWorkspaceNotice>
      ) : null}

      <SellerWorkspaceSectionCard
        title="Product Overview"
        Icon={Package}
      >
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
          <div className="grid items-center lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-7">
              <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-slate-200 bg-white p-5 sm:min-h-[380px]">
                {primaryImageUrl ? (
                  <img
                    src={resolveAssetUrl(primaryImageUrl)}
                    alt={product?.name || "Product"}
                    className="max-h-[340px] w-full object-contain sm:max-h-[360px]"
                  />
                ) : (
                  <div className="flex min-h-[220px] w-full items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-400 sm:min-h-[260px]">
                    No image available
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 lg:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[1.75rem] font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-[2rem] xl:text-[2.2rem]">
                    {product?.name || "Unnamed product"}
                  </h2>
                  <p className="mt-2.5 text-sm text-slate-500">
                    SKU:
                    <span className="ml-2 rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                      {productSku}
                    </span>
                  </p>
                </div>
                <SellerWorkspaceBadge
                  label={heroStatusLabel}
                  tone={heroStatusTone}
                  className="px-3 py-1.5 text-xs"
                />
              </div>

              <div className="mt-5">
                <p className="text-[2.5rem] font-bold leading-none text-emerald-500 sm:text-[2.85rem] xl:text-[3rem]">
                  {formatCurrency(effectivePrice)}
                </p>
                {salePrice != null && basePrice != null && salePrice !== basePrice ? (
                  <p className="mt-2 text-sm text-slate-400 line-through">
                    {formatCurrency(basePrice)}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                    Number(stockQuantity) > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {Number(stockQuantity) > 0 ? "In Stock" : "Out of Stock"}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-sm font-medium text-slate-700">
                  Quantity:
                  <span className="ml-1.5 font-semibold text-slate-950">
                    {String(stockQuantity)}
                  </span>
                </span>
              </div>

              <p className="mt-5 text-[15px] leading-6 text-slate-600">
                {product?.descriptions?.description ||
                  "No description available."}
              </p>

              <div className="mt-6 grid gap-4 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Category
                  </p>
                  <p className="mt-2.5 text-base font-semibold text-slate-900">{categoryLabel}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {assignedCategories.length > 0 ? (
                      assignedCategories.map((category) => (
                        <SellerWorkspaceBadge
                          key={`${category.id}-${category.code || category.name}`}
                          label={category.name}
                          tone="sky"
                        />
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">No additional categories.</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Tags
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {normalizedTags.length > 0 ? (
                      normalizedTags.map((tag) => (
                        <SellerWorkspaceBadge key={tag} label={tag} tone="stone" />
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">No tag data stored.</span>
                    )}
                  </div>
                </div>
              </div>

              {canEditDraft ? (
                <div className="mt-6">
                  <Link
                    to={workspaceRoutes.productEdit(product.id)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <Save className="h-4 w-4" />
                    {editActionLabel}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SellerWorkspaceSectionCard>

      <SellerWorkspaceSectionCard
        title="Product Variant List"
        Icon={Layers3}
      >
        {variationSummary?.variantCount > 0 ? (
          <SellerProductVariationSummary
            summary={variationSummary}
            formatCurrency={formatCurrency}
            emptyTitle="No variants available"
            emptyDescription=""
            readOnlyHint=""
            showOverview={false}
            showAttributeValues={false}
            tableTitle="Variant List"
          />
        ) : (
          <SellerWorkspaceEmptyState
            title="No variants available"
            description=""
            icon={<Layers3 className="h-5 w-5" />}
          />
        )}
      </SellerWorkspaceSectionCard>

    </div>
  );
}
