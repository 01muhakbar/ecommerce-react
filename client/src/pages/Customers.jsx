import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  Filter,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../auth/useAuth.js";
import { can } from "../constants/permissions.js";
import {
  exportAdminCustomers,
  fetchAdminCustomers,
  importAdminCustomers,
  updateAdminCustomer,
} from "../lib/adminApi.js";
import { api } from "../api/axios.ts";
import DeleteCouponModal from "../components/admin/coupons/DeleteCouponModal.jsx";
import { UiErrorState, UiSkeleton } from "../components/primitives/state/index.js";
import { GENERIC_ERROR, NO_CUSTOMERS_FOUND, UPDATING } from "../constants/uiMessages.js";

const headerBtnBase =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[11px] font-medium transition";
const headerBtnSoft = `${headerBtnBase} bg-slate-50/80 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60`;
const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const tableHeadCell =
  "whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-3 py-2.5 align-middle text-sm text-slate-700";

const customerStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Disabled" },
  { value: "blocked", label: "Blocked" },
  { value: "pending_verification", label: "Pending verification" },
];

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
const getCustomerName = (customer) => toText(customer?.name) || "-";
const getCustomerEmail = (customer) => toText(customer?.email) || "-";
const getCustomerPhone = (customer) =>
  toText(customer?.phone || customer?.phoneNumber || customer?.phone_number) || "-";
const getCustomerId = (customer) => customer?.id || null;
const getShortId = (customer) => {
  const raw = toText(getCustomerId(customer));
  return raw ? (raw.length <= 6 ? raw : raw.slice(0, 6).toUpperCase()) : "-";
};
const getCustomerStatus = (customer) => {
  const raw = toText(customer?.status).toLowerCase();
  if (["active", "inactive", "blocked", "pending_verification"].includes(raw)) return raw;
  return "active";
};
const getOrderCount = (customer) => Number(customer?.ordersCount || 0);

