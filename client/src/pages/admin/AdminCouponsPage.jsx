import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Layers3,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import {
  bulkAdminCoupons,
  createAdminCoupon,
  deleteAdminCoupon,
  exportAdminCoupons,
  fetchAdminCouponMeta,
  fetchAdminCoupons,
  importAdminCoupons,
  updateAdminCoupon,
} from "../../lib/adminApi.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { formatCurrency } from "../../utils/format.js";
import AddCouponDrawer from "../../components/admin/coupons/AddCouponDrawer.jsx";
import DeleteCouponModal from "../../components/admin/coupons/DeleteCouponModal.jsx";
import CouponFilterMenu from "../../components/coupons/CouponFilterMenu.jsx";
import EditCouponDrawer from "../../components/admin/coupons/EditCouponDrawer.jsx";
import CouponImportModal from "../../components/coupons/CouponImportModal.jsx";
import {
  UiErrorState,
  UiSkeleton,
} from "../../components/primitives/state/index.js";
import {
  GENERIC_ERROR,
  NO_COUPONS_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";
import { downloadCsvFile, downloadJsonFile } from "../../utils/exportFiles.js";

const headerBtnBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const headerBtnSoft = `${headerBtnBase} border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50`;
const headerBtnAmber = `${headerBtnBase} border border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnDanger = `${headerBtnBase} border border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-700 text-white hover:bg-emerald-800`;
const headerBtnGhost =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-transparent px-2.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";
const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-700 focus:border-emerald-500 focus:outline-none";
const tableHeadCell =
  "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-4 py-3.5 align-middle text-sm text-slate-700";
const publishedFilterOptions = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
];
const statusFilterOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Draft / Inactive" },
  { value: "scheduled", label: "Scheduled" },
];
const DEFAULT_COLUMN_VISIBILITY = {
  campaign: true,
  code: true,
  discount: true,
  published: true,
  startDate: true,
  endDate: true,
  status: true,
  actions: true,
};
const VIEW_COLUMNS = [
  ["campaign", "Campaign name"],
  ["code", "Code"],
  ["discount", "Discount"],
  ["published", "Published"],
  ["startDate", "Start date"],
  ["endDate", "End date"],
  ["status", "Status"],
  ["actions", "Actions"],
];
const EXPORT_COLUMNS = [
  { key: "campaignName", label: "Campaign Name" },
  { key: "code", label: "Code" },
  { key: "scope", label: "Scope" },
  { key: "store", label: "Store" },
  { key: "discountType", label: "Discount Type" },
  { key: "discountValue", label: "Discount Value" },
  { key: "minimumAmount", label: "Minimum Amount" },
  { key: "published", label: "Published" },
  { key: "status", label: "Status" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "bannerImageUrl", label: "Banner Image URL" },
];
const EMPTY_COUPONS = [];

const toText = (value) => String(value ?? "").trim();

const formatDiscount = (coupon) => {
  if (!coupon) return "-";
  if (coupon.discountType === "percent") {
    return `${Number(coupon.amount || 0)}%`;
  }
  return formatCurrency(Number(coupon.amount || 0));
};

const formatDateLabel = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const resolveCampaignName = (coupon) => {
  return (
    toText(coupon?.campaignName) ||
    toText(coupon?.name) ||
    toText(coupon?.code) ||
    `Coupon #${coupon?.id ?? "-"}`
  );
};

const resolveCouponScope = (coupon) => {
  const scopeType = String(
    coupon?.governance?.scopeType || coupon?.scopeType || "PLATFORM"
  ).toUpperCase();
  const store = coupon?.governance?.store || coupon?.store || null;
  return {
    scopeType: scopeType === "STORE" ? "STORE" : "PLATFORM",
    label: scopeType === "STORE" ? "Store-scoped" : "Platform",
    ownership:
      scopeType === "STORE" ? "Seller-owned / admin-governed" : "Admin-owned global",
    storeLabel:
      scopeType === "STORE"
        ? store?.name || store?.slug || `Store #${coupon?.governance?.storeId || coupon?.storeId || "-"}`
        : "All storefront lanes",
  };
};

