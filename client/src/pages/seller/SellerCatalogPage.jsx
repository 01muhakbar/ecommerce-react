import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Filter,
  Layers3,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Tag,
} from "lucide-react";
import {
  bulkSubmitSellerProductsForReview,
  exportSellerProducts,
  getSellerProducts,
  setSellerProductPublished,
  submitSellerProductDraftForReview,
} from "../../api/sellerProducts.ts";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { prevData } from "../../lib/rq.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import {
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  sellerTableWrapClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatePanel,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";

const DEFAULT_FILTERS = {
  keyword: "",
  status: "",
  submissionStatus: "",
  visibilityState: "",
  page: 1,
  limit: 20,
};

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
    filters.status,
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
  if (status === "submitted") return "Submitted";
  if (status === "needs_revision") return "Needs revision";
  if (status === "none") return "Not submitted";
  return "All submission";
};

const getVisibilityFilterLabel = (value) => {
  if (value === "storefront_visible") return "Storefront visible";
  if (value === "published_blocked") return "Published blocked";
  if (value === "internal_only") return "Internal only";
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
  if (filters.submissionStatus === "submitted") return "Submitted";
  if (filters.submissionStatus === "needs_revision") return "Revision";
  if (filters.status === "draft") return "Draft";
  if (filters.visibilityState === "storefront_visible") return "Visible";
  if (filters.visibilityState === "published_blocked") return "Blocked";
  return "All";
};

const getSubmissionReason = (submission) =>
  submission?.reviewNote || submission?.revisionReason || submission?.revisionNote || null;

const compactActionButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const compactPrimaryActionButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const compactTableHeadClass =
  "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const compactTableCellClass = "px-3 py-2.5 align-top text-sm text-slate-700";
const compactTextLinkClass =
  "inline-flex h-8 items-center whitespace-nowrap px-1 text-xs font-semibold text-slate-500 transition hover:text-slate-900";

const getCompactStockMeta = (item) => {
  const stock = Number(item?.inventory?.stock ?? item?.availability?.stock ?? 0);
  if (stock <= 0) return { label: "Out of stock", toneClass: "text-rose-600" };
  if (stock <= 10) return { label: "Low stock", toneClass: "text-amber-600" };
  return { label: "Ready", toneClass: "text-emerald-600" };
};

const getCompactSubmissionHint = (item) => {
  if (item?.submission?.status === "submitted") return "In review";
  if (item?.submission?.status === "needs_revision") return "Fix then resend";
  if (isReadyToSubmitItem(item)) return "Ready now";
  if (item?.authoring?.canEditDraft) return "Edit draft";
  if (item?.status === "draft") return "Draft";
  return "Read-only";
};

const getCompactSubmissionLabel = (item) => {
  if (item?.submission?.status === "submitted") return "Submitted";
  if (item?.submission?.status === "needs_revision") return "Needs revision";
  if (isReadyToSubmitItem(item)) return "Ready to submit";
  if (item?.status === "draft") return "Draft";
  return item?.submission?.label || "Not submitted";
};

const getCompactVisibilityLabel = (item) =>
  item?.visibility?.storefrontVisible
    ? "Visible"
    : item?.visibility?.stateCode === "PUBLISHED_BLOCKED"
      ? "Blocked"
      : "Internal";

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
  if (item?.visibility?.storefrontVisible) return "Storefront on";
  if (item?.visibility?.stateCode === "PUBLISHED_BLOCKED") {
    return "Publish on, state blocked";
  }
  return "Seller/Admin only";
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

