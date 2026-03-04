import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Filter,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { fetchAdminCustomers } from "../lib/adminApi.js";
import { api } from "../api/axios.ts";
import DeleteCouponModal from "../components/admin/coupons/DeleteCouponModal.jsx";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../components/ui-states/index.js";
import {
  GENERIC_ERROR,
  NO_CUSTOMERS_FOUND,
  UPDATING,
} from "../constants/uiMessages.js";

const headerBtnBase =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const statCardClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm";
const tableHeadCell =
  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-4 py-3.5 align-middle text-sm text-slate-700";

const toText = (value) => String(value ?? "").trim();

const formatJoinDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const getCustomerName = (customer) =>
  toText(customer?.name || customer?.fullName || customer?.username) || "-";
const getCustomerEmail = (customer) =>
  toText(customer?.email || customer?.mail) || "-";
const getCustomerPhone = (customer) =>
  toText(customer?.phone || customer?.phone_number || customer?.phoneNumber) || "-";
const getJoiningDate = (customer) =>
  customer?.createdAt || customer?.created_at || customer?.joinDate || null;
const getCustomerId = (customer) =>
  customer?.id || customer?._id || customer?.uuid || null;
const getShortId = (customer) => {
  const raw = toText(getCustomerId(customer));
  if (!raw) return "-";
  return raw.length <= 6 ? raw : raw.slice(0, 6);
};

const getOrderCount = (customer) => {
  const candidates = [
    customer?.ordersCount,
    customer?.orderCount,
    customer?.totalOrders,
    customer?.orders_count,
    customer?.orders,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.length;
    if (Number.isFinite(Number(candidate))) return Number(candidate);
  }
  return null;
};

const getCustomerStatus = (customer) => {
  const statusRaw = toText(customer?.status || customer?.state || customer?.accountStatus).toLowerCase();
  if (statusRaw === "blocked" || statusRaw === "suspended") return "blocked";
  if (statusRaw === "inactive" || statusRaw === "disabled") return "inactive";
  if (statusRaw === "active") return "active";

  if (typeof customer?.isBlocked === "boolean") return customer.isBlocked ? "blocked" : "active";
  if (typeof customer?.blocked === "boolean") return customer.blocked ? "blocked" : "active";
  if (typeof customer?.isActive === "boolean") return customer.isActive ? "active" : "inactive";
  if (typeof customer?.active === "boolean") return customer.active ? "active" : "inactive";
  return "active";
};

