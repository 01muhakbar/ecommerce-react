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
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">Review customer accounts and activity.</p>
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
              placeholder="Search by name/email/phone"
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

          {customersQuery.isFetching ? <UiUpdatingBadge label={UPDATING} /> : null}
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
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="min-w-[90px] px-4 py-3">ID</th>
                  <th className="min-w-[130px] px-4 py-3">Joining Date</th>
                  <th className="min-w-[170px] px-4 py-3">Name</th>
                  <th className="min-w-[220px] px-4 py-3">Email</th>
                  <th className="min-w-[140px] px-4 py-3">Phone</th>
                  <th className="min-w-[130px] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((customer) => {
                  const customerId = getCustomerId(customer);
                  const hasDetailRoute = Boolean(customerId);
                  return (
                    <tr
                      key={customerId || `${getCustomerName(customer)}-${getCustomerEmail(customer)}`}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {getShortId(customer)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatJoinDate(getJoiningDate(customer))}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {getCustomerName(customer)}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 text-slate-600">
                        {getCustomerEmail(customer)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {getCustomerPhone(customer)}
                      </td>
                      <td className="px-4 py-3">
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
