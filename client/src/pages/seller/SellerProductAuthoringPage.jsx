import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  ImageIcon,
  Package,
  Plus,
  Save,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  createSellerProductDraft,
  getSellerProductAuthoringMeta,
  getSellerProductDetail,
  submitSellerProductDraftForReview,
  uploadSellerProductImage,
  updateSellerProductDraft,
} from "../../api/sellerProducts.ts";
import {
  sellerDisabledFieldClass,
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  sellerTextareaClass,
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatePanel,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { buildCategoryTree } from "../../utils/categoryTree.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const emptyToNull = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const createEmptyForm = () => ({
  name: "",
  description: "",
  sku: "",
  categoryIds: [],
  defaultCategoryId: "",
  price: "0",
  salePrice: "",
  stock: "0",
  imageUrls: [],
});

const createFormFromMeta = (meta) => ({
  name: meta?.draftDefaults?.name || "",
  description: meta?.draftDefaults?.description || "",
  sku: meta?.draftDefaults?.sku || "",
  categoryIds: Array.isArray(meta?.draftDefaults?.categoryIds) ? meta.draftDefaults.categoryIds : [],
  defaultCategoryId:
    meta?.draftDefaults?.defaultCategoryId != null
      ? String(meta.draftDefaults.defaultCategoryId)
      : "",
  price: String(meta?.draftDefaults?.price ?? 0),
  salePrice:
    meta?.draftDefaults?.salePrice == null ? "" : String(meta.draftDefaults.salePrice),
  stock: String(meta?.draftDefaults?.stock ?? 0),
  imageUrls: Array.isArray(meta?.draftDefaults?.imageUrls) ? meta.draftDefaults.imageUrls : [],
});

const createFormFromProduct = (product) => ({
  name: product?.name || "",
  description: product?.descriptions?.description || "",
  sku: product?.sku || "",
  categoryIds: Array.isArray(product?.category?.assigned)
    ? product.category.assigned
        .map((category) => Number(category?.id || 0))
        .filter((id) => id > 0)
    : [],
  defaultCategoryId:
    product?.category?.default?.id != null ? String(product.category.default.id) : "",
  price: String(product?.pricing?.price ?? 0),
  salePrice:
    product?.pricing?.salePrice == null ? "" : String(product.pricing.salePrice),
  stock: String(product?.inventory?.stock ?? 0),
  imageUrls: Array.isArray(product?.media?.imageUrls) ? product.media.imageUrls : [],
});

