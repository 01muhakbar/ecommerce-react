import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Hash,
  ImageIcon,
  Layers3,
  Package,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Tag,
  Upload,
  X,
} from "lucide-react";
import {
  createSellerProductDraft,
  getSellerProductAuthoringMeta,
  getSellerProductDetail,
  setSellerProductPublished,
  submitSellerProductDraftForReview,
  uploadSellerProductImage,
  updateSellerProductDraft,
} from "../../api/sellerProducts.ts";
import {
  sellerDisabledFieldClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceNotice,
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

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const createEmptyForm = () => ({
  name: "",
  description: "",
  sku: "",
  barcode: "",
  slug: "",
  categoryIds: [],
  defaultCategoryId: "",
  price: "0",
  salePrice: "",
  stock: "0",
  imageUrls: [],
  tags: [],
});

const createFormFromMeta = (meta) => ({
  name: meta?.draftDefaults?.name || "",
  description: meta?.draftDefaults?.description || "",
  sku: meta?.draftDefaults?.sku || "",
  barcode: meta?.draftDefaults?.barcode || "",
  slug: meta?.draftDefaults?.slug || "",
  categoryIds: Array.isArray(meta?.draftDefaults?.categoryIds)
    ? meta.draftDefaults.categoryIds
    : [],
  defaultCategoryId:
    meta?.draftDefaults?.defaultCategoryId != null
      ? String(meta.draftDefaults.defaultCategoryId)
      : "",
  price: String(meta?.draftDefaults?.price ?? 0),
  salePrice:
    meta?.draftDefaults?.salePrice == null
      ? ""
      : String(meta.draftDefaults.salePrice),
  stock: String(meta?.draftDefaults?.stock ?? 0),
  imageUrls: Array.isArray(meta?.draftDefaults?.imageUrls)
    ? meta.draftDefaults.imageUrls
    : [],
  tags: Array.isArray(meta?.draftDefaults?.tags) ? meta.draftDefaults.tags : [],
});

const createFormFromProduct = (product) => ({
  name: product?.name || "",
  description: product?.descriptions?.description || "",
  sku: product?.sku || "",
  barcode: product?.attributes?.barcode || "",
  slug: product?.slug || "",
  categoryIds: Array.isArray(product?.category?.assigned)
    ? product.category.assigned
        .map((category) => Number(category?.id || 0))
        .filter((id) => id > 0)
    : [],
  defaultCategoryId:
    product?.category?.default?.id != null
      ? String(product.category.default.id)
      : "",
  price: String(product?.pricing?.price ?? 0),
  salePrice:
    product?.pricing?.salePrice == null
      ? ""
      : String(product.pricing.salePrice),
  stock: String(product?.inventory?.stock ?? 0),
  imageUrls: Array.isArray(product?.media?.imageUrls)
    ? product.media.imageUrls
    : [],
  tags: Array.isArray(product?.attributes?.tags) ? product.attributes.tags : [],
});

function SellerCategoryTree({ tree = [], selectedIds = [], onToggle }) {
  if (!Array.isArray(tree) || tree.length === 0) {
    return <p className="text-sm text-slate-500">No categories available.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {tree.map((node) => {
        const nodeId = Number(node?.id || 0);
        const isChecked = selectedIds.includes(nodeId);
        const hasChildren =
          Array.isArray(node?.children) && node.children.length > 0;

        return (
          <li
            key={`${nodeId}-${node?.slug || node?.name || "category"}`}
            className="space-y-1.5"
          >
            <label className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-white/80">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(nodeId)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
              />
              <span className="min-w-0">
                <span className="block font-medium text-slate-900">
                  {node?.name || "Category"}
                </span>
                {node?.code ? (
                  <span className="block text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    {node.code}
                  </span>
                ) : null}
              </span>
            </label>

            {hasChildren ? (
              <div className="ml-4 border-l border-slate-100 pl-2.5">
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
  const code = String(error?.response?.data?.code || "")
    .trim()
    .toUpperCase();
  const message = String(error?.response?.data?.message || "").trim();
  const forbiddenFields = Array.isArray(error?.response?.data?.fields)
    ? error.response.data.fields
    : [];

  if (
    code === "SELLER_PRODUCT_AUTHORING_FORBIDDEN_FIELDS" &&
    forbiddenFields.length > 0
  ) {
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

  if (code === "SELLER_PRODUCT_BARCODE_TOO_LONG") {
    return "Barcode must be 100 characters or fewer.";
  }

  if (code === "SELLER_PRODUCT_SLUG_INVALID") {
    return "Slug is invalid. Use letters, numbers, or hyphens only.";
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
    return (
      message ||
      "Selected categories are no longer valid for seller draft authoring."
    );
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

const getPublishErrorMessage = (error) => {
  const code = String(error?.response?.data?.code || "")
    .trim()
    .toUpperCase();
  const message = String(error?.response?.data?.message || "").trim();
  const blockers = Array.isArray(error?.response?.data?.data?.blockers)
    ? error.response.data.data.blockers
    : [];

  if (code === "SELLER_PRODUCT_PUBLISH_NOT_READY" && blockers.length > 0) {
    return blockers
      .map((entry) => entry?.message)
      .filter(Boolean)
      .join(" ");
  }

  return (
    message ||
    getSellerRequestErrorMessage(error, {
      permissionMessage:
        "Your current seller access does not include publish control.",
      fallbackMessage: "Failed to update seller product visibility.",
    })
  );
};

const getSubmissionReason = (submission) =>
  submission?.reviewNote ||
  submission?.revisionReason ||
  submission?.revisionNote ||
  null;

const drawerToneClassMap = {
  slate: "border-slate-200 bg-white text-slate-600",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const authoringFieldClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100";
const authoringTextareaClass =
  "w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100";
const authoringSelectClass =
  "mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100";
const authoringSurfaceClass =
  "rounded-[18px] border border-slate-200/70 bg-slate-50/45 p-3";
const authoringActionMutedClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const authoringActionPrimaryClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const authoringTopLinkClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100/80 hover:text-slate-700";
const authoringIconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700";

function ProductField({
  label,
  hint,
  icon: Icon = null,
  multiline = false,
  disabled = false,
  ...props
}) {
  const inputClasses = multiline ? authoringTextareaClass : authoringFieldClass;

  return (
    <label className="block">
      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      {multiline ? (
        <textarea
          className={`${inputClasses} mt-2 min-h-[132px] ${disabled ? sellerDisabledFieldClass : ""}`}
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
      {hint ? (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p>
      ) : null}
    </label>
  );
}

function DrawerChip({ icon: Icon = null, label, tone = "slate" }) {
  const toneClass = drawerToneClassMap[tone] || drawerToneClassMap.slate;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </span>
  );
}

function FormSectionLabel({ eyebrow, title, description = null }) {
  return (
    <div className="space-y-1 border-b border-slate-100/90 pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      {description ? (
        <p className="text-xs text-slate-500">{description}</p>
      ) : null}
    </div>
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
  const hasValidProductId =
    Number.isInteger(numericProductId) && numericProductId > 0;

  const [form, setForm] = useState(createEmptyForm());
  const [status, setStatus] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const metaQuery = useQuery({
    queryKey: ["seller", "products", "authoring-meta", storeId],
    queryFn: () => getSellerProductAuthoringMeta(storeId),
    enabled: Boolean(storeId) && canViewProducts,
    retry: false,
  });

  const productQuery = useQuery({
    queryKey: ["seller", "products", "detail", storeId, productId],
    queryFn: () => getSellerProductDetail(storeId, productId),
    enabled:
      Boolean(storeId) && canViewProducts && isEditMode && hasValidProductId,
    retry: false,
  });

  useEffect(() => {
    if (!isEditMode && metaQuery.data) {
      setForm(createFormFromMeta(metaQuery.data));
      setSlugTouched(false);
    }
  }, [isEditMode, metaQuery.data]);

  useEffect(() => {
    if (isEditMode && productQuery.data) {
      setForm(createFormFromProduct(productQuery.data));
      setSlugTouched(Boolean(productQuery.data?.slug));
    }
  }, [isEditMode, productQuery.data]);

  const governance = useMemo(() => {
    if (isEditMode) {
      return (
        productQuery.data?.governance ?? metaQuery.data?.governance ?? null
      );
    }
    return metaQuery.data?.governance ?? null;
  }, [isEditMode, metaQuery.data, productQuery.data]);

  const authoringGovernance = governance?.authoring ?? null;
  const fieldGovernance = governance?.fieldGovernance ?? null;
  const submissionGovernance = governance?.submissionGovernance ?? null;
  const detailAuthoring = productQuery.data?.authoring ?? null;
  const publishing = productQuery.data?.publishing ?? null;
  const submission = productQuery.data?.submission ?? null;
  const submissionReason = getSubmissionReason(submission);
  const categoryReference = metaQuery.data?.references?.categories || [];
  const categoryTree = useMemo(
    () => buildCategoryTree(categoryReference),
    [categoryReference],
  );
  const selectedCategories = useMemo(
    () =>
      categoryReference.filter((category) =>
        Array.isArray(form.categoryIds)
          ? form.categoryIds.includes(Number(category.id))
          : false,
      ),
    [categoryReference, form.categoryIds],
  );
  const defaultCategoryOptions = selectedCategories;
  const canCreateDraft = Boolean(authoringGovernance?.canCreateDraft);
  const canEditDraft = Boolean(detailAuthoring?.canEditDraft);
  const canManagePublish = Boolean(governance?.canPublish);
  const canSubmitForReview = Boolean(
    isEditMode &&
    (submission?.canSubmit ||
      submission?.canResubmit ||
      submissionGovernance?.canSubmitWhenEnabled),
  );
  const isNeedsRevision = submission?.status === "needs_revision";
  const isBusy = metaQuery.isLoading || (isEditMode && productQuery.isLoading);
  const canManageMedia = Array.isArray(fieldGovernance?.sellerEditableNow)
    ? fieldGovernance.sellerEditableNow.includes("imageUrls")
    : false;
  const publishBlockers = Array.isArray(publishing?.blockedReasons)
    ? publishing.blockedReasons.filter((entry) => entry?.message)
    : [];
  const showPublishBlockers =
    publishBlockers.length > 0 &&
    Boolean(isEditMode ? !publishing?.canPublish || !publishing?.isReady : true);

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditMode
        ? updateSellerProductDraft(storeId, productId, payload)
        : createSellerProductDraft(storeId, payload),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
      ]);

      queryClient.setQueryData(
        ["seller", "products", "detail", storeId, data.id],
        data,
      );
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
      queryClient.setQueryData(
        ["seller", "products", "detail", storeId, productId],
        data,
      );
      navigate(workspaceRoutes.productDetail(data.id), { replace: true });
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getAuthoringErrorMessage(error, "edit"),
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ productId: targetProductId, published }) =>
      setSellerProductPublished(storeId, targetProductId, published),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "authoring-meta", storeId],
        }),
      ]);
      queryClient.setQueryData(
        ["seller", "products", "detail", storeId, data.id],
        data,
      );
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getPublishErrorMessage(error),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      const uploadedUrls = await Promise.all(
        files.map((file) => uploadSellerProductImage(file)),
      );
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
        imageUrls: Array.from(
          new Set([...(current.imageUrls || []), ...uploadedUrls]),
        ).slice(0, 6),
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

  const handleNameChange = (event) => {
    const nextValue = event?.target?.value ?? "";
    setForm((current) => ({
      ...current,
      name: nextValue,
      slug: slugTouched ? current.slug : slugify(nextValue),
    }));
  };

  const handleSlugChange = (event) => {
    const nextValue = slugify(event?.target?.value ?? "");
    setSlugTouched(true);
    setForm((current) => ({ ...current, slug: nextValue }));
  };

  const handleTagKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = String(tagInput || "").trim();
    if (!value) return;

    setForm((current) => {
      const exists = current.tags.some(
        (entry) => entry.toLowerCase() === value.toLowerCase(),
      );
      if (exists) return current;
      return { ...current, tags: [...current.tags, value] };
    });
    setTagInput("");
  };

  const handleRemoveTag = (tag) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((entry) => entry !== tag),
    }));
  };

  const handleToggleCategory = (categoryId) => {
    const numericId = Number(categoryId);
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    setForm((current) => {
      const nextIds = current.categoryIds.includes(numericId)
        ? current.categoryIds.filter((id) => id !== numericId)
        : [...current.categoryIds, numericId];
      const shouldClearDefault =
        current.defaultCategoryId &&
        !nextIds.includes(Number(current.defaultCategoryId));

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
      imageUrls: (current.imageUrls || []).filter(
        (entry) => entry !== imageUrl,
      ),
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
    const invalidTypeFile = files.find(
      (file) => !allowedTypes.has(String(file.type || "")),
    );
    if (invalidTypeFile) {
      setUploadStatus({
        type: "error",
        message: "Only JPG and PNG files are allowed for seller draft media.",
      });
      return;
    }

    const oversizedFile = files.find(
      (file) => Number(file.size || 0) > 2 * 1024 * 1024,
    );
    if (oversizedFile) {
      setUploadStatus({
        type: "error",
        message:
          "Each seller draft image must stay within the existing 2MB upload limit.",
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

  const buildPayload = () => {
    setStatus(null);
    setUploadStatus(null);

    const name = String(form.name || "").trim();
    const basePrice = Number(form.price || 0);
    const salePrice = form.salePrice === "" ? null : Number(form.salePrice);
    const stock = Number(form.stock || 0);

    if (!name) {
      setStatus({ type: "error", message: "Product name is required." });
      return null;
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setStatus({
        type: "error",
        message: "Base price must be a valid non-negative number.",
      });
      return null;
    }

    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0)) {
      setStatus({
        type: "error",
        message: "Sale price must be a valid non-negative number.",
      });
      return null;
    }

    if (salePrice !== null && salePrice > 0 && salePrice >= basePrice) {
      setStatus({
        type: "error",
        message: "Sale price must stay lower than the base price.",
      });
      return null;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      setStatus({
        type: "error",
        message: "Stock must be a valid non-negative integer.",
      });
      return null;
    }

    if (!Number.isInteger(stock)) {
      setStatus({ type: "error", message: "Stock must be a whole number." });
      return null;
    }

    if (form.categoryIds.length > 0 && !form.defaultCategoryId) {
      setStatus({
        type: "error",
        message: "Choose a default category when categories are selected.",
      });
      return null;
    }

    return {
      name,
      description: emptyToNull(form.description),
      sku: emptyToNull(form.sku),
      barcode: emptyToNull(form.barcode),
      slug: emptyToNull(form.slug) || slugify(name),
      categoryIds: form.categoryIds,
      defaultCategoryId: form.defaultCategoryId
        ? Number(form.defaultCategoryId)
        : null,
      price: basePrice,
      salePrice,
      stock,
      imageUrls: form.imageUrls,
      tags: Array.isArray(form.tags) ? form.tags : [],
    };
  };

  const handleSubmit = async (event, intent = "save") => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) return;

    let saved;

    try {
      saved = await mutation.mutateAsync(payload);
    } catch {
      return;
    }

    setForm(createFormFromProduct(saved));
    setSlugTouched(Boolean(saved?.slug));

    if (intent === "publish") {
      let published = null;

      try {
        published = await publishMutation.mutateAsync({
          productId: saved.id,
          published: true,
        });
      } catch {
        if (!isEditMode) {
          navigate(workspaceRoutes.productEdit(saved.id), { replace: true });
        }
        return;
      }

      setStatus({
        type: "success",
        message: published?.visibility?.storefrontVisible
          ? "Product published and is now synced to storefront visibility."
          : "Product published, but storefront visibility is still blocked.",
      });
      navigate(workspaceRoutes.productDetail(published.id), { replace: true });
      return;
    }

    setStatus({
      type: "success",
      message: isEditMode
        ? "Product changes saved in seller workspace."
        : "Draft created in seller workspace.",
    });

    if (!isEditMode) {
      navigate(workspaceRoutes.productEdit(saved.id), { replace: true });
    }
  };

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
        title="Seller product editing needs a valid product id"
        description="Open this lane from a product that belongs to the active seller store."
        action={backButton}
        tone="warning"
        Icon={Package}
      />
    );
  }

  if (isBusy) {
    return (
      <SellerWorkspaceStatePanel
        title={
          isEditMode
            ? "Loading seller product editor"
            : "Loading seller product authoring"
        }
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
        title={
          isEditMode
            ? "Failed to load seller product"
            : "Failed to load seller product authoring"
        }
        description={getSellerRequestErrorMessage(error, {
          permissionMessage: isEditMode
            ? "Your current seller access does not include draft editing."
            : "Your current seller access does not include draft creation.",
          fallbackMessage: isEditMode
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
        title="Product creation is unavailable"
        description={
          authoringGovernance?.note ||
          "Your current seller access does not include product creation in this store."
        }
        action={backButton}
        tone="warning"
        Icon={ShieldCheck}
      />
    );
  }

  if (isEditMode && productQuery.data && !canEditDraft) {
    return (
      <div className="space-y-4">
        <SellerWorkspaceStatePanel
          title="Product editing is unavailable"
          description={
            detailAuthoring?.editBlockedReason === "PRODUCT_STATUS_NOT_EDITABLE"
              ? "This product is outside the current seller edit states."
              : authoringGovernance?.note ||
                "Your current seller access does not include product editing for this store."
          }
          action={backButton}
          tone="warning"
          Icon={ShieldCheck}
        />
        <div className="flex flex-wrap gap-2">
          <Link
            to={workspaceRoutes.productDetail(productQuery.data.id)}
            className={sellerSecondaryButtonClass}
          >
            <Eye className="h-4 w-4" />
            Open detail
          </Link>
        </div>
      </div>
    );
  }

  const selectedCategoryCount = selectedCategories.length;
  const isPublished = Boolean(
    productQuery.data?.published ??
      productQuery.data?.visibility?.isPublished ??
      publishing?.isPublished
  );
  const isStorefrontVisible = Boolean(
    productQuery.data?.visibility?.storefrontVisible
  );
  const visibilityLabel =
    productQuery.data?.visibility?.sellerLabel ||
    (isStorefrontVisible
      ? "Visible in storefront"
      : isPublished
        ? "Published but blocked"
        : "Hidden from storefront");
  const saveActionLabel = mutation.isPending
    ? isEditMode
      ? "Saving..."
      : "Creating..."
    : isEditMode
      ? isNeedsRevision
        ? "Save Revision"
        : "Save"
      : "Save Draft";
  const publishActionLabel = publishMutation.isPending
    ? "Publishing..."
    : isEditMode
      ? "Publish"
      : "Create & Publish";

  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100vh-4rem)] bg-slate-100/80 px-3 py-4 md:-mx-6 md:-mt-6 md:px-6 md:py-6">
      <div className="ml-auto max-w-[1080px] rounded-[28px] bg-white">
        <div className="border-b border-slate-200/80 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                {isEditMode ? "Edit Product" : "Add Product"}
              </h1>
            </div>

            <div className="flex items-center gap-2 self-start">
              <Link
                to={workspaceRoutes.catalog()}
                className={authoringTopLinkClass}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <Link
                to={workspaceRoutes.catalog()}
                className={authoringIconButtonClass}
                aria-label="Close seller product editor"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4 md:px-6">
          {status ? (
            <SellerWorkspaceNotice type={status.type}>
              {status.message}
            </SellerWorkspaceNotice>
          ) : null}

          {uploadStatus ? (
            <SellerWorkspaceNotice type={uploadStatus.type}>
              {uploadStatus.message}
            </SellerWorkspaceNotice>
          ) : null}

          {isNeedsRevision ? (
            <SellerWorkspaceNotice type="warning">
              <div className="flex flex-wrap items-start gap-2">
                <DrawerChip
                  icon={Clock3}
                  label="Revision requested"
                  tone="amber"
                />
                {submissionReason ? (
                  <span className="text-sm text-slate-700">
                    {submissionReason}
                  </span>
                ) : (
                  <span className="text-sm text-slate-700">
                    Update the requested fields.
                  </span>
                )}
              </div>
            </SellerWorkspaceNotice>
          ) : null}

          <section className="space-y-5">
            <div className="border border-slate-200/70 bg-white px-4 py-5 md:px-5">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <ProductField
                  label="Name"
                  icon={FileText}
                  value={form.name}
                  onChange={handleNameChange}
                  disabled={mutation.isPending}
                  maxLength={255}
                  placeholder="Product name"
                />

                <ProductField
                  label="Description"
                  icon={FileText}
                  value={form.description}
                  onChange={handleChange("description")}
                  disabled={mutation.isPending}
                  multiline
                  placeholder="Short product description"
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <ProductField
                    label="SKU"
                    icon={Hash}
                    value={form.sku}
                    onChange={handleChange("sku")}
                    disabled={mutation.isPending}
                    maxLength={100}
                    placeholder="Store SKU"
                  />
                  <ProductField
                    label="Barcode"
                    icon={Hash}
                    value={form.barcode}
                    onChange={handleChange("barcode")}
                    disabled={mutation.isPending}
                    maxLength={100}
                    placeholder="EAN / UPC"
                  />
                  <ProductField
                    label="Slug"
                    icon={Tag}
                    value={form.slug}
                    onChange={handleSlugChange}
                    disabled={mutation.isPending}
                    placeholder="product-slug"
                    hint="Auto-filled until you change it."
                  />
                </div>

                <FormSectionLabel eyebrow="Placement" title="Categories" />
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block lg:col-span-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Layers3 className="h-3.5 w-3.5" />
                      Categories
                    </span>
                    <div className="mt-2 space-y-2">
                      {selectedCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCategories.slice(0, 2).map((category) => (
                            <DrawerChip
                              key={category.id}
                              icon={Layers3}
                              label={category.name}
                              tone="sky"
                            />
                          ))}
                          {selectedCategories.length > 2 ? (
                            <DrawerChip
                              icon={Layers3}
                              label={`+${selectedCategories.length - 2} more`}
                              tone="slate"
                            />
                          ) : null}
                        </div>
                      ) : null}
                      <div className="max-h-36 overflow-auto rounded-lg border border-slate-200 bg-slate-50/40 p-1.5">
                        <SellerCategoryTree
                          tree={categoryTree}
                          selectedIds={form.categoryIds}
                          onToggle={handleToggleCategory}
                        />
                      </div>
                    </div>
                  </label>

                  <label className="block">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Layers3 className="h-3.5 w-3.5" />
                      Default Category
                    </span>
                    <select
                      value={form.defaultCategoryId}
                      onChange={handleChange("defaultCategoryId")}
                      disabled={
                        mutation.isPending || selectedCategories.length === 0
                      }
                      className={`${authoringSelectClass} ${
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
                  </label>

                  <div className="lg:col-span-2">
                    <FormSectionLabel eyebrow="Commercial" title="Pricing" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr] lg:col-span-2">
                    <ProductField
                      label="Base Price"
                      icon={DollarSign}
                      value={form.price}
                      onChange={handleChange("price")}
                      disabled={mutation.isPending}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                    />

                    <ProductField
                      label="Sale Price"
                      icon={DollarSign}
                      value={form.salePrice}
                      onChange={handleChange("salePrice")}
                      disabled={mutation.isPending}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Optional"
                      hint="Must stay below base price."
                    />
                  </div>
                </div>
                <FormSectionLabel eyebrow="Operations" title="Inventory" />
                <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <ProductField
                    label="Stock"
                    icon={Package}
                    value={form.stock}
                    onChange={handleChange("stock")}
                    disabled={mutation.isPending}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                  <div className="space-y-1.5 pb-1">
                    <div className="space-y-1.5 text-sm text-slate-500">
                      <p className="inline-flex items-center gap-2 font-medium text-slate-600">
                        {isStorefrontVisible ? (
                          <Eye className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-slate-400" />
                        )}
                        {visibilityLabel}
                      </p>
                      {!governance?.canPublish ? (
                        <p className="inline-flex items-center gap-2 text-amber-700">
                          <Globe2 className="h-4 w-4" />
                          Publish unavailable
                        </p>
                      ) : null}
                    </div>
                    {submissionReason ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {submissionReason}
                      </p>
                    ) : null}
                  </div>
                </div>

                <FormSectionLabel eyebrow="Media" title="Images" />

                {canManageMedia ? (
                  <div className={`space-y-2.5 ${authoringSurfaceClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>{form.imageUrls.length} image(s)</span>
                        <span className="text-slate-300">/</span>
                        <span>6 max</span>
                      </div>
                      <label
                        className={`${authoringActionMutedClass} cursor-pointer`}
                      >
                        <Upload className="h-4 w-4" />
                        {uploadMutation.isPending
                          ? "Uploading..."
                          : "Add Images"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          className="hidden"
                          disabled={
                            uploadMutation.isPending || mutation.isPending
                          }
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

                    {Array.isArray(form.imageUrls) &&
                    form.imageUrls.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {form.imageUrls.map((imageUrl, index) => (
                          <div
                            key={`${imageUrl}-${index}`}
                            className="overflow-hidden rounded-xl border border-slate-200/80 bg-white"
                          >
                            <div className="relative h-24 w-full overflow-hidden bg-slate-100">
                              <img
                                src={resolveAssetUrl(imageUrl)}
                                alt={`Draft image ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(imageUrl)}
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-slate-600 shadow-sm transition hover:bg-white"
                                aria-label="Remove draft image"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="space-y-1 border-t border-slate-100 px-3 py-2.5">
                              <DrawerChip
                                icon={index === 0 ? CheckCircle2 : ImageIcon}
                                label={
                                  index === 0
                                    ? "Primary image"
                                    : `Image ${index + 1}`
                                }
                                tone={index === 0 ? "emerald" : "slate"}
                              />
                              <p
                                className="truncate text-xs text-slate-500"
                                title={imageUrl}
                              >
                                {imageUrl}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-400">
                        Add product images
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Media deferred</span>
                    </div>
                  </div>
                )}

                <FormSectionLabel eyebrow="Metadata" title="Tags" />
                <div className="space-y-2.5 rounded-[18px] border border-slate-200/70 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Tag className="h-3.5 w-3.5" />
                      Tags
                    </p>
                    <span className="text-xs font-medium text-slate-500">
                      {form.tags.length} tags
                    </span>
                  </div>
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Add tag"
                    className={authoringFieldClass}
                    disabled={mutation.isPending}
                  />
                  {form.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {form.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                          title={`Remove ${tag}`}
                        >
                          <Tag className="h-3.5 w-3.5" />
                          {tag}
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {showPublishBlockers ? (
                  <div className="rounded-[20px] border border-amber-200 bg-amber-50/90 px-3.5 py-3 text-sm text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium">
                          Publish needs a few updates.
                        </p>
                        <ul className="space-y-1 text-xs text-amber-800">
                          {publishBlockers.map((entry) => (
                            <li
                              key={`${entry.field || "field"}-${entry.code || entry.message}`}
                            >
                              {entry.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/98 px-1 py-3 backdrop-blur">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Final Action
                    </p>
                    <p className="text-xs text-slate-500">
                      {visibilityLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={workspaceRoutes.catalog()}
                      className={authoringActionMutedClass}
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className={authoringActionMutedClass}
                    >
                      {isEditMode ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {saveActionLabel}
                    </button>
                    {canManagePublish ? (
                      <button
                        type="button"
                        disabled={
                          mutation.isPending ||
                          publishMutation.isPending ||
                          (isEditMode && !publishing?.canPublish)
                        }
                        onClick={(event) => handleSubmit(event, "publish")}
                        className={authoringActionPrimaryClass}
                        title={isEditMode ? publishing?.hint || "Publish" : "Publish"}
                      >
                        <Globe2 className="h-4 w-4" />
                        {publishActionLabel}
                      </button>
                    ) : null}
                    {isEditMode && publishing?.canUnpublish ? (
                      <button
                        type="button"
                        disabled={publishMutation.isPending}
                        onClick={async () => {
                          setStatus(null);
                          let updated = null;

                          try {
                            updated = await publishMutation.mutateAsync({
                              productId,
                              published: false,
                            });
                          } catch {
                            return;
                          }

                          setStatus({
                            type: "success",
                            message: "Product hidden from storefront.",
                          });
                          setForm(createFormFromProduct(updated));
                        }}
                        className={authoringActionMutedClass}
                      >
                        <EyeOff className="h-4 w-4" />
                        {publishMutation.isPending
                          ? "Updating..."
                          : "Unpublish"}
                      </button>
                    ) : null}
                    {canSubmitForReview ? (
                      <button
                        type="button"
                        disabled={
                          mutation.isPending || submitMutation.isPending
                        }
                        onClick={async () => {
                          setStatus(null);
                          await submitMutation.mutateAsync();
                        }}
                        className={authoringActionMutedClass}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {submitMutation.isPending
                          ? "Submitting..."
                          : submission?.status === "needs_revision"
                            ? "Resubmit"
                            : "Submit Review"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
