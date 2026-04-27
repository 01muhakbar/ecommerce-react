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
  Search,
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
import { getSellerAttributes } from "../../api/sellerAttributes.ts";
import {
  sellerDisabledFieldClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceNotice,
  SellerWorkspaceStatePanel,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import SellerProductVariationSummary from "../../components/seller/SellerProductVariationSummary.jsx";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { buildCategoryTree } from "../../utils/categoryTree.ts";
import { summarizeProductVariations } from "../../utils/productVariations.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const emptyToNull = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const normalizeSelectedCategoryIds = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry > 0),
    ),
  );

const resolveDefaultCategoryId = (categoryIds, currentDefaultCategoryId) => {
  const normalizedIds = normalizeSelectedCategoryIds(categoryIds);
  const normalizedDefault = Number(currentDefaultCategoryId);

  if (normalizedIds.length === 0) return "";
  if (
    Number.isInteger(normalizedDefault) &&
    normalizedIds.includes(normalizedDefault)
  ) {
    return String(normalizedDefault);
  }
  return String(normalizedIds[0]);
};

const normalizeCategorySearchValue = (value) =>
  String(value || "").trim().toLowerCase();

const filterCategoryTree = (nodes, query) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  if (!query) return nodes;

  return nodes.reduce((accumulator, node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    const filteredChildren = filterCategoryTree(children, query);
    const haystack = `${node?.name || ""} ${node?.code || ""}`.toLowerCase();
    const nodeMatches = haystack.includes(query);

    if (nodeMatches) {
      accumulator.push({
        ...node,
        children,
      });
      return accumulator;
    }

    if (filteredChildren.length > 0) {
      accumulator.push({
        ...node,
        children: filteredChildren,
      });
    }

    return accumulator;
  }, []);
};

const countCategoryTreeNodes = (nodes) =>
  (Array.isArray(nodes) ? nodes : []).reduce((total, node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    return total + 1 + countCategoryTreeNodes(children);
  }, 0);

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
  categoryIds: normalizeSelectedCategoryIds(meta?.draftDefaults?.categoryIds),
  defaultCategoryId: resolveDefaultCategoryId(
    meta?.draftDefaults?.categoryIds,
    meta?.draftDefaults?.defaultCategoryId,
  ),
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
  categoryIds: normalizeSelectedCategoryIds(
    Array.isArray(product?.category?.assigned)
      ? product.category.assigned.map((category) => Number(category?.id || 0))
      : [],
  ),
  defaultCategoryId: resolveDefaultCategoryId(
    Array.isArray(product?.category?.assigned)
      ? product.category.assigned.map((category) => Number(category?.id || 0))
      : [],
    product?.category?.default?.id,
  ),
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

