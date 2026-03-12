import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { createStaff, deleteStaff, fetchStaff, updateStaff } from "../../api/adminStaff.ts";
import { useAuth } from "../../auth/useAuth.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import AddStaffDrawer from "../../components/admin/staff/AddStaffDrawer.jsx";
import EditStaffDrawer from "../../components/admin/staff/EditStaffDrawer.jsx";
import DeleteCouponModal from "../../components/admin/coupons/DeleteCouponModal.jsx";
import {
  UiErrorState,
  UiSkeleton,
} from "../../components/ui-states/index.js";
import {
  GENERIC_ERROR,
  NO_STAFF_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";

const headerBtnBase =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[11px] font-medium transition";
const headerBtnSoft = `${headerBtnBase} bg-slate-50/80 text-slate-600 hover:bg-slate-100`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const fieldClass =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const tableHeadCell =
  "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-3 py-2 align-middle text-sm text-slate-700";

const toText = (value) => String(value ?? "").trim();
const normalizeRole = (value) => toText(value).toLowerCase();

const formatRoleLabel = (value) => {
  const raw = toText(value);
  if (!raw) return "-";
  return raw
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatJoiningDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const getStaffName = (staff) => toText(staff?.name) || `#${staff?.id ?? "-"}`;
const getStaffEmail = (staff) => toText(staff?.email) || "-";
const getStaffPhone = (staff) => toText(staff?.phoneNumber || staff?.phone) || "-";
const getStaffAvatarUrl = (staff) => resolveAssetUrl(toText(staff?.avatarUrl) || "");
const getAvatarInitial = (staff) => {
  const name = getStaffName(staff);
  return name.charAt(0).toUpperCase() || "S";
};
const isPrivilegedRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "super_admin" || normalized === "superadmin";
};

function RoleBadge({ role }) {
  const normalized = normalizeRole(role);
  const styleMap = {
    super_admin: "border-violet-200/80 bg-violet-50/80 text-violet-700",
    admin: "border-indigo-200/80 bg-indigo-50/80 text-indigo-700",
    staff: "border-sky-200/80 bg-sky-50/80 text-sky-700",
    seller: "border-amber-200/80 bg-amber-50/80 text-amber-700",
  };
  return (
    <span
      className={`inline-flex min-h-5 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        styleMap[normalized] || "border-slate-200 bg-slate-100/80 text-slate-700"
      }`}
    >
      {formatRoleLabel(role)}
    </span>
  );
}

function ActiveStatusBadge({ isActive }) {
  return (
    <span
      className={`inline-flex min-h-5 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        isActive
          ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
          : "border-rose-200/80 bg-rose-50/80 text-rose-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isActive ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminStaffPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ q: "", role: "" });

  const [notice, setNotice] = useState("");
  const [rowError, setRowError] = useState("");
  const [createDrawerError, setCreateDrawerError] = useState("");
  const [editDrawerError, setEditDrawerError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingPublishedId, setPendingPublishedId] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalError, setDeleteModalError] = useState("");
  const [publishedMap, setPublishedMap] = useState({});

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const params = useMemo(
    () => ({
      page,
      limit,
      q: appliedFilters.q || undefined,
    }),
    [page, limit, appliedFilters.q]
  );

  const staffQuery = useQuery({
    queryKey: ["admin-staff", params],
    queryFn: () => fetchStaff(params),
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      setIsCreateModalOpen(false);
      setCreateDrawerError("");
      setNotice("Staff created.");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (error) => {
      setCreateDrawerError(error?.response?.data?.message ?? error?.message ?? GENERIC_ERROR);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateStaff(id, payload),
    onSuccess: () => {
      setRowError("");
      setEditDrawerError("");
      setIsEditModalOpen(false);
      setEditTarget(null);
      setNotice("Staff updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (error) => {
      const message = error?.response?.data?.message ?? error?.message ?? GENERIC_ERROR;
      setEditDrawerError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteStaff(id),
    onSuccess: () => {
      setRowError("");
      setDeleteModalError("");
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      setPendingDeleteId(null);
      setNotice("Staff deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (error) => {
      const message = error?.response?.data?.message ?? error?.message ?? GENERIC_ERROR;
      setDeleteModalError(message);
      setRowError(message);
      setPendingDeleteId(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }) => updateStaff(id, { isPublished }),
    onSuccess: () => {
      setRowError("");
      setNotice("Published status updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (error, variables) => {
      const message = error?.response?.data?.message ?? error?.message ?? GENERIC_ERROR;
      setPublishedMap((prev) => ({ ...prev, [variables.id]: variables.previousValue }));
      setRowError(message);
    },
    onSettled: () => {
      setPendingPublishedId(null);
    },
  });

  const items = Array.isArray(staffQuery.data?.rows) ? staffQuery.data.rows : [];
  const meta = staffQuery.data || { page: 1, limit, count: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));

  useEffect(() => {
    if (!items.length) return;
    setPublishedMap((prev) => {
      const next = { ...prev };
      items.forEach((staff) => {
        const id = Number(staff?.id);
        if (!id) return;
        if (typeof next[id] !== "boolean") {
          next[id] = typeof staff?.isPublished === "boolean" ? staff.isPublished : true;
        }
      });
      return next;
    });
  }, [items]);

  const roleOptions = useMemo(() => {
    const map = new Map([
      ["staff", "staff"],
      ["admin", "admin"],
      ["super_admin", "super_admin"],
      ["seller", "seller"],
    ]);
    items.forEach((staff) => {
      const raw = toText(staff?.role);
      if (!raw) return;
      const key = normalizeRole(raw);
      if (!map.has(key)) map.set(key, raw);
    });
    return Array.from(map.values());
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((staff) => {
      const keyword = appliedFilters.q.toLowerCase();
      if (keyword) {
        const haystack = [getStaffName(staff), getStaffEmail(staff), getStaffPhone(staff)]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }

      if (appliedFilters.role) {
        if (normalizeRole(staff?.role) !== normalizeRole(appliedFilters.role)) return false;
      }

      return true;
    });
  }, [items, appliedFilters]);
  const activeFilterCount = (appliedFilters.q ? 1 : 0) + (appliedFilters.role ? 1 : 0);

  const isInitialLoading = staffQuery.isLoading && !staffQuery.data;
  const isRefetching = staffQuery.isFetching && !isInitialLoading;
  const isErrorState = staffQuery.isError && !staffQuery.data;
  const isEmpty = !isInitialLoading && !isErrorState && filteredItems.length === 0;
  const tableErrorMessage =
    staffQuery.error?.response?.data?.message || staffQuery.error?.message || GENERIC_ERROR;

  const isDeletePending = deleteMutation.isPending;

  const getPublished = (staff) => {
    const id = Number(staff?.id);
    if (id && typeof publishedMap[id] === "boolean") return publishedMap[id];
    return typeof staff?.isPublished === "boolean" ? staff.isPublished : true;
  };

  const applyFilters = () => {
    setAppliedFilters({ q: searchInput.trim(), role: roleInput });
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setRoleInput("");
    setAppliedFilters({ q: "", role: "" });
    setPage(1);
  };

  const openCreateModal = () => {
    setCreateDrawerError("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createMutation.isPending) return;
    setIsCreateModalOpen(false);
    setCreateDrawerError("");
  };

  const openViewModal = (staff) => {
    setViewTarget(staff || null);
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setViewTarget(null);
  };

  const openEditModal = (staff) => {
    setEditDrawerError("");
    setEditTarget(staff || null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (updateMutation.isPending) return;
    setIsEditModalOpen(false);
    setEditTarget(null);
    setEditDrawerError("");
  };

  const openDeleteModal = (staff) => {
    setDeleteTarget(staff || null);
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeletePending) return;
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeleteModalError("");
  };

  const onConfirmDelete = () => {
    if (!deleteTarget?.id) return;
    setPendingDeleteId(deleteTarget.id);
    deleteMutation.mutate(deleteTarget.id);
  };

  const onSubmitCreate = (payload) => {
    setCreateDrawerError("");
    createMutation.mutate(payload);
  };

  const onSubmitEdit = (payload) => {
    if (!editTarget?.id) return;
    setEditDrawerError("");
    updateMutation.mutate({
      id: editTarget.id,
      payload,
    });
  };

  const onTogglePublished = (staff) => {
    const id = Number(staff?.id);
    if (!id || pendingPublishedId === id) return;
    const previousValue = getPublished(staff);
    const nextValue = !previousValue;
    setRowError("");
    setPendingPublishedId(id);
    setPublishedMap((prev) => ({ ...prev, [id]: nextValue }));
    publishMutation.mutate({ id, isPublished: nextValue, previousValue });
  };

  const canDeleteStaff = (staff) => {
    const roleProtected = isPrivilegedRole(staff?.role);
    const isSelf =
      currentUser?.email &&
      toText(currentUser.email).toLowerCase() === toText(staff?.email).toLowerCase();
    return !roleProtected && !isSelf;
  };

  return (
    <div className="space-y-2">
      <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-2 shadow-sm sm:px-5">
        <div className="flex flex-col gap-1.5">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">All Staff</h1>
            <p className="text-sm text-slate-500">Manage staff accounts and access.</p>
          </div>
          <p className="text-[11px] text-slate-500">
            {Number(meta.count || 0)} total
            <span className="mx-1.5 text-slate-300">•</span>
            {activeFilterCount} filters
          </p>
        </div>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-full min-w-[220px] flex-1 xl:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Search by name/email/phone"
              className={`${fieldClass} pl-9`}
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            <select
              value={roleInput}
              onChange={(event) => setRoleInput(event.target.value)}
              className={`${fieldClass} min-w-[140px]`}
            >
              <option value="">All Roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
            <button type="button" onClick={applyFilters} className={headerBtnSoft}>
              <Filter className="h-4 w-4" />
              Apply
            </button>
            <button type="button" onClick={resetFilters} className={headerBtnSoft}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button type="button" className={headerBtnGreen} onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {rowError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {rowError}
        </div>
      ) : null}

      {isInitialLoading ? <UiSkeleton variant="table" rows={8} /> : null}

      {isErrorState ? (
        <UiErrorState title={GENERIC_ERROR} message={tableErrorMessage} onRetry={staffQuery.refetch} />
      ) : null}

      {isEmpty ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">{NO_STAFF_FOUND}</p>
          <p className="mt-1 text-xs text-slate-500">Try another keyword or reset your filters.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-2.5 inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 text-[11px] font-medium text-white hover:bg-emerald-700"
          >
            Add Staff
          </button>
        </div>
      ) : null}

      {!isInitialLoading && !isErrorState && !isEmpty ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-1 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-700">{filteredItems.length}</span> /{" "}
            <span className="font-semibold text-slate-700">{Number(meta.count || 0)}</span>
            {isRefetching || publishMutation.isPending ? (
              <span className="ml-2 text-slate-400">{UPDATING}</span>
            ) : null}
          </div>
          <div className="-mx-3 w-auto overflow-x-auto px-3 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[44%] min-w-[300px]`}>Staff</th>
                  <th className={`${tableHeadCell} w-[16%]`}>Role</th>
                  <th className={`${tableHeadCell} w-[16%]`}>Joined</th>
                  <th className={`${tableHeadCell} w-[16%] min-w-[170px]`}>Status</th>
                  <th className={`${tableHeadCell} w-[8%] text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((staff) => {
                  const canDelete = canDeleteStaff(staff);
                  const isDeleting = pendingDeleteId === staff?.id;
                  const isPublishing = pendingPublishedId === staff?.id;
                  const isActive = staff?.isActive !== false;
                  return (
                    <tr
                      key={staff?.id || `${getStaffEmail(staff)}-${getStaffName(staff)}`}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={`${tableCell} w-[44%]`}>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                            {getStaffAvatarUrl(staff) ? (
                              <img
                                src={getStaffAvatarUrl(staff)}
                                alt={getStaffName(staff)}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              getAvatarInitial(staff)
                            )}
                          </span>
                          <div className="min-w-0 max-w-[300px]">
                            <p className="truncate font-semibold text-slate-900">{getStaffName(staff)}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                              <span className="truncate">{getStaffEmail(staff)}</span>
                              {getStaffPhone(staff) !== "-" ? (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span>{getStaffPhone(staff)}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[16%]`}>
                        <RoleBadge role={staff?.role} />
                      </td>
                      <td className={`${tableCell} w-[16%] whitespace-nowrap text-slate-600`}>
                        {formatJoiningDate(staff?.createdAt)}
                      </td>
                      <td className={`${tableCell} w-[16%]`}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <ActiveStatusBadge isActive={isActive} />
                            <button
                              type="button"
                              onClick={() => onTogglePublished(staff)}
                              disabled={isPublishing}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                                getPublished(staff) ? "bg-emerald-500" : "bg-slate-300"
                              } ${isPublishing ? "cursor-not-allowed opacity-60" : ""}`}
                              aria-label={`Toggle publish for ${getStaffName(staff)}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                  getPublished(staff) ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isPublishing ? UPDATING : getPublished(staff) ? "Live" : "Hidden"}
                          </div>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[8%] text-right`}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => openViewModal(staff)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                            aria-label={`View ${getStaffName(staff)}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(staff)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                            aria-label={`Edit ${getStaffName(staff)}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(staff)}
                            disabled={!canDelete || isDeleting}
                            title={!canDelete ? "Cannot delete this account." : undefined}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Delete ${getStaffName(staff)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-0.5 text-[10px] shadow-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 disabled:opacity-50"
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
          className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 disabled:opacity-50"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>

      <AddStaffDrawer
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        onSubmit={onSubmitCreate}
        isSubmitting={createMutation.isPending}
        error={createDrawerError}
      />

      <EditStaffDrawer
        open={isEditModalOpen}
        onClose={closeEditModal}
        staff={editTarget}
        rolesOptions={roleOptions}
        onSubmit={onSubmitEdit}
        isSubmitting={updateMutation.isPending}
        error={editDrawerError}
      />

      {isViewModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Staff Detail</h2>
              <button type="button" className="text-sm text-slate-500" onClick={closeViewModal}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                  {getStaffAvatarUrl(viewTarget) ? (
                    <img
                      src={getStaffAvatarUrl(viewTarget)}
                      alt={getStaffName(viewTarget)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getAvatarInitial(viewTarget)
                  )}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{getStaffName(viewTarget)}</p>
                  <p className="text-xs text-slate-500">{getStaffEmail(viewTarget)}</p>
                </div>
              </div>
              <p><span className="font-semibold text-slate-700">Name:</span> {getStaffName(viewTarget)}</p>
              <p><span className="font-semibold text-slate-700">Email:</span> {getStaffEmail(viewTarget)}</p>
              <p><span className="font-semibold text-slate-700">Contact:</span> {getStaffPhone(viewTarget)}</p>
              <p><span className="font-semibold text-slate-700">Role:</span> {formatRoleLabel(viewTarget?.role)}</p>
              <p>
                <span className="font-semibold text-slate-700">Status:</span>{" "}
                {viewTarget?.isActive !== false ? "Active" : "Inactive"}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Joining Date:</span>{" "}
                {formatJoiningDate(viewTarget?.createdAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteCouponModal
        open={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={onConfirmDelete}
        title="Are You Sure! Want to Delete ?"
        description={`Do you really want to delete ${
          deleteTarget?.name || deleteTarget?.email || "this staff"
        }? You can't view this in your list anymore if you delete!`}
        cancelLabel="No, Keep It"
        confirmLabel="Yes, Delete It"
        isLoading={isDeletePending}
        errorMessage={deleteModalError}
      />
    </div>
  );
}
