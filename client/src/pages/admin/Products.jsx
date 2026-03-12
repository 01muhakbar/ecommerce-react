import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkAdminProducts,
  deleteAdminProduct,
  exportAdminProducts,
  fetchAdminCategories,
  fetchAdminProducts,
  importAdminProducts,
  updateAdminProductPublished,
} from "../../lib/adminApi.js";
import { moneyIDR } from "../../utils/money.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import {
  Download,
  ChevronDown,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import ProductForm from "./ProductForm.jsx";
import ProductPreviewDrawer from "./ProductPreviewDrawer.jsx";

const FALLBACK_THUMBNAIL = "/demo/placeholder-product.svg";
const DEFAULT_FILTERS = {
  q: "",
  categoryId: "",
  priceSort: "default",
  reviewState: "all",
};
const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024;
const REVIEW_QUEUE_FILTERS = [
  {
    value: "all",
    label: "All products",
    description: "Return to the full catalog list.",
  },
  {
    value: "review_queue",
    label: "Review queue",
    description: "Show seller products waiting review or revision follow-up.",
  },
  {
    value: "submitted",
    label: "Submitted",
    description: "Show seller products currently waiting for admin review.",
  },
  {
    value: "needs_revision",
    label: "Needs revision",
    description: "Show products that were sent back to seller for fixes.",
  },
];

const btnBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus-visible:ring-slate-300`;
const btnGreen = `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300`;
const btnDanger = `${btnBase} bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300`;
const btnAmber = `${btnBase} bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-300`;

const inputBase =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none";
const selectBase = `${inputBase} pr-8`;
const statCardClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm";

const tableHeadCell =
  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-4 py-3.5 align-middle text-sm text-slate-700";

function ProductPublishedBadge({ isPublished }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        isPublished
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isPublished ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function ProductSellerReviewBadge({ submission }) {
  const status = submission?.status || "none";
  const toneClass =
    status === "submitted"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : status === "needs_revision"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-500";

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}
    >
      {submission?.label || "Not submitted"}
    </span>
  );
}

function ReviewQueueCard({
  label,
  description,
  count,
  active = false,
  onClick,
  tone = "slate",
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
        : active
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-white text-slate-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{count}</p>
      <p className="mt-1 text-xs opacity-80">{description}</p>
    </button>
  );
}

const resolveAdminProductPricing = (product) => {
  const basePrice = Number(product?.price || 0);
  const rawSalePrice = product?.salePrice;
  const salePrice = Number.isFinite(Number(rawSalePrice)) ? Number(rawSalePrice) : null;
  const hasSalePrice = salePrice !== null && salePrice > 0 && salePrice < basePrice;

  return {
    basePrice,
    salePrice: hasSalePrice ? salePrice : null,
    hasSalePrice,
  };
};

function ProductCategoryBadge({ label }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
      {label || "Uncategorized"}
    </span>
  );
}

const getStockMeta = (value) => {
  const stock = Number(value || 0);
  if (stock <= 0) {
    return {
      label: "Out of stock",
      className: "text-rose-500",
    };
  }
  if (stock <= 10) {
    return {
      label: "Low stock",
      className: "text-amber-600",
    };
  }
  return {
    label: "In stock",
    className: "text-emerald-600",
  };
};

const getProductCategoryContext = (product) => {
  const selectedCategories = Array.isArray(product?.categories)
    ? product.categories.filter(Boolean)
    : [];
  const fallbackDefaultId = Number(product?.defaultCategoryId ?? product?.categoryId ?? 0);
  const defaultCategory =
    product?.defaultCategory ||
    product?.category ||
    selectedCategories.find((category) => Number(category?.id) === fallbackDefaultId) ||
    null;
  const relatedCategories = selectedCategories.filter(
    (category) => Number(category?.id) !== Number(defaultCategory?.id ?? 0)
  );

  return {
    defaultCategory,
    relatedCategories,
    selectedCount: selectedCategories.length,
  };
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkNotice, setBulkNotice] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState({
    open: false,
    action: "delete",
    ids: [],
  });
  const [publishedOverrides, setPublishedOverrides] = useState({});
  const [publishingIds, setPublishingIds] = useState(() => new Set());
  const [publishError, setPublishError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [drawerState, setDrawerState] = useState({
    open: false,
    mode: "create",
    productId: null,
  });
  const bulkMenuRef = useRef(null);
  const importInputRef = useRef(null);

  const params = useMemo(
    () => ({
      page,
      limit,
      q: appliedFilters.q || undefined,
      categoryId: appliedFilters.categoryId || undefined,
      sellerSubmissionStatus:
        appliedFilters.reviewState && appliedFilters.reviewState !== "all"
          ? appliedFilters.reviewState
          : undefined,
    }),
    [page, limit, appliedFilters]
  );

  const productsQuery = useQuery({
    queryKey: [
      "admin-products",
      page,
      limit,
      appliedFilters.q,
      appliedFilters.categoryId,
      appliedFilters.reviewState,
    ],
    queryFn: () => fetchAdminProducts(params),
    keepPreviousData: true,
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories-filter"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => deleteAdminProduct(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setSelectedIds(new Set());
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, published }) => updateAdminProductPublished(id, published),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkAdminProducts(action, ids),
  });

  const items = productsQuery.data?.data || [];
  const categories = categoriesQuery.data?.data || [];
  const meta = productsQuery.data?.meta || { page: 1, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const isOperationsBusy =
    isExporting || isImporting || bulkMutation.isPending || deleteMutation.isPending;
  const activeFilterCount =
    (appliedFilters.q ? 1 : 0) +
    (appliedFilters.categoryId ? 1 : 0) +
    (appliedFilters.priceSort && appliedFilters.priceSort !== "default" ? 1 : 0) +
    (appliedFilters.reviewState && appliedFilters.reviewState !== "all" ? 1 : 0);
  const selectedCount = selectedIds.size;

  const derivedReviewQueue = useMemo(() => {
    return items.reduce(
      (acc, product) => {
        const status = String(product?.sellerSubmission?.status || "none");
        if (status === "submitted") acc.submitted += 1;
        if (status === "needs_revision") acc.needsRevision += 1;
        return acc;
      },
      { submitted: 0, needsRevision: 0 }
    );
  }, [items]);

  const reviewQueue = useMemo(() => {
    const metaReviewQueue = productsQuery.data?.meta?.reviewQueue;
    const submitted = Number(metaReviewQueue?.submitted ?? derivedReviewQueue.submitted);
    const needsRevision = Number(
      metaReviewQueue?.needsRevision ?? derivedReviewQueue.needsRevision
    );
    return {
      submitted,
      needsRevision,
      total: Number(metaReviewQueue?.total ?? submitted + needsRevision),
      activeFilter: metaReviewQueue?.activeFilter ?? null,
    };
  }, [productsQuery.data?.meta?.reviewQueue, derivedReviewQueue]);

  const displayItems = useMemo(() => {
    const sorted = [...items];
    if (appliedFilters.priceSort === "price_asc") {
      sorted.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
    } else if (appliedFilters.priceSort === "price_desc") {
      sorted.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
    }
    return sorted;
  }, [items, appliedFilters.priceSort]);

  useEffect(() => {
    const visibleIds = new Set(displayItems.map((product) => Number(product?.id)));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(Number(id))) next.add(Number(id));
      });
      return next;
    });
  }, [displayItems]);

  const asCurrency = (value) => moneyIDR(Number(value || 0));
  const resolveThumbnail = (product) =>
    resolveAssetUrl(product.imageUrl || product.promoImagePath || FALLBACK_THUMBNAIL);

  const getPublished = (product) => {
    const override = publishedOverrides[product.id];
    if (typeof override === "boolean") return override;
    return Boolean(product.published ?? true);
  };

  const allVisibleSelected =
    displayItems.length > 0 &&
    displayItems.every((product) => selectedIds.has(Number(product.id)));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        displayItems.forEach((product) => next.delete(Number(product.id)));
      } else {
        displayItems.forEach((product) => next.add(Number(product.id)));
      }
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const numId = Number(id);
      if (next.has(numId)) next.delete(numId);
      else next.add(numId);
      return next;
    });
  };

  const applyFilters = () => {
    setAppliedFilters({
      q: String(draftFilters.q || "").trim(),
      categoryId: String(draftFilters.categoryId || ""),
      priceSort: String(draftFilters.priceSort || "default"),
      reviewState: String(draftFilters.reviewState || "all"),
    });
    setPage(1);
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const applyReviewStateFilter = (reviewState) => {
    const nextReviewState = String(reviewState || "all");
    setDraftFilters((prev) => ({ ...prev, reviewState: nextReviewState }));
    setAppliedFilters((prev) => ({ ...prev, reviewState: nextReviewState }));
    setPage(1);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const showBulkNotice = (payload) => {
    setBulkNotice(payload);
  };

  const handleExport = async () => {
    if (isOperationsBusy) return;
    showBulkNotice(null);
    setIsExporting(true);

    try {
      const response = await exportAdminProducts({
        q: appliedFilters.q,
        categoryId: appliedFilters.categoryId,
        sellerSubmissionStatus:
          appliedFilters.reviewState && appliedFilters.reviewState !== "all"
            ? appliedFilters.reviewState
            : undefined,
      });
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename = filenameMatch?.[1] || "products-export.json";

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);

      showBulkNotice({
        type: "success",
        title: "Export completed",
        message: `Products JSON downloaded as ${filename}.`,
      });
    } catch (error) {
      showBulkNotice({
        type: "error",
        title: "Export failed",
        message: error?.message || "Export failed. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const triggerImport = () => {
    if (isOperationsBusy) return;
    importInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isOperationsBusy) return;

    const normalizedName = String(file.name || "").toLowerCase();
    const normalizedType = String(file.type || "").toLowerCase();
    const looksLikeJson =
      normalizedName.endsWith(".json") ||
      normalizedType === "application/json" ||
      normalizedType.endsWith("+json");
    if (!looksLikeJson) {
      showBulkNotice({
        type: "error",
        title: "Invalid import file",
        message: "Import only accepts JSON files exported from Admin Products.",
      });
      return;
    }

    if (file.size <= 0) {
      showBulkNotice({
        type: "error",
        title: "Empty import file",
        message: "Choose a JSON file that contains at least one product row.",
      });
      return;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      showBulkNotice({
        type: "error",
        title: "Import file too large",
        message: "Import file exceeds the 2 MB limit for the current MVP flow.",
      });
      return;
    }

    showBulkNotice(null);
    setIsImporting(true);

    try {
      const response = await importAdminProducts(file);
      const summary = response?.data || {};
      const totalRows = Number(summary.totalRows || 0);
      const created = Number(summary.created || 0);
      const updated = Number(summary.updated || 0);
      const failed = Number(summary.failed || 0);
      const importErrors = Array.isArray(summary.errors) ? summary.errors : [];
      const errorPreview = importErrors.slice(0, 3).map((entry) => {
        const rowLabel = entry?.row ? `Row ${entry.row}` : "Row";
        const slugLabel = entry?.slug ? ` (${entry.slug})` : "";
        return `${rowLabel}${slugLabel}: ${entry?.message || "Import row failed."}`;
      });

      showBulkNotice({
        type: failed > 0 && created + updated === 0 ? "error" : "success",
        title: failed > 0 ? "Import completed with warnings" : "Import completed",
        message: `Processed ${totalRows} row(s): ${created} created, ${updated} updated, ${failed} failed.`,
        details: errorPreview,
        meta:
          failed > errorPreview.length
            ? `${failed - errorPreview.length} additional row error(s) not shown.`
            : null,
      });
      setSelectedIds(new Set());
      setBulkMenuOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (error) {
      showBulkNotice({
        type: "error",
        title: "Import failed",
        message: error?.response?.data?.message || "Import failed. Please try again.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showBulkNotice({
        type: "error",
        title: "Selection required",
        message: "Select at least one product before running a bulk delete.",
      });
      return;
    }
    if (isOperationsBusy) return;
    setBulkConfirm({ open: true, action: "delete", ids });
  };

  const handleDeleteOne = (id) => {
    if (deleteMutation.isPending) return;
    if (!window.confirm("Delete this product?")) return;
    deleteMutation.mutate([Number(id)]);
  };

  const handleBulkAction = (action) => {
    const ids = Array.from(selectedIds);
    if (!action) return;
    if (ids.length === 0) {
      showBulkNotice({
        type: "error",
        title: "Selection required",
        message: "Select at least one product before running a bulk action.",
      });
      setBulkMenuOpen(false);
      return;
    }
    if (isOperationsBusy) return;

    if (action === "delete_selected") {
      setBulkConfirm({ open: true, action: "delete", ids });
      setBulkMenuOpen(false);
      return;
    }

    const nextAction = action === "publish_selected" ? "publish" : "unpublish";
    showBulkNotice(null);
    bulkMutation.mutate(
      { action: nextAction, ids },
      {
        onSuccess: (response) => {
          const affected = Number(response?.affected || 0);
          setSelectedIds(new Set());
          setBulkMenuOpen(false);
          showBulkNotice({
            type: "success",
            title:
              nextAction === "publish" ? "Bulk publish completed" : "Bulk unpublish completed",
            message:
              nextAction === "publish"
                ? `${affected} product(s) published.`
                : `${affected} product(s) unpublished.`,
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          showBulkNotice({
            type: "error",
            title: "Bulk action failed",
            message:
              error?.response?.data?.message || "Bulk action failed. Please try again.",
          });
          setBulkMenuOpen(false);
        },
      }
    );
  };

  const handleConfirmBulkDelete = () => {
    const ids = Array.isArray(bulkConfirm.ids) ? bulkConfirm.ids : [];
    if (!bulkConfirm.open || ids.length === 0 || bulkMutation.isPending) return;

    showBulkNotice(null);
    bulkMutation.mutate(
      { action: "delete", ids },
      {
        onSuccess: (response) => {
          const affected = Number(response?.affected || 0);
          setSelectedIds(new Set());
          setBulkConfirm({ open: false, action: "delete", ids: [] });
          setBulkMenuOpen(false);
          showBulkNotice({
            type: "success",
            title: "Bulk delete completed",
            message: `${affected} product(s) deleted.`,
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          showBulkNotice({
            type: "error",
            title: "Bulk delete failed",
            message:
              error?.response?.data?.message || "Delete selected failed. Please try again.",
          });
        },
      }
    );
  };

  const openCreateDrawer = () => {
    setDrawerState({ open: true, mode: "create", productId: null });
  };

  const openEditDrawer = (productId) => {
    const parsedId = Number(productId);
    if (!parsedId) return;
    setDrawerState({ open: true, mode: "edit", productId: parsedId });
  };

  const openViewDrawer = (productId) => {
    const parsedId = Number(productId);
    if (!parsedId) return;
    setDrawerState({ open: true, mode: "view", productId: parsedId });
  };

  const closeDrawer = () => {
    setDrawerState({ open: false, mode: "create", productId: null });
  };

  const handleTogglePublished = (product) => {
    const productId = Number(product?.id);
    if (!productId || publishingIds.has(productId)) return;

    const hadOverride = Object.prototype.hasOwnProperty.call(publishedOverrides, productId);
    const previousOverride = hadOverride ? publishedOverrides[productId] : undefined;
    const previousValue = getPublished(product);
    const nextValue = !previousValue;

    setPublishError("");
    setPublishingIds((prev) => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
    setPublishedOverrides((prev) => ({ ...prev, [productId]: nextValue }));

    publishMutation.mutate(
      { id: productId, published: nextValue },
      {
        onSuccess: (response) => {
          const serverValue = response?.data?.published;
          setPublishedOverrides((prev) => ({
            ...prev,
            [productId]:
              typeof serverValue === "boolean" ? serverValue : nextValue,
          }));
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          setPublishError(
            error?.response?.data?.message || "Failed to update published status."
          );
          setPublishedOverrides((prev) => {
            const next = { ...prev };
            if (hadOverride) next[productId] = previousOverride;
            else delete next[productId];
            return next;
          });
        },
        onSettled: () => {
          setPublishingIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        },
      }
    );
  };

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!bulkMenuRef.current) return;
      if (!bulkMenuRef.current.contains(event.target)) {
        setBulkMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!drawerState.open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerState.open]);

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Admin / Products
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Products
            </h1>
            <p className="text-sm text-slate-500">
              Manage product catalog, publish states, and stock visibility.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                Catalog Workspace
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {selectedCount} selected
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                Page {meta.page} / {totalPages}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <div className={statCardClass}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total products</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{meta.total || 0}</p>
            </div>
            <div className={statCardClass}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Active filters</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{activeFilterCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Product Controls
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Search, filter, and act faster</h2>
            <p className="text-sm text-slate-500">
              Keep catalog updates organized and surface seller review work without leaving the products lane.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              Visible now: {displayItems.length}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              Active filters: {activeFilterCount}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:max-w-xl">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Search catalog
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={draftFilters.q}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, q: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
                placeholder="Search by product name"
                className={`${inputBase} h-11 pl-9`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="mr-1 hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:block">
              Quick actions
            </div>
            <button
              type="button"
              onClick={openCreateDrawer}
              disabled={isOperationsBusy}
              className={`${btnGreen} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>

            <button
              type="button"
              className={btnOutline}
              onClick={handleExport}
              disabled={isOperationsBusy}
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </button>
            <button
              type="button"
              className={btnOutline}
              onClick={triggerImport}
              disabled={isOperationsBusy}
            >
              <Upload className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />

            <div ref={bulkMenuRef} className="relative">
              <button
                type="button"
                disabled={bulkMutation.isPending}
                onClick={() => {
                  if (selectedIds.size === 0) {
                    showBulkNotice({
                      type: "error",
                      title: "Selection required",
                      message: "Select at least one product to open bulk actions.",
                    });
                    return;
                  }
                  setBulkMenuOpen((prev) => !prev);
                }}
                className={`${btnAmber} min-w-[132px] disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Bulk Action
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            {bulkMenuOpen ? (
                <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-lg border border-amber-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleBulkAction("delete_selected")}
                    disabled={selectedIds.size === 0 || bulkMutation.isPending}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("publish_selected")}
                    disabled={selectedIds.size === 0 || bulkMutation.isPending}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Publish Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("unpublish_selected")}
                    disabled={selectedIds.size === 0 || bulkMutation.isPending}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Unpublish Selected
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={
                selectedIds.size === 0 || deleteMutation.isPending || bulkMutation.isPending
              }
              className={`${btnDanger} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Review Inbox
              </p>
              <h3 className="text-base font-semibold text-slate-900">
                Seller submissions that need admin attention
              </h3>
              <p className="text-sm text-slate-500">
                Review state comes from the product submission domain. Publish authority stays with admin.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Current lane:{" "}
              <span className="font-semibold text-slate-700">
                {appliedFilters.reviewState === "review_queue"
                  ? "Review queue"
                  : appliedFilters.reviewState === "submitted"
                    ? "Submitted"
                    : appliedFilters.reviewState === "needs_revision"
                      ? "Needs revision"
                      : "All products"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReviewQueueCard
              label="All products"
              description="Return to the full admin catalog lane."
              count={meta.total || 0}
              active={appliedFilters.reviewState === "all"}
              onClick={() => applyReviewStateFilter("all")}
            />
            <ReviewQueueCard
              label="Review queue"
              description="Submitted and needs-revision seller products in one lane."
              count={reviewQueue.total}
              active={appliedFilters.reviewState === "review_queue"}
              onClick={() => applyReviewStateFilter("review_queue")}
            />
            <ReviewQueueCard
              label="Submitted"
              description="Seller products waiting for admin review."
              count={reviewQueue.submitted}
              tone="sky"
              active={appliedFilters.reviewState === "submitted"}
              onClick={() => applyReviewStateFilter("submitted")}
            />
            <ReviewQueueCard
              label="Needs revision"
              description="Products sent back to seller and pending corrections."
              count={reviewQueue.needsRevision}
              tone="amber"
              active={appliedFilters.reviewState === "needs_revision"}
              onClick={() => applyReviewStateFilter("needs_revision")}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Category
            </p>
            <select
              value={draftFilters.categoryId}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, categoryId: event.target.value }))
              }
              className={`${selectBase} h-11 w-full`}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Price sort
            </p>
            <select
              value={draftFilters.priceSort}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, priceSort: event.target.value }))
              }
              className={`${selectBase} h-11 w-full`}
            >
              <option value="default">Default Price</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Review state
            </p>
            <select
              value={draftFilters.reviewState}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, reviewState: event.target.value }))
              }
              className={`${selectBase} h-11 w-full`}
            >
              {REVIEW_QUEUE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Apply changes
            </p>
            <button type="button" onClick={applyFilters} className={`${btnGreen} w-full`}>
              <Filter className="h-4 w-4" />
              Apply
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Clear filters
            </p>
            <button type="button" onClick={resetFilters} className={`${btnOutline} w-full`}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {categoriesQuery.isError ? (
          <p className="mt-2 text-xs text-rose-500">Failed to load categories.</p>
        ) : null}
        {publishError ? (
          <p className="mt-2 text-xs text-rose-500">{publishError}</p>
        ) : null}
        {bulkNotice ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2.5 text-xs ${
              bulkNotice.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {bulkNotice.title ? (
              <p className="font-semibold uppercase tracking-[0.08em]">{bulkNotice.title}</p>
            ) : null}
            <p className={bulkNotice.title ? "mt-1" : ""}>{bulkNotice.message}</p>
            {Array.isArray(bulkNotice.details) && bulkNotice.details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px]">
                {bulkNotice.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {bulkNotice.meta ? <p className="mt-2 text-[11px]">{bulkNotice.meta}</p> : null}
          </div>
        ) : null}
      </div>

      {productsQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading products...
        </div>
      ) : productsQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {productsQuery.error?.response?.data?.message || "Failed to load products."}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No products found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{displayItems.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{meta.total || 0}</span> products
            <span className="ml-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {selectedCount} selected
            </span>
          </div>
          <div className="-mx-4 w-auto overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[4%]`}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible products"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                    />
                  </th>
                  <th className={`${tableHeadCell} w-[24%]`}>Product Name</th>
                  <th className={`${tableHeadCell} w-[15%]`}>Category</th>
                  <th className={`${tableHeadCell} w-[9%] text-right`}>Price</th>
                  <th className={`${tableHeadCell} w-[9%] text-right`}>Sale Price</th>
                  <th className={`${tableHeadCell} w-[7%] text-right`}>Stock</th>
                  <th className={`${tableHeadCell} w-[9%]`}>Status</th>
                  <th className={`${tableHeadCell} w-[13%]`}>Seller Review</th>
                  <th className={`${tableHeadCell} w-[6%] text-center`}>View</th>
                  <th className={`${tableHeadCell} w-[8%] text-center`}>Publish</th>
                  <th className={`${tableHeadCell} w-[8%] text-center`}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {displayItems.map((product) => {
                  const isSelected = selectedIds.has(Number(product.id));
                  const isPublished = getPublished(product);
                  const stockMeta = getStockMeta(product.stock);
                  const pricing = resolveAdminProductPricing(product);
                  const categoryContext = getProductCategoryContext(product);
                  const sellerSubmission = product?.sellerSubmission || null;
                  const publishGate = sellerSubmission?.publishGate || null;
                  const submittedAtLabel = sellerSubmission?.submittedAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                      }).format(new Date(sellerSubmission.submittedAt))
                    : null;
                  const reviewActionTitle = sellerSubmission?.hasSubmission
                    ? "Open review preview"
                    : "View product";
                  const publishToggleDisabled =
                    publishingIds.has(Number(product.id)) ||
                    (!isPublished && publishGate && publishGate.canUseListToggle === false);
                  const publishToggleTitle =
                    !isPublished && publishGate?.hint
                      ? publishGate.hint
                      : "Toggle published";

                  return (
                    <tr
                      key={product.id}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={`${tableCell} w-[4%]`}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.name || `product ${product.id}`}`}
                          checked={isSelected}
                          onChange={() => toggleSelectRow(product.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                        />
                      </td>

                      <td className={`${tableCell} w-[24%]`}>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <img
                              src={resolveThumbnail(product)}
                              alt={product.name || `#${product.id}`}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = FALLBACK_THUMBNAIL;
                              }}
                              className="h-full w-full object-contain p-1"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {product.name || `#${product.id}`}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="truncate">{product.slug || "-"}</span>
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
                                SKU #{product.id}
                              </span>
                              {pricing.hasSalePrice ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                                  On sale
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className={`${tableCell} w-[15%]`}>
                        <div className="space-y-1">
                          <ProductCategoryBadge label={categoryContext.defaultCategory?.name} />
                          <span className="block truncate text-xs text-slate-500">
                            Default category
                          </span>
                          {categoryContext.relatedCategories.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {categoryContext.relatedCategories.slice(0, 2).map((category) => (
                                <span
                                  key={`${product.id}-${category.id}`}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {category.name}
                                </span>
                              ))}
                              {categoryContext.relatedCategories.length > 2 ? (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                  +{categoryContext.relatedCategories.length - 2} more
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="block truncate text-[11px] text-slate-400">
                              {categoryContext.selectedCount > 0
                                ? "No secondary categories"
                                : "No categories"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        className={`${tableCell} w-[9%] text-right font-semibold tabular-nums text-slate-900`}
                      >
                        <div className="space-y-1">
                          <div>{asCurrency(pricing.basePrice)}</div>
                          <div className="text-xs font-medium text-slate-400">Base price</div>
                        </div>
                      </td>

                      <td className={`${tableCell} w-[9%] text-right tabular-nums`}>
                        {pricing.hasSalePrice ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-emerald-700">
                              {asCurrency(pricing.salePrice)}
                            </div>
                            <div className="text-xs font-medium text-emerald-600">
                              Promo live
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className={`${tableCell} w-[7%] text-right tabular-nums`}>
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-900">{product.stock ?? 0}</div>
                          <div className={`text-xs font-medium ${stockMeta.className}`}>
                            {stockMeta.label}
                          </div>
                        </div>
                      </td>

                      <td className={`${tableCell} w-[9%]`}>
                        <ProductPublishedBadge isPublished={isPublished} />
                      </td>

                      <td className={`${tableCell} w-[13%]`}>
                        <div className="space-y-1.5">
                          <ProductSellerReviewBadge submission={sellerSubmission} />
                          {sellerSubmission?.status === "submitted" ? (
                            <p className="text-[11px] text-slate-500">
                              {publishGate?.hint ||
                                (submittedAtLabel
                                  ? `Waiting review since ${submittedAtLabel}`
                                  : "Waiting review")}
                            </p>
                          ) : sellerSubmission?.status === "needs_revision" ? (
                            <p className="text-[11px] text-amber-700">
                              {publishGate?.hint ||
                                "Seller can edit and resubmit after corrections."}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400">
                              Outside seller submission loop.
                            </p>
                          )}
                        </div>
                      </td>

                      <td className={`${tableCell} w-[6%] text-center`}>
                        <button
                          type="button"
                          onClick={() => openViewDrawer(product.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                          title={reviewActionTitle}
                        >
                          <Search className="h-4 w-4" />
                        </button>
                      </td>

                      <td className={`${tableCell} w-[8%] text-center`}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(product)}
                          disabled={publishToggleDisabled}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            isPublished ? "bg-emerald-500" : "bg-slate-300"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          aria-label={publishToggleTitle}
                          aria-busy={publishingIds.has(Number(product.id))}
                          title={publishToggleTitle}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              isPublished ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>

                      <td className={`${tableCell} w-[8%] text-center`}>
                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(product.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(product.id)}
                            disabled={deleteMutation.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-slate-400">
                          Quick edit
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-50"
          disabled={meta.page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span className="text-slate-500">
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-50"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>

      {drawerState.open ? (
        <>
          <button
            type="button"
            aria-label="Close add product drawer"
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-slate-900/35"
          />
          <div className="fixed inset-y-0 left-0 right-0 z-50 border-l border-slate-200 bg-white shadow-2xl md:left-[280px]">
            {drawerState.mode === "view" ? (
              <ProductPreviewDrawer
                productId={drawerState.productId}
                onClose={closeDrawer}
                onEdit={(id) => openEditDrawer(id)}
              />
            ) : (
              <ProductForm
                key={`${drawerState.mode}-${drawerState.productId ?? "new"}`}
                mode="drawer"
                productId={drawerState.mode === "edit" ? drawerState.productId : null}
                onClose={closeDrawer}
                onSuccess={() => {
                  closeDrawer();
                  queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                }}
              />
            )}
          </div>
        </>
      ) : null}

      {bulkConfirm.open ? (
        <>
          <button
            type="button"
            onClick={() => {
              if (bulkMutation.isPending) return;
              setBulkConfirm({ open: false, action: "delete", ids: [] });
            }}
            className="fixed inset-0 z-[70] bg-slate-900/35"
            aria-label="Close bulk delete confirmation"
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Are you sure?</h3>
              <p className="mt-2 text-sm text-slate-500">
                You are about to delete {bulkConfirm.ids.length} selected product(s). This action
                cannot be undone.
              </p>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={bulkMutation.isPending}
                  onClick={() => setBulkConfirm({ open: false, action: "delete", ids: [] })}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkMutation.isPending}
                  onClick={handleConfirmBulkDelete}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-500 bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkMutation.isPending ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