function SellerCategoryTree({
  tree = [],
  selectedIds = [],
  defaultCategoryId = "",
  onToggle,
  depth = 0,
}) {
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
            <label
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                isChecked
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(nodeId)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">
                  {node?.name || "Category"}
                </span>
              </span>
            </label>

            {hasChildren ? (
              <div className="ml-4 border-l border-slate-100 pl-2.5">
                <SellerCategoryTree
                  tree={node.children}
                  selectedIds={selectedIds}
                  defaultCategoryId={defaultCategoryId}
                  onToggle={onToggle}
                  depth={depth + 1}
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
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const authoringTextareaClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const authoringSelectClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50";
const authoringSurfaceClass =
  "rounded-[18px] border border-slate-200/70 bg-slate-50/45 p-3";
const authoringActionMutedClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const authoringActionPrimaryClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const authoringIconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition hover:bg-rose-100";

function AuthoringFormRow({ label, helper = null, children }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-5">
      <div className="pt-2">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AuthoringInlineField({ label, children }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[128px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AuthoringGridField({ label, children }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

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
    <AuthoringFormRow
      label={label}
      helper={hint}
    >
      {multiline ? (
        <textarea
          className={`${inputClasses} min-h-[132px] ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      ) : (
        <input
          className={`${inputClasses} ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      )}
    </AuthoringFormRow>
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

export default function SellerProductAuthoringPage({
  mode = "create",
  presentation = "page",
  onClose,
  onSuccess,
}) {
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
  const isDrawerMode = presentation === "drawer";
  const hasValidProductId =
    Number.isInteger(numericProductId) && numericProductId > 0;

  const [form, setForm] = useState(createEmptyForm());
  const [status, setStatus] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

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

  const attributeReferenceQuery = useQuery({
    queryKey: ["seller", "attributes", "reference", storeId],
    queryFn: () =>
      getSellerAttributes(storeId, {
        page: 1,
        limit: 250,
        scope: "global",
      }),
    enabled: Boolean(storeId) && canViewProducts,
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
  const attributeReferenceById = useMemo(() => {
    const reference = Array.isArray(attributeReferenceQuery.data?.data)
      ? attributeReferenceQuery.data.data
      : [];
    return new Map(
      reference
        .map((attribute) => [String(attribute?.id || "").trim(), attribute])
        .filter(([key]) => Boolean(key)),
    );
  }, [attributeReferenceQuery.data?.data]);
  const attributeReferenceByName = useMemo(() => {
    const reference = Array.isArray(attributeReferenceQuery.data?.data)
      ? attributeReferenceQuery.data.data
      : [];
    return new Map(
      reference
        .flatMap((attribute) => {
          const keys = [
            String(attribute?.name || "").trim().toLowerCase(),
            String(attribute?.displayName || "").trim().toLowerCase(),
          ].filter(Boolean);
          return keys.map((key) => [key, attribute]);
        })
        .filter(([key]) => Boolean(key)),
    );
  }, [attributeReferenceQuery.data?.data]);
  const variationSummary = useMemo(
    () =>
      summarizeProductVariations(productQuery.data?.variations?.raw, {
        attributeReferenceById,
        attributeReferenceByName,
      }),
    [
      attributeReferenceById,
      attributeReferenceByName,
      productQuery.data?.variations?.raw,
    ],
  );
  const submissionReason = getSubmissionReason(submission);
  const categoryReference = metaQuery.data?.references?.categories || [];
  const categoryTree = useMemo(
    () => buildCategoryTree(categoryReference),
    [categoryReference],
  );
  const normalizedCategorySearch = useMemo(
    () => normalizeCategorySearchValue(categorySearch),
    [categorySearch],
  );
  const filteredCategoryTree = useMemo(
    () => filterCategoryTree(categoryTree, normalizedCategorySearch),
    [categoryTree, normalizedCategorySearch],
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
      const normalizedIds = normalizeSelectedCategoryIds(nextIds);

      return {
        ...current,
        categoryIds: normalizedIds,
        defaultCategoryId: resolveDefaultCategoryId(
          normalizedIds,
          current.defaultCategoryId,
        ),
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

  const handleSetPrimaryImage = (imageUrl) => {
    setForm((current) => {
      const nextImages = Array.isArray(current.imageUrls)
        ? current.imageUrls.filter(Boolean)
        : [];
      if (!nextImages.includes(imageUrl) || nextImages[0] === imageUrl) {
        return current;
      }

      return {
        ...current,
        imageUrls: [
          imageUrl,
          ...nextImages.filter((entry) => entry !== imageUrl),
        ],
      };
    });
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

    if (typeof onSuccess === "function") {
      onSuccess(saved);
      return;
    }

    if (!isEditMode) {
      navigate(workspaceRoutes.productEdit(saved.id), { replace: true });
    }
  };

  const closeForm = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    navigate(workspaceRoutes.catalog(), { replace: true });
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
  const fallbackAction = isDrawerMode ? (
    <button
      key="close"
      type="button"
      onClick={closeForm}
      className={sellerSecondaryButtonClass}
    >
      <X className="h-4 w-4" />
      Close
    </button>
  ) : (
    backButton
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
        action={fallbackAction}
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
        action={fallbackAction}
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
        action={fallbackAction}
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
        action={fallbackAction}
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
          action={fallbackAction}
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
  const categoryTreeCount = countCategoryTreeNodes(categoryTree);
  const filteredCategoryCount = countCategoryTreeNodes(filteredCategoryTree);
  const defaultCategoryLabel =
    selectedCategories.find(
      (category) => String(category?.id) === String(form.defaultCategoryId),
    )?.name || "Auto-select from chosen categories";
  const primaryImageUrl = Array.isArray(form.imageUrls) ? form.imageUrls[0] || null : null;
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
      : "Add Product";
  const publishActionLabel = publishMutation.isPending
    ? "Publishing..."
    : isEditMode
      ? "Publish"
      : "Create & Publish";

  return (
    <div
      className={
        isDrawerMode
          ? "flex h-full min-h-0 flex-col bg-white"
          : "-mx-4 -mt-4 min-h-[calc(100vh-4rem)] bg-slate-100/80 px-3 py-4 md:-mx-6 md:-mt-6 md:px-6 md:py-6"
      }
    >
      <div
        className={
          isDrawerMode
            ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
            : "ml-auto max-w-[1080px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]"
        }
      >
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold leading-tight text-slate-900">
                {isEditMode ? "Edit Product" : "Add Product"}
              </h1>
              <p className="text-sm text-slate-500">
                {isEditMode
                  ? "Update your seller draft information from here."
                  : "Add your product and necessary information from here"}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <select
                defaultValue="en"
                className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm text-slate-700 outline-none"
                aria-label="Language"
              >
                <option value="en">en</option>
              </select>
              <button
                type="button"
                onClick={closeForm}
                className={authoringIconButtonClass}
                aria-label="Close seller product editor"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            isDrawerMode
              ? "min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5 md:px-6"
              : "space-y-4 overflow-x-hidden px-4 py-4 sm:px-5 md:px-6"
          }
        >
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

          {isEditMode ? (
          <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <DrawerChip
                icon={isEditMode ? Pencil : Plus}
                label={isEditMode ? "Edit seller product" : "Create seller draft"}
                tone="slate"
              />
              <DrawerChip
                icon={Layers3}
                label={`${selectedCategoryCount} categor${selectedCategoryCount === 1 ? "y" : "ies"}`}
                tone={selectedCategoryCount > 0 ? "sky" : "slate"}
              />
              <DrawerChip
                icon={ImageIcon}
                label={`${form.imageUrls.length} image${form.imageUrls.length === 1 ? "" : "s"}`}
                tone={form.imageUrls.length > 0 ? "emerald" : "slate"}
              />
              <DrawerChip
                icon={Globe2}
                label={visibilityLabel}
                tone={isStorefrontVisible ? "emerald" : isPublished ? "amber" : "slate"}
              />
            </div>
            <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
              <p>Default category: {defaultCategoryLabel}</p>
              <p>Primary image: {primaryImageUrl ? "Configured" : "Not set"}</p>
              <p>SKU: {form.sku || "Not set"}</p>
              <p>Slug: {form.slug || slugify(form.name) || "-"}</p>
            </div>
          </div>
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
              <form className="space-y-6 overflow-x-hidden" onSubmit={handleSubmit}>
                <div className="border-b border-slate-200 pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                      <button
                        type="button"
                        className="inline-flex h-10 shrink-0 items-center justify-center border-b-2 border-emerald-600 px-4 text-sm font-semibold text-emerald-700"
                      >
                        Basic Info
                      </button>
                      <button
                        type="button"
                        disabled
                        title="SEO fields are not available in Seller authoring yet."
                        className="inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center border-b-2 border-transparent px-4 text-sm font-semibold text-slate-300"
                      >
                        SEO
                      </button>
                    </div>
                  </div>
                </div>

                <ProductField
                  label="Product Title/Name"
                  icon={FileText}
                  value={form.name}
                  onChange={handleNameChange}
                  disabled={mutation.isPending}
                  maxLength={255}
                  placeholder="Product Title/Name"
                />

                <ProductField
                  label="Product Description"
                  icon={FileText}
                  value={form.description}
                  onChange={handleChange("description")}
                  disabled={mutation.isPending}
                  multiline
                  placeholder="Product Description"
                />

                <AuthoringFormRow label="Product SKU / Barcode">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Product SKU
                      </label>
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.sku}
                        onChange={handleChange("sku")}
                        disabled={mutation.isPending}
                        maxLength={100}
                        placeholder="Product SKU"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Product Barcode
                      </label>
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.barcode}
                        onChange={handleChange("barcode")}
                        disabled={mutation.isPending}
                        maxLength={100}
                        placeholder="Product Barcode"
                      />
                    </div>
                  </div>
                </AuthoringFormRow>

                <section className="border-t border-slate-200 pt-5">
                  <div className="space-y-5">
                    <AuthoringFormRow label="Category">
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="search"
                            value={categorySearch}
                            onChange={(event) => setCategorySearch(event.target.value)}
                            placeholder="Select one or more categories"
                            className="h-11 w-full rounded-lg border border-emerald-200 bg-white pl-10 pr-10 text-sm text-slate-700 transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50"
                          />
                          {categorySearch ? (
                            <button
                              type="button"
                              onClick={() => setCategorySearch("")}
                              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              aria-label="Clear category search"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                        <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                          {categoryReference.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                              No published categories are available for seller assignment yet.
                            </div>
                          ) : filteredCategoryTree.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                              No categories match the current search.
                            </div>
                          ) : (
                            <SellerCategoryTree
                              tree={filteredCategoryTree}
                              selectedIds={form.categoryIds}
                              defaultCategoryId={form.defaultCategoryId}
                              onToggle={handleToggleCategory}
                            />
                          )}
                        </div>
                      </div>
                    </AuthoringFormRow>

                    <AuthoringFormRow label="Default Category">
                      <select
                        value={form.defaultCategoryId}
                        onChange={handleChange("defaultCategoryId")}
                        disabled={
                          mutation.isPending || selectedCategories.length === 0
                        }
                        className={`${authoringSelectClass} max-w-[260px] ${
                          mutation.isPending || selectedCategories.length === 0
                            ? sellerDisabledFieldClass
                            : ""
                        }`}
                      >
                        <option value="">Default Category</option>
                        {defaultCategoryOptions.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </AuthoringFormRow>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AuthoringFormRow label="Product Price">
                      <div className="flex h-11 w-full max-w-none items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <span className="inline-flex h-11 w-12 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.price}
                          onChange={handleChange("price")}
                          disabled={mutation.isPending}
                          placeholder="0"
                          className={`h-11 w-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none ${
                            mutation.isPending ? sellerDisabledFieldClass : ""
                          }`}
                        />
                      </div>
                    </AuthoringFormRow>

                    <AuthoringFormRow label="Sale Price">
                      <div className="flex h-11 w-full max-w-none items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <span className="inline-flex h-11 w-12 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.salePrice}
                          onChange={handleChange("salePrice")}
                          disabled={mutation.isPending}
                          placeholder=""
                          className={`h-11 w-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none ${
                            mutation.isPending ? sellerDisabledFieldClass : ""
                          }`}
                        />
                      </div>
                    </AuthoringFormRow>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AuthoringFormRow label="Product Quantity">
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.stock}
                        onChange={handleChange("stock")}
                        disabled={mutation.isPending}
                        type="number"
                        min="0"
                        step="1"
                        placeholder=""
                      />
                    </AuthoringFormRow>

                    <AuthoringFormRow label="Product Slug">
                      <input
                        className={`${authoringFieldClass} ${
                          mutation.isPending ? sellerDisabledFieldClass : ""
                        }`}
                        value={form.slug}
                        onChange={handleSlugChange}
                        disabled={mutation.isPending}
                        placeholder="Product Slug"
                      />
                    </AuthoringFormRow>
                  </div>
                </section>

                {isEditMode ? (
                  <div className="space-y-3">
                    <FormSectionLabel
                      eyebrow="Reference"
                      title="Variant Summary"
                      description="Existing variant data is shown for reference only."
                    />
                    <div className={authoringSurfaceClass}>
                      <SellerProductVariationSummary
                        summary={variationSummary}
                        formatCurrency={formatCurrency}
                        emptyTitle="No variants stored"
                        emptyDescription="This product does not currently expose variant data in seller authoring."
                        readOnlyHint="Variant combinations are read-only here. Use this summary to review the existing attribute and stock setup."
                      />
                    </div>
                  </div>
                ) : null}

                {canManageMedia ? (
                  <section className="space-y-4 border-t border-slate-200 pt-6">
                    <AuthoringFormRow label="Product Images">
                    <div className={`space-y-2.5 ${authoringSurfaceClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>{form.imageUrls.length} image(s)</span>
                          <span className="text-slate-300">/</span>
                          <span>6 max</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          The first image becomes the primary storefront preview.
                        </p>
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
                              <div className="flex flex-wrap gap-2 pt-1">
                                {index !== 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimaryImage(imageUrl)}
                                    className={authoringActionMutedClass}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Set as Primary
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(imageUrl)}
                                  className={authoringActionMutedClass}
                                >
                                  <X className="h-4 w-4" />
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-7 w-7 text-slate-300" />
                          <span className="font-medium text-slate-600">Drag your images here</span>
                          <span>JPG and PNG only, up to 2MB each.</span>
                        </div>
                      </div>
                    )}
                    </div>
                    </AuthoringFormRow>
                  </section>
                ) : (
                  <section className="space-y-4 border-t border-slate-200 pt-6">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Media deferred</span>
                    </div>
                    </div>
                  </section>
                )}

                <section className="space-y-4 border-t border-slate-200 pt-6">
                  <AuthoringFormRow label="Product Tags">
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
                    placeholder="Product Tag (Write then press enter to add new tag)"
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
                  </AuthoringFormRow>
                </section>

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

                <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/98 px-1 py-3 backdrop-blur">
                  <div className="flex flex-wrap gap-2 sm:ml-auto">
                    <Link
                      to={workspaceRoutes.catalog()}
                      onClick={(event) => {
                        if (isDrawerMode) {
                          event.preventDefault();
                          closeForm();
                        }
                      }}
                      className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isEditMode ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {saveActionLabel}
                    </button>
                    {isEditMode && canManagePublish ? (
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