const resolvePublished = (coupon, overrideMap) => {
  const id = Number(coupon?.id);
  if (id && typeof overrideMap[id] === "boolean") {
    return overrideMap[id];
  }
  if (typeof coupon?.active === "boolean") return coupon.active;
  if (typeof coupon?.published === "boolean") return coupon.published;
  return true;
};

const resolveStartDate = (coupon) => {
  return coupon?.startDate || coupon?.startsAt || coupon?.createdAt || null;
};

const resolveEndDate = (coupon) => {
  return coupon?.endDate || coupon?.expiresAt || coupon?.endsAt || null;
};

const resolveStatus = (coupon, published) => {
  const startDate = resolveStartDate(coupon);
  const endDate = resolveEndDate(coupon);
  const parsedStart = startDate ? new Date(startDate) : null;
  const parsedEnd = endDate ? new Date(endDate) : null;
  const isScheduled =
    parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart.getTime() > Date.now() : false;
  const isExpiredByDate = parsedEnd && !Number.isNaN(parsedEnd.getTime())
    ? parsedEnd.getTime() < Date.now()
    : false;

  if (!published) {
    return {
      label: "Draft / Inactive",
      tone: "deactive",
    };
  }

  if (isScheduled && published) {
    return {
      label: "Scheduled",
      tone: "scheduled",
    };
  }

  if (isExpiredByDate) {
    return {
      label: "Expired",
      tone: "expired",
    };
  }

  return {
    label: "Active",
    tone: "active",
  };
};

function CouponStatusBadge({ status }) {
  const tone =
    status?.tone === "expired"
      ? "expired"
      : status?.tone === "scheduled"
        ? "scheduled"
        : status?.tone === "deactive"
          ? "deactive"
          : "active";
  const styles =
    tone === "expired"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "active"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
  const dotClass =
    tone === "expired"
      ? "bg-rose-500"
      : tone === "active"
        ? "bg-emerald-500"
        : "bg-slate-400";

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      {status?.label || "Active"}
    </span>
  );
}

function CouponDiscountTypeBadge({ coupon }) {
  const isPercent = coupon?.discountType === "percent";
  return (
    <span
      className={`inline-flex min-h-5 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        isPercent
          ? "border-violet-200/80 bg-violet-50/80 text-violet-700"
          : "border-sky-200/80 bg-sky-50/80 text-sky-700"
      }`}
    >
      {isPercent ? "Percent" : "Fixed"}
    </span>
  );
}

