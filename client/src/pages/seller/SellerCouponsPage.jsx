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
  createSellerCoupon,
  deleteSellerCoupon,
  listSellerCoupons,
  updateSellerCoupon,
} from "../../api/sellerCoupons.ts";
import DeleteCouponModal from "../../components/admin/coupons/DeleteCouponModal.jsx";
import CouponFilterMenu from "../../components/coupons/CouponFilterMenu.jsx";
import CouponImportModal from "../../components/coupons/CouponImportModal.jsx";
import SellerCouponDrawer from "../../components/seller/coupons/SellerCouponDrawer.jsx";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { formatCurrency } from "../../utils/format.js";
import { downloadCsvFile, downloadJsonFile } from "../../utils/exportFiles.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition";
const outlineButton =
  `${buttonBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`;
const accentButton =
  `${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60`;
const dangerButton =
  `${buttonBase} border border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50`;
const headerBtnAmber =
  `${buttonBase} border border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60`;
const ghostButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-transparent px-2.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";
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

const toText = (value) => String(value ?? "").trim();

const formatDateLabel = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const formatDiscountLabel = (coupon) =>
  coupon?.discountType === "percent"
    ? `${Number(coupon?.amount || 0)}%`
    : formatCurrency(Number(coupon?.amount || 0));

const resolvePublished = (coupon) =>
  typeof coupon?.published === "boolean"
    ? coupon.published
    : typeof coupon?.active === "boolean"
      ? coupon.active
      : true;

const resolveStatus = (coupon) => {
  const published = resolvePublished(coupon);
  const code = String(coupon?.status?.code || "").trim().toUpperCase();
  if (!published || code === "INACTIVE") return { label: "Draft / Inactive", tone: "stone" };
  if (code === "EXPIRED") return { label: "Expired", tone: "rose" };
  if (code === "SCHEDULED") return { label: "Scheduled", tone: "amber" };
  return { label: "Active", tone: "emerald" };
};