export default function SellerCatalogPage({ variant = "catalog" }) {
  const queryClient = useQueryClient();
  const { workspaceStoreId: storeId, workspaceRoutes, sellerContext } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewProducts = permissionKeys.includes("PRODUCT_VIEW");
  const canEditProducts = permissionKeys.includes("PRODUCT_EDIT");
  const canPublishProducts = permissionKeys.includes("PRODUCT_PUBLISH");
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [actionNotice, setActionNotice] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [submittingProductId, setSubmittingProductId] = useState(null);
  const isLanding = variant === "landing";

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
          ? "Product published and synced to storefront visibility."
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
  const canCreateDraft = Boolean(authoringGovernance?.canCreateDraft);
  const totalPages = Math.max(
    1,
    Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 20))
  );
  const activeFilterCount = buildActiveFilterCount(appliedFilters);
  const appliedFilterPills = useMemo(
    () => buildAppliedFilterPills(appliedFilters),
    [appliedFilters]
  );
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
  const isListRefreshing = productsQuery.isFetching && !productsQuery.isLoading;
  const allVisibleSelected = itemIds.length > 0 && itemIds.every((id) => selectedIds.has(id));
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
  const selectedBlockedCount = Math.max(
    0,
    selectedCount - selectedReadyToSubmitIds.length - selectedRevisionIds.length
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const allowed = new Set(itemIds);
      const next = [...current].filter((id) => allowed.has(Number(id)));
      if (next.length === current.size) return current;
      return new Set(next);
    });
  }, [itemIds]);

  const applyFilters = () => {
    setSelectedIds(new Set());
    setAppliedFilters((current) => ({
      ...current,
      keyword: String(draftFilters.keyword || "").trim(),
      status: String(draftFilters.status || ""),
      submissionStatus: String(draftFilters.submissionStatus || ""),
      visibilityState: String(draftFilters.visibilityState || ""),
      limit: Number(draftFilters.limit || 20) || 20,
      page: 1,
    }));
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSelectedIds(new Set());
  };

  const emptyStateAction =
    activeFilterCount > 0 ? (
      <button type="button" onClick={resetFilters} className={sellerSecondaryButtonClass}>
        <RotateCcw className="h-4 w-4" />
        Reset filters
      </button>
    ) : canCreateDraft ? (
      <Link to={workspaceRoutes.productCreate()} className={sellerPrimaryButtonClass}>
        <Plus className="h-4 w-4" />
        Add Product
      </Link>
    ) : null;

  const updatePage = (page) => {
    setSelectedIds(new Set());
    setDraftFilters((current) => ({ ...current, page }));
    setAppliedFilters((current) => ({ ...current, page }));
  };

  const applyQuickLane = (nextPartial) => {
    setSelectedIds(new Set());
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

  const handleExport = async () => {
    if (!storeId) return;
    setIsExporting(true);
    setActionNotice(null);

    try {
      const exportPayload = await exportSellerProducts(storeId, {
        filters: {
          keyword: appliedFilters.keyword,
          status: appliedFilters.status,
          submissionStatus: appliedFilters.submissionStatus,
          visibilityState: appliedFilters.visibilityState,
        },
      });
      downloadBlobFile(exportPayload.filename, exportPayload.blob);
      setActionNotice({
        type: "success",
        message: "Exported the current seller product result set for this store.",
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

  const handleExportSelected = async () => {
    if (!storeId || selectedCount === 0) return;
    setIsExporting(true);
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
    setSelectedIds(new Set());
  };

  const handleApplyBulkAction = (action, ids) => {
    if (!canEditProducts || !action || !Array.isArray(ids) || ids.length === 0) return;
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
      <SellerWorkspaceSectionHeader
        eyebrow={null}
        title="Products"
        description="Seller catalog for drafts, review flow, and live state."
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || bulkMutation.isPending}
              className={sellerSecondaryButtonClass}
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </button>
            {canCreateDraft ? (
              <Link to={workspaceRoutes.productCreate()} className={sellerPrimaryButtonClass}>
                <Plus className="h-4 w-4" />
                Add Product
              </Link>
            ) : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{pagination.total} in result</span>
          <span className="text-slate-300">/</span>
          <span>{summary.totalProducts} in store</span>
          <span className="text-slate-300">/</span>
          <span>{getCurrentLaneLabel(appliedFilters)}</span>
          {activeFilterCount > 0 ? (
            <>
              <span className="text-slate-300">/</span>
              <span>{activeFilterCount} filters</span>
            </>
          ) : null}
          {selectedCount > 0 ? (
            <>
              <span className="text-slate-300">/</span>
              <span>{selectedCount} selected</span>
            </>
          ) : null}
          {isListRefreshing ? (
            <>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-700">Refreshing...</span>
            </>
          ) : null}
        </div>
      </SellerWorkspaceSectionHeader>

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

      <SellerWorkspacePanel className="p-3.5 sm:p-4">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <CompactSummaryItem label="Total" value={String(summary.totalProducts)} />
            <CompactSummaryItem
              label="Result set"
              value={String(pagination.total)}
              tone={activeFilterCount > 0 ? "sky" : "slate"}
              Icon={Filter}
            />
            <CompactSummaryItem
              label="Drafts"
              value={String(summary.drafts)}
              tone="amber"
              Icon={Pencil}
            />
            {canEditProducts ? (
              <CompactSummaryItem
                label="Ready"
                value={String(summary.readyToSubmit || 0)}
                tone="emerald"
                Icon={CheckCircle2}
              />
            ) : null}
            <CompactSummaryItem
              label="Review queue"
              value={String(summary.reviewQueue)}
              tone="sky"
              Icon={Clock3}
            />
            <CompactSummaryItem
              label="Needs revision"
              value={String(summary.needsRevision)}
              tone="amber"
              Icon={AlertTriangle}
            />
            <CompactSummaryItem
              label="Live"
              value={String(summary.storefrontVisible)}
              tone="emerald"
              Icon={Eye}
            />
            <CompactSummaryItem
              label="Blocked"
              value={String(summary.publishedBlocked)}
              tone="amber"
              Icon={AlertTriangle}
            />
            <CompactSummaryItem
              label="Internal"
              value={String(summary.internalOnly)}
              Icon={Boxes}
            />
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="w-full xl:max-w-md">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Search
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={draftFilters.keyword}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      keyword: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters();
                  }}
                  placeholder="Search name, slug, or SKU"
                  className={`${sellerFieldClass} h-10 pl-9`}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 xl:justify-end">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Lifecycle
                </p>
                <select
                  value={draftFilters.status}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className={`${sellerFieldClass} h-10 w-full sm:w-[148px]`}
                >
                  <option value="">All lifecycle</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Submission
                </p>
                <select
                  value={draftFilters.submissionStatus}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      submissionStatus: event.target.value,
                    }))
                  }
                  className={`${sellerFieldClass} h-10 w-full sm:w-[172px]`}
                >
                  <option value="">All submission</option>
                  {canEditProducts ? (
                    <option value="ready_to_submit">Ready to submit</option>
                  ) : null}
                  <option value="none">Not submitted</option>
                  <option value="submitted">Submitted</option>
                  <option value="needs_revision">Needs revision</option>
                  <option value="review_queue">Review queue</option>
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Visibility
                </p>
                <select
                  value={draftFilters.visibilityState}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      visibilityState: event.target.value,
                    }))
                  }
                  className={`${sellerFieldClass} h-10 w-full sm:w-[172px]`}
                >
                  <option value="">All visibility</option>
                  <option value="internal_only">Internal only</option>
                  <option value="storefront_visible">Storefront visible</option>
                  <option value="published_blocked">Published blocked</option>
                </select>
              </div>
              <select
                value={String(draftFilters.limit || 20)}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    limit: Number(event.target.value) || 20,
                  }))
                }
                className={`${sellerFieldClass} h-10 w-full sm:w-[128px]`}
              >
                <option value="20">20 rows</option>
                <option value="30">30 rows</option>
                <option value="50">50 rows</option>
              </select>
              <button type="button" onClick={applyFilters} className={sellerPrimaryButtonClass}>
                <Filter className="h-4 w-4" />
                Apply
              </button>
              <button type="button" onClick={resetFilters} className={sellerSecondaryButtonClass}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-[0.08em] text-slate-700">
                View
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">
                {getCurrentLaneLabel(appliedFilters)}
              </span>
              <span>{pagination.total} matching rows</span>
              {activeFilterCount > 0 ? <span>{activeFilterCount} active filter(s)</span> : null}
              {selectedCount > 0 ? <span>{selectedCount} selected</span> : null}
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-100 pt-3 xl:grid-cols-[170px_minmax(0,1fr)] xl:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Submission lane
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReviewQueueCard
                label="All"
                count={summary.totalProducts}
                Icon={Boxes}
                active={
                  !appliedFilters.status &&
                  !appliedFilters.submissionStatus &&
                  !appliedFilters.visibilityState
                }
                onClick={() =>
                  applyQuickLane({
                    status: "",
                    submissionStatus: "",
                    visibilityState: "",
                  })
                }
              />
              <ReviewQueueCard
                label="Draft"
                count={summary.drafts}
                tone="amber"
                Icon={Pencil}
                active={appliedFilters.status === "draft"}
                onClick={() =>
                  applyQuickLane({
                    status: "draft",
                    submissionStatus: "",
                    visibilityState: "",
                  })
                }
              />
              {canEditProducts ? (
                <ReviewQueueCard
                  label="Ready"
                  count={summary.readyToSubmit || 0}
                  tone="emerald"
                  Icon={CheckCircle2}
                  active={appliedFilters.submissionStatus === "ready_to_submit"}
                  onClick={() =>
                    applyQuickLane({
                      status: "",
                      submissionStatus: "ready_to_submit",
                      visibilityState: "",
                    })
                  }
                />
              ) : null}
              <ReviewQueueCard
                label="Submitted"
                count={summary.submitted}
                tone="sky"
                Icon={Clock3}
                active={appliedFilters.submissionStatus === "submitted"}
                onClick={() =>
                  applyQuickLane({
                    status: "",
                    submissionStatus: "submitted",
                    visibilityState: "",
                  })
                }
              />
              <ReviewQueueCard
                label="Review queue"
                count={summary.reviewQueue}
                tone="sky"
                Icon={Clock3}
                active={appliedFilters.submissionStatus === "review_queue"}
                onClick={() =>
                  applyQuickLane({
                    status: "",
                    submissionStatus: "review_queue",
                    visibilityState: "",
                  })
                }
              />
              <ReviewQueueCard
                label="Revision"
                count={summary.needsRevision}
                tone="amber"
                Icon={AlertTriangle}
                active={appliedFilters.submissionStatus === "needs_revision"}
                onClick={() =>
                  applyQuickLane({
                    status: "",
                    submissionStatus: "needs_revision",
                    visibilityState: "",
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[170px_minmax(0,1fr)] xl:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Catalog state
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReviewQueueCard
                label="Active"
                count={summary.active}
                tone="emerald"
                Icon={CheckCircle2}
                active={appliedFilters.status === "active"}
                onClick={() =>
                  applyQuickLane({
                    status: "active",
                    submissionStatus: "",
                    visibilityState: "",
                  })
                }
              />
              <ReviewQueueCard
                label="Visible"
                count={summary.storefrontVisible}
                tone="emerald"
                Icon={Eye}
                active={appliedFilters.visibilityState === "storefront_visible"}
                onClick={() =>
                  applyQuickLane({
                    status: "",
                    submissionStatus: "",
                    visibilityState: "storefront_visible",
                  })
                }
              />
              <ReviewQueueCard
                label="Blocked"
                count={summary.publishedBlocked}
                tone="amber"
                Icon={AlertTriangle}
                active={appliedFilters.visibilityState === "published_blocked"}
                onClick={() =>
                  applyQuickLane({
                    status: "",
                    submissionStatus: "",
                    visibilityState: "published_blocked",
                  })
                }
              />
              <ReviewQueueCard
                label="Inactive"
                count={summary.inactive}
                Icon={Boxes}
                active={appliedFilters.status === "inactive"}
                onClick={() =>
                  applyQuickLane({
                    status: "inactive",
                    submissionStatus: "",
                    visibilityState: "",
                  })
                }
              />
            </div>
          </div>

          {appliedFilterPills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Applied
              </span>
              {appliedFilterPills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700"
                >
                  {pill}
                </span>
              ))}
              <button type="button" onClick={resetFilters} className={compactTextLinkClass}>
                Clear filters
              </button>
            </div>
          ) : null}

          {authoringGovernance?.note || catalogGovernance?.note || contractNotes.length > 0 ? (
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <summary className="cursor-pointer list-none font-semibold text-slate-700">
                Workspace rules
              </summary>
              <div className="mt-2 space-y-2">
                {authoringGovernance?.note || catalogGovernance?.note ? (
                  <p>{authoringGovernance?.note || catalogGovernance?.note}</p>
                ) : null}
                {contractNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </SellerWorkspacePanel>

      <SellerWorkspacePanel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Product list</h3>
            <p className="mt-1 text-xs text-slate-500">
              {pagination.total} row(s) in this result set
              <span className="mx-1.5 text-slate-300">/</span>
              {summary.totalProducts} total in this store
            </p>
          </div>
          {isListRefreshing ? (
            <span className="text-xs font-medium text-slate-500">Refreshing result set...</span>
          ) : null}
        </div>

        {items.length > 0 ? (
          <div className="mt-3">
            {canEditProducts ? (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                {selectedCount > 0 ? (
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <CompactMetricPill
                        label="Selected"
                        value={selectedCount}
                        Icon={Layers3}
                        title="Selected rows"
                      />
                      <CompactMetricPill
                        label="Ready"
                        value={selectedReadyToSubmitIds.length}
                        tone="emerald"
                        Icon={CheckCircle2}
                        title="Draft rows ready to submit"
                      />
                      <CompactMetricPill
                        label="Revision"
                        value={selectedRevisionIds.length}
                        tone="sky"
                        Icon={Clock3}
                        title="Revision rows ready to resubmit"
                      />
                      {selectedBlockedCount > 0 ? (
                        <CompactMetricPill
                          label="Blocked"
                          value={selectedBlockedCount}
                          tone="amber"
                          Icon={AlertTriangle}
                          title="Selected rows that cannot run the current seller action"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyBulkAction("submit_review", selectedReadyToSubmitIds)
                        }
                        disabled={
                          bulkMutation.isPending ||
                          !canEditProducts ||
                          selectedReadyToSubmitIds.length === 0
                        }
                        className={compactPrimaryActionButtonClass}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {bulkMutation.isPending
                          ? "Submitting..."
                          : `Submit drafts (${selectedReadyToSubmitIds.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyBulkAction("resubmit_review", selectedRevisionIds)
                        }
                        disabled={
                          bulkMutation.isPending ||
                          !canEditProducts ||
                          selectedRevisionIds.length === 0
                        }
                        className={compactActionButtonClass}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {bulkMutation.isPending
                          ? "Resubmitting..."
                          : `Resubmit revisions (${selectedRevisionIds.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportSelected}
                        disabled={isExporting || selectedCount === 0}
                        className={compactActionButtonClass}
                        title="Export selected rows"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {isExporting ? "Exporting..." : "Export"}
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className={compactActionButtonClass}
                        title="Clear current selection"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <CompactMetricPill label="Select rows" value="Bulk" Icon={Layers3} />
                    <CompactMetricPill
                      label="Seller actions"
                      value="Submit / Resubmit / Export"
                      Icon={Send}
                      title="Seller bulk actions stay limited to review submission flow"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500">
                This role can review the current seller result set, but draft submit actions stay
                hidden.
              </div>
            )}

            <div className={`${sellerTableWrapClass} overflow-x-auto`}>
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    {canEditProducts ? (
                      <th className={`${compactTableHeadClass} w-[4%]`}>
                        <input
                          type="checkbox"
                          aria-label="Select visible seller products"
                          checked={allVisibleSelected}
                          onChange={toggleSelectVisible}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                    ) : null}
                    <th className={`${compactTableHeadClass} ${canEditProducts ? "w-[31%]" : "w-[34%]"}`}>
                      Product
                    </th>
                    <th className={`${compactTableHeadClass} w-[13%]`}>Category</th>
                    <th className={`${compactTableHeadClass} w-[10%] text-right`}>Price</th>
                    <th className={`${compactTableHeadClass} w-[9%] text-right`}>Sale</th>
                    <th className={`${compactTableHeadClass} w-[8%]`}>Stock</th>
                    <th className={`${compactTableHeadClass} w-[12%]`}>Submission</th>
                    <th className={`${compactTableHeadClass} w-[7%]`}>Visibility</th>
                    <th className={`${compactTableHeadClass} w-[10%]`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item) => {
                    const canEditDraft = Boolean(item.authoring?.canEditDraft && canEditProducts);
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
                    const submissionReason = getSubmissionReason(item.submission);
                    const waitingForAdmin = item.submission?.status === "submitted";
                    const needsRevision = item.submission?.status === "needs_revision";
                    const readyToSubmit = isReadyToSubmitItem(item);
                    const stockMeta = getCompactStockMeta(item);
                    const submissionHint =
                      item.submission?.nextActionDescription || getCompactSubmissionHint(item);
                    const submissionTimelineLabel = waitingForAdmin
                      ? item.submission?.submittedAt
                        ? `Sent ${formatDateTime(item.submission.submittedAt)}`
                        : "Waiting in admin review"
                      : needsRevision && item.submission?.revisionRequestedAt
                        ? `Requested ${formatDateTime(item.submission.revisionRequestedAt)}`
                        : null;

                    return (
                      <tr
                        key={item.id}
                        className={`transition ${isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50/80"}`}
                      >
                        {canEditProducts ? (
                          <td className={`${compactTableCellClass} align-top`}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.name}`}
                              checked={selectedIds.has(Number(item.id))}
                              onChange={() => toggleSelectedId(item.id)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        ) : null}
                        <td className={compactTableCellClass}>
                          <div className="flex items-start gap-3">
                            {item.mediaPreviewUrl ? (
                              <img
                                src={resolveAssetUrl(item.mediaPreviewUrl)}
                                alt={item.name}
                                className="h-12 w-12 rounded-xl border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                                <Boxes className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link
                                to={workspaceRoutes.productDetail(item.id)}
                                className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-emerald-600"
                                title={item.name}
                              >
                                {item.name}
                              </Link>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <CompactMetaItem Icon={Tag} label={item.slug} title={item.slug} />
                                {item.sku ? (
                                  <CompactMetaItem
                                    Icon={Tag}
                                    label={item.sku}
                                    title={`SKU ${item.sku}`}
                                  />
                                ) : null}
                                <CompactMetaItem Icon={Clock3} label={formatDateTime(item.updatedAt)} />
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <SellerWorkspaceBadge
                                  label={getCompactLifecycleLabel(item)}
                                  tone={getLifecycleTone(item)}
                                  className="px-2.5 py-1 text-[11px]"
                                />
                                {item.pricing?.salePrice ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                                    title="Promo price active"
                                  >
                                    <Tag className="h-3.5 w-3.5" />
                                    Promo
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={compactTableCellClass}>
                          <span
                            className="inline-flex min-h-6 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700"
                            title={item.category?.name || "Uncategorized"}
                          >
                            <Layers3 className="h-3.5 w-3.5" />
                            {item.category?.name || "Uncategorized"}
                          </span>
                          {item.category?.code ? (
                            <p className="mt-1 text-xs text-slate-400">{item.category.code}</p>
                          ) : null}
                        </td>
                        <td className={`${compactTableCellClass} text-right font-semibold text-slate-900`}>
                          <div className="space-y-0.5">
                            <div>{formatCurrency(item.pricing?.price)}</div>
                            <div className="text-[10px] font-medium text-slate-400">Base</div>
                          </div>
                        </td>
                        <td className={`${compactTableCellClass} text-right`}>
                          {item.pricing?.salePrice ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-emerald-700">
                                {formatCurrency(item.pricing.salePrice)}
                              </div>
                              <div className="text-[10px] font-medium text-emerald-600">Promo</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">No sale</span>
                          )}
                        </td>
                        <td className={compactTableCellClass}>
                          <p className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                            <Package className="h-3.5 w-3.5 text-slate-400" />
                            {item.inventory?.stock ?? item.availability?.stock ?? 0}
                          </p>
                          <p
                            className={`mt-1 text-xs font-medium ${stockMeta.toneClass}`}
                            title={stockMeta.label}
                          >
                            {stockMeta.label}
                          </p>
                        </td>
                        <td className={compactTableCellClass}>
                          <div className="space-y-1">
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                              title={submissionHint}
                            >
                              {needsRevision ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              ) : waitingForAdmin ? (
                                <Clock3 className="h-3.5 w-3.5 text-sky-600" />
                              ) : readyToSubmit ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Pencil className="h-3.5 w-3.5 text-slate-400" />
                              )}
                              {getCompactSubmissionLabel(item)}
                            </span>
                            {submissionTimelineLabel ? (
                              <p className="text-[11px] text-slate-400" title={submissionTimelineLabel}>
                                {submissionTimelineLabel}
                              </p>
                            ) : null}
                          </div>
                          {submissionReason ? (
                            <p
                              className="mt-1 line-clamp-1 text-[11px] text-amber-700"
                              title={submissionReason}
                            >
                              {submissionReason}
                            </p>
                          ) : null}
                        </td>
                        <td className={compactTableCellClass}>
                          <div className="space-y-1">
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                              title={getCompactVisibilityHint(item)}
                            >
                              {item.visibility?.storefrontVisible ? (
                                <Eye className="h-3.5 w-3.5 text-emerald-600" />
                              ) : item.visibility?.stateCode === "PUBLISHED_BLOCKED" ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <Boxes className="h-3.5 w-3.5 text-slate-400" />
                              )}
                              {getCompactVisibilityLabel(item)}
                            </span>
                            <p className="text-[11px] text-slate-400">{getCompactVisibilityHint(item)}</p>
                          </div>
                        </td>
                        <td className={`${compactTableCellClass} whitespace-nowrap`}>
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {canPublish ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      publishMutation.mutate({
                                        productId: item.id,
                                        published: true,
                                      })
                                    }
                                    disabled={isPublishing}
                                    className={compactPrimaryActionButtonClass}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    {isPublishing ? "Publishing..." : "Publish"}
                                  </button>
                                ) : null}
                                {canUnpublish ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      publishMutation.mutate({
                                        productId: item.id,
                                        published: false,
                                      })
                                    }
                                    disabled={isPublishing}
                                    className={compactActionButtonClass}
                                  >
                                    <Boxes className="h-3.5 w-3.5" />
                                    {isPublishing ? "Updating..." : "Unpublish"}
                                  </button>
                                ) : null}
                                {readyToSubmit && canSubmit ? (
                                  <button
                                    type="button"
                                  onClick={() => submitMutation.mutate(item.id)}
                                  disabled={isSubmitting}
                                  className={compactPrimaryActionButtonClass}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  {isSubmitting ? "Submitting..." : "Submit"}
                                </button>
                              ) : null}
                              {canEditDraft ? (
                                <Link
                                  to={workspaceRoutes.productEdit(item.id)}
                                  className={
                                    needsRevision || !readyToSubmit
                                      ? compactPrimaryActionButtonClass
                                      : compactActionButtonClass
                                  }
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  {needsRevision ? "Revise" : "Edit"}
                                </Link>
                              ) : null}
                              {canSubmit && !readyToSubmit ? (
                                <button
                                  type="button"
                                  onClick={() => submitMutation.mutate(item.id)}
                                  disabled={isSubmitting}
                                  className={compactActionButtonClass}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  {isSubmitting
                                    ? "Submitting..."
                                    : needsRevision
                                      ? "Resubmit"
                                      : "Submit"}
                                </button>
                              ) : null}
                              {(canSubmit ||
                                canEditDraft ||
                                waitingForAdmin ||
                                item.visibility?.storefrontVisible) ? (
                                <Link
                                  to={workspaceRoutes.productDetail(item.id)}
                                  className={compactTextLinkClass}
                                  title="Open product detail"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Open
                                </Link>
                              ) : (
                                <Link
                                  to={workspaceRoutes.productDetail(item.id)}
                                  className={compactPrimaryActionButtonClass}
                                  title="Open product detail"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Open
                                </Link>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium">
                              {!canEditDraft && !canSubmit && waitingForAdmin ? (
                                <span className="text-sky-700">In review</span>
                              ) : item.visibility?.storefrontVisible ? (
                                <span className="text-emerald-700">Live</span>
                              ) : item.status === "inactive" ? (
                                <span className="text-slate-500">Read-only</span>
                              ) : null}
                              <span className="text-slate-400">
                                {item.publishing?.nextActionLabel ||
                                  item.submission?.nextActionLabel ||
                                  "Check status"}
                              </span>
                            </div>
                          </div>
                        </td>
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
                  ? "Try widening lifecycle, submission, visibility, or keyword filters."
                  : canCreateDraft
                    ? "Create the first draft product for this seller store."
                    : "Confirm whether this store already owns product rows in the current workspace."
              }
              action={emptyStateAction}
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
              onClick={() => updatePage(Math.max(1, appliedFilters.page - 1))}
              disabled={appliedFilters.page <= 1}
              className={sellerSecondaryButtonClass}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => updatePage(Math.min(totalPages, appliedFilters.page + 1))}
              disabled={appliedFilters.page >= totalPages}
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
