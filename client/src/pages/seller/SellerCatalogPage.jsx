import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Eye,
  Layers3,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Send,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  bulkSubmitSellerProductsForReview,
  deleteSellerProduct,
  duplicateSellerProduct,
  exportSellerProducts,
  getSellerProductAuthoringMeta,
  getSellerProducts,
  importSellerProducts,
  setSellerProductPublished,
  submitSellerProductDraftForReview,
} from "../../api/sellerProducts.ts";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { prevData } from "../../lib/rq.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import {
  sellerFieldClass,
  sellerTableWrapClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceStatePanel,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import ProductFilterBar from "../../components/Products/ProductFilterBar.jsx";
import ProductInventoryBadge from "../../components/Products/ProductInventoryBadge.jsx";
import ProductManagementHeader from "../../components/Products/ProductManagementHeader.jsx";
import ProductPublishedToggle from "../../components/Products/ProductPublishedToggle.jsx";
import ProductRowActionsMenu from "../../components/Products/ProductRowActionsMenu.jsx";
import SellerProductAuthoringPage from "./SellerProductAuthoringPage.jsx";

const DEFAULT_FILTERS = {
  keyword: "",
  categoryIds: [],
  sort: "",
  status: "",
  published: "",
  submissionStatus: "",
  visibilityState: "",
  page: 1,
  limit: 20,
};

const DEFAULT_COLUMN_VISIBILITY = {
  product: true,
  category: true,
  price: true,
  salePrice: true,
  stock: true,
  inventory: true,
  view: true,
  published: true,
  actions: true,
};

const COLUMN_VISIBILITY_OPTIONS = [
  ["product", "Product"],
  ["category", "Category"],
  ["price", "Price"],
  ["salePrice", "Sale Price"],
  ["stock", "Stock"],
  ["inventory", "Inventory"],
  ["view", "View"],
  ["published", "Published"],
  ["actions", "Actions"],
];

const UI_ONLY_CATEGORY_FALLBACK = [
  { id: "category-fallback-fruit", name: "Fresh Fruits" },
  { id: "category-fallback-vegetable", name: "Fresh Vegetables" },
  { id: "category-fallback-bakery", name: "Bread & Bakery" },
  { id: "category-fallback-dairy", name: "Milk & Dairy" },
];

const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024;

const SELLER_SORT_FILTER_GROUPS = [
  {
    key: "sort",
    label: "Sort",
    options: [
      { value: "price_asc", label: "Low to High" },
      { value: "price_desc", label: "High to Low" },
      { value: "date_added", label: "Date Added" },
      { value: "date_updated", label: "Date Updated" },
    ],
  },
];

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

const getVisibilityTone = (visibility) => {
  if (visibility?.stateCode === "STOREFRONT_VISIBLE") return "emerald";
  if (visibility?.stateCode === "PUBLISHED_BLOCKED") return "amber";
  return "stone";
};

const isReadyToSubmitItem = (item) =>
  item?.status === "draft" &&
  item?.submission?.status === "none" &&
  Boolean(item?.submission?.canSubmit);

const getSubmissionTone = (item) => {
  if (isReadyToSubmitItem(item)) return "emerald";
  if (item?.submission?.status === "submitted") return "sky";
  if (item?.submission?.status === "needs_revision") return "amber";
  return "stone";
};

const buildActiveFilterCount = (filters) =>
  [
    filters.keyword?.trim(),
    Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0
      ? filters.categoryIds.join(",")
      : "",
    filters.sort,
    filters.status,
    filters.published,
    filters.submissionStatus,
    filters.visibilityState,
  ].filter(Boolean).length;

const getStatusFilterLabel = (status) => {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  if (status === "draft") return "Draft";
  return "All lifecycle";
};

const getSubmissionFilterLabel = (status) => {
  if (status === "ready_to_submit") return "Ready to submit";
  if (status === "review_queue") return "Review queue";
  if (status === "submitted") return "Submitted for review";
  if (status === "needs_revision") return "Needs revision";
  if (status === "none") return "Not submitted";
  return "All submission";
};

const getPublishedFilterLabel = (value) => {
  if (value === "true") return "Published";
  if (value === "false") return "Unpublished";
  return "All publish states";
};

const getVisibilityFilterLabel = (value) => {
  if (value === "storefront_visible") return "Storefront visible";
  if (value === "published_blocked") return "Visibility blocked";
  if (value === "internal_only") return "Hidden from storefront";
  return "All visibility";
};

const buildAppliedFilterPills = (filters) => {
  const pills = [];

  if (filters.keyword?.trim()) {
    pills.push(`Search: "${filters.keyword.trim()}"`);
  }
  if (filters.status) {
    pills.push(`Lifecycle: ${getStatusFilterLabel(filters.status)}`);
  }
  if (filters.published) {
    pills.push(`Publish: ${getPublishedFilterLabel(filters.published)}`);
  }
  if (filters.submissionStatus) {
    pills.push(`Submission: ${getSubmissionFilterLabel(filters.submissionStatus)}`);
  }
  if (filters.visibilityState) {
    pills.push(`Visibility: ${getVisibilityFilterLabel(filters.visibilityState)}`);
  }

  return pills;
};

const downloadBlobFile = (filename, blob) => {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
};

const formatFileSize = (value) => {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

const buildUiPreviewCategoryOptions = (items = []) => {
  const options = Array.from(
    new Map(
      items
        .map((item) => item?.category)
        .filter((category) => category?.name)
        .map((category) => [
          String(category.id || category.code || category.name).trim().toLowerCase(),
          {
            id:
              category.id ||
              `category-${String(category.code || category.name).trim().toLowerCase()}`,
            name: category.name,
            code: category.code || null,
          },
        ])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name, "id"));

  return options.length > 0 ? options : UI_ONLY_CATEGORY_FALLBACK;
};

const getSortFilterLabel = (value) => {
  const selected = SELLER_SORT_FILTER_GROUPS[0]?.options.find((option) => option.value === value);
  return selected?.label || "Price";
};

function ReviewQueueCard({
  label,
  count,
  tone = "slate",
  active = false,
  onClick,
  Icon = null,
}) {
  const toneClass =
    tone === "sky"
      ? active
        ? "border-sky-300 bg-sky-50 text-sky-900"
        : "border-sky-200 bg-white text-sky-800"
      : tone === "amber"
        ? active
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-amber-200 bg-white text-amber-800"
        : tone === "emerald"
          ? active
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-emerald-200 bg-white text-emerald-800"
          : active
            ? "border-slate-300 bg-slate-50 text-slate-900"
            : "border-slate-200 bg-white text-slate-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${toneClass}`}
      title={label}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{count}</span>
    </button>
  );
}

function CompactSummaryItem({ label, value, tone = "slate", Icon = null }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
          <p className="mt-2 text-lg font-semibold leading-none">{value}</p>
        </div>
        {Icon ? <Icon className="mt-0.5 h-4 w-4 opacity-70" /> : null}
      </div>
    </div>
  );
}

