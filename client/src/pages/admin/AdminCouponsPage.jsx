import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Download,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  updateAdminCoupon,
} from "../../lib/adminApi.js";
import { formatCurrency } from "../../utils/format.js";
import AddCouponDrawer from "../../components/admin/coupons/AddCouponDrawer.jsx";
import DeleteCouponModal from "../../components/admin/coupons/DeleteCouponModal.jsx";
import EditCouponDrawer from "../../components/admin/coupons/EditCouponDrawer.jsx";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
import {
  GENERIC_ERROR,
  NO_COUPONS_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";

const headerBtnBase =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const headerBtnAmber = `${headerBtnBase} bg-amber-500 text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnDanger = `${headerBtnBase} bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const statCardClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm";
const tableHeadCell =
  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-4 py-3.5 align-middle text-sm text-slate-700";

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
  const endDate = resolveEndDate(coupon);
  const parsedEnd = endDate ? new Date(endDate) : null;
  const isExpiredByDate = parsedEnd && !Number.isNaN(parsedEnd.getTime())
    ? parsedEnd.getTime() < Date.now()
    : false;
  const isExpired = isExpiredByDate || !published;

  if (isExpired) {
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
  const tone = status?.tone === "expired" ? "expired" : "active";
  const styles =
    tone === "expired"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const dotClass = tone === "expired" ? "bg-rose-500" : "bg-emerald-500";

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}
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
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        isPercent
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-sky-200 bg-sky-50 text-sky-700"
      }`}
    >
      {isPercent ? "Percent" : "Fixed amount"}
    </span>
  );
}

export default function AdminCouponsPage() {
  const qc = useQueryClient();
  const bulkMenuRef = useRef(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
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

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => updateAdminCoupon(id, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
  });

  const items = Array.isArray(couponsQuery.data?.data?.items)
    ? couponsQuery.data.data.items
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
  const activeFilterCount = appliedSearch ? 1 : 0;
  const isDeletePending = deleteMutation.isPending || bulkDeleteMutation.isPending;
  const isCreateBusy = Boolean(createMutation.isPending || createMutation.isLoading);
  const isUpdateBusy = Boolean(updateMutation.isPending || updateMutation.isLoading);

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
    if (!bulkMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!bulkMenuRef.current) return;
      if (!bulkMenuRef.current.contains(event.target)) {
        setBulkMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [bulkMenuOpen]);

  useEffect(() => {
    const visibleIds = new Set(items.map((coupon) => Number(coupon?.id)));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(Number(id))) next.add(Number(id));
      });
      return next;
    });
  }, [items]);

  const allSelected =
    items.length > 0 && items.every((coupon) => selectedIds.has(Number(coupon.id)));

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

  const applyFilters = () => {
    const nextSearch = toText(searchInput);
    setAppliedSearch(nextSearch);
    setPage(1);
    if (nextSearch) showNotice(`Showing results for "${nextSearch}".`);
  };

  const resetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
    showNotice("Coupon filters reset.");
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
        items.forEach((coupon) => next.delete(Number(coupon.id)));
      } else {
        items.forEach((coupon) => next.add(Number(coupon.id)));
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
    showNotice("Bulk action is UI-only for coupons.");
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
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Admin / Coupons
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Coupons
            </h1>
            <p className="text-sm text-slate-500">
              Create discounts and manage campaign validity for checkout.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <div className={statCardClass}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total records</p>
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
              Promotion Controls
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Review discount value, active window, and checkout visibility before editing campaigns
            </h2>
            <p className="text-sm text-slate-500">
              Search active promotions, verify validity dates, and open coupon drawers only after the campaign context is clear.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              Visible now: {items.length}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              Selected: {selectedIds.size}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              Active filters: {activeFilterCount}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:max-w-xl">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Search promotion
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
                placeholder="Search by coupon code or campaign"
                className={`${fieldClass} pl-9`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:block">
              Quick actions
            </div>
            <button
              type="button"
              className={headerBtnOutline}
              onClick={() => setNotice("Export is UI-only.")}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              className={headerBtnOutline}
              onClick={() => setNotice("Import is UI-only.")}
            >
              <Upload className="h-4 w-4" />
              Import
            </button>

            <div ref={bulkMenuRef} className="relative">
              <button
                type="button"
                className={headerBtnAmber}
                disabled={selectedIds.size === 0 || isDeletePending}
                onClick={() => setBulkMenuOpen((prev) => !prev)}
              >
                Bulk Action
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {bulkMenuOpen ? (
                <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-amber-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleBulkAction("delete")}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50"
                  >
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("placeholder")}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50"
                  >
                    Other Action (UI)
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={headerBtnDanger}
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

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={applyFilters} className={`${headerBtnGreen} w-full`}>
            <Filter className="h-4 w-4" />
            Apply
          </button>

          <button type="button" onClick={resetFilters} className={`${headerBtnOutline} w-full`}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 sm:justify-center sm:gap-3">
            {selectedIds.size > 0 ? (
              <span>{selectedIds.size} selected</span>
            ) : (
              <span>No selection</span>
            )}
            {couponsQuery.isFetching ? <UiUpdatingBadge label={UPDATING} /> : null}
          </div>
        </div>
      </div>

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

      {!couponsQuery.isLoading && !couponsQuery.isError && items.length === 0 ? (
        <UiEmptyState
          title={NO_COUPONS_FOUND}
          description={
            appliedSearch
              ? "No campaigns match the current search. Try another code or reset filters."
              : "Create your first coupon to start applying checkout discounts."
          }
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Add Coupon
            </button>
          }
        />
      ) : null}

      {!couponsQuery.isLoading && !couponsQuery.isError && items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{items.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{meta.total || 0}</span> records
            <span className="ml-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="-mx-4 w-auto overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-12`}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className={`${tableHeadCell} min-w-[220px]`}>Campaign Name</th>
                  <th className={`${tableHeadCell} min-w-[120px]`}>Code</th>
                  <th className={`${tableHeadCell} min-w-[110px] text-right`}>Discount</th>
                  <th className={`${tableHeadCell} min-w-[110px]`}>Published</th>
                  <th className={`${tableHeadCell} min-w-[130px]`}>Start Date</th>
                  <th className={`${tableHeadCell} min-w-[130px]`}>End Date</th>
                  <th className={`${tableHeadCell} min-w-[110px]`}>Status</th>
                  <th className={`${tableHeadCell} min-w-[120px] text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((coupon) => {
                  const id = Number(coupon?.id);
                  const campaignName = resolveCampaignName(coupon);
                  const initial = campaignName.charAt(0).toUpperCase() || "C";
                  const published = resolvePublished(coupon, publishedOverrides);
                  const status = resolveStatus(coupon, published);
                  const startDate = resolveStartDate(coupon);
                  const endDate = resolveEndDate(coupon);

                  return (
                    <tr
                      key={coupon.id}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={tableCell}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => toggleSelectRow(id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      <td className={tableCell}>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                            {initial}
                          </span>
                          <div className="min-w-0 max-w-[220px]">
                            <p className="truncate text-sm font-semibold text-slate-900">{campaignName}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <CouponDiscountTypeBadge coupon={coupon} />
                              <span className="truncate">
                                Code: <span className="font-medium text-slate-600">{coupon.code || "-"}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className={`${tableCell} max-w-[140px] truncate`}>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{coupon.code || "-"}</div>
                          <div className="text-[11px] font-medium text-slate-400">
                            {coupon?.minimumAmount
                              ? `Min order ${formatCurrency(Number(coupon.minimumAmount || 0))}`
                              : "No minimum order"}
                          </div>
                        </div>
                      </td>

                      <td className={`${tableCell} text-right`}>
                        <div className="space-y-1">
                          <div className="font-semibold tabular-nums text-slate-900">
                            {formatDiscount(coupon)}
                          </div>
                          <div className="text-[11px] font-medium text-slate-400">
                            {coupon.discountType === "percent"
                              ? "Applied as percentage"
                              : "Applied as currency discount"}
                          </div>
                        </div>
                      </td>

                      <td className={tableCell}>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePublished(coupon)}
                            disabled={togglingIds.has(id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                              published ? "bg-emerald-500" : "bg-slate-300"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                            aria-label={`Toggle publish for ${campaignName}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                                published ? "translate-x-5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                          <div className="text-[11px] font-medium text-slate-400">
                            {published ? "Visible at checkout" : "Hidden from checkout"}
                          </div>
                        </div>
                      </td>

                      <td className={`${tableCell} whitespace-nowrap`}>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{formatDateLabel(startDate)}</div>
                          <div className="text-[11px] font-medium text-slate-400">Starts</div>
                        </div>
                      </td>

                      <td className={`${tableCell} whitespace-nowrap`}>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{formatDateLabel(endDate)}</div>
                          <div className="text-[11px] font-medium text-slate-400">Ends</div>
                        </div>
                      </td>

                      <td className={tableCell}>
                        <div className="space-y-1">
                          <CouponStatusBadge status={status} />
                          <div className="text-[11px] font-medium text-slate-400">
                            {status.tone === "expired"
                              ? "Review end date or publish state"
                              : "Eligible for live checkout use"}
                          </div>
                        </div>
                      </td>

                      <td className={`${tableCell} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(coupon)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            aria-label={`Edit ${coupon.code || campaignName}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(coupon)}
                            disabled={isDeletePending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${coupon.code || campaignName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-slate-400">
                          Edit or remove campaign
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

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

      <DeleteCouponModal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={deleteTitle}
        description={deleteDescription}
        isLoading={isDeletePending}
        errorMessage={deleteModalError}
      />

      <AddCouponDrawer
        open={isAddDrawerOpen}
        onClose={closeCreateDrawer}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
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
        error={
          updateMutation.error?.response?.data?.message ||
          (updateMutation.isError ? GENERIC_ERROR : "")
        }
      />
    </div>
  );
}