export default function AdminCouponsPage() {
  const qc = useQueryClient();
  const bulkMenuRef = useRef(null);
  const exportMenuRef = useRef(null);
  const viewMenuRef = useRef(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [actionMenuCouponId, setActionMenuCouponId] = useState(null);
  const [columnVisibility, setColumnVisibility] = useState(() => ({ ...DEFAULT_COLUMN_VISIBILITY }));
  const [publishedOverrides, setPublishedOverrides] = useState({});
  const [togglingIds, setTogglingIds] = useState(() => new Set());

  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);
  const [deleteTargetSummary, setDeleteTargetSummary] = useState("");
  const [deleteModalError, setDeleteModalError] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [notice, setNotice] = useState({ type: "success", message: "" });
  const [operationError, setOperationError] = useState("");

  const params = useMemo(
    () => ({ page, limit, q: appliedSearch || undefined }),
    [page, limit, appliedSearch]
  );

  const couponsQuery = useQuery({
    queryKey: ["admin-coupons", params],
    queryFn: () => fetchAdminCoupons(params),
    keepPreviousData: true,
  });
  const couponMetaQuery = useQuery({
    queryKey: ["admin-coupon-meta"],
    queryFn: () => fetchAdminCouponMeta(),
  });

  const createMutation = useMutation({
    mutationFn: createAdminCoupon,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      showNotice("Coupon created.");
      setIsAddDrawerOpen(false);
    },
    onError: (error) => {
      showNotice(error?.response?.data?.message || "Failed to create coupon.", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCoupon(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      showNotice("Coupon updated.");
      setIsEditDrawerOpen(false);
      setEditingCoupon(null);
    },
    onError: (error) => {
      showNotice(error?.response?.data?.message || "Failed to update coupon.", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCoupon,
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => deleteAdminCoupon(id)));
      return ids.length;
    },
  });

  const importMutation = useMutation({
    mutationFn: importAdminCoupons,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setIsImportModalOpen(false);
      const summary = result?.data || result || {};
      const created = Number(summary.created || 0);
      const updated = Number(summary.updated || 0);
      const failed = Number(summary.failed || 0);
      showNotice(
        `Coupon import complete. ${created} created, ${updated} updated, ${failed} failed.`,
        failed > 0 ? "error" : "success"
      );
    },
    onError: (error) => {
      showNotice(error?.response?.data?.message || "Failed to import coupons.", "error");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkAdminCoupons(action, ids),
    onSuccess: async (_result, variables) => {
      await qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setSelectedIds(new Set());
      const actionLabel =
        variables.action === "activate"
          ? "activated"
          : variables.action === "deactivate"
            ? "deactivated"
            : "updated";
      showNotice(`${variables.ids.length} coupon(s) ${actionLabel}.`);
    },
    onError: (error) => {
      showNotice(error?.response?.data?.message || "Failed to run bulk coupon action.", "error");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => updateAdminCoupon(id, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
  });

  const items = Array.isArray(couponsQuery.data?.data?.items)
    ? couponsQuery.data.data.items
    : EMPTY_COUPONS;
  const filteredItems = useMemo(
    () =>
      items.filter((coupon) => {
        const published = resolvePublished(coupon, publishedOverrides);
        const status = resolveStatus(coupon, published);
        if (publishedFilter === "published" && !published) return false;
        if (publishedFilter === "unpublished" && published) return false;
        if (statusFilter === "active" && status.label !== "Active") return false;
        if (statusFilter === "expired" && status.label !== "Expired") return false;
        if (statusFilter === "inactive" && status.label !== "Draft / Inactive") return false;
        if (statusFilter === "scheduled" && status.label !== "Scheduled") return false;
        return true;
      }),
    [items, publishedFilter, publishedOverrides, statusFilter]
  );
  const storeOptions = Array.isArray(couponMetaQuery.data?.data?.stores)
    ? couponMetaQuery.data.data.stores
    : [];
  const meta = couponsQuery.data?.data?.meta || {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
  };
  const totalPages = Math.max(
    1,
    Number(meta.totalPages || Math.ceil(Number(meta.total || 0) / Number(meta.limit || limit)) || 1)
  );
  const isDeletePending = deleteMutation.isPending || bulkDeleteMutation.isPending;
  const isBulkPending = bulkMutation.isPending;
  const isCreateBusy = Boolean(createMutation.isPending || createMutation.isLoading);
  const isUpdateBusy = Boolean(updateMutation.isPending || updateMutation.isLoading);
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  const showNotice = (message, type = "success") => {
    setNotice({ type, message });
  };

  useEffect(() => {
    if (!notice?.message) return;
    const timer = setTimeout(() => setNotice({ type: "success", message: "" }), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!operationError) return;
    const timer = setTimeout(() => setOperationError(""), 2800);
    return () => clearTimeout(timer);
  }, [operationError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = toText(searchInput);
      setAppliedSearch((prev) => (prev === next ? prev : next));
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!actionMenuCouponId && !bulkMenuOpen && !exportMenuOpen && !viewMenuOpen) return undefined;
    const onDocumentClick = (event) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(event.target)) {
        setBulkMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target)) {
        setViewMenuOpen(false);
      }
      if (actionMenuCouponId && !event.target.closest?.("[data-coupon-action-menu]")) {
        setActionMenuCouponId(null);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setBulkMenuOpen(false);
        setExportMenuOpen(false);
        setViewMenuOpen(false);
        setActionMenuCouponId(null);
      }
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [actionMenuCouponId, bulkMenuOpen, exportMenuOpen, viewMenuOpen]);

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((coupon) => Number(coupon?.id)));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(Number(id))) next.add(Number(id));
      });
      if (next.size === prev.size) {
        let changed = false;
        next.forEach((id) => {
          if (!prev.has(Number(id))) changed = true;
        });
        if (!changed) {
          return prev;
        }
      }
      return next;
    });
  }, [filteredItems]);

  const allSelected =
    filteredItems.length > 0 && filteredItems.every((coupon) => selectedIds.has(Number(coupon.id)));

  const openCreate = () => {
    createMutation.reset();
    setIsAddDrawerOpen(true);
  };

  const closeCreateDrawer = () => {
    if (isCreateBusy) return;
    createMutation.reset();
    setIsAddDrawerOpen(false);
  };

  const openEdit = (coupon) => {
    updateMutation.reset();
    setEditingCoupon(coupon ?? null);
    setIsEditDrawerOpen(true);
  };

  const closeEditDrawer = () => {
    if (isUpdateBusy) return;
    updateMutation.reset();
    setIsEditDrawerOpen(false);
    setEditingCoupon(null);
  };

  const handleUpdateSubmit = (payload) => {
    if (isUpdateBusy) return;
    const id = Number(editingCoupon?.id);
    if (!id) return;
    updateMutation.mutate({ id, payload });
  };

  const handleCreateSubmit = (payload) => {
    if (isCreateBusy) return;
    createMutation.mutate(payload);
  };

  const serializeCouponForExport = (coupon) => {
    const scope = resolveCouponScope(coupon);
    const published = resolvePublished(coupon, {});
    const status = resolveStatus(coupon, published);
    return {
      id: coupon?.id ?? null,
      campaignName: resolveCampaignName(coupon),
      code: toText(coupon?.code).toUpperCase(),
      scope: scope.label,
      store: scope.scopeType === "STORE" ? scope.storeLabel : "",
      discountType: coupon?.discountType === "fixed" ? "Fixed" : "Percent",
      discountValue: formatDiscount(coupon),
      minimumAmount: formatCurrency(Number(coupon?.minSpend || 0)),
      published: published ? "Published" : "Unpublished",
      status: status.label,
      startDate: formatDateLabel(resolveStartDate(coupon)),
      endDate: formatDateLabel(resolveEndDate(coupon)),
      bannerImageUrl: toText(coupon?.bannerImageUrl),
      amount: Number(coupon?.amount || 0),
      minSpend: Number(coupon?.minSpend || 0),
      discountTypeCode: coupon?.discountType === "fixed" ? "fixed" : "percent",
      startsAt: resolveStartDate(coupon),
      expiresAt: resolveEndDate(coupon),
      scopeType: scope.scopeType,
      storeId: coupon?.governance?.storeId || coupon?.storeId || null,
      active: published,
    };
  };

  const filterCouponsForCurrentView = (coupons) =>
    coupons.filter((coupon) => {
      const published = resolvePublished(coupon, {});
      const status = resolveStatus(coupon, published);
      if (publishedFilter === "published" && !published) return false;
      if (publishedFilter === "unpublished" && published) return false;
      if (statusFilter === "active" && status.label !== "Active") return false;
      if (statusFilter === "expired" && status.label !== "Expired") return false;
      if (statusFilter === "inactive" && status.label !== "Draft / Inactive") return false;
      if (statusFilter === "scheduled" && status.label !== "Scheduled") return false;
      return true;
    });

  const handleExport = async (format) => {
    try {
      const response = await exportAdminCoupons({ q: appliedSearch || undefined });
      const payload = await response.json();
      const exportItems = filterCouponsForCurrentView(
        Array.isArray(payload?.items) ? payload.items : EMPTY_COUPONS
      );
      if (!exportItems.length) {
        showNotice("No coupons available to export.", "error");
        return;
      }
      const serializedItems = exportItems.map(serializeCouponForExport);
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        downloadCsvFile(EXPORT_COLUMNS, serializedItems, `coupons-export-${stamp}.csv`);
      } else {
        downloadJsonFile(
          {
            format: "admin-coupons.export.v2",
            exportedAt: new Date().toISOString(),
            total: serializedItems.length,
            filters: {
              q: appliedSearch || null,
              published: publishedFilter,
              status: statusFilter,
            },
            items: serializedItems,
          },
          `coupons-export-${stamp}.json`
        );
      }
      setExportMenuOpen(false);
      showNotice(`Coupon export ${format.toUpperCase()} ready.`);
    } catch (error) {
      showNotice(error?.message || "Failed to export coupons.", "error");
    }
  };

  const handleImportSubmit = (file) => {
    if (!file || importMutation.isPending) return;
    importMutation.mutate(file);
  };

  const closeDeleteModal = () => {
    if (isDeletePending) return;
    setIsDeleteModalOpen(false);
    setDeleteMode(null);
    setDeleteTargetId(null);
    setDeleteTargetIds([]);
    setDeleteTargetSummary("");
    setDeleteModalError("");
  };

  const openDeleteModalForSingle = (coupon) => {
    const id = Number(coupon?.id);
    if (!id) return;
    const published = resolvePublished(coupon, publishedOverrides);
    const status = resolveStatus(coupon, published);
    const endDate = resolveEndDate(coupon);
    const validityLabel = endDate ? `Ends ${formatDateLabel(endDate)}` : "No expiry date";
    const codeLabel = toText(coupon?.code) || resolveCampaignName(coupon);
    setDeleteMode("single");
    setDeleteTargetId(id);
    setDeleteTargetIds([]);
    setDeleteTargetSummary(
      `${codeLabel} is currently ${status.label.toLowerCase()} and ${published ? "visible in checkout" : "hidden from checkout"}. ${validityLabel}.`
    );
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
  };

  const openDeleteModalForBulk = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      showNotice("Select at least one coupon before opening bulk delete.", "error");
      return;
    }
    setBulkMenuOpen(false);
    setDeleteMode("bulk");
    setDeleteTargetId(null);
    setDeleteTargetIds(ids);
    setDeleteTargetSummary(
      `${ids.length} selected coupon(s) will be removed from the current promotion list. This cannot be undone.`
    );
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteModalError("");
    try {
      if (deleteMode === "single" && deleteTargetId) {
        await deleteMutation.mutateAsync(deleteTargetId);
        showNotice("Coupon deleted.");
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(Number(deleteTargetId));
          return next;
        });
      } else if (deleteMode === "bulk" && deleteTargetIds.length > 0) {
        const total = deleteTargetIds.length;
        await bulkDeleteMutation.mutateAsync(deleteTargetIds);
        showNotice(`${total} coupon(s) deleted.`);
        setSelectedIds(new Set());
      } else {
        return;
      }
      await qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      closeDeleteModal();
    } catch (error) {
      setDeleteModalError(error?.response?.data?.message || GENERIC_ERROR);
    }
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filteredItems.forEach((coupon) => next.delete(Number(coupon.id)));
      } else {
        filteredItems.forEach((coupon) => next.add(Number(coupon.id)));
      }
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    const safeId = Number(id);
    if (!safeId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(safeId)) next.delete(safeId);
      else next.add(safeId);
      return next;
    });
  };

  const handleDeleteOne = (coupon) => {
    openDeleteModalForSingle(coupon);
  };

  const handleDeleteSelected = () => {
    openDeleteModalForBulk();
  };

  const handleBulkAction = (action) => {
    if (!selectedIds.size) {
      showNotice("Select at least one coupon before using bulk actions.", "error");
      return;
    }
    setBulkMenuOpen(false);
    if (action === "delete") {
      handleDeleteSelected();
      return;
    }
    bulkMutation.mutate({
      action,
      ids: Array.from(selectedIds),
    });
  };

  const handleTogglePublished = (coupon) => {
    const id = Number(coupon?.id);
    if (!id || togglingIds.has(id)) return;
    const previous = resolvePublished(coupon, publishedOverrides);
    const nextValue = !previous;

    setPublishedOverrides((prev) => ({ ...prev, [id]: nextValue }));
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    toggleMutation.mutate(
      { id, active: nextValue },
      {
        onSuccess: () => {
          showNotice(
            `${resolveCampaignName(coupon)} ${nextValue ? "enabled for checkout" : "hidden from checkout"}.`
          );
        },
        onError: (error) => {
          setOperationError(error?.response?.data?.message || GENERIC_ERROR);
          setPublishedOverrides((prev) => ({ ...prev, [id]: previous }));
        },
        onSettled: () => {
          setTogglingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      }
    );
  };

  const tableErrorMessage =
    couponsQuery.error?.response?.data?.message || GENERIC_ERROR;
  const deleteTitle =
    deleteMode === "bulk"
      ? `Delete ${deleteTargetIds.length} coupon(s)?`
      : "Delete this coupon?";
  const deleteDescription =
    deleteMode === "bulk"
      ? deleteTargetSummary ||
        "These selected coupons will be removed from the promotion list and cannot be restored from this screen."
      : deleteTargetSummary ||
        "This coupon will be removed from the promotion list and can no longer be used at checkout.";

  return (
    <div className="space-y-4 bg-slate-50">
      <section className="rounded-[10px] border border-slate-200 bg-white shadow-none">
        <div className="flex flex-col gap-4 px-4 py-3.5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1">
              <h1 className="text-[20px] font-semibold leading-6 text-slate-900">Coupon</h1>
              <p className="text-[13px] font-normal text-slate-500">Manage discount coupons</p>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2.5 xl:justify-end">
              <div ref={exportMenuRef} className="relative">
                <button
                  type="button"
                  className={headerBtnOutline}
                  onClick={() => setExportMenuOpen((prev) => !prev)}
                >
                  <Upload className="h-4 w-4" />
                  Export
                </button>
                {exportMenuOpen ? (
                  <div className="absolute left-0 top-12 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                    <button
                      type="button"
                      onClick={() => handleExport("csv")}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" />
                      Export to CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("json")}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" />
                      Export to JSON
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={headerBtnOutline}
                onClick={() => setIsImportModalOpen(true)}
                disabled={importMutation.isPending}
              >
                <Download className="h-4 w-4" />
                Import
              </button>

              <div ref={bulkMenuRef} className="relative">
                <button
                  type="button"
                  className={selectedIds.size > 0 ? headerBtnAmber : headerBtnSoft}
                  disabled={selectedIds.size === 0 || isDeletePending || isBulkPending}
                  onClick={() => setBulkMenuOpen((prev) => !prev)}
                >
                  <Layers3 className="h-4 w-4" />
                  Bulk Action
                </button>
                {bulkMenuOpen ? (
                  <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                    <button
                      type="button"
                      onClick={() => handleBulkAction("activate")}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Activate Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("deactivate")}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Deactivate Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("delete")}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Delete Selected
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className={selectedIds.size > 0 ? headerBtnDanger : `${headerBtnDanger} cursor-not-allowed`}
                disabled={selectedIds.size === 0 || isDeletePending}
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>

              <button type="button" onClick={openCreate} className={headerBtnGreen}>
                <Plus className="h-4 w-4" />
                Add Coupon
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="w-full min-w-[240px] flex-1 xl:max-w-[360px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search by name or code..."
                    className={`${fieldClass} pl-9`}
                  />
                </div>
              </div>
              <CouponFilterMenu
                label="Published"
                value={publishedFilter}
                options={publishedFilterOptions}
                onChange={setPublishedFilter}
                widthClass="min-w-[156px]"
              />
              <CouponFilterMenu
                label="Status"
                value={statusFilter}
                options={statusFilterOptions}
                onChange={setStatusFilter}
                widthClass="min-w-[148px]"
              />
            </div>

            <div ref={viewMenuRef} className="relative flex items-center justify-end xl:ml-3">
              <button
                type="button"
                className={headerBtnGhost}
                onClick={() => setViewMenuOpen((prev) => !prev)}
                aria-expanded={viewMenuOpen}
                title={`Toggle columns (${visibleColumnCount}/8 visible)`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                View
              </button>
              {viewMenuOpen ? (
                <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                  <button
                    type="button"
                    onClick={() => setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY })}
                    className="mb-1 flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  >
                    <span>Reset view</span>
                    <span>{visibleColumnCount}/8</span>
                  </button>
                  {VIEW_COLUMNS.map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 transition hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(columnVisibility[key])}
                        onChange={() =>
                          setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {notice?.message ? (
        <div
          className={`rounded-2xl px-4 py-2 text-sm ${
            notice.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {operationError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {operationError}
        </div>
      ) : null}

      {couponsQuery.isLoading && !couponsQuery.data ? <UiSkeleton variant="table" rows={8} /> : null}

      {couponsQuery.isError && !couponsQuery.data ? (
        <UiErrorState title={GENERIC_ERROR} message={tableErrorMessage} onRetry={couponsQuery.refetch} />
      ) : null}

      {!couponsQuery.isLoading && !couponsQuery.isError && filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">{NO_COUPONS_FOUND}</p>
          <p className="mt-1 text-xs text-slate-500">
            {appliedSearch
              ? "No campaigns match the current search. Try another code or adjust the filters."
              : "Create your first coupon to enable checkout discounts."}
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-2.5 inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 text-[11px] font-medium text-white hover:bg-emerald-700"
          >
            Add Coupon
          </button>
        </div>
      ) : null}

      {!couponsQuery.isLoading && !couponsQuery.isError && filteredItems.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-700">{filteredItems.length}</span> /{" "}
            <span className="font-semibold text-slate-700">{meta.total || 0}</span>
            {selectedIds.size > 0 ? <span className="ml-2 text-slate-400">{selectedIds.size} selected</span> : null}
          </div>
          <div className="-mx-3 w-auto overflow-x-auto px-3 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[4%]`}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  {columnVisibility.campaign ? (
                    <th className={`${tableHeadCell} w-[28%] min-w-[220px]`}>Campaign Name</th>
                  ) : null}
                  {columnVisibility.code ? <th className={`${tableHeadCell} w-[12%]`}>Code</th> : null}
                  {columnVisibility.discount ? (
                    <th className={`${tableHeadCell} w-[16%] text-right`}>Discount</th>
                  ) : null}
                  {columnVisibility.published ? (
                    <th className={`${tableHeadCell} w-[12%]`}>Published</th>
                  ) : null}
                  {columnVisibility.startDate ? (
                    <th className={`${tableHeadCell} w-[12%]`}>Start Date</th>
                  ) : null}
                  {columnVisibility.endDate ? (
                    <th className={`${tableHeadCell} w-[12%]`}>End Date</th>
                  ) : null}
                  {columnVisibility.status ? (
                    <th className={`${tableHeadCell} w-[12%] min-w-[160px]`}>Status</th>
                  ) : null}
                  {columnVisibility.actions ? (
                    <th className={`${tableHeadCell} w-[8%] text-right`}>Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((coupon) => {
                  const id = Number(coupon?.id);
                  const campaignName = resolveCampaignName(coupon);
                  const initial = campaignName.charAt(0).toUpperCase() || "C";
                  const bannerSrc = resolveAssetUrl(coupon?.bannerImageUrl || "");
                  const published = resolvePublished(coupon, publishedOverrides);
                  const status = resolveStatus(coupon, published);
                  const startDate = resolveStartDate(coupon);
                  const endDate = resolveEndDate(coupon);
                  const scope = resolveCouponScope(coupon);

                  return (
                    <tr
                      key={coupon.id}
                      className="h-14 border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={`${tableCell} w-[4%]`}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => toggleSelectRow(id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {columnVisibility.campaign ? (
                      <td className={`${tableCell} w-[28%]`}>
                        <div className="flex items-center gap-3">
                          {bannerSrc ? (
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                              <img
                                src={bannerSrc}
                                alt={`${coupon.code || campaignName} banner`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                              <span className="absolute bottom-1 left-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[10px] font-semibold text-emerald-700 shadow-sm ring-1 ring-slate-200">
                                {initial}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                              {initial}
                            </span>
                          )}
                          <div className="min-w-0 max-w-[220px]">
                            <p className="truncate text-sm font-semibold text-slate-900">{campaignName}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                {scope.label}
                              </span>
                              <span className="truncate">{scope.storeLabel}</span>
                            </div>
                            {bannerSrc ? (
                              <div className="mt-1 text-[10px] font-medium text-emerald-600">
                                Banner linked
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      ) : null}

                      {columnVisibility.code ? (
                      <td className={`${tableCell} w-[12%]`}>
                        <span className="font-semibold uppercase text-slate-700">{coupon.code || "-"}</span>
                      </td>
                      ) : null}

                      {columnVisibility.discount ? (
                      <td className={`${tableCell} w-[16%] text-right`}>
                        <div className="space-y-1">
                          <div className="font-semibold tabular-nums text-slate-900">
                            {formatDiscount(coupon)}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <CouponDiscountTypeBadge coupon={coupon} />
                            <span className="text-[11px] text-slate-500">
                              {Number(coupon?.minSpend || 0) > 0
                                ? `Minimum ${formatCurrency(Number(coupon.minSpend || 0))}`
                                : "No minimum"}
                            </span>
                          </div>
                        </div>
                      </td>
                      ) : null}

                      {columnVisibility.published ? (
                      <td className={`${tableCell} w-[12%]`}>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePublished(coupon)}
                            disabled={togglingIds.has(id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                              published ? "bg-fuchsia-500" : "bg-slate-300"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                            aria-label={`Toggle publish for ${campaignName}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                published ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                      ) : null}

                      {columnVisibility.startDate ? (
                      <td className={`${tableCell} w-[12%] whitespace-nowrap`}>
                        {formatDateLabel(startDate)}
                      </td>
                      ) : null}

                      {columnVisibility.endDate ? (
                      <td className={`${tableCell} w-[12%] whitespace-nowrap`}>
                        {formatDateLabel(endDate)}
                      </td>
                      ) : null}

                      {columnVisibility.status ? (
                      <td className={`${tableCell} w-[12%]`}>
                        <CouponStatusBadge status={status} />
                      </td>
                      ) : null}

                      {columnVisibility.actions ? (
                      <td className={`${tableCell} w-[8%] text-right`}>
                        <div className="relative inline-flex" data-coupon-action-menu>
                          <button
                            type="button"
                            onClick={() =>
                              setActionMenuCouponId((prev) => (prev === id ? null : id))
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                            aria-label={`Open actions for ${coupon.code || campaignName}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {actionMenuCouponId === id ? (
                            <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => openEdit(coupon)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4 text-slate-400" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOne(coupon)}
                                disabled={isDeletePending}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4 text-rose-500" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] shadow-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 disabled:opacity-50"
          disabled={meta.page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span className="text-[10px] text-slate-500">
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 disabled:opacity-50"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>

      <DeleteCouponModal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={deleteTitle}
        description={deleteDescription}
        isLoading={isDeletePending}
        errorMessage={deleteModalError}
      />
      <CouponImportModal
        open={isImportModalOpen}
        onClose={() => !importMutation.isPending && setIsImportModalOpen(false)}
        onImport={handleImportSubmit}
        isSubmitting={importMutation.isPending}
        errorMessage={importMutation.error?.response?.data?.message || ""}
        title="Import coupons"
        description="Upload a JSON file to import coupon campaigns into Admin Workspace."
        helperText="Accepted format: JSON coupon export from Admin Workspace."
      />

      <AddCouponDrawer
        open={isAddDrawerOpen}
        onClose={closeCreateDrawer}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
        storeOptions={storeOptions}
        error={
          createMutation.error?.response?.data?.message ||
          (createMutation.isError ? GENERIC_ERROR : "")
        }
      />
      <EditCouponDrawer
        open={isEditDrawerOpen}
        onClose={closeEditDrawer}
        coupon={editingCoupon}
        onSubmit={handleUpdateSubmit}
        isSubmitting={updateMutation.isPending}
        storeOptions={storeOptions}
        error={
          updateMutation.error?.response?.data?.message ||
          (updateMutation.isError ? GENERIC_ERROR : "")
        }
      />
    </div>
  );
}