function SellerCategoryTree({ tree = [], selectedIds = [], onToggle }) {
  if (!Array.isArray(tree) || tree.length === 0) {
    return <p className="text-sm text-slate-500">No categories available.</p>;
  }

  return (
    <ul className="space-y-2">
      {tree.map((node) => {
        const nodeId = Number(node?.id || 0);
        const isChecked = selectedIds.includes(nodeId);
        const hasChildren = Array.isArray(node?.children) && node.children.length > 0;

        return (
          <li key={`${nodeId}-${node?.slug || node?.name || "category"}`} className="space-y-2">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(nodeId)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
              />
              <span className="min-w-0">
                <span className="block font-medium text-slate-900">{node?.name || "Category"}</span>
                {node?.code ? (
                  <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">
                    {node.code}
                  </span>
                ) : null}
              </span>
            </label>

            {hasChildren ? (
              <div className="ml-6 border-l border-slate-200 pl-4">
                <SellerCategoryTree
                  tree={node.children}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const getAuthoringErrorMessage = (error, mode = "create") => {
  const code = String(error?.response?.data?.code || "").trim().toUpperCase();
  const message = String(error?.response?.data?.message || "").trim();
  const forbiddenFields = Array.isArray(error?.response?.data?.fields)
    ? error.response.data.fields
    : [];

  if (code === "SELLER_PRODUCT_AUTHORING_FORBIDDEN_FIELDS" && forbiddenFields.length > 0) {
    return `These fields are not editable in seller draft authoring: ${forbiddenFields.join(", ")}.`;
  }

  if (code === "SELLER_PRODUCT_DRAFT_REQUIRED") {
    return "Only draft products can be edited here.";
  }

  if (code === "SELLER_PRODUCT_SUBMISSION_LOCKED") {
    return "This draft is already with admin review, so editing is locked for now.";
  }

  if (code === "SELLER_PRODUCT_ALREADY_SUBMITTED") {
    return "This draft is already waiting in admin review.";
  }

  if (code === "SELLER_PRODUCT_NAME_REQUIRED") {
    return "Product name is required.";
  }

  if (code === "SELLER_PRODUCT_NAME_TOO_LONG") {
    return "Product name must be 255 characters or fewer.";
  }

  if (code === "SELLER_PRODUCT_SKU_TOO_LONG") {
    return "SKU must be 100 characters or fewer.";
  }

  if (code === "SELLER_PRODUCT_PRICE_INVALID") {
    return "Base price must be a valid non-negative number.";
  }

  if (code === "SELLER_PRODUCT_SALE_PRICE_INVALID") {
    return "Sale price must be a valid non-negative number.";
  }

  if (code === "SELLER_PRODUCT_SALE_PRICE_TOO_HIGH") {
    return "Sale price must stay lower than the base price.";
  }

  if (code === "SELLER_PRODUCT_STOCK_INVALID") {
    return "Stock must be a valid non-negative integer.";
  }

  if (code === "SELLER_PRODUCT_IMAGES_INVALID") {
    return "Draft images must be provided as a valid image list.";
  }

  if (code === "SELLER_PRODUCT_IMAGES_LIMIT_EXCEEDED") {
    return "Seller draft media is limited to 6 images in this phase.";
  }

  if (code === "SELLER_PRODUCT_IMAGE_URL_INVALID") {
    return "One or more draft images are invalid. Use uploaded JPG or PNG assets only.";
  }

  if (code === "SELLER_PRODUCT_DEFAULT_CATEGORY_REQUIRED") {
    return "Choose a default category when categories are selected.";
  }

  if (
    code === "SELLER_PRODUCT_DEFAULT_CATEGORY_INVALID" ||
    code === "SELLER_PRODUCT_CATEGORY_INVALID"
  ) {
    return message || "Selected categories are no longer valid for seller draft authoring.";
  }

  return (
    message ||
    getSellerRequestErrorMessage(error, {
      permissionMessage:
        mode === "create"
          ? "Your current seller access does not include draft creation."
          : "Your current seller access does not include draft editing.",
      fallbackMessage:
        mode === "create"
          ? "Failed to create seller product draft."
          : "Failed to update seller product draft.",
    })
  );
};

const getSubmissionReason = (submission) =>
  submission?.reviewNote || submission?.revisionReason || submission?.revisionNote || null;

function ProductField({ label, hint, multiline = false, disabled = false, ...props }) {
  const inputClasses = multiline ? sellerTextareaClass : sellerFieldClass;

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      {multiline ? (
        <textarea
          className={`${inputClasses} mt-2 min-h-[160px] ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      ) : (
        <input
          className={`${inputClasses} mt-2 ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      )}
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function SellerProductAuthoringPage({ mode = "create" }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { productId } = useParams();
  const {
    sellerContext,
    workspaceStoreId: storeId,
    workspaceRoutes,
  } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");
  const numericProductId = Number(productId);
  const isEditMode = mode === "edit";
  const hasValidProductId = Number.isInteger(numericProductId) && numericProductId > 0;

  const [form, setForm] = useState(createEmptyForm());
  const [status, setStatus] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const metaQuery = useQuery({
    queryKey: ["seller", "products", "authoring-meta", storeId],
    queryFn: () => getSellerProductAuthoringMeta(storeId),
    enabled: Boolean(storeId) && canViewProducts,
    retry: false,
  });

  const productQuery = useQuery({
    queryKey: ["seller", "products", "detail", storeId, productId],
    queryFn: () => getSellerProductDetail(storeId, productId),
    enabled: Boolean(storeId) && canViewProducts && isEditMode && hasValidProductId,
    retry: false,
  });

  useEffect(() => {
    if (!isEditMode && metaQuery.data) {
      setForm(createFormFromMeta(metaQuery.data));
    }
  }, [isEditMode, metaQuery.data]);

  useEffect(() => {
    if (isEditMode && productQuery.data) {
      setForm(createFormFromProduct(productQuery.data));
    }
  }, [isEditMode, productQuery.data]);

  const governance = useMemo(() => {
    if (isEditMode) {
      return productQuery.data?.governance ?? metaQuery.data?.governance ?? null;
    }
    return metaQuery.data?.governance ?? null;
  }, [isEditMode, metaQuery.data, productQuery.data]);

  const authoringGovernance = governance?.authoring ?? null;
  const fieldGovernance = governance?.fieldGovernance ?? null;
  const submissionGovernance = governance?.submissionGovernance ?? null;
  const detailAuthoring = productQuery.data?.authoring ?? null;
  const submission = productQuery.data?.submission ?? null;
  const submissionReason = getSubmissionReason(submission);
  const categoryReference = metaQuery.data?.references?.categories || [];
  const categoryTree = useMemo(() => buildCategoryTree(categoryReference), [categoryReference]);
  const selectedCategories = useMemo(
    () =>
      categoryReference.filter((category) =>
        Array.isArray(form.categoryIds) ? form.categoryIds.includes(Number(category.id)) : false
      ),
    [categoryReference, form.categoryIds]
  );
  const defaultCategoryOptions = selectedCategories;
  const canCreateDraft = Boolean(authoringGovernance?.canCreateDraft);
  const canEditDraft = Boolean(detailAuthoring?.canEditDraft);
  const canSubmitForReview = Boolean(
    isEditMode &&
      (submission?.canSubmit ||
        submission?.canResubmit ||
        submissionGovernance?.canSubmitWhenEnabled)
  );
  const isNeedsRevision = submission?.status === "needs_revision";
  const isBusy = metaQuery.isLoading || (isEditMode && productQuery.isLoading);
  const canManageMedia = Array.isArray(fieldGovernance?.sellerEditableNow)
    ? fieldGovernance.sellerEditableNow.includes("imageUrls")
    : false;

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditMode
        ? updateSellerProductDraft(storeId, productId, payload)
        : createSellerProductDraft(storeId, payload),
    onSuccess: async (data) => {
      setStatus({
        type: "success",
        message: isEditMode
          ? "Draft updated in seller workspace."
          : "Draft created in seller workspace.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "products", "authoring-meta", storeId] }),
      ]);

      if (isEditMode) {
        queryClient.setQueryData(["seller", "products", "detail", storeId, productId], data);
        setForm(createFormFromProduct(data));
        return;
      }

      navigate(workspaceRoutes.productEdit(data.id), { replace: true });
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getAuthoringErrorMessage(error, mode),
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitSellerProductDraftForReview(storeId, productId),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
      ]);
      queryClient.setQueryData(["seller", "products", "detail", storeId, productId], data);
      navigate(workspaceRoutes.productDetail(data.id), { replace: true });
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getAuthoringErrorMessage(error, "edit"),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      const uploadedUrls = await Promise.all(files.map((file) => uploadSellerProductImage(file)));
      return uploadedUrls;
    },
    onSuccess: (uploadedUrls) => {
      setUploadStatus({
        type: "success",
        message:
          uploadedUrls.length === 1
            ? "Image uploaded to draft media staging."
            : `${uploadedUrls.length} images uploaded to draft media staging.`,
      });
      setForm((current) => ({
        ...current,
        imageUrls: Array.from(new Set([...(current.imageUrls || []), ...uploadedUrls])).slice(
          0,
          6
        ),
      }));
    },
    onError: (error) => {
      setUploadStatus({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to upload seller draft image.",
      });
    },
  });

  const handleChange = (key) => (event) => {
    const nextValue = event?.target?.value ?? "";
    setForm((current) => ({ ...current, [key]: nextValue }));
  };

  const handleToggleCategory = (categoryId) => {
    const numericId = Number(categoryId);
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    setForm((current) => {
      const nextIds = current.categoryIds.includes(numericId)
        ? current.categoryIds.filter((id) => id !== numericId)
        : [...current.categoryIds, numericId];
      const shouldClearDefault =
        current.defaultCategoryId && !nextIds.includes(Number(current.defaultCategoryId));

      return {
        ...current,
        categoryIds: nextIds,
        defaultCategoryId: shouldClearDefault ? "" : current.defaultCategoryId,
      };
    });
  };

  const handleRemoveImage = (imageUrl) => {
    setForm((current) => ({
      ...current,
      imageUrls: (current.imageUrls || []).filter((entry) => entry !== imageUrl),
    }));
  };

  const handleImageFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    setUploadStatus(null);
    const remainingSlots = Math.max(0, 6 - form.imageUrls.length);
    if (remainingSlots <= 0) {
      setUploadStatus({
        type: "error",
        message: "Seller draft media is limited to 6 images in this phase.",
      });
      return;
    }

    const allowedTypes = new Set(["image/jpeg", "image/png"]);
    const invalidTypeFile = files.find((file) => !allowedTypes.has(String(file.type || "")));
    if (invalidTypeFile) {
      setUploadStatus({
        type: "error",
        message: "Only JPG and PNG files are allowed for seller draft media.",
      });
      return;
    }

    const oversizedFile = files.find((file) => Number(file.size || 0) > 2 * 1024 * 1024);
    if (oversizedFile) {
      setUploadStatus({
        type: "error",
        message: "Each seller draft image must stay within the existing 2MB upload limit.",
      });
      return;
    }

    if (files.length > remainingSlots) {
      setUploadStatus({
        type: "warning",
        message: `Only ${remainingSlots} more image slot${
          remainingSlots === 1 ? "" : "s"
        } are available. Extra files were ignored.`,
      });
    }

    await uploadMutation.mutateAsync(files.slice(0, remainingSlots));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setUploadStatus(null);

    const basePrice = Number(form.price || 0);
    const salePrice = form.salePrice === "" ? null : Number(form.salePrice);
    const stock = Number(form.stock || 0);

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setStatus({ type: "error", message: "Base price must be a valid non-negative number." });
      return;
    }

    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0)) {
      setStatus({ type: "error", message: "Sale price must be a valid non-negative number." });
      return;
    }

    if (salePrice !== null && salePrice > 0 && salePrice >= basePrice) {
      setStatus({
        type: "error",
        message: "Sale price must stay lower than the base price.",
      });
      return;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      setStatus({ type: "error", message: "Stock must be a valid non-negative integer." });
      return;
    }

    if (!Number.isInteger(stock)) {
      setStatus({ type: "error", message: "Stock must be a whole number." });
      return;
    }

    if (form.categoryIds.length > 0 && !form.defaultCategoryId) {
      setStatus({
        type: "error",
        message: "Choose a default category when categories are selected.",
      });
      return;
    }

    await mutation.mutateAsync({
      name: String(form.name || "").trim(),
      description: emptyToNull(form.description),
      sku: emptyToNull(form.sku),
      categoryIds: form.categoryIds,
      defaultCategoryId: form.defaultCategoryId ? Number(form.defaultCategoryId) : null,
      price: basePrice,
      salePrice,
      stock,
      imageUrls: form.imageUrls,
    });
  };

  const backButton = (
    <Link key="back" to={workspaceRoutes.catalog()} className={sellerSecondaryButtonClass}>
      <ArrowLeft className="h-4 w-4" />
      Back to catalog
    </Link>
  );

  if (!canViewProducts) {
    return (
      <SellerWorkspaceStatePanel
        title="Catalog authoring is unavailable"
        description="Your current seller access does not include catalog visibility."
        tone="error"
        Icon={ShieldCheck}
      />
    );
  }

  if (isEditMode && !hasValidProductId) {
    return (
      <SellerWorkspaceStatePanel
        title="Seller draft editing needs a valid product id"
        description="Open this lane from a draft product that belongs to the active seller store."
        action={backButton}
        tone="warning"
        Icon={Package}
      />
    );
  }

  if (isBusy) {
    return (
      <SellerWorkspaceStatePanel
        title={isEditMode ? "Loading seller draft editor" : "Loading seller draft authoring"}
        description="Fetching seller authoring governance for the active store."
        action={backButton}
        Icon={Package}
      />
    );
  }

  if (metaQuery.isError || (isEditMode && productQuery.isError)) {
    const error = productQuery.error || metaQuery.error;
    return (
      <SellerWorkspaceStatePanel
        title={isEditMode ? "Failed to load seller draft" : "Failed to load draft authoring"}
        description={getSellerRequestErrorMessage(error, {
          permissionMessage:
            isEditMode
              ? "Your current seller access does not include draft editing."
              : "Your current seller access does not include draft creation.",
          fallbackMessage:
            isEditMode
              ? "Failed to load seller draft."
              : "Failed to load seller draft authoring.",
        })}
        action={backButton}
        tone="error"
        Icon={ShieldCheck}
      />
    );
  }

  if (!isEditMode && !canCreateDraft) {
    return (
        <SellerWorkspaceStatePanel
          title="Draft creation is unavailable"
          description={
            authoringGovernance?.note ||
          "Your current seller access does not include draft creation in this store."
        }
        action={backButton}
        tone="warning"
        Icon={ShieldCheck}
      />
    );
  }

  if (isEditMode && productQuery.data && !canEditDraft) {
    return (
      <div className="space-y-6">
        <SellerWorkspaceSectionHeader
          eyebrow="Seller Catalog"
          title="Draft editing is unavailable"
          description={
            authoringGovernance?.note ||
            "This product cannot be edited from seller workspace right now."
          }
          actions={[
            backButton,
            <Link
              key="detail"
              to={workspaceRoutes.productDetail(productQuery.data.id)}
              className={sellerSecondaryButtonClass}
            >
              View detail
            </Link>,
          ]}
        />

        <SellerWorkspaceSectionCard
          title="Why this product is read-only here"
          hint="Seller workspace only opens edit access when the current draft state allows it."
          Icon={ShieldCheck}
        >
          <SellerWorkspaceNotice type="warning">
            {detailAuthoring?.editBlockedReason === "PRODUCT_STATUS_NOT_DRAFT"
              ? "This product is no longer a draft, so seller editing is closed here."
              : detailAuthoring?.editBlockedReason === "PRODUCT_SUBMISSION_PENDING_REVIEW"
                ? "This draft is already with admin review, so seller editing stays locked until admin asks for changes."
                : "Your current seller access does not include draft editing for this product."}
          </SellerWorkspaceNotice>
        </SellerWorkspaceSectionCard>
      </div>
    );
  }

  const editableNow = fieldGovernance?.sellerEditableNow || [];
  const deferredFields = fieldGovernance?.deferred || [];
  const adminOwnedFields = fieldGovernance?.adminOwned || [];

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        eyebrow="Seller Catalog"
        title={
          isEditMode
            ? isNeedsRevision
              ? "Continue seller revision"
              : "Edit seller draft"
            : "Create seller draft"
        }
        description={
          isEditMode
            ? isNeedsRevision
              ? "Admin asked for changes on this draft. Update the allowed fields, then send it back for review when the requested changes are complete."
              : "Update the draft fields that seller workspace currently owns. Final review and publishing still happen outside this page."
            : "Create a store-scoped draft with the fields seller workspace currently owns. Final review and publishing still happen outside this page."
        }
        actions={[
          backButton,
          <SellerWorkspaceBadge
            key="phase"
            label={authoringGovernance?.phaseLabel || "Draft-first MVP"}
            tone="amber"
          />,
          <SellerWorkspaceBadge
            key="store"
            label={sellerContext?.store?.slug || "store"}
            tone="sky"
          />,
        ]}
      />

      {status ? (
        <SellerWorkspaceNotice type={status.type}>{status.message}</SellerWorkspaceNotice>
      ) : null}

      {uploadStatus ? (
        <SellerWorkspaceNotice type={uploadStatus.type}>{uploadStatus.message}</SellerWorkspaceNotice>
      ) : null}

      {authoringGovernance?.note ? (
        <SellerWorkspaceNotice type="info">{authoringGovernance.note}</SellerWorkspaceNotice>
      ) : null}

      {isNeedsRevision ? (
        <SellerWorkspaceNotice type="warning">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">
              Revision Requested
            </p>
            <p>
              Admin reopened this draft for changes. Update the requested fields, then send it
              back for review when ready.
            </p>
            {submissionReason ? <p>{submissionReason}</p> : null}
          </div>
        </SellerWorkspaceNotice>
      ) : null}

      {isEditMode ? (
        <SellerWorkspaceSectionCard
          title="Submission context"
          hint="Use this state panel to see where the draft stands and what seller should do next."
          Icon={ShieldCheck}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SellerWorkspaceDetailItem
              label="Submission Status"
              value={submission?.label || "Not submitted"}
              hint={submission?.reviewState || "NOT_SUBMITTED"}
            />
            <SellerWorkspaceDetailItem
              label="Revision Reason"
              value={submissionReason || "No revision request recorded."}
              hint={
                isNeedsRevision
                  ? "Address this request before resubmitting."
                  : "This stays empty until admin sends the draft back for changes."
              }
            />
            <SellerWorkspaceDetailItem
              label="Storefront Visibility"
              value={productQuery.data?.visibility?.storefrontLabel || "Hidden from storefront"}
              hint={productQuery.data?.visibility?.storefrontReason || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Next Recommended Action"
              value={submission?.nextActionLabel || "Edit Draft"}
              hint={
                submission?.nextActionDescription ||
                "Keep updating this draft until it is ready to send for review."
              }
            />
          </div>
        </SellerWorkspaceSectionCard>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SellerWorkspaceSectionCard
          title={
            isEditMode ? (isNeedsRevision ? "Revision form" : "Draft authoring form") : "New draft form"
          }
          hint={
            isNeedsRevision
              ? "Only the seller-managed draft fields are reopened here. Finish the requested corrections, then send the draft back for review."
              : "Use this form for the draft fields seller workspace owns. Publishing and final review stay outside this page."
          }
          Icon={isEditMode ? Save : Plus}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <ProductField
              label="Product Name"
              value={form.name}
              onChange={handleChange("name")}
              disabled={mutation.isPending}
              maxLength={255}
              placeholder="Product name shown inside seller workspace"
              hint="Required. A canonical product slug will be derived and kept unique by the backend."
            />

            <ProductField
              label="Description"
              value={form.description}
              onChange={handleChange("description")}
              disabled={mutation.isPending}
              multiline
              placeholder="Short seller-managed product description"
              hint="Optional. This MVP keeps description editable because it is low-risk and store-scoped."
            />

            <ProductField
              label="SKU"
              value={form.sku}
              onChange={handleChange("sku")}
              disabled={mutation.isPending}
              maxLength={100}
              placeholder="Optional seller SKU"
              hint="Optional. Leave empty if SKU governance for this draft is not needed yet."
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <label className="block lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Categories
                </span>
                <div className="mt-2 space-y-3 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                  {selectedCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedCategories.map((category) => (
                        <SellerWorkspaceBadge
                          key={category.id}
                          label={category.name}
                          tone="sky"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Choose one or more published categories for this seller draft.
                    </p>
                  )}
                  <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">
                    <SellerCategoryTree
                      tree={categoryTree}
                      selectedIds={form.categoryIds}
                      onToggle={handleToggleCategory}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Seller can only choose from existing published categories. Category creation stays outside this lane.
                </p>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Default Category
                </span>
                <select
                  value={form.defaultCategoryId}
                  onChange={handleChange("defaultCategoryId")}
                  disabled={mutation.isPending || selectedCategories.length === 0}
                  className={`${sellerFieldClass} mt-2 ${
                    mutation.isPending || selectedCategories.length === 0
                      ? sellerDisabledFieldClass
                      : ""
                  }`}
                >
                  <option value="">Choose default category</option>
                  {defaultCategoryOptions.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  The default category must come from the selected categories above.
                </p>
              </label>

              <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
                <ProductField
                  label="Base Price"
                  value={form.price}
                  onChange={handleChange("price")}
                  disabled={mutation.isPending}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  hint="Seller may define draft pricing now, but final publish remains admin-owned."
                />

                <ProductField
                  label="Sale Price"
                  value={form.salePrice}
                  onChange={handleChange("salePrice")}
                  disabled={mutation.isPending}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional discount price"
                  hint="Optional. If used, it must stay lower than the base price."
                />

                <ProductField
                  label="Stock"
                  value={form.stock}
                  onChange={handleChange("stock")}
                  disabled={mutation.isPending}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  hint="Stock is now seller-editable for draft and revision lanes in this phase."
                />
              </div>
            </div>

            {canManageMedia ? (
              <div className="space-y-3 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Draft Images
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Upload JPEG or PNG files. The first image becomes the primary product preview.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    {uploadMutation.isPending ? "Uploading..." : "Add Images"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      multiple
                      className="hidden"
                      disabled={uploadMutation.isPending || mutation.isPending}
                      onChange={async (event) => {
                        try {
                          await handleImageFiles(event.target.files);
                        } finally {
                          event.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>

                <p className="text-xs text-slate-500">
                  Up to 6 images. Uploaded files are stored immediately, but the draft keeps them only after you save.
                </p>

                {Array.isArray(form.imageUrls) && form.imageUrls.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {form.imageUrls.map((imageUrl, index) => (
                      <div
                        key={`${imageUrl}-${index}`}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                      >
                        <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                          <img
                            src={resolveAssetUrl(imageUrl)}
                            alt={`Draft image ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(imageUrl)}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:bg-white"
                            aria-label="Remove draft image"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-1 border-t border-slate-200 px-3 py-3">
                          <SellerWorkspaceBadge
                            label={index === 0 ? "Primary image" : `Image ${index + 1}`}
                            tone={index === 0 ? "emerald" : "stone"}
                          />
                          <p className="truncate text-xs text-slate-500">{imageUrl}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                    No draft images added yet.
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={mutation.isPending} className={sellerPrimaryButtonClass}>
                {isEditMode ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {mutation.isPending
                  ? isEditMode
                    ? isNeedsRevision
                      ? "Saving revision..."
                      : "Saving draft..."
                    : "Creating draft..."
                  : isEditMode
                    ? isNeedsRevision
                      ? "Save Revision"
                      : "Save Draft"
                    : "Create Draft"}
              </button>
              {canSubmitForReview ? (
                <button
                  type="button"
                  disabled={mutation.isPending || submitMutation.isPending}
                  onClick={async () => {
                    setStatus(null);
                    await submitMutation.mutateAsync();
                  }}
                  className={sellerSecondaryButtonClass}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {submitMutation.isPending
                    ? "Submitting..."
                    : submission?.status === "needs_revision"
                      ? "Resubmit for Review"
                      : "Submit for Review"}
                </button>
              ) : null}
              <Link to={workspaceRoutes.catalog()} className={sellerSecondaryButtonClass}>
                Cancel
              </Link>
            </div>
          </form>
        </SellerWorkspaceSectionCard>

        <div className="space-y-6">
          <SellerWorkspaceSectionCard
            title="Governance snapshot"
            hint="These permissions come from the current seller rules for this store."
            Icon={ShieldCheck}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Create Draft"
                value={canCreateDraft ? "Allowed" : "Not allowed"}
              />
              <SellerWorkspaceDetailItem
                label="Edit Draft"
                value={isEditMode ? (canEditDraft ? "Allowed" : "Not allowed") : "Draft-only"}
              />
              <SellerWorkspaceDetailItem
                label="Publish"
                value={governance?.canPublish ? "Allowed" : "Admin-owned"}
              />
              <SellerWorkspaceDetailItem
                label="Pricing"
                value={governance?.canManagePricing ? "Seller-managed in draft" : "Deferred"}
              />
              <SellerWorkspaceDetailItem
                label="Inventory"
                value={governance?.canManageInventory ? "Seller-managed in draft" : "Deferred"}
              />
              <SellerWorkspaceDetailItem
                label="Media"
                value={canManageMedia ? "Minimal image set" : "Deferred"}
              />
              <SellerWorkspaceDetailItem
                label="Status Transition"
                value={
                  governance?.statusGovernance?.sellerStateTransitionsActive
                    ? "Seller-owned"
                    : "Admin-owned"
                }
              />
              <SellerWorkspaceDetailItem
                label="Submission State"
                value={submission?.label || submissionGovernance?.status || "Not submitted"}
              />
              <SellerWorkspaceDetailItem
                label="Submit Action"
                value={
                  canSubmitForReview
                    ? submission?.status === "needs_revision"
                      ? "Resubmit available"
                      : "Available"
                    : "Not available"
                }
              />
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Editable now"
            hint="Only these backend-governed fields are opened in seller authoring phase 2."
            Icon={FileText}
          >
            <div className="flex flex-wrap gap-2">
              {editableNow.map((field) => (
                <SellerWorkspaceBadge key={field} label={field} tone="emerald" />
              ))}
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Deferred and admin-owned"
            hint="These areas stay outside MVP to avoid product governance drift."
            Icon={Package}
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Admin-owned
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {adminOwnedFields.map((field) => (
                    <SellerWorkspaceBadge key={field} label={field} tone="stone" />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Deferred From MVP
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {deferredFields.map((field) => (
                    <SellerWorkspaceBadge key={field} label={field} tone="amber" />
                  ))}
                </div>
              </div>
            </div>
          </SellerWorkspaceSectionCard>
        </div>
      </section>
    </div>
  );
}
