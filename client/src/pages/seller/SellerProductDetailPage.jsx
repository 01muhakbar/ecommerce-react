import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Globe2,
  ImageIcon,
  Layers3,
  Package,
  Save,
  Send,
  ShieldCheck,
  Wallet,
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
  SellerWorkspaceDetailItem,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import {
  getProductVisibleImageUrls,
  normalizeProductDisplayTags,
} from "../../utils/productDisplay.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";

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
  if (visibility?.stateCode === "STOREFRONT_VISIBLE") return "emerald";
  if (visibility?.stateCode === "PUBLISHED_BLOCKED") return "amber";
  return "stone";
};

const getAvailabilityTone = (availability) => {
  if (availability?.stateCode === "PREORDER") return "sky";
  if (availability?.stateCode === "IN_STOCK") return "emerald";
  return "amber";
};

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
          ? "Product published and synced to storefront visibility."
          : "Product hidden from storefront.",
      });
      queryClient.setQueryData(["seller", "products", "detail", storeId, productId], data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
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
  const contractNotes = Array.isArray(product?.contract?.notes) ? product.contract.notes : [];
  const catalogGovernance = product?.governance ?? null;
  const authoringGovernance = catalogGovernance?.authoring ?? null;
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

  return (
    <div className="space-y-5">
      <SellerWorkspaceSectionHeader
        eyebrow="Seller Product Detail"
        title={product?.name || "Product"}
        description="Use this page to manage the seller-owned product state, storefront visibility, and any legacy review notes still attached to the item."
        actions={[
          backButton,
          canEditDraft ? (
            <Link
              key="edit"
              to={workspaceRoutes.productEdit(product.id)}
              className={sellerSecondaryButtonClass}
            >
              <Save className="h-4 w-4" />
              {editActionLabel}
            </Link>
          ) : null,
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
              label="Waiting for admin review"
              tone="sky"
            />
          ) : isStorefrontVisible ? (
            <SellerWorkspaceBadge key="live" label="Live in storefront" tone="emerald" />
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
      >
        <div className="mt-1 flex flex-wrap gap-2">
          {product?.sku ? <SellerWorkspaceBadge label={`SKU ${product.sku}`} tone="stone" /> : null}
          {product?.category?.default?.name ? (
            <SellerWorkspaceBadge label={product.category.default.name} tone="sky" />
          ) : null}
          <SellerWorkspaceBadge
            label={
              authoringGovernance?.phaseLabel ||
              (catalogGovernance?.mode === "READ_ONLY_PHASE_1" ? "Read-only" : "Catalog access")
            }
            tone="amber"
          />
          <SellerWorkspaceBadge
            label={
              product?.visibility?.sellerLabel ||
              product?.visibility?.publishLabel ||
              product?.visibility?.label ||
              (product?.published ? "Published" : "Private")
            }
            tone={getVisibilityTone(product?.visibility)}
          />
          <SellerWorkspaceBadge
            label={product?.availability?.label || "Availability unknown"}
            tone={getAvailabilityTone(product?.availability)}
          />
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

      {submitStatus ? (
        <SellerWorkspaceNotice type={submitStatus.type}>{submitStatus.message}</SellerWorkspaceNotice>
      ) : null}

      {isSubmitted ? (
        <SellerWorkspaceNotice type="info">
          Legacy admin review is still recorded for this product. Seller publish control remains active for the store, so use the visibility state below as the operational source of truth.
        </SellerWorkspaceNotice>
      ) : null}

      {isNeedsRevision ? (
        <SellerWorkspaceNotice type="warning">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">
              Revision requested
            </p>
            <p>
              Admin asked for changes on this product. You can update the product, resubmit for review, or publish directly once the required fields are ready.
            </p>
            {revisionReason ? <p>{revisionReason}</p> : null}
          </div>
        </SellerWorkspaceNotice>
      ) : null}

      <SellerWorkspaceSectionCard
        title="Visibility and next action"
        hint="Use this panel to confirm storefront state, publish readiness, and any optional review workflow that still applies."
        Icon={Send}
        actions={
          canEditDraft || canSubmitForReview || canPublish || canUnpublish
            ? [
                canEditDraft ? (
                  <Link
                    key="lifecycle-edit"
                    to={workspaceRoutes.productEdit(product.id)}
                    className={sellerSecondaryButtonClass}
                  >
                    <Save className="h-4 w-4" />
                    {editActionLabel}
                  </Link>
                ) : null,
                canPublish ? (
                  <button
                    key="lifecycle-publish"
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
                    key="lifecycle-unpublish"
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
                    key="lifecycle-submit"
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
                ) : null,
              ].filter(Boolean)
            : null
        }
        >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SellerWorkspaceDetailItem
            label="Visibility"
            value={product?.visibility?.storefrontLabel || "Hidden from storefront"}
            hint={product?.visibility?.storefrontReason || "-"}
          />
          <SellerWorkspaceDetailItem
            label="Publish State"
            value={publishing?.label || "Draft"}
            hint={
              publishing?.hint ||
              publishBlockers[0]?.message ||
              "Check the remaining blockers before publishing."
            }
          />
          <SellerWorkspaceDetailItem
            label="Submission Status"
            value={submission?.label || "Not submitted"}
            hint={submission?.reviewState || "NOT_SUBMITTED"}
          />
          <SellerWorkspaceDetailItem
            label="Next Recommended Action"
            value={publishing?.nextActionLabel || submission?.nextActionLabel || "Review product status"}
            hint={
              publishing?.hint ||
              submission?.nextActionDescription ||
              "No seller action is open for this product right now."
            }
          />
        </div>
      </SellerWorkspaceSectionCard>

      <section className="grid gap-3.5 xl:grid-cols-4">
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

      <SellerWorkspaceSectionCard
        title="Submission timeline"
        hint="Review metadata is still visible here for continuity, but seller publish control is now the active storefront authority."
        Icon={Send}
      >
        {submissionGovernance?.note ? (
          <SellerWorkspaceNotice
            type={
              submission?.status === "submitted"
                ? "warning"
                : submission?.status === "needs_revision"
                  ? "warning"
                  : "info"
            }
            className="mb-4"
          >
            {submissionGovernance.note}
          </SellerWorkspaceNotice>
        ) : null}
        {revisionReason ? (
          <SellerWorkspaceNotice type="warning" className="mb-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                Revision Note
              </p>
              <p>{revisionReason}</p>
            </div>
          </SellerWorkspaceNotice>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SellerWorkspaceDetailItem
            label="Submission Status"
            value={submission?.label || "Not submitted"}
          />
          <SellerWorkspaceDetailItem
            label="Review State"
            value={submission?.reviewState || "NOT_SUBMITTED"}
          />
          <SellerWorkspaceDetailItem
            label="Submitted At"
            value={formatDateTime(submission?.submittedAt)}
          />
          <SellerWorkspaceDetailItem
            label="Revision Requested At"
            value={formatDateTime(submission?.revisionRequestedAt)}
          />
          <SellerWorkspaceDetailItem
            label="Publish Authority"
            value={submissionGovernance?.sellerCanPublish ? "Seller-owned" : "Admin-owned"}
          />
          <SellerWorkspaceDetailItem
            label="Storefront Impact"
            value={submission?.storefrontImpact || "NO_VISIBILITY_CHANGE"}
          />
          <SellerWorkspaceDetailItem
            label="Edit After Submit"
            value={
              submissionGovernance?.canEditAfterSubmit
                ? "Allowed"
                : submission?.status === "needs_revision"
                  ? "Opened for revision"
                : submission?.status === "submitted"
                  ? "Locked after submit"
                  : "Draft-only"
            }
          />
          <SellerWorkspaceDetailItem
            label="Submit Action"
            value={
              canSubmitForReview
                ? submitButtonLabel
                : submission?.nextActionLabel || "Not available"
            }
          />
          <SellerWorkspaceDetailItem
            label="Current Public State"
            value={product?.visibility?.storefrontLabel || "Hidden from storefront"}
          />
        </div>
      </SellerWorkspaceSectionCard>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
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
            {authoringGovernance?.note || catalogGovernance?.note ? (
              <SellerWorkspaceNotice type="warning" className="mb-4">
                {authoringGovernance?.note || catalogGovernance?.note}
              </SellerWorkspaceNotice>
            ) : null}
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
            <div className="grid gap-3.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Description
                </p>
                <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {product?.descriptions?.description || "No description stored for this product."}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Internal Notes
                </p>
                <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {product?.descriptions?.notes || "No internal notes stored."}
                </p>
              </div>
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Media"
            hint="Seller draft media is limited to a minimal image set. The first image becomes the primary preview while richer media governance stays outside this lane."
            Icon={ImageIcon}
          >
            <div className="space-y-3.5">
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
              {detailImageUrls.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {detailImageUrls.map((imageUrl) => (
                    <div
                      key={imageUrl}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={resolveAssetUrl(imageUrl)}
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
                  title="No product images stored"
                  description="This product does not currently expose a promo image or additional seller media rows."
                  icon={<ImageIcon className="h-5 w-5" />}
                />
              )}
            </div>
          </SellerWorkspaceSectionCard>
        </div>

        <div className="space-y-5">
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
              <div className="mt-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Assigned Categories
                </p>
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
            <div className="space-y-3.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Variations
                </p>
                {product?.variations?.hasVariations ? (
                  <pre className="mt-2.5 overflow-x-auto rounded-xl bg-slate-950 p-3.5 text-xs leading-6 text-slate-100">
                    {prettyJson(product.variations.raw)}
                  </pre>
                ) : (
                  <p className="mt-2.5 text-sm text-slate-500">No variation data stored.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Wholesale
                </p>
                {product?.wholesale?.hasWholesale ? (
                  <pre className="mt-2.5 overflow-x-auto rounded-xl bg-slate-950 p-3.5 text-xs leading-6 text-slate-100">
                    {prettyJson(product.wholesale.raw)}
                  </pre>
                ) : (
                  <p className="mt-2.5 text-sm text-slate-500">
                    No wholesale configuration stored.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tags
                </p>
                {normalizedTags.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {normalizedTags.map((tag) => (
                      <SellerWorkspaceBadge key={tag} label={tag} tone="stone" />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2.5 text-sm text-slate-500">No tag data stored.</p>
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
              {authoringGovernance?.note ||
                catalogGovernance?.note ||
                "This detail page remains read-only, but draft authoring now covers seller-safe category, pricing, and stock updates for eligible draft or revision rows."}
            </SellerWorkspaceNotice>
          </SellerWorkspaceSectionCard>
        </div>
      </section>
    </div>
  );
}