function CompactMetricPill({ label, value, tone = "slate", Icon = null, title = "" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : tone === "rose"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-white text-slate-800";

  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium ${toneClass}`}
      title={title || label}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function CompactMetaItem({ Icon, label, title = "" }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-slate-500"
      title={title || label}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
      <span>{label}</span>
    </span>
  );
}

const getSubmissionActionErrorMessage = (error) => {
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
      permissionMessage: "Your current seller access does not include seller draft submission.",
      fallbackMessage: "Failed to submit seller draft for review.",
    })
  );
};

const getPublishActionErrorMessage = (error) => {
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

const getCurrentLaneLabel = (filters) => {
  if (filters.submissionStatus === "ready_to_submit") return "Ready";
  if (filters.submissionStatus === "review_queue") return "Queue";
  if (filters.submissionStatus === "submitted") return "Submitted for review";
  if (filters.submissionStatus === "needs_revision") return "Needs revision";
  if (filters.status === "draft") return "Draft";
  if (filters.published === "true") return "Published";
  if (filters.published === "false") return "Unpublished";
  if (filters.visibilityState === "storefront_visible") return "Visible";
  if (filters.visibilityState === "published_blocked") return "Blocked";
  if (filters.visibilityState === "internal_only") return "Hidden";
  return "All";
};

const getSubmissionReason = (submission) =>
  submission?.reviewNote || submission?.revisionReason || submission?.revisionNote || null;

const compactTableHeadClass =
  "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap";
const compactTableCellClass = "px-2 py-1.5 align-top text-[13px] text-slate-700";
const compactTableIconCellClass = "px-1.5 py-1.5 align-top text-[13px] text-slate-700";
const adminAlignedPanelClass =
  "rounded-[18px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";
const adminAlignedButtonBase =
  "inline-flex h-[34px] items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
const adminAlignedOutlineButton =
  `${adminAlignedButtonBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const adminAlignedPrimaryButton =
  `${adminAlignedButtonBase} bg-emerald-500 text-white hover:bg-emerald-600`;
const adminAlignedDangerButton =
  `${adminAlignedButtonBase} border border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400 hover:bg-rose-100`;

const getCompactStockMeta = (item) => {
  const stock = Number(item?.inventory?.stock ?? item?.availability?.stock ?? 0);
  if (stock <= 0) {
    return {
      label: "Out of Stock",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-600",
    };
  }
  if (stock <= 10) {
    return {
      label: "Low Stock",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: "Selling",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
};

const getCompactSubmissionHint = (item) => {
  if (item?.submission?.status === "submitted") return "Waiting admin review";
  if (item?.submission?.status === "needs_revision") return "Revise and resubmit";
  if (isReadyToSubmitItem(item)) return "Ready now";
  if (item?.authoring?.canEditDraft) return "Edit draft";
  if (item?.status === "draft") return "Draft";
  return "Read-only";
};

const getCompactSubmissionLabel = (item) => {
  if (item?.submission?.status === "submitted") return "Submitted for review";
  if (item?.submission?.status === "needs_revision") return "Needs revision";
  if (isReadyToSubmitItem(item)) return "Ready to submit";
  if (item?.status === "draft") return "Draft";
  return item?.submission?.label || "Not submitted";
};

const getCompactVisibilityLabel = (item) => {
  const visibility = item?.visibility || null;
  const reasonCode = String(visibility?.reasonCode || "").trim().toUpperCase();

  if (visibility?.storefrontVisible) {
    return visibility?.storefrontLabel || "Visible";
  }
  if (reasonCode === "STORE_NOT_READY") return "Store not ready";
  if (reasonCode === "STORE_NOT_ACTIVE") return "Store blocked";
  if (reasonCode === "REVIEW_PENDING") return "Review blocked";
  if (reasonCode === "REVISION_REQUIRED") return "Revision blocked";
  if (item?.status === "draft") return "Draft";
  if (visibility?.stateCode === "PUBLISHED_BLOCKED") return visibility?.sellerLabel || "Blocked";
  return "Hidden";
};

const getCompactLifecycleLabel = (item) => {
  const status = String(item?.statusMeta?.code || item?.status || "").toLowerCase();
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Draft";
};

const getLifecycleTone = (item) => {
  const status = String(item?.statusMeta?.code || item?.status || "").toLowerCase();
  if (status === "active") return "emerald";
  if (status === "inactive") return "stone";
  return "amber";
};

const getCompactVisibilityHint = (item) => {
  const visibility = item?.visibility || null;
  if (visibility?.sellerHint) return visibility.sellerHint;
  if (visibility?.storefrontReason) return visibility.storefrontReason;
  if (visibility?.storefrontVisible) return "Visible to customers";
  if (item?.status === "draft") return "Draft stays internal";
  if (visibility?.stateCode === "PUBLISHED_BLOCKED") {
    return "Lifecycle still blocks storefront";
  }
  return "Hidden from storefront";
};

const getPublishedStateMeta = (item) => {
  const published = Boolean(
    item?.published ?? item?.visibility?.isPublished ?? item?.publishing?.isPublished
  );

  return {
    published,
    label: published ? "Published" : "Unpublished",
    hint: published
      ? item?.visibility?.storefrontVisible
        ? "Published and storefront-visible."
        : "Published, but storefront visibility is still blocked."
      : "Hidden from storefront until publish is turned on.",
  };
};

const isItemEligibleForBulkAction = (item, action) => {
  if (!item || action === "") return false;

  if (action === "submit_review") {
    return (
      item.status === "draft" &&
      item.submission?.status === "none" &&
      Boolean(item.submission?.canSubmit)
    );
  }

  if (action === "resubmit_review") {
    return (
      item.status === "draft" &&
      item.submission?.status === "needs_revision" &&
      Boolean(item.submission?.canResubmit)
    );
  }

  return false;
};

const getBulkActionErrorMessage = (error) =>
  getSellerRequestErrorMessage(error, {
    permissionMessage:
      "Your current seller access does not include seller bulk submission actions.",
    fallbackMessage: "Failed to run seller bulk action.",
  });

const getDuplicateActionErrorMessage = (error) =>
  getSellerRequestErrorMessage(error, {
    permissionMessage:
      "Your current seller access does not include creating seller draft copies.",
    fallbackMessage: "Failed to duplicate seller product.",
  });

const getDeleteActionErrorMessage = (error) =>
  getSellerRequestErrorMessage(error, {
    permissionMessage:
      "Your current seller access does not include deleting or archiving seller products.",
    fallbackMessage: "Failed to delete seller product.",
  });

export default function SellerCatalogPage({ variant = "catalog" }) {
  const queryClient = useQueryClient();
  const { workspaceStoreId: storeId, workspaceRoutes, sellerContext } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");
  const canEditProducts = permissionKeys.includes("PRODUCT_EDIT");
  const canArchiveProducts = permissionKeys.includes("PRODUCT_ARCHIVE");
  const canPublishProducts = permissionKeys.includes("PRODUCT_PUBLISH");
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY);
  const [actionNotice, setActionNotice] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [submittingProductId, setSubmittingProductId] = useState(null);
  const [duplicatingProductId, setDuplicatingProductId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [pendingImportSummary, setPendingImportSummary] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [rowActionMenu, setRowActionMenu] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [priceSearch, setPriceSearch] = useState("");
  const [isCreateDrawerMounted, setIsCreateDrawerMounted] = useState(false);
  const [isCreateDrawerVisible, setIsCreateDrawerVisible] = useState(false);
  const isLanding = variant === "landing";

  const authoringMetaQuery = useQuery({
    queryKey: ["seller", "products", "authoring-meta", storeId],
    queryFn: () => getSellerProductAuthoringMeta(storeId),
    enabled: Boolean(storeId) && canViewProducts,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const productsQuery = useQuery({
    queryKey: ["seller", "products", storeId, appliedFilters],
    queryFn: () => getSellerProducts(storeId, appliedFilters),
    enabled: Boolean(storeId) && canViewProducts,
    placeholderData: prevData,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (productId) => submitSellerProductDraftForReview(storeId, productId),
    onMutate: (productId) => {
      setSubmittingProductId(Number(productId));
      setActionNotice(null);
    },
    onSuccess: async (data, productId) => {
      setSelectedIds((current) => {
        if (!current.has(Number(productId))) return current;
        const next = new Set(current);
        next.delete(Number(productId));
        return next;
      });
      setActionNotice({
        type: "success",
        message:
          data?.submission?.status === "submitted"
            ? "Sent to admin review. Editing is now locked until an admin decision or revision request."
            : "Seller draft submitted.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "detail", storeId, productId],
        }),
      ]);
    },
    onError: (error) => {
      setActionNotice({
        type: "error",
        message: getSubmissionActionErrorMessage(error),
      });
    },
    onSettled: () => {
      setSubmittingProductId(null);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkSubmitSellerProductsForReview(storeId, action, ids),
    onMutate: () => {
      setActionNotice(null);
    },
    onSuccess: async (data, variables) => {
      const skippedCount = Number(variables?.skippedCount || 0);
      const successCount = Number(data?.summary?.successCount || 0);
      const failureCount = Number(data?.summary?.failureCount || 0) + skippedCount;
      const failedRows = Array.isArray(data?.results)
        ? data.results.filter((entry) => entry.status === "failed").slice(0, 4)
        : [];

      setSelectedIds((current) => {
        const successfulIds = new Set(
          (Array.isArray(data?.results) ? data.results : [])
            .filter((entry) => entry.status === "success")
            .map((entry) => Number(entry.id))
        );

        if (successfulIds.size === 0) return current;
        return new Set([...current].filter((id) => !successfulIds.has(Number(id))));
      });
      setActionNotice({
        type:
          successCount > 0 && failureCount > 0
            ? "warning"
            : successCount > 0
              ? "success"
              : "error",
        title: data?.actionLabel || "Bulk action",
        message:
          successCount > 0
            ? `${successCount} product(s) moved into the seller submission lane. Admin remains the final reviewer.`
            : "No selected products were eligible for that seller bulk action.",
        details: [
          skippedCount > 0
            ? `${skippedCount} selected row(s) were skipped in the workspace because their current state does not match the chosen action.`
            : null,
          ...failedRows.map(
            (entry) =>
              `${entry?.name || `Product #${entry?.id}`}: ${entry?.message || "Bulk action failed."}`
          ),
        ].filter(Boolean),
        meta:
          failureCount > 0
            ? `${failureCount} row(s) were rejected because the current state or store boundary was invalid.`
            : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] });
    },
    onError: (error) => {
      setActionNotice({
        type: "error",
        message: getBulkActionErrorMessage(error),
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (productId) => duplicateSellerProduct(storeId, productId),
    onMutate: (productId) => {
      setDuplicatingProductId(Number(productId));
      setActionNotice(null);
    },
    onSuccess: async (data) => {
      setActionNotice({
        type: "success",
        title: "Duplicate created",
        message: `${data?.name || "Product copy"} created as a seller draft copy.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "detail", storeId, data?.id],
        }),
      ]);
    },
    onError: (error) => {
      setActionNotice({
        type: "error",
        title: "Duplicate failed",
        message: getDuplicateActionErrorMessage(error),
      });
    },
    onSettled: () => {
      setDuplicatingProductId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId) => deleteSellerProduct(storeId, productId),
    onMutate: (productId) => {
      setDeletingProductId(Number(productId));
      setActionNotice(null);
    },
    onSuccess: async (data, productId) => {
      setSelectedIds((current) => {
        if (!current.has(Number(productId))) return current;
        const next = new Set(current);
        next.delete(Number(productId));
        return next;
      });
      setActionNotice({
        type: data?.archived ? "warning" : "success",
        title: data?.archived ? "Product archived" : "Product deleted",
        message:
          data?.message ||
          (data?.archived
            ? "This product was archived instead of deleted."
            : "Product deleted successfully."),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "detail", storeId, productId],
        }),
      ]);
    },
    onError: (error) => {
      setActionNotice({
        type: "error",
        title: "Delete failed",
        message: getDeleteActionErrorMessage(error),
      });
    },
    onSettled: () => {
      setDeletingProductId(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: (file) => importSellerProducts(storeId, file),
    onMutate: () => {
      setActionNotice(null);
    },
    onSuccess: async (data) => {
      const failed = Number(data?.failed || 0);
      const created = Number(data?.created || 0);
      const totalRows = Number(data?.totalRows || 0);
      const errorPreview = Array.isArray(data?.errors)
        ? data.errors.slice(0, 5).map((entry) => {
            const rowLabel = entry?.row ? `Row ${entry.row}` : "Row";
            const slugLabel = entry?.slug ? ` (${entry.slug})` : "";
            return `${rowLabel}${slugLabel}: ${entry?.message || "Import row failed."}`;
          })
        : [];

      setActionNotice({
        type: failed > 0 ? (created > 0 ? "warning" : "error") : "success",
        title: failed > 0 ? "Import completed with warnings" : "Import completed",
        message: `Processed ${totalRows} row(s): ${created} created, ${failed} failed.`,
        details: errorPreview,
        meta:
          failed > errorPreview.length
            ? `${failed - errorPreview.length} additional row error(s) not shown.`
            : null,
      });
      setPendingImportFile(null);
      setPendingImportSummary(null);
      setImportMenuOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] });
    },
    onError: (error) => {
      setActionNotice({
        type: "error",
        title: "Import failed",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Import failed. Please try again.",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ productId, published }) =>
      setSellerProductPublished(storeId, productId, published),
    onMutate: () => {
      setActionNotice(null);
    },
    onSuccess: async (data) => {
      setActionNotice({
        type: "success",
        message: data?.published
          ? data?.visibility?.storefrontVisible
            ? "Product published and synced to storefront visibility."
            : "Product published, but storefront visibility is still blocked."
          : "Product hidden from storefront.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "products", storeId] }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "products", "detail", storeId, data?.id],
        }),
      ]);
    },
    onError: (error) => {
      setActionNotice({
        type: "error",
        message: getPublishActionErrorMessage(error),
      });
    },
  });

  const summary = useMemo(() => {
    const apiSummary = productsQuery.data?.summary;
    if (apiSummary) return apiSummary;

    const items = productsQuery.data?.items || [];
    return {
      totalProducts: items.length,
      drafts: items.filter((item) => item.status === "draft").length,
      readyToSubmit: items.filter((item) => isReadyToSubmitItem(item)).length,
      active: items.filter((item) => item.status === "active").length,
      inactive: items.filter((item) => item.status === "inactive").length,
      submitted: items.filter((item) => item.submission?.status === "submitted").length,
      needsRevision: items.filter((item) => item.submission?.status === "needs_revision").length,
      reviewQueue: items.filter((item) =>
        ["submitted", "needs_revision"].includes(item.submission?.status)
      ).length,
      storefrontVisible: items.filter(
        (item) => item.visibility?.stateCode === "STOREFRONT_VISIBLE"
      ).length,
      publishedBlocked: items.filter(
        (item) => item.visibility?.stateCode === "PUBLISHED_BLOCKED"
      ).length,
      internalOnly: items.filter((item) => item.visibility?.stateCode === "INTERNAL_ONLY").length,
    };
  }, [productsQuery.data]);

  const items = productsQuery.data?.items || [];
  const pagination = productsQuery.data?.pagination || { page: 1, limit: 20, total: 0 };
  const contractNotes = Array.isArray(productsQuery.data?.contract?.notes)
    ? productsQuery.data.contract.notes
    : [];
  const catalogGovernance = productsQuery.data?.governance ?? null;
  const authoringGovernance = catalogGovernance?.authoring ?? null;
  const catalogCanDelete = catalogGovernance?.canDelete !== false;
  const canCreateDraft = Boolean(authoringGovernance?.canCreateDraft);
  const totalPages = Math.max(
    1,
    Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 20))
  );
  const activeFilterCount = buildActiveFilterCount(appliedFilters);
  const itemIds = useMemo(
    () => items.map((item) => Number(item.id)).filter((id) => id > 0),
    [items]
  );
  const itemMap = useMemo(
    () =>
      new Map(items.map((item) => [Number(item.id), item]).filter(([id]) => Number(id) > 0)),
    [items]
  );
  const selectedIdList = useMemo(
    () => [...selectedIds].map((id) => Number(id)).filter((id) => id > 0),
    [selectedIds]
  );
  const selectedCount = selectedIdList.length;
  const allVisibleSelected = itemIds.length > 0 && itemIds.every((id) => selectedIds.has(id));
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;
  const isToolbarBusy =
    isExporting ||
    bulkMutation.isPending ||
    submitMutation.isPending ||
    publishMutation.isPending;
  const referencedCategories = Array.isArray(authoringMetaQuery.data?.references?.categories)
    ? authoringMetaQuery.data.references.categories
    : [];
  const uiPreviewCategoryOptions = useMemo(
    () =>
      referencedCategories.length > 0
        ? referencedCategories
        : buildUiPreviewCategoryOptions(items),
    [items, referencedCategories]
  );
  const filteredUiCategoryOptions = useMemo(() => {
    const keyword = String(categorySearch || "").trim().toLowerCase();
    if (!keyword) return uiPreviewCategoryOptions;
    return uiPreviewCategoryOptions.filter((category) =>
      String(category?.name || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [categorySearch, uiPreviewCategoryOptions]);
  const selectedUiCategoryNames = useMemo(
    () =>
      uiPreviewCategoryOptions
        .filter((category) =>
          (draftFilters.categoryIds || []).includes(Number(category.id))
        )
        .map((category) => category.name),
    [draftFilters.categoryIds, uiPreviewCategoryOptions]
  );
  const selectedUiCategoryLabel =
    selectedUiCategoryNames.length === 0
      ? "Category"
      : selectedUiCategoryNames.length === 1
        ? selectedUiCategoryNames[0]
        : `${selectedUiCategoryNames.length} categories`;
  const uiPreviewSelectionCount = draftFilters.sort ? 1 : 0;
  const uiPreviewButtonLabel = getSortFilterLabel(draftFilters.sort);
  const filteredUiPreviewGroups = useMemo(() => {
    const keyword = String(priceSearch || "").trim().toLowerCase();
    return SELLER_SORT_FILTER_GROUPS.map((group) => ({
      ...group,
      options: keyword
        ? group.options.filter((option) => option.label.toLowerCase().includes(keyword))
        : group.options,
    })).filter((group) => group.options.length > 0);
  }, [priceSearch]);
  const selectedReadyToSubmitIds = useMemo(
    () =>
      selectedIdList.filter((id) =>
        isItemEligibleForBulkAction(itemMap.get(id), "submit_review")
      ),
    [itemMap, selectedIdList]
  );
  const selectedRevisionIds = useMemo(
    () =>
      selectedIdList.filter((id) =>
        isItemEligibleForBulkAction(itemMap.get(id), "resubmit_review")
      ),
    [itemMap, selectedIdList]
  );
  const closeFloatingMenus = () => {
    setExportMenuOpen(false);
    setImportMenuOpen(false);
    setBulkMenuOpen(false);
    setCategoryMenuOpen(false);
    setPriceMenuOpen(false);
    setColumnMenuOpen(false);
    setRowActionMenu(null);
  };

  const openCreateDrawer = () => {
    if (!canCreateDraft) return;
    closeFloatingMenus();
    setActionNotice(null);
    setIsCreateDrawerMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsCreateDrawerVisible(true));
    });
  };

  const closeCreateDrawer = () => {
    setIsCreateDrawerVisible(false);
    window.setTimeout(() => {
      setIsCreateDrawerMounted(false);
    }, 260);
  };

  const toggleFloatingMenu = (menuName) => {
    const menuState = {
      export: exportMenuOpen,
      import: importMenuOpen,
      bulk: bulkMenuOpen,
      category: categoryMenuOpen,
      price: priceMenuOpen,
      column: columnMenuOpen,
    };
    const shouldOpen = !menuState[menuName];

    closeFloatingMenus();
    if (!shouldOpen) return;

    if (menuName === "export") setExportMenuOpen(true);
    if (menuName === "import") setImportMenuOpen(true);
    if (menuName === "bulk") setBulkMenuOpen(true);
    if (menuName === "category") setCategoryMenuOpen(true);
    if (menuName === "price") setPriceMenuOpen(true);
    if (menuName === "column") setColumnMenuOpen(true);
  };

  const toggleRowActionMenu = (event, productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 220;
    const margin = 12;
    const left = Math.min(
      Math.max(margin, rect.right - menuWidth),
      Math.max(margin, window.innerWidth - menuWidth - margin)
    );
    const fitsBelow = rect.bottom + 8 + menuHeight <= window.innerHeight - margin;
    const top = fitsBelow
      ? rect.bottom + 8
      : Math.max(margin, rect.top - menuHeight - 8);

    setExportMenuOpen(false);
    setImportMenuOpen(false);
    setBulkMenuOpen(false);
    setCategoryMenuOpen(false);
    setPriceMenuOpen(false);
    setColumnMenuOpen(false);
    setRowActionMenu((current) =>
      current?.id === id ? null : { id, top, left }
    );
  };

  useEffect(() => {
    setSelectedIds((current) => {
      const allowed = new Set(itemIds);
      const next = [...current].filter((id) => allowed.has(Number(id)));
      if (next.length === current.size) return current;
      return new Set(next);
    });
  }, [itemIds]);

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (!target.closest("[data-seller-products-export-menu]")) setExportMenuOpen(false);
      if (!target.closest("[data-seller-products-import-menu]")) setImportMenuOpen(false);
      if (!target.closest("[data-seller-products-bulk-menu]")) setBulkMenuOpen(false);
      if (!target.closest("[data-seller-products-category-menu]")) setCategoryMenuOpen(false);
      if (!target.closest("[data-seller-products-price-menu]")) setPriceMenuOpen(false);
      if (!target.closest("[data-seller-products-column-menu]")) setColumnMenuOpen(false);
      if (!target.closest("[data-seller-products-row-menu]")) setRowActionMenu(null);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeFloatingMenus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closeFloatingMenus);
    window.addEventListener("scroll", closeFloatingMenus);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closeFloatingMenus);
      window.removeEventListener("scroll", closeFloatingMenus);
    };
  }, []);

  useEffect(() => {
    if (!isCreateDrawerMounted) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeCreateDrawer();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isCreateDrawerMounted]);

  const resetFilters = () => {
    closeFloatingMenus();
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setCategorySearch("");
    setPriceSearch("");
    setActionNotice(null);
    setSelectedIds(new Set());
  };

  const emptyStateAction =
    activeFilterCount > 0 ? (
      <button type="button" onClick={resetFilters} className={adminAlignedOutlineButton}>
        <RotateCcw className="h-4 w-4" />
        Reset filters
      </button>
    ) : canCreateDraft ? (
      <button
        type="button"
        onClick={openCreateDrawer}
        className={adminAlignedPrimaryButton}
        aria-label="+ Add Product"
      >
        + Add Product
      </button>
    ) : null;

  const updatePage = (page) => {
    setSelectedIds(new Set());
    closeFloatingMenus();
    setDraftFilters((current) => ({ ...current, page }));
    setAppliedFilters((current) => ({ ...current, page }));
  };

  const updateKeywordFilter = (value) => {
    setSelectedIds(new Set());
    setDraftFilters((current) => ({
      ...current,
      keyword: value,
      page: 1,
    }));
    setAppliedFilters((current) => ({
      ...current,
      keyword: value,
      page: 1,
    }));
  };

  const applyQuickLane = (nextPartial) => {
    setSelectedIds(new Set());
    closeFloatingMenus();
    const nextDraft = {
      ...draftFilters,
      ...nextPartial,
      page: 1,
    };
    const nextApplied = {
      ...appliedFilters,
      ...nextPartial,
      page: 1,
    };
    setDraftFilters(nextDraft);
    setAppliedFilters(nextApplied);
  };

  const handleExport = async (format = "csv") => {
    if (!storeId) return;
    setIsExporting(true);
    closeFloatingMenus();
    setActionNotice(null);

    try {
      const exportPayload = await exportSellerProducts(storeId, {
        format,
        filters: {
          keyword: appliedFilters.keyword,
          categoryIds: appliedFilters.categoryIds,
          sort: appliedFilters.sort,
          status: appliedFilters.status,
          published: appliedFilters.published,
          submissionStatus: appliedFilters.submissionStatus,
          visibilityState: appliedFilters.visibilityState,
        },
      });
      downloadBlobFile(exportPayload.filename, exportPayload.blob);
      setActionNotice({
        type: "success",
        message: `Exported the current seller product result set as ${String(format).toUpperCase()}.`,
      });
    } catch (error) {
      setActionNotice({
        type: "error",
        message:
          error?.message || "Failed to export seller products for the active workspace.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const triggerImportPicker = () => {
    if (!canCreateDraft) return;
    const input = document.getElementById("seller-products-import-input");
    input?.click();
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const normalizedName = String(file.name || "").toLowerCase();
    const normalizedType = String(file.type || "").toLowerCase();
    const looksLikeJson =
      normalizedName.endsWith(".json") ||
      normalizedType === "application/json" ||
      normalizedType.endsWith("+json");
    const looksLikeCsv =
      normalizedName.endsWith(".csv") ||
      normalizedType === "text/csv" ||
      normalizedType === "application/csv" ||
      normalizedType === "application/vnd.ms-excel";

    if (!looksLikeJson && !looksLikeCsv) {
      setPendingImportFile(null);
      setPendingImportSummary(null);
      setActionNotice({
        type: "error",
        title: "Invalid import file",
        message: "Seller import only accepts CSV or JSON files.",
      });
      return;
    }

    if (file.size <= 0) {
      setPendingImportFile(null);
      setPendingImportSummary(null);
      setActionNotice({
        type: "error",
        title: "Empty import file",
        message: "Choose a CSV or JSON file that contains at least one product row.",
      });
      return;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setPendingImportFile(null);
      setPendingImportSummary(null);
      setActionNotice({
        type: "error",
        title: "Import file too large",
        message: "Import file exceeds the 2 MB limit for the current seller import flow.",
      });
      return;
    }

    setPendingImportFile(file);
    setPendingImportSummary({
      name: file.name,
      size: file.size,
      type: file.type || "Unknown file type",
    });
    setActionNotice({
      type: "success",
      title: "Import file ready",
      message: `${file.name} is ready for Seller product import.`,
    });
  };

  const handleImportNow = () => {
    if (!pendingImportFile || importMutation.isPending) return;
    importMutation.mutate(pendingImportFile);
  };

  const toggleUiCategorySelection = (categoryId) => {
    const nextCategoryId = Number(categoryId);
    if (!Number.isFinite(nextCategoryId) || nextCategoryId <= 0) return;

    setSelectedIds(new Set());
    setDraftFilters((current) => {
      const currentIds = Array.isArray(current.categoryIds) ? current.categoryIds : [];
      const nextIds = currentIds.includes(nextCategoryId)
        ? currentIds.filter((value) => Number(value) !== nextCategoryId)
        : [...currentIds, nextCategoryId];
      return {
        ...current,
        categoryIds: nextIds,
        page: 1,
      };
    });
    setAppliedFilters((current) => {
      const currentIds = Array.isArray(current.categoryIds) ? current.categoryIds : [];
      const nextIds = currentIds.includes(nextCategoryId)
        ? currentIds.filter((value) => Number(value) !== nextCategoryId)
        : [...currentIds, nextCategoryId];
      return {
        ...current,
        categoryIds: nextIds,
        page: 1,
      };
    });
  };

  const toggleUiPreviewFilter = (groupKey, value) => {
    if (groupKey !== "sort") return;

    const nextSort = draftFilters.sort === value ? "" : value;
    setSelectedIds(new Set());
    setDraftFilters((current) => ({
      ...current,
      sort: nextSort,
      page: 1,
    }));
    setAppliedFilters((current) => ({
      ...current,
      sort: nextSort,
      page: 1,
    }));
  };

  const handleExportSelected = async () => {
    if (!storeId || selectedCount === 0) return;
    setIsExporting(true);
    closeFloatingMenus();
    setActionNotice(null);

    try {
      const exportPayload = await exportSellerProducts(storeId, {
        ids: selectedIdList,
      });
      downloadBlobFile(exportPayload.filename, exportPayload.blob);
      setActionNotice({
        type: "success",
        message: `Exported ${selectedCount} selected seller product row(s).`,
      });
    } catch (error) {
      setActionNotice({
        type: "error",
        message:
          error?.message || "Failed to export the selected seller product rows.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDuplicateProduct = (item) => {
    const productId = Number(item?.id);
    if (!productId || duplicateMutation.isPending) return;

    closeFloatingMenus();
    setActionNotice(null);
    duplicateMutation.mutate(productId);
  };

  const handleDeleteProduct = (item) => {
    const productId = Number(item?.id);
    if (!productId || deleteMutation.isPending) return;

    const confirmed = window.confirm(
      `Delete product\n\n${item?.name || "This product"} will be removed from the seller catalog if it is safe to delete.\n\nThis may archive the product if it has order history.`
    );
    if (!confirmed) return;

    closeFloatingMenus();
    setActionNotice(null);
    deleteMutation.mutate(productId);
  };

  const toggleSelectedId = (productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) return;

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectVisible = () => {
    if (itemIds.length === 0) return;

    setSelectedIds((current) => {
      const next = new Set(current);
      if (itemIds.every((id) => next.has(id))) {
        itemIds.forEach((id) => next.delete(id));
      } else {
        itemIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    closeFloatingMenus();
    setSelectedIds(new Set());
  };

  const handleApplyBulkAction = (action, ids) => {
    if (!canEditProducts || !action || !Array.isArray(ids) || ids.length === 0) return;
    closeFloatingMenus();
    bulkMutation.mutate({
      action,
      ids,
      skippedCount: Math.max(0, selectedCount - ids.length),
    });
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
        title="Loading seller products"
        description="Loading the seller-scoped product workspace for the active store."
        Icon={Package}
      />
    );
  }

  if (productsQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        title="Failed to load seller products"
        description={getSellerRequestErrorMessage(productsQuery.error, {
          permissionMessage: "Your current seller access does not include catalog visibility.",
          fallbackMessage: "Failed to load seller products.",
        })}
        tone="error"
        Icon={Package}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProductManagementHeader
        title="Products"
        subtitle="Seller catalog for drafts, review flow, and live state."
      >
            <div className="relative" data-seller-products-export-menu>
              <button
                type="button"
                onClick={() => toggleFloatingMenu("export")}
                disabled={isToolbarBusy}
                className={adminAlignedOutlineButton}
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting..." : "Export"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleExport("csv")}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Export to CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("json")}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Export to JSON
                  </button>
                </div>
              ) : null}
            </div>

            <div
              className="flex min-w-0 flex-wrap items-center gap-1 xl:flex-nowrap xl:gap-1"
              data-seller-products-import-menu
            >
              <button
                type="button"
                onClick={() => toggleFloatingMenu("import")}
                disabled={!canCreateDraft}
                className={adminAlignedOutlineButton}
                title={
                  canCreateDraft
                    ? "Open Seller import UI"
                    : "Seller import UI follows create-draft permission."
                }
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <input
                id="seller-products-import-input"
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleImportFileChange}
                className="hidden"
              />
              {importMenuOpen ? (
                <>
                  <button
                    type="button"
                    onClick={triggerImportPicker}
                    disabled={!canCreateDraft || importMutation.isPending}
                    title={
                      pendingImportSummary
                        ? `${pendingImportSummary.name} • ${formatFileSize(pendingImportSummary.size)}`
                        : "Select file"
                    }
                    className="inline-flex h-[34px] w-[136px] min-w-0 max-w-[136px] items-center gap-1 rounded-lg border border-emerald-200 border-dashed bg-white px-1.5 text-[10px] font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">{pendingImportSummary?.name || "Select File"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleImportNow}
                    disabled={!pendingImportFile || importMutation.isPending}
                    className={`inline-flex h-[34px] items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      pendingImportFile && !importMutation.isPending
                        ? "bg-sky-500 text-white hover:bg-sky-600"
                        : "border border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {importMutation.isPending ? "Importing..." : "Import Now"}
                  </button>
                </>
              ) : null}
            </div>

            {canEditProducts ? (
              <div className="relative" data-seller-products-bulk-menu>
                <button
                  type="button"
                  onClick={() => toggleFloatingMenu("bulk")}
                  disabled={selectedCount === 0 || bulkMutation.isPending}
                  className={`${adminAlignedButtonBase} ${
                    selectedCount > 0
                      ? "border border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Layers3 className="h-4 w-4" />
                  Bulk Action
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {bulkMenuOpen ? (
                  <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-lg">
                    <div className="px-2.5 py-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Selected rows
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {selectedCount} selected • {selectedReadyToSubmitIds.length} ready •{" "}
                        {selectedRevisionIds.length} revision
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyBulkAction("submit_review", selectedReadyToSubmitIds)
                      }
                      disabled={selectedReadyToSubmitIds.length === 0 || bulkMutation.isPending}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Submit drafts
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyBulkAction("resubmit_review", selectedRevisionIds)
                      }
                      disabled={selectedRevisionIds.length === 0 || bulkMutation.isPending}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resubmit revisions
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSelected}
                      disabled={selectedCount === 0 || isExporting}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Export selected rows
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              disabled
              title="Bulk delete is deferred in the current Seller workspace contract."
              className={adminAlignedDangerButton}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>

            {canCreateDraft ? (
              <button
                type="button"
                onClick={openCreateDrawer}
                className={`${adminAlignedPrimaryButton} min-w-[118px]`}
                aria-label="+ Add Product"
              >
                + Add Product
              </button>
            ) : null}
      </ProductManagementHeader>

      {actionNotice ? (
        <SellerWorkspaceNotice type={actionNotice.type}>
          <div className="space-y-1.5">
            {actionNotice.title ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                {actionNotice.title}
              </p>
            ) : null}
            <p>{actionNotice.message}</p>
            {Array.isArray(actionNotice.details) && actionNotice.details.length > 0 ? (
              <div className="space-y-1 text-xs">
                {actionNotice.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            ) : null}
            {actionNotice.meta ? <p className="text-xs opacity-80">{actionNotice.meta}</p> : null}
          </div>
        </SellerWorkspaceNotice>
      ) : null}

      <ProductFilterBar
        controls={
          <div className="grid min-w-0 flex-1 gap-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,0.62fr)_minmax(0,0.62fr)]">
                  <div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={draftFilters.keyword}
                        onChange={(event) => updateKeywordFilter(event.target.value)}
                        placeholder="Search name, slug, or SKU"
                        className={`${sellerFieldClass} h-[38px] rounded-xl pl-9`}
                      />
                    </div>
                  </div>

                  <div className="relative" data-seller-products-category-menu>
                    <button
                      type="button"
                      onClick={() => toggleFloatingMenu("category")}
                      className={`inline-flex h-[38px] w-full items-center justify-start gap-2 rounded-xl border border-dashed px-3 text-sm font-semibold transition ${
                        selectedUiCategoryNames.length > 0
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current/30">
                        <Plus className="h-3 w-3" />
                      </span>
                      <span className="truncate text-left">{selectedUiCategoryLabel}</span>
                    </button>
                    {categoryMenuOpen ? (
                      <div className="absolute left-0 z-30 mt-2 w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="search"
                            value={categorySearch}
                            onChange={(event) => setCategorySearch(event.target.value)}
                            placeholder="Category"
                            className={`${sellerFieldClass} h-[40px] rounded-xl pl-9`}
                          />
                        </div>
                        <div className="mt-2 max-h-64 space-y-0.5 overflow-auto pr-1">
                          {filteredUiCategoryOptions.length > 0 ? (
                            filteredUiCategoryOptions.map((category) => {
                              const checked = (draftFilters.categoryIds || []).includes(
                                Number(category.id)
                              );
                              return (
                                <label
                                  key={String(category.id)}
                                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition ${
                                    checked ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleUiCategorySelection(category.id)}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">
                                      {category.name}
                                    </span>
                                    {category.code ? (
                                      <span className="block text-xs text-slate-400">
                                        {category.code}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })
                          ) : (
                            <div className="px-2.5 py-3 text-sm text-slate-500">
                              No category options found.
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-1 pt-2">
                          <span className="text-[11px] font-medium text-slate-500">
                            {selectedUiCategoryNames.length > 0
                              ? `${selectedUiCategoryNames.length} selected`
                              : authoringMetaQuery.isError
                                ? "Category reference unavailable"
                                : "No category selected"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIds(new Set());
                              setDraftFilters((current) => ({
                                ...current,
                                categoryIds: [],
                                page: 1,
                              }));
                              setAppliedFilters((current) => ({
                                ...current,
                                categoryIds: [],
                                page: 1,
                              }));
                            }}
                            className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="relative" data-seller-products-price-menu>
                    <button
                      type="button"
                      onClick={() => toggleFloatingMenu("price")}
                      className={`inline-flex h-[38px] w-full items-center justify-start gap-2 rounded-xl border border-dashed px-3 text-sm font-semibold transition ${
                        uiPreviewSelectionCount > 0
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current/30">
                        <Plus className="h-3 w-3" />
                      </span>
                      <span className="truncate text-left">{uiPreviewButtonLabel}</span>
                    </button>
                    {priceMenuOpen ? (
                      <div className="absolute left-0 z-30 mt-2 w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="search"
                            value={priceSearch}
                            onChange={(event) => setPriceSearch(event.target.value)}
                            placeholder="Price"
                            className={`${sellerFieldClass} h-[40px] rounded-xl pl-9`}
                          />
                        </div>
                        <div className="mt-2 max-h-64 space-y-0.5 overflow-auto pr-1">
                          {filteredUiPreviewGroups.length > 0 ? (
                            filteredUiPreviewGroups.map((group) => (
                              <div key={group.key} className="space-y-1">
                                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                  {group.label}
                                </p>
                                {group.options.map((option) => {
                                  const checked = draftFilters.sort === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => toggleUiPreviewFilter(group.key, option.value)}
                                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                                        checked
                                          ? "bg-emerald-50 text-emerald-800"
                                          : "hover:bg-slate-50"
                                      }`}
                                    >
                                      <span
                                        className={`inline-flex h-4 w-4 shrink-0 rounded border ${
                                          checked
                                            ? "border-emerald-500 bg-emerald-100"
                                            : "border-slate-300 bg-white"
                                        }`}
                                      />
                                      <span className="truncate">{option.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ))
                          ) : (
                            <div className="px-2.5 py-3 text-sm text-slate-500">
                              No preview filter options found.
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-1 pt-2">
                          <span className="text-[11px] font-medium text-slate-500">
                            {draftFilters.sort
                              ? `Sorted by ${getSortFilterLabel(draftFilters.sort)}`
                              : "Default sort"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIds(new Set());
                              setDraftFilters((current) => ({
                                ...current,
                                sort: "",
                                page: 1,
                              }));
                              setAppliedFilters((current) => ({
                                ...current,
                                sort: "",
                                page: 1,
                              }));
                            }}
                            className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
          </div>
        }
        actions={
          <>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                  <div className="relative" data-seller-products-column-menu>
                    <button
                      type="button"
                      onClick={() => toggleFloatingMenu("column")}
                      className="inline-flex h-[34px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      title={`Visible columns (${visibleColumnCount}/${COLUMN_VISIBILITY_OPTIONS.length})`}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      View
                    </button>
                    {columnMenuOpen ? (
                      <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Visible columns
                          </p>
                          <button
                            type="button"
                            onClick={() => setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)}
                            className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {COLUMN_VISIBILITY_OPTIONS.map(([key, label]) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                disabled={visibleColumnCount === 1 && Boolean(columnVisibility[key])}
                                checked={Boolean(columnVisibility[key])}
                                onChange={() =>
                                  setColumnVisibility((current) => {
                                    const nextVisibleCount = Object.values(current).filter(Boolean)
                                      .length;
                                    if (current[key] && nextVisibleCount === 1) return current;
                                    return {
                                      ...current,
                                      [key]: !current[key],
                                    };
                                  })
                                }
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                              />
                              <span className="text-sm text-slate-700">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
          </>
        }
      />

      <SellerWorkspacePanel className={`${adminAlignedPanelClass} p-3`}>
        {items.length > 0 ? (
          <div>
            {productsQuery.isFetching && !productsQuery.isLoading ? (
              <div
                className="mb-2.5 h-1 overflow-hidden rounded-full bg-slate-100"
                aria-label="Refreshing product list"
              >
                <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-400" />
              </div>
            ) : null}
            {!canEditProducts ? (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
                This role can review the current seller result set.
              </div>
            ) : null}

            <div
              className={`${sellerTableWrapClass} w-full overflow-x-hidden rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]`}
              aria-busy={productsQuery.isFetching}
            >
              <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-slate-50/90">
                  <tr>
                    {canEditProducts ? (
                      <th className={`${compactTableHeadClass} w-[40px]`}>
                        <input
                          type="checkbox"
                          aria-label="Select visible seller products"
                          checked={allVisibleSelected}
                          onChange={toggleSelectVisible}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                    ) : null}
                    {columnVisibility.product ? (
                      <th className={compactTableHeadClass}>
                        Product
                      </th>
                    ) : null}
                    {columnVisibility.category ? (
                      <th className={`${compactTableHeadClass} w-[128px]`}>Category</th>
                    ) : null}
                    {columnVisibility.price ? (
                      <th className={`${compactTableHeadClass} w-[92px] text-right`}>Price</th>
                    ) : null}
                    {columnVisibility.salePrice ? (
                      <th className={`${compactTableHeadClass} w-[96px] text-right`}>
                        Sale Price
                      </th>
                    ) : null}
                    {columnVisibility.stock ? (
                      <th className={`${compactTableHeadClass} w-[72px] text-right`}>Stock</th>
                    ) : null}
                    {columnVisibility.inventory ? (
                      <th className={`${compactTableHeadClass} w-[96px] text-center`}>
                        Inventory
                      </th>
                    ) : null}
                    {columnVisibility.view ? (
                      <th className={`${compactTableHeadClass} w-[56px] text-center`}>View</th>
                    ) : null}
                    {columnVisibility.published ? (
                      <th className={`${compactTableHeadClass} w-[76px] text-center`}>
                        Published
                      </th>
                    ) : null}
                    {columnVisibility.actions ? (
                      <th className={`${compactTableHeadClass} w-[60px] text-center`}>Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item) => {
                    const canEditDraft = Boolean(item.authoring?.canEditDraft && canEditProducts);
                    const canDuplicate = Boolean(canCreateDraft);
                    const waitingForAdmin = item.submission?.status === "submitted";
                    const needsRevision = item.submission?.status === "needs_revision";
                    const canDeleteProduct = Boolean(
                      canArchiveProducts &&
                        catalogCanDelete &&
                        item.submission?.status === "none"
                    );
                    const editBlockedTitle = waitingForAdmin
                      ? "This product is currently with admin review, so editing is locked for now."
                      : item.authoring?.editBlockedReason === "PRODUCT_EDIT_PERMISSION_REQUIRED"
                        ? "Your current seller access cannot edit products in this store."
                        : "This product cannot be edited from the current seller state.";
                    const deleteBlockedTitle =
                      !canArchiveProducts || !catalogCanDelete
                        ? "Your current seller access cannot delete or archive products."
                        : waitingForAdmin || needsRevision
                          ? "Products in the review lane cannot be deleted or archived yet."
                          : "Delete product";
                    const canSubmit = Boolean(
                      canEditProducts &&
                        (item.submission?.canSubmit || item.submission?.canResubmit)
                    );
                    const canPublish = Boolean(item.publishing?.canPublish && canPublishProducts);
                    const canUnpublish = Boolean(item.publishing?.canUnpublish && canPublishProducts);
                    const isSelected = selectedIds.has(Number(item.id));
                    const isSubmitting = submitMutation.isPending && submittingProductId === item.id;
                    const isPublishing =
                      publishMutation.isPending &&
                      Number(publishMutation.variables?.productId) === Number(item.id);
                    const isDuplicating =
                      duplicateMutation.isPending && duplicatingProductId === Number(item.id);
                    const isDeleting =
                      deleteMutation.isPending && deletingProductId === Number(item.id);
                    const publishedState = getPublishedStateMeta(item);
                    const canTogglePublished = canPublish || canUnpublish;
                    const publishToggleTitle = canTogglePublished
                      ? publishedState.published
                        ? "Hide from storefront"
                        : "Publish to storefront"
                      : item.publishing?.hint ||
                        item.submission?.nextActionDescription ||
                        publishedState.hint;
                    const stockMeta = getCompactStockMeta(item);
                    return (
                      <tr
                        key={item.id}
                        className={`transition ${isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50/80"}`}
                      >
                        {canEditProducts ? (
                          <td className={`${compactTableIconCellClass} align-top`}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.name}`}
                              checked={selectedIds.has(Number(item.id))}
                              onChange={() => toggleSelectedId(item.id)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        ) : null}
                        {columnVisibility.product ? (
                          <td className={`${compactTableCellClass}`}>
                            <div className="flex items-start gap-2">
                              {item.mediaPreviewUrl ? (
                                <img
                                  src={resolveAssetUrl(item.mediaPreviewUrl)}
                                  alt={item.name}
                                  className="h-8 w-8 rounded-md border border-slate-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400">
                                  <Boxes className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link
                                  to={workspaceRoutes.productDetail(item.id)}
                                  className="block truncate text-[13px] font-semibold leading-5 text-slate-900 hover:text-emerald-600"
                                  title={item.name}
                                >
                                  {item.name}
                                </Link>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <SellerWorkspaceBadge
                                    label={getCompactLifecycleLabel(item)}
                                    tone={getLifecycleTone(item)}
                                    className="px-2 py-0.5 text-[10px]"
                                  />
                                  {waitingForAdmin || needsRevision ? (
                                    <SellerWorkspaceBadge
                                      label={getCompactSubmissionLabel(item)}
                                      tone={getSubmissionTone(item)}
                                      className="px-2 py-0.5 text-[10px]"
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                        ) : null}
                        {columnVisibility.category ? (
                          <td className={compactTableCellClass}>
                            <p className="truncate text-[12px] font-medium text-slate-700">
                              {item.category?.name || "Uncategorized"}
                            </p>
                          </td>
                        ) : null}
                        {columnVisibility.price ? (
                          <td className={`${compactTableCellClass} text-right font-semibold text-slate-900`}>
                            <div>{formatCurrency(item.pricing?.price)}</div>
                          </td>
                        ) : null}
                        {columnVisibility.salePrice ? (
                          <td className={`${compactTableCellClass} text-right`}>
                            {item.pricing?.salePrice ? (
                              <span className="font-semibold text-emerald-700">
                                {formatCurrency(item.pricing.salePrice)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        ) : null}
                        {columnVisibility.stock ? (
                          <td className={`${compactTableCellClass} text-right`}>
                            <div className="font-semibold tabular-nums text-slate-900">
                              {item.inventory?.stock ?? item.availability?.stock ?? 0}
                            </div>
                          </td>
                        ) : null}
                        {columnVisibility.inventory ? (
                          <td className={`${compactTableCellClass} text-center`}>
                            <ProductInventoryBadge
                              label={stockMeta.label}
                              title={stockMeta.label}
                              className={stockMeta.badgeClass}
                            />
                          </td>
                        ) : null}
                        {columnVisibility.view ? (
                          <td className={`${compactTableIconCellClass} text-center`}>
                            <Link
                              to={workspaceRoutes.productDetail(item.id)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                              title="View product"
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        ) : null}
                        {columnVisibility.published ? (
                          <td className={`${compactTableIconCellClass} text-center`}>
                            <ProductPublishedToggle
                              checked={publishedState.published}
                              onClick={() =>
                                canTogglePublished &&
                                publishMutation.mutate({
                                  productId: item.id,
                                  published: !publishedState.published,
                                })
                              }
                              disabled={!canTogglePublished || isPublishing}
                              ariaLabel={publishToggleTitle}
                              title={publishToggleTitle}
                            />
                          </td>
                        ) : null}
                        {columnVisibility.actions ? (
                          <td className={`${compactTableIconCellClass} text-center`}>
                            <ProductRowActionsMenu
                              open={rowActionMenu?.id === Number(item.id)}
                              onToggle={(event) => toggleRowActionMenu(event, item.id)}
                              containerProps={{ "data-seller-products-row-menu": true }}
                              menuPositionClassName="fixed z-[70]"
                              menuStyle={{
                                top: `${rowActionMenu?.top ?? 0}px`,
                                left: `${rowActionMenu?.left ?? 0}px`,
                              }}
                            >
                              <Link
                                to={workspaceRoutes.productDetail(item.id)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Search className="h-3.5 w-3.5" />
                                View
                              </Link>
                              {canDuplicate ? (
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateProduct(item)}
                                  disabled={duplicateMutation.isPending}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  {isDuplicating ? "Duplicating..." : "Duplicate"}
                                </button>
                              ) : null}
                              {canEditDraft ? (
                                <Link
                                  to={workspaceRoutes.productEdit(item.id)}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Link>
                              ) : canEditProducts ? (
                                <button
                                  type="button"
                                  disabled
                                  title={editBlockedTitle}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-400 disabled:cursor-not-allowed"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  {waitingForAdmin ? "Edit locked" : "Edit"}
                                </button>
                              ) : null}
                              {canSubmit ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRowActionMenu(null);
                                    submitMutation.mutate(item.id);
                                  }}
                                  disabled={isSubmitting}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  {needsRevision ? "Resubmit" : "Submit"}
                                </button>
                              ) : null}
                              {canPublish ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRowActionMenu(null);
                                    publishMutation.mutate({
                                      productId: item.id,
                                      published: true,
                                    });
                                  }}
                                  disabled={isPublishing}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Publish
                                </button>
                              ) : null}
                              {canUnpublish ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRowActionMenu(null);
                                    publishMutation.mutate({
                                      productId: item.id,
                                      published: false,
                                    });
                                  }}
                                  disabled={isPublishing}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Boxes className="h-3.5 w-3.5" />
                                  Unpublish
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(item)}
                                disabled={!canDeleteProduct || isDeleting}
                                title={deleteBlockedTitle}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {isDeleting
                                  ? "Deleting..."
                                  : waitingForAdmin || needsRevision
                                    ? "Delete locked"
                                    : "Delete"}
                              </button>
                            </ProductRowActionsMenu>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <SellerWorkspaceEmptyState
              title={
                activeFilterCount > 0
                  ? "No products match the current seller filters"
                  : "No products found for this store"
              }
              description={
                activeFilterCount > 0
                  ? "Try broadening the current search or reset the visible product filters."
                  : canCreateDraft
                    ? "Create the first draft product for this seller store."
                    : "Confirm whether this store already owns product rows in the current workspace."
              }
              action={emptyStateAction}
              icon={<Boxes className="h-5 w-5" />}
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-sm">
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updatePage(Math.max(1, appliedFilters.page - 1))}
              disabled={appliedFilters.page <= 1}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => updatePage(Math.min(totalPages, appliedFilters.page + 1))}
              disabled={appliedFilters.page >= totalPages}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SellerWorkspacePanel>

      {isCreateDrawerMounted ? (
        <>
          <button
            type="button"
            aria-label="Close seller product drawer"
            onClick={closeCreateDrawer}
            className={`fixed inset-0 z-40 bg-slate-900/35 transition-opacity duration-200 ${
              isCreateDrawerVisible ? "opacity-100" : "opacity-0"
            }`}
          />
          <div className="pointer-events-none fixed inset-0 z-50">
            <div
              className={`pointer-events-auto absolute inset-y-0 right-0 w-full max-w-full overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[92vw] md:w-[860px] ${
                isCreateDrawerVisible ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <SellerProductAuthoringPage
                mode="create"
                presentation="drawer"
                onClose={closeCreateDrawer}
                onSuccess={() => {
                  closeCreateDrawer();
                  setActionNotice({
                    type: "success",
                    message: "Draft created in seller workspace.",
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["seller", "products", storeId],
                  });
                }}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
