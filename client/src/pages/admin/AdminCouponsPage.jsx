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
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300`;
const headerBtnAmber = `${headerBtnBase} bg-amber-500 text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnDanger = `${headerBtnBase} bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;

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
      className: "bg-rose-100 text-rose-700",
    };
  }

  return {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700",
  };
};

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
  const [deleteModalError, setDeleteModalError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteError, setDeleteError] = useState("");

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
      setNotice("Coupon created.");
      setIsAddDrawerOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCoupon(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setNotice("Coupon updated.");
      setIsEditDrawerOpen(false);
      setEditingCoupon(null);
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
  const isDeletePending = deleteMutation.isPending || bulkDeleteMutation.isPending;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!deleteError) return;
    const timer = setTimeout(() => setDeleteError(""), 2800);
    return () => clearTimeout(timer);
  }, [deleteError]);

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
    createMutation.reset();
    setIsAddDrawerOpen(false);
  };

  const openEdit = (coupon) => {
    updateMutation.reset();
    setEditingCoupon(coupon ?? null);
    setIsEditDrawerOpen(true);
  };

  const closeEditDrawer = () => {
    updateMutation.reset();
    setIsEditDrawerOpen(false);
    setEditingCoupon(null);
  };

  const handleUpdateSubmit = (payload) => {
    const id = Number(editingCoupon?.id);
    if (!id) return;
    updateMutation.mutate({ id, payload });
  };

  const handleCreateSubmit = (payload) => {
    createMutation.mutate(payload);
  };

  const applyFilters = () => {
    setAppliedSearch(toText(searchInput));
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const closeDeleteModal = () => {
    if (isDeletePending) return;
    setIsDeleteModalOpen(false);
    setDeleteMode(null);
    setDeleteTargetId(null);
    setDeleteTargetIds([]);
    setDeleteModalError("");
  };

  const openDeleteModalForSingle = (coupon) => {
    const id = Number(coupon?.id);
    if (!id) return;
    setDeleteMode("single");
    setDeleteTargetId(id);
    setDeleteTargetIds([]);
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
  };

  const openDeleteModalForBulk = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkMenuOpen(false);
    setDeleteMode("bulk");
    setDeleteTargetId(null);
    setDeleteTargetIds(ids);
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteModalError("");
    try {
      if (deleteMode === "single" && deleteTargetId) {
        await deleteMutation.mutateAsync(deleteTargetId);
        setNotice("Coupon deleted.");
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(Number(deleteTargetId));
          return next;
        });
      } else if (deleteMode === "bulk" && deleteTargetIds.length > 0) {
        const total = deleteTargetIds.length;
        await bulkDeleteMutation.mutateAsync(deleteTargetIds);
        setNotice(`${total} coupon(s) deleted.`);
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
    if (!selectedIds.size) return;
    setBulkMenuOpen(false);
    if (action === "delete") {
      handleDeleteSelected();
      return;
    }
    setNotice("Bulk action is UI-only for coupons.");
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
        onError: (error) => {
          setDeleteError(error?.response?.data?.message || GENERIC_ERROR);
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
  const deleteDescription =
    deleteMode === "bulk"
      ? "Do you really want to delete these records? You can't view this in your list anymore if you delete!"
      : "Do you really want to delete these records? You can't view this in your list anymore if you delete!";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Coupon</h1>
          <p className="text-sm text-slate-500">Create discounts for store checkout.</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Search by coupon code/name"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <button type="button" onClick={applyFilters} className={headerBtnGreen}>
            <Filter className="h-4 w-4" />
            Filter
          </button>

          <button type="button" onClick={resetFilters} className={headerBtnOutline}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          {couponsQuery.isFetching ? <UiUpdatingBadge label={UPDATING} /> : null}

          {selectedIds.size > 0 ? (
            <span className="ml-auto text-sm text-slate-500">{selectedIds.size} selected</span>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {deleteError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {deleteError}
        </div>
      ) : null}

      {couponsQuery.isLoading && !couponsQuery.data ? <UiSkeleton variant="table" rows={8} /> : null}

      {couponsQuery.isError && !couponsQuery.data ? (
        <UiErrorState title={GENERIC_ERROR} message={tableErrorMessage} onRetry={couponsQuery.refetch} />
      ) : null}

      {!couponsQuery.isLoading && !couponsQuery.isError && items.length === 0 ? (
        <UiEmptyState
          title={NO_COUPONS_FOUND}
          description="Create your first coupon to start applying checkout discounts."
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
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="min-w-[220px] px-4 py-3">Campaign Name</th>
                  <th className="min-w-[120px] px-4 py-3">Code</th>
                  <th className="min-w-[110px] px-4 py-3">Discount</th>
                  <th className="min-w-[110px] px-4 py-3">Published</th>
                  <th className="min-w-[130px] px-4 py-3">Start Date</th>
                  <th className="min-w-[130px] px-4 py-3">End Date</th>
                  <th className="min-w-[110px] px-4 py-3">Status</th>
                  <th className="min-w-[120px] px-4 py-3 text-right">Actions</th>
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
                    <tr key={coupon.id} className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => toggleSelectRow(id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                            {initial}
                          </span>
                          <div className="min-w-0 max-w-[220px]">
                            <p className="truncate text-sm font-semibold text-slate-900">{campaignName}</p>
                            <p className="truncate text-xs text-slate-500">{coupon.code || "-"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="max-w-[140px] truncate px-4 py-3 font-medium text-slate-900">
                        {coupon.code || "-"}
                      </td>

                      <td className="px-4 py-3">{formatDiscount(coupon)}</td>

                      <td className="px-4 py-3">
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
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">{formatDateLabel(startDate)}</td>

                      <td className="whitespace-nowrap px-4 py-3">{formatDateLabel(endDate)}</td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
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