function StatusBadge({ status }) {
  const toneClass =
    status?.tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status?.tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
  const dotClass =
    status?.tone === "emerald"
      ? "bg-emerald-500"
      : status?.tone === "rose"
        ? "bg-rose-500"
        : "bg-slate-400";

  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${toneClass}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      {status?.label || "Draft / Inactive"}
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

export default function SellerCouponsPage() {
  const queryClient = useQueryClient();
  const actionMenuRef = useRef(null);
  const bulkMenuRef = useRef(null);
  const exportMenuRef = useRef(null);
  const viewMenuRef = useRef(null);
  const { sellerContext, workspaceStoreId: storeId } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canView = permissionKeys.includes("COUPON_VIEW");

  const [searchInput, setSearchInput] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [actionMenuCouponId, setActionMenuCouponId] = useState(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(() => ({ ...DEFAULT_COLUMN_VISIBILITY }));
  const [notice, setNotice] = useState(null);
  const [operationError, setOperationError] = useState("");
  const [drawerMode, setDrawerMode] = useState("create");
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState("single");
  const [deleteTargetCoupon, setDeleteTargetCoupon] = useState(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);
  const [deleteModalError, setDeleteModalError] = useState("");

  const couponsQuery = useQuery({
    queryKey: ["seller", "coupons", storeId],
    queryFn: () => listSellerCoupons(storeId),
    enabled: Boolean(storeId) && canView,
    retry: false,
  });

  const governance = couponsQuery.data?.governance || {};
  const canCreate = Boolean(governance.sellerCanCreate ?? permissionKeys.includes("COUPON_CREATE"));
  const canEdit = Boolean(governance.sellerCanEdit ?? permissionKeys.includes("COUPON_EDIT"));
  const canManageStatus = Boolean(
    governance.sellerCanManageStatus ?? permissionKeys.includes("COUPON_STATUS_MANAGE")
  );
  const items = Array.isArray(couponsQuery.data?.items) ? couponsQuery.data.items : [];
  const effectiveStore = couponsQuery.data?.store || sellerContext?.store || null;

  const createMutation = useMutation({
    mutationFn: (payload) => createSellerCoupon(storeId, payload),
    onSuccess: async () => {
      setNotice({ type: "success", message: "Coupon created." });
      setIsDrawerOpen(false);
      setEditingCoupon(null);
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
    },
    onError: (error) =>
      setNotice({
        type: "error",
        message: error?.response?.data?.message || error?.message || "Failed to create coupon.",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ couponId, payload }) => updateSellerCoupon(storeId, couponId, payload),
    onSuccess: async () => {
      setNotice({ type: "success", message: "Coupon updated." });
      setIsDrawerOpen(false);
      setEditingCoupon(null);
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
    },
    onError: (error) =>
      setNotice({
        type: "error",
        message: error?.response?.data?.message || error?.message || "Failed to update coupon.",
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ couponId, active }) => updateSellerCoupon(storeId, couponId, { active }),
    onSuccess: async (_data, variables) => {
      setNotice({
        type: "success",
        message: variables.active ? "Coupon published." : "Coupon hidden from checkout.",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
    },
    onError: (error) =>
      setOperationError(
        error?.response?.data?.message || error?.message || "Failed to update coupon status."
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (couponId) => deleteSellerCoupon(storeId, couponId),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, active }) => {
      await Promise.all(ids.map((couponId) => updateSellerCoupon(storeId, couponId, { active })));
      return { ids, active };
    },
    onSuccess: async ({ ids, active }) => {
      setNotice({
        type: "success",
        message: `${ids.length} coupon(s) ${active ? "published" : "deactivated"}.`,
      });
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
    },
    onError: (error) =>
      setOperationError(
        error?.response?.data?.message || error?.message || "Failed to update selected coupons."
      ),
  });

  const filteredItems = useMemo(() => {
    const normalizedSearch = toText(searchInput).toLowerCase();
    return items.filter((coupon) => {
      const published = resolvePublished(coupon);
      const status = resolveStatus(coupon);
      if (
        normalizedSearch &&
        !`${toText(coupon.campaignName)} ${toText(coupon.code)}`.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      if (publishedFilter === "published" && !published) return false;
      if (publishedFilter === "unpublished" && published) return false;
      if (statusFilter === "active" && status.label !== "Active") return false;
      if (statusFilter === "expired" && status.label !== "Expired") return false;
      if (statusFilter === "inactive" && status.label !== "Draft / Inactive") return false;
      if (statusFilter === "scheduled" && status.label !== "Scheduled") return false;
      return true;
    });
  }, [items, publishedFilter, searchInput, statusFilter]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(filteredItems.map((coupon) => Number(coupon.id)));
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(Number(id))) next.add(Number(id));
      });
      return next;
    });
  }, [filteredItems]);

  useEffect(() => {
    if (!notice?.message) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!operationError) return;
    const timer = setTimeout(() => setOperationError(""), 2600);
    return () => clearTimeout(timer);
  }, [operationError]);

  useEffect(() => {
    if (!actionMenuCouponId && !bulkMenuOpen && !exportMenuOpen && !viewMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuCouponId(null);
      }
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(event.target)) {
        setBulkMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target)) {
        setViewMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setActionMenuCouponId(null);
        setBulkMenuOpen(false);
        setExportMenuOpen(false);
        setViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [actionMenuCouponId, bulkMenuOpen, exportMenuOpen, viewMenuOpen]);

  const allSelected =
    filteredItems.length > 0 &&
    filteredItems.every((coupon) => selectedIds.has(Number(coupon.id)));
  const isDrawerSubmitting = createMutation.isPending || updateMutation.isPending;
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  const openCreateDrawer = () => {
    if (!canCreate) return;
    setDrawerMode("create");
    setEditingCoupon(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (coupon) => {
    if (!canEdit) return;
    setDrawerMode("edit");
    setEditingCoupon(coupon);
    setIsDrawerOpen(true);
    setActionMenuCouponId(null);
  };

  const closeDrawer = () => {
    if (isDrawerSubmitting) return;
    setIsDrawerOpen(false);
    setEditingCoupon(null);
  };

  const handleDrawerSubmit = (payload) => {
    if (drawerMode === "edit" && editingCoupon?.id) {
      updateMutation.mutate({ couponId: editingCoupon.id, payload });
      return;
    }
    createMutation.mutate(payload);
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

  const toggleSelectRow = (couponId) => {
    const id = Number(couponId);
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTogglePublished = (coupon) => {
    if (!canManageStatus) return;
    toggleMutation.mutate({
      couponId: coupon.id,
      active: !resolvePublished(coupon),
    });
  };

  const openDeleteModalForCoupon = (coupon) => {
    if (!canManageStatus) return;
    setDeleteMode("single");
    setDeleteTargetCoupon(coupon);
    setDeleteTargetIds([]);
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
    setActionMenuCouponId(null);
  };

  const openDeleteModalForSelected = () => {
    if (!canManageStatus || selectedIds.size === 0) return;
    setDeleteMode("bulk");
    setDeleteTargetCoupon(null);
    setDeleteTargetIds(Array.from(selectedIds));
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
    setBulkMenuOpen(false);
  };

  const closeDeleteModal = () => {
    if (deleteMutation.isPending || bulkStatusMutation.isPending) return;
    setIsDeleteModalOpen(false);
    setDeleteTargetCoupon(null);
    setDeleteTargetIds([]);
    setDeleteModalError("");
  };

  const confirmDelete = async () => {
    setDeleteModalError("");
    try {
      if (deleteMode === "single" && deleteTargetCoupon?.id) {
        await deleteMutation.mutateAsync(deleteTargetCoupon.id);
        setNotice({ type: "success", message: "Coupon deactivated." });
      } else if (deleteMode === "bulk" && deleteTargetIds.length > 0) {
        await bulkStatusMutation.mutateAsync({ ids: deleteTargetIds, active: false });
      }
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
      closeDeleteModal();
    } catch (error) {
      setDeleteModalError(
        error?.response?.data?.message || error?.message || "Failed to deactivate coupon."
      );
    }
  };

  const handleBulkAction = (action) => {
    if (!canManageStatus || selectedIds.size === 0) return;
    setBulkMenuOpen(false);
    if (action === "delete") {
      openDeleteModalForSelected();
      return;
    }
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), active: action === "activate" });
  };

  const serializeCouponForExport = (coupon) => ({
    id: coupon?.id ?? null,
    campaignName: toText(coupon?.campaignName) || toText(coupon?.code).toUpperCase(),
    code: toText(coupon?.code).toUpperCase(),
    store: effectiveStore?.name || effectiveStore?.slug || "Store",
    discountType: coupon?.discountType === "fixed" ? "Fixed" : "Percent",
    discountValue: formatDiscountLabel(coupon),
    minimumAmount: formatCurrency(Number(coupon?.minSpend || 0)),
    published: resolvePublished(coupon) ? "Published" : "Unpublished",
    status: resolveStatus(coupon).label,
    startDate: formatDateLabel(coupon?.startsAt),
    endDate: formatDateLabel(coupon?.expiresAt),
    bannerImageUrl: toText(coupon?.bannerImageUrl),
    amount: Number(coupon?.amount || 0),
    minSpend: Number(coupon?.minSpend || 0),
    discountTypeCode: coupon?.discountType === "fixed" ? "fixed" : "percent",
    startsAt: coupon?.startsAt || null,
    expiresAt: coupon?.expiresAt || null,
    active: resolvePublished(coupon),
    storeId: coupon?.storeId || effectiveStore?.id || null,
  });

  const handleExport = (format) => {
    if (!filteredItems.length) {
      setNotice({ type: "error", message: "No coupons available to export." });
      return;
    }
    const serializedItems = filteredItems.map(serializeCouponForExport);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      downloadCsvFile(EXPORT_COLUMNS, serializedItems, `seller-coupons-export-${stamp}.csv`);
    } else {
      downloadJsonFile(
        {
          format: "seller-coupons.export.v1",
          exportedAt: new Date().toISOString(),
          total: serializedItems.length,
          filters: {
            q: toText(searchInput) || null,
            published: publishedFilter,
            status: statusFilter,
            storeId: storeId || null,
          },
          store: effectiveStore,
          items: serializedItems,
        },
        `seller-coupons-export-${stamp}.json`
      );
    }
    setExportMenuOpen(false);
    setNotice({ type: "success", message: `Coupon export ${format.toUpperCase()} ready.` });
  };

  if (!canView) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Coupon access is unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your current seller access does not include store coupon visibility.
        </p>
      </div>
    );
  }

  if (couponsQuery.isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Loading coupons</h1>
        <p className="mt-2 text-sm text-slate-500">
          Fetching store-scoped coupons for the active seller workspace.
        </p>
      </div>
    );
  }

  if (couponsQuery.isError) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Failed to load coupons</h1>
        <p className="mt-2 text-sm text-slate-500">
          {getSellerRequestErrorMessage(couponsQuery.error, {
            permissionMessage: "Your current seller access does not include this coupon module.",
            fallbackMessage: "Failed to load seller coupons.",
          })}
        </p>
      </div>
    );
  }

  const deleteDescription =
    deleteMode === "bulk"
      ? `${deleteTargetIds.length} selected coupon(s) will be deactivated and hidden from checkout.`
      : `${toText(deleteTargetCoupon?.campaignName) || toText(deleteTargetCoupon?.code) || "This coupon"} will be deactivated and hidden from checkout.`;

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
                  className={outlineButton}
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
                className={outlineButton}
                onClick={() => setIsImportModalOpen(true)}
              >
                <Download className="h-4 w-4" />
                Import
              </button>
              <div ref={bulkMenuRef} className="relative">
                <button
                  type="button"
                  className={selectedIds.size > 0 ? headerBtnAmber : outlineButton}
                  disabled={!canManageStatus || selectedIds.size === 0 || bulkStatusMutation.isPending}
                  onClick={() => setBulkMenuOpen((prev) => !prev)}
                >
                  <Layers3 className="h-4 w-4" />
                  Bulk Action
                </button>
                {bulkMenuOpen ? (
                  <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                    <button type="button" onClick={() => handleBulkAction("activate")} className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                      Publish Selected
                    </button>
                    <button type="button" onClick={() => handleBulkAction("deactivate")} className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                      Unpublish Selected
                    </button>
                    <button type="button" onClick={() => handleBulkAction("delete")} className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-rose-700 hover:bg-rose-50">
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={dangerButton}
                disabled={!canManageStatus || selectedIds.size === 0}
                onClick={openDeleteModalForSelected}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button type="button" className={accentButton} onClick={openCreateDrawer} disabled={!canCreate}>
                <Plus className="h-4 w-4" />
                Add Coupon
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-[240px] flex-1 xl:max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by name or code..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[14px] text-slate-700 focus:border-emerald-500 focus:outline-none"
                />
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
                className={ghostButton}
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
          className={`rounded-2xl px-4 py-3 text-sm ${
            notice.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {operationError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {operationError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-700">{filteredItems.length}</span> /{" "}
          <span className="font-semibold text-slate-700">{items.length}</span>
          {selectedIds.size > 0 ? <span className="ml-2 text-slate-400">{selectedIds.size} selected</span> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
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
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={1 + visibleColumnCount} className="px-6 py-16 text-center">
                    <p className="text-base font-semibold text-slate-900">No coupons found</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {searchInput || publishedFilter !== "all" || statusFilter !== "all"
                        ? "Try another search keyword or adjust the filters."
                        : "Create your first store coupon to start discounting checkout."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((coupon) => {
                  const status = resolveStatus(coupon);
                  const published = resolvePublished(coupon);
                  const bannerSrc = resolveAssetUrl(coupon.bannerImageUrl || "");
                  const campaignName = toText(coupon.campaignName) || toText(coupon.code);
                  const isActionMenuOpen = actionMenuCouponId === Number(coupon.id);

                  return (
                    <tr key={coupon.id} className="h-14 border-b border-slate-100 text-slate-700 transition last:border-b-0 hover:bg-slate-50/80">
                      <td className={`${tableCell} w-[4%]`}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(Number(coupon.id))}
                          onChange={() => toggleSelectRow(coupon.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      {columnVisibility.campaign ? (
                      <td className={`${tableCell} w-[28%]`}>
                        <div className="flex items-center gap-3">
                          {bannerSrc ? (
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                              <img src={bannerSrc} alt={`${coupon.code} banner`} className="h-full w-full object-cover" />
                              <span className="absolute bottom-1 left-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[10px] font-semibold text-emerald-700 shadow-sm ring-1 ring-slate-200">
                                {campaignName.slice(0, 1).toUpperCase() || "C"}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                              {campaignName.slice(0, 1).toUpperCase() || "C"}
                            </div>
                          )}
                          <div className="min-w-0 max-w-[220px]">
                            <p className="truncate text-sm font-semibold text-slate-900">{campaignName}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                Store-scoped
                              </span>
                              <span className="truncate">{effectiveStore?.name || "Active store"}</span>
                            </div>
                            {bannerSrc ? (
                              <div className="mt-1 text-[10px] font-medium text-emerald-600">Banner linked</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      ) : null}
                      {columnVisibility.code ? (
                      <td className={`${tableCell} w-[12%]`}>
                        <span className="font-semibold uppercase text-slate-700">{coupon.code}</span>
                      </td>
                      ) : null}
                      {columnVisibility.discount ? (
                      <td className={`${tableCell} w-[16%] text-right`}>
                        <div className="space-y-1">
                          <p className="font-semibold tabular-nums text-slate-900">{formatDiscountLabel(coupon)}</p>
                          <div className="flex flex-col items-end gap-1">
                            <CouponDiscountTypeBadge coupon={coupon} />
                            <span className="text-[11px] text-slate-500">
                              {Number(coupon.minSpend || 0) > 0
                                ? `Minimum ${formatCurrency(Number(coupon.minSpend || 0))}`
                                : "No minimum"}
                            </span>
                          </div>
                        </div>
                      </td>
                      ) : null}
                      {columnVisibility.published ? (
                      <td className={`${tableCell} w-[12%]`}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(coupon)}
                          disabled={!canManageStatus || toggleMutation.isPending}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                            published ? "bg-fuchsia-500" : "bg-slate-300"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          aria-label={`Toggle publish for ${coupon.code}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              published ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      ) : null}
                      {columnVisibility.startDate ? (
                      <td className={`${tableCell} w-[12%] whitespace-nowrap`}>{formatDateLabel(coupon.startsAt)}</td>
                      ) : null}
                      {columnVisibility.endDate ? (
                      <td className={`${tableCell} w-[12%] whitespace-nowrap`}>{formatDateLabel(coupon.expiresAt)}</td>
                      ) : null}
                      {columnVisibility.status ? (
                      <td className={`${tableCell} w-[12%]`}>
                        <StatusBadge status={status} />
                      </td>
                      ) : null}
                      {columnVisibility.actions ? (
                      <td className={`${tableCell} w-[8%] text-right`}>
                        <div ref={isActionMenuOpen ? actionMenuRef : null} className="relative inline-flex">
                          <button
                            type="button"
                            onClick={() =>
                              setActionMenuCouponId((prev) =>
                                prev === Number(coupon.id) ? null : Number(coupon.id)
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                            aria-label={`Open actions for ${coupon.code}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {isActionMenuOpen ? (
                            <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                              <button type="button" onClick={() => openEditDrawer(coupon)} disabled={!canEdit} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                                <Pencil className="h-4 w-4 text-slate-400" />
                                Edit
                              </button>
                              <button type="button" onClick={() => openDeleteModalForCoupon(coupon)} disabled={!canManageStatus} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
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
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <SellerCouponDrawer
        open={isDrawerOpen}
        onClose={closeDrawer}
        onSubmit={handleDrawerSubmit}
        coupon={editingCoupon}
        isSubmitting={isDrawerSubmitting}
        error={
          createMutation.error?.response?.data?.message ||
          updateMutation.error?.response?.data?.message ||
          ""
        }
        canManageStatus={canManageStatus}
      />

      <DeleteCouponModal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={deleteMode === "bulk" ? "Deactivate selected coupons?" : "Deactivate this coupon?"}
        description={deleteDescription}
        confirmLabel="Deactivate Coupon"
        cancelLabel="Keep Coupon"
        isLoading={deleteMutation.isPending || bulkStatusMutation.isPending}
        errorMessage={deleteModalError}
      />
      <CouponImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import coupons"
        description="Coupon import is not available in Seller Workspace."
        unavailableMessage="Seller coupon import has not been enabled for this workspace yet. Use Add Coupon to create store-scoped campaigns."
      />
    </div>
  );
}