function CustomerStatusBadge({ customer }) {
  const status = getCustomerStatus(customer);
  const styleMap = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    inactive: "border-amber-200 bg-amber-50 text-amber-700",
    blocked: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const dotMap = {
    active: "bg-emerald-500",
    inactive: "bg-amber-500",
    blocked: "bg-rose-500",
  };
  const labelMap = {
    active: "Active",
    inactive: "Inactive",
    blocked: "Blocked",
  };

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        styleMap[status] || styleMap.active
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotMap[status] || dotMap.active}`} />
      {labelMap[status] || labelMap.active}
    </span>
  );
}

export default function Customers() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [notice, setNotice] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState(null);
  const [deleteModalError, setDeleteModalError] = useState("");

  const params = useMemo(() => ({ page, limit }), [page, limit]);

  const customersQuery = useQuery({
    queryKey: ["admin-customers", params],
    queryFn: () => fetchAdminCustomers(params),
    keepPreviousData: true,
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/admin/customers/${id}`);
      return data;
    },
    onSuccess: () => {
      setNotice("Customer deleted.");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
  });

  const items = Array.isArray(customersQuery.data?.data) ? customersQuery.data.data : [];
  const filteredItems = useMemo(() => {
    const keyword = appliedSearch.toLowerCase();
    if (!keyword) return items;
    return items.filter((customer) => {
      const haystack = [
        getCustomerName(customer),
        getCustomerEmail(customer),
        getCustomerPhone(customer),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, appliedSearch]);

  const meta = customersQuery.data?.meta || { page, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const activeFilterCount = appliedSearch ? 1 : 0;

  const applyFilters = () => {
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
  };

  const handleOpenDeleteModal = (customer) => {
    if (!getCustomerId(customer)) return;
    setDeleteTargetCustomer(customer);
    setDeleteModalError("");
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (deleteCustomerMutation.isPending) return;
    setDeleteTargetCustomer(null);
    setDeleteModalError("");
    setIsDeleteModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    const deleteId = getCustomerId(deleteTargetCustomer);
    if (!deleteId) return;
    setDeleteModalError("");
    try {
      await deleteCustomerMutation.mutateAsync(deleteId);
      handleCloseDeleteModal();
    } catch (error) {
      setDeleteModalError(error?.response?.data?.message || GENERIC_ERROR);
    }
  };

  const tableErrorMessage =
    customersQuery.error?.response?.data?.message || GENERIC_ERROR;

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Admin / Customers
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Customers
            </h1>
            <p className="text-sm text-slate-500">Review customer accounts and profile information.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <div className={statCardClass}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total records</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{Number(meta.total || 0)}</p>
            </div>
            <div className={statCardClass}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Active filters</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{activeFilterCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
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

          <div className="flex flex-wrap items-center gap-2">
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
            <span>{filteredItems.length} shown</span>
            {customersQuery.isFetching ? <UiUpdatingBadge label={UPDATING} /> : null}
          </div>
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {customersQuery.isLoading && !customersQuery.data ? (
        <UiSkeleton variant="table" rows={8} />
      ) : null}

      {customersQuery.isError && !customersQuery.data ? (
        <UiErrorState
          title={GENERIC_ERROR}
          message={tableErrorMessage}
          onRetry={customersQuery.refetch}
        />
      ) : null}

      {!customersQuery.isLoading && !customersQuery.isError && filteredItems.length === 0 ? (
        <UiEmptyState
          title={NO_CUSTOMERS_FOUND}
          description="Try another keyword or reset your search."
        />
      ) : null}

      {!customersQuery.isLoading && !customersQuery.isError && filteredItems.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filteredItems.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{Number(meta.total || 0)}</span> records
          </div>
          <div className="-mx-4 w-auto overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={tableHeadCell}>ID</th>
                  <th className={tableHeadCell}>Joining Date</th>
                  <th className={tableHeadCell}>Customer</th>
                  <th className={tableHeadCell}>Phone</th>
                  <th className={`${tableHeadCell} text-right`}>Orders</th>
                  <th className={tableHeadCell}>Status</th>
                  <th className={`${tableHeadCell} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((customer) => {
                  const customerId = getCustomerId(customer);
                  const hasDetailRoute = Boolean(customerId);
                  return (
                    <tr
                      key={customerId || `${getCustomerName(customer)}-${getCustomerEmail(customer)}`}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={`${tableCell} font-medium tabular-nums text-slate-700`}>
                        {getShortId(customer)}
                      </td>
                      <td className={`${tableCell} whitespace-nowrap text-slate-600`}>
                        {formatJoinDate(getJoiningDate(customer))}
                      </td>
                      <td className={`${tableCell} max-w-[280px]`}>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{getCustomerName(customer)}</p>
                          <p className="truncate text-xs text-slate-500">{getCustomerEmail(customer)}</p>
                        </div>
                      </td>
                      <td className={`${tableCell} text-slate-600`}>{getCustomerPhone(customer)}</td>
                      <td className={`${tableCell} text-right font-medium tabular-nums text-slate-700`}>
                        {getOrderCount(customer) ?? "-"}
                      </td>
                      <td className={tableCell}>
                        <CustomerStatusBadge customer={customer} />
                      </td>
                      <td className={`${tableCell} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          {hasDetailRoute ? (
                            <Link
                              to={`/admin/customers/${customerId}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                              aria-label={`View ${getCustomerName(customer)}`}
                            >
                              <Search className="h-4 w-4" />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Customer detail is unavailable"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                              aria-label={`View ${getCustomerName(customer)}`}
                            >
                              <Search className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled
                            title="Edit not implemented yet"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                            aria-label={`Edit ${getCustomerName(customer)}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(customer)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                            aria-label={`Delete ${getCustomerName(customer)}`}
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
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Are You Sure! Want to Delete ?"
        description="Do you really want to delete these records? You can't view this in your list anymore if you delete!"
        cancelLabel="No, Keep It"
        confirmLabel="Yes, Delete It"
        isLoading={deleteCustomerMutation.isPending}
        errorMessage={deleteModalError}
      />
    </div>
  );
}