function CustomerStatusBadge({ status }) {
  const styles = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    inactive: "border-slate-200 bg-slate-100 text-slate-600",
    blocked: "border-rose-200 bg-rose-50 text-rose-700",
    pending_verification: "border-sky-200 bg-sky-50 text-sky-700",
  };
  const dots = {
    active: "bg-emerald-500",
    inactive: "bg-slate-400",
    blocked: "bg-rose-500",
    pending_verification: "bg-sky-500",
  };
  const labels = {
    active: "Active",
    inactive: "Disabled",
    blocked: "Blocked",
    pending_verification: "Pending verification",
  };

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        styles[status] || styles.active
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.active}`} />
      {labels[status] || labels.active}
    </span>
  );
}

function StatusSwitch({ checked, disabled, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const emptyEditForm = { name: "", email: "", phone: "", status: "active" };

export default function Customers() {
  const qc = useQueryClient();
  const { user } = useAuth() || {};
  const canMutateCustomers = can(user, "CUSTOMERS_UPDATE");
  const fileInputRef = useRef(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [rowError, setRowError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalError, setDeleteModalError] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const params = useMemo(
    () => ({ page, limit: 10, q: appliedSearch || undefined }),
    [page, appliedSearch]
  );

  const customersQuery = useQuery({
    queryKey: ["admin-customers", params],
    queryFn: () => fetchAdminCustomers(params),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/admin/customers/${id}`);
      return data;
    },
    onSuccess: () => {
      setDeleteModalError("");
      setRowError("");
      setNotice("Customer deleted.");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload, meta }) =>
      updateAdminCustomer(id, payload).then((data) => ({ data, meta, id })),
    onSuccess: ({ meta, id }) => {
      setPendingStatusId(null);
      setEditError("");
      setEditFieldErrors({});
      setRowError("");
      setNotice(meta === "toggle" ? "Customer account status updated." : "Customer updated.");
      if (meta !== "toggle") {
        setIsEditOpen(false);
        setEditTarget(null);
      }
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-customer", String(id)] });
    },
    onError: (error, variables) => {
      const message = error?.response?.data?.message || GENERIC_ERROR;
      if (variables?.meta === "toggle") {
        setPendingStatusId(null);
        setRowError(message);
        return;
      }
      setEditFieldErrors(error?.response?.data?.errors?.fieldErrors || {});
      setEditError(message);
    },
    onSettled: (_, __, variables) => {
      if (variables?.meta === "toggle") setPendingStatusId(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: (file) => importAdminCustomers(file),
    onSuccess: (payload) => {
      const data = payload?.data || payload || {};
      setNotice(
        `Customer import finished. ${Number(data.updated || 0)} updated, ${Number(data.skipped || 0)} skipped, ${Number(data.failed || 0)} failed.`
      );
      setRowError(Array.isArray(data.errors) ? data.errors[0]?.message || "" : "");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (error) => {
      setRowError(error?.response?.data?.message || error?.message || GENERIC_ERROR);
    },
  });

  const items = Array.isArray(customersQuery.data?.data) ? customersQuery.data.data : [];
  const meta = customersQuery.data?.meta || { page, totalPages: 1, total: 0 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));

  const openEdit = (customer) => {
    if (!customer?.id || !canMutateCustomers) return;
    setEditTarget(customer);
    setEditError("");
    setEditFieldErrors({});
    setEditForm({
      name: getCustomerName(customer) === "-" ? "" : getCustomerName(customer),
      email: getCustomerEmail(customer) === "-" ? "" : getCustomerEmail(customer),
      phone: getCustomerPhone(customer) === "-" ? "" : getCustomerPhone(customer),
      status: getCustomerStatus(customer),
    });
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (updateMutation.isPending) return;
    setIsEditOpen(false);
    setEditTarget(null);
    setEditError("");
    setEditFieldErrors({});
    setEditForm(emptyEditForm);
  };

  const submitEdit = (event) => {
    event.preventDefault();
    if (!editTarget?.id) return;
    setEditError("");
    setEditFieldErrors({});
    updateMutation.mutate({
      id: editTarget.id,
      payload: {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        status: editForm.status,
      },
      meta: "edit",
    });
  };

  const toggleStatus = (customer) => {
    const id = getCustomerId(customer);
    const status = getCustomerStatus(customer);
    if (!id || !canMutateCustomers || pendingStatusId === id) return;
    if (!["active", "inactive"].includes(status)) return;
    setRowError("");
    setPendingStatusId(id);
    updateMutation.mutate({
      id,
      payload: { status: status === "active" ? "inactive" : "active" },
      meta: "toggle",
    });
  };

  const downloadExport = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setRowError("");
    try {
      const response = await exportAdminCustomers({ q: appliedSearch || undefined });
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename=\"?([^\"]+)\"?/i)?.[1] || "customers-export.json";
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setNotice(`Customers export downloaded as ${filename}.`);
    } catch (error) {
      setRowError(error?.message || GENERIC_ERROR);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) importMutation.mutate(file);
        }}
      />

      <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Customers</h1>
        <p className="mt-1 text-sm text-slate-500">Manage customer accounts and order access.</p>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setAppliedSearch(searchInput.trim());
                  setPage(1);
                }
              }}
              placeholder="Search by name/email/phone"
              className={`${fieldClass} pl-9`}
            />
          </div>
          <button type="button" className={headerBtnSoft} onClick={() => { setAppliedSearch(searchInput.trim()); setPage(1); }}>
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button type="button" className={headerBtnSoft} onClick={() => { setSearchInput(""); setAppliedSearch(""); setPage(1); }}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button type="button" className={headerBtnSoft} onClick={downloadExport} disabled={isDownloading}>
            <Download className="h-4 w-4" />
            {isDownloading ? "Downloading..." : "Export"}
          </button>
          <button
            type="button"
            className={headerBtnSoft}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canMutateCustomers || importMutation.isPending}
          >
            <Upload className="h-4 w-4" />
            {importMutation.isPending ? "Importing..." : "Import"}
          </button>
          {customersQuery.isFetching ? <span className="text-[10px] text-slate-400">{UPDATING}</span> : null}
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div> : null}
      {rowError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{rowError}</div> : null}
      {customersQuery.isLoading && !customersQuery.data ? <UiSkeleton variant="table" rows={8} /> : null}
      {customersQuery.isError && !customersQuery.data ? <UiErrorState title={GENERIC_ERROR} message={customersQuery.error?.response?.data?.message || GENERIC_ERROR} onRetry={customersQuery.refetch} /> : null}

      {!customersQuery.isLoading && !customersQuery.isError && items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">{NO_CUSTOMERS_FOUND}</p>
          <p className="mt-1 text-xs text-slate-500">Try another keyword or reset your search.</p>
        </div>
      ) : null}

      {!customersQuery.isLoading && !customersQuery.isError && items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-700">{items.length}</span> / <span className="font-semibold text-slate-700">{Number(meta.total || 0)}</span>
          </div>
          <div className="-mx-3 w-auto overflow-x-auto px-3 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[8%]`}>ID</th>
                  <th className={`${tableHeadCell} w-[14%]`}>Joining Date</th>
                  <th className={`${tableHeadCell} w-[18%]`}>Name</th>
                  <th className={`${tableHeadCell} w-[23%]`}>Email</th>
                  <th className={`${tableHeadCell} w-[14%]`}>Phone</th>
                  <th className={`${tableHeadCell} w-[11%]`}>Status</th>
                  <th className={`${tableHeadCell} w-[12%] text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((customer) => {
                  const id = getCustomerId(customer);
                  const status = getCustomerStatus(customer);
                  const canToggle = canMutateCustomers && ["active", "inactive"].includes(status);
                  return (
                    <tr key={id || `${getCustomerName(customer)}-${getCustomerEmail(customer)}`} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className={`${tableCell} font-semibold text-slate-900`}>{getShortId(customer)}</td>
                      <td className={`${tableCell} whitespace-nowrap text-slate-600`}>{formatJoinDate(customer?.createdAt)}</td>
                      <td className={tableCell}>
                        {id ? <Link to={`/admin/customers/${id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{getCustomerName(customer)}</Link> : getCustomerName(customer)}
                      </td>
                      <td className={`${tableCell} text-slate-600`}>{getCustomerEmail(customer)}</td>
                      <td className={`${tableCell} text-slate-600`}>{getCustomerPhone(customer)}</td>
                      <td className={tableCell}><CustomerStatusBadge status={status} /></td>
                      <td className={`${tableCell} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          {id ? (
                            <Link
                              to={`/admin/customer-orders/${id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                              title={`View order list (${getOrderCount(customer)} orders)`}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEdit(customer)}
                            disabled={!canMutateCustomers || !id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-70"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(customer); setDeleteModalError(""); }}
                            disabled={!canMutateCustomers || !id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:opacity-70"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <StatusSwitch
                            checked={status === "active"}
                            disabled={!canToggle || pendingStatusId === id}
                            onClick={() => toggleStatus(customer)}
                            title={
                              canToggle
                                ? `${status === "active" ? "Disable" : "Activate"} ${getCustomerName(customer)}`
                                : `Status toggle unavailable for ${status.replace(/_/g, " ")}`
                            }
                          />
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

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] shadow-sm">
        <button type="button" className="rounded-full border border-slate-200 px-3 py-1 text-slate-700 disabled:opacity-50" disabled={meta.page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</button>
        <span className="text-slate-500">Page {meta.page} of {Math.max(1, Number(meta.totalPages || 1))}</span>
        <button type="button" className="rounded-full border border-slate-200 px-3 py-1 text-slate-700 disabled:opacity-50" disabled={meta.page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</button>
      </div>

      {isEditOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={closeEdit} aria-label="Close update customer drawer" />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[680px] flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Admin / Customers / Edit</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Update Customer</h2>
                  <p className="mt-1 text-sm text-slate-500">Update customer necessary information from here.</p>
                </div>
                <button type="button" onClick={closeEdit} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700" disabled={updateMutation.isPending}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>
            <form onSubmit={submitEdit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {[
                  ["Name", "name"],
                  ["Email", "email"],
                  ["Phone", "phone"],
                ].map(([label, key]) => (
                  <div key={key} className="grid gap-4 sm:grid-cols-[180px,1fr] sm:items-center">
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    <div>
                      <input
                        type={key === "email" ? "email" : "text"}
                        value={editForm[key]}
                        onChange={(event) => {
                          setEditForm((prev) => ({ ...prev, [key]: event.target.value }));
                          setEditFieldErrors((prev) => ({ ...prev, [key]: "" }));
                        }}
                        className={fieldClass}
                        disabled={updateMutation.isPending}
                      />
                      {editFieldErrors[key] ? <p className="mt-1 text-xs text-rose-600">{editFieldErrors[key]}</p> : null}
                    </div>
                  </div>
                ))}

                <div className="grid gap-4 sm:grid-cols-[180px,1fr] sm:items-center">
                  <label className="text-sm font-medium text-slate-700">Account status</label>
                  <div>
                    <select
                      value={editForm.status}
                      onChange={(event) => {
                        setEditForm((prev) => ({ ...prev, status: event.target.value }));
                        setEditFieldErrors((prev) => ({ ...prev, status: "" }));
                      }}
                      className={fieldClass}
                      disabled={updateMutation.isPending}
                    >
                      {customerStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    {editFieldErrors.status ? <p className="mt-1 text-xs text-rose-600">{editFieldErrors.status}</p> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                  Use the <span className="font-semibold text-slate-700">View Order</span> action in the table to inspect this customer's orders.
                </div>

                {editError && !Object.keys(editFieldErrors).length ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</div> : null}
              </div>
              <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" onClick={closeEdit} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300" disabled={updateMutation.isPending}>Cancel</button>
                  <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Updating..." : "Update Customer"}</button>
                </div>
              </footer>
            </form>
          </aside>
        </div>
      ) : null}

      <DeleteCouponModal
        open={Boolean(deleteTarget)}
        onClose={() => { if (!deleteMutation.isPending) { setDeleteTarget(null); setDeleteModalError(""); } }}
        onConfirm={async () => {
          if (!deleteTarget?.id) return;
          setDeleteModalError("");
          setRowError("");
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          } catch (error) {
            const message = error?.response?.data?.message || GENERIC_ERROR;
            setDeleteModalError(message);
            setRowError(message);
          }
        }}
        title="Are You Sure! Want to Delete ?"
        description={`Do you really want to delete ${deleteTarget?.name || deleteTarget?.email || "this customer"}? You can't view this in your list anymore if you delete!`}
        cancelLabel="No, Keep It"
        confirmLabel="Yes, Delete It"
        isLoading={deleteMutation.isPending}
        errorMessage={deleteModalError}
      />
    </div>
  );
}
