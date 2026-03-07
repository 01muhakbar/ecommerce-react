import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminOrders, updateAdminOrderStatus } from "../../lib/adminApi.js";
import { toUIStatus } from "../../constants/orderStatus.js";
import { prevData } from "../../lib/rq.ts";
import useAdminLocale from "../../hooks/useAdminLocale.js";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";
import { Download, Eye, Filter, Printer, RotateCcw, Search } from "lucide-react";
import {
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
import { GENERIC_ERROR, UPDATING } from "../../constants/uiMessages.js";

const headerBtnBase =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const statCardClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm";

const toText = (value) => String(value ?? "").trim();
const countAppliedFilters = (filters) =>
  Object.values(filters || {}).filter((value) => toText(value).length > 0).length;

const getOrderDateValue = (order) => order?.createdAt || order?.created_at || null;

const getInvoiceLabel = (order) => {
  const raw = toText(order?.invoiceNo || order?.invoice || order?.ref || order?.id);
  if (!raw) return "-";
  return raw.length <= 14 ? raw : raw.slice(0, 14);
};

const getInvoiceParam = (order) =>
  toText(order?.invoiceNo || order?.invoice || order?.ref || order?.id);

const getCustomerName = (order) =>
  toText(order?.customerName || order?.customer?.name || order?.customer?.email) || "Guest";

const getCustomerHint = (order) => toText(order?.customer?.email || order?.ref) || "";

const getStatusNote = (status) => {
  const value = toUIStatus(status || "pending");
  if (value === "pending") return "Needs review";
  if (value === "processing") return "Being prepared";
  if (value === "shipping") return "In delivery";
  if (value === "delivered" || value === "complete") return "Completed";
  if (value === "cancel" || value === "cancelled") return "Stopped";
  return "Awaiting action";
};

const methodLabelMap = {
  cash: "Cash",
  card: "Card",
  credit: "Credit",
};

const normalizeMethod = (raw) => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "cash";
  if (value.includes("cod") || value.includes("cash")) return "cash";
  if (value.includes("credit card") || value.includes("card") || value.includes("debit")) {
    return "card";
  }
  if (value.includes("credit") || value.includes("paylater") || value.includes("installment")) {
    return "credit";
  }
  return "cash";
};

const getMethodLabel = (order) => {
  const method = normalizeMethod(order?.method || order?.paymentMethod || "");
  return methodLabelMap[method] || "Cash";
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipping", label: "Shipping" },
  { value: "delivered", label: "Delivered" },
  { value: "cancel", label: "Cancel" },
];

const STATUS_ACTION_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipping", label: "Shipping" },
  { value: "delivered", label: "Delivered" },
  { value: "cancel", label: "Cancel" },
];

const toActionStatusValue = (raw) => {
  const uiStatus = toUIStatus(raw || "pending");
  if (uiStatus === "complete") return "delivered";
  if (uiStatus === "cancelled") return "cancel";
  return uiStatus;
};

export default function Orders() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState("");
  const [methodInput, setMethodInput] = useState("");
  const [limitDaysInput, setLimitDaysInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    status: "",
    method: "",
    limitDays: "",
    startDate: "",
    endDate: "",
  });
  const [pendingUpdateId, setPendingUpdateId] = useState(null);
  const [lastStatusAttempt, setLastStatusAttempt] = useState(null);
  const [rowError, setRowError] = useState("");
  const [notice, setNotice] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const queryClient = useQueryClient();
  const { formatDateTime, formatMoney } = useAdminLocale();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: appliedFilters.search || undefined,
      status: appliedFilters.status || undefined,
      method: appliedFilters.method || undefined,
      limitDays: appliedFilters.limitDays || undefined,
      startDate: appliedFilters.startDate || undefined,
      endDate: appliedFilters.endDate || undefined,
    }),
    [page, pageSize, appliedFilters]
  );

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", params],
    queryFn: () => fetchAdminOrders(params),
    placeholderData: prevData,
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, payload }) => updateAdminOrderStatus(orderId, payload),
    onSuccess: () => {
      setRowError("");
      setNotice("Order status updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"], exact: false });
    },
    onSettled: () => {
      setPendingUpdateId(null);
    },
    onError: (error) => {
      setRowError(
        error?.response?.data?.message ?? error?.message ?? "Failed to update status."
      );
    },
  });

  const items = Array.isArray(ordersQuery.data?.data) ? ordersQuery.data.data : [];

  const meta = ordersQuery.data?.meta || { page: 1, limit: pageSize, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const hasItems = items.length > 0;
  const isInitialLoading = ordersQuery.isLoading && !ordersQuery.data;
  const isRefetching = ordersQuery.isFetching && !isInitialLoading;
  const isErrorState = ordersQuery.isError && !ordersQuery.data;
  const showInlineError = ordersQuery.isError && Boolean(ordersQuery.data);
  const activeFilterCount = countAppliedFilters(appliedFilters);
  const errorMessage =
    ordersQuery.error?.response?.data?.message ||
    ordersQuery.error?.message ||
    GENERIC_ERROR;

  const onApplyFilters = () => {
    setAppliedFilters({
      search: searchInput.trim(),
      status: statusInput,
      method: methodInput,
      limitDays: limitDaysInput,
      startDate: startDateInput,
      endDate: endDateInput,
    });
    setPage(1);
  };

  const onResetFilters = () => {
    setSearchInput("");
    setStatusInput("");
    setMethodInput("");
    setLimitDaysInput("");
    setStartDateInput("");
    setEndDateInput("");
    setAppliedFilters({
      search: "",
      status: "",
      method: "",
      limitDays: "",
      startDate: "",
      endDate: "",
    });
    setPage(1);
  };

  const onUpdateStatus = (order, nextStatus) => {
    if (!nextStatus) return;
    if (!order?.id) return;
    setRowError("");
    setNotice("");
    setPendingUpdateId(order.id);
    const requestPayload = { orderId: order.id, payload: { status: nextStatus } };
    setLastStatusAttempt(requestPayload);
    updateMutation.mutate(requestPayload);
  };

  const retryLastStatusUpdate = () => {
    if (!lastStatusAttempt || updateMutation.isPending) return;
    setRowError("");
    setNotice("");
    setPendingUpdateId(lastStatusAttempt.orderId);
    updateMutation.mutate(lastStatusAttempt);
  };

  const onDownloadAll = () => {
    if (isDownloading) return;
    setRowError("");
    setIsDownloading(true);
    const params = new URLSearchParams();
    if (appliedFilters.search) params.set("search", appliedFilters.search);
    if (appliedFilters.status) params.set("status", appliedFilters.status);
    if (appliedFilters.method) params.set("method", appliedFilters.method);
    if (appliedFilters.limitDays) params.set("limitDays", appliedFilters.limitDays);
    if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
    const query = params.toString();
    const endpoint = query
      ? `/api/admin/orders/export?${query}`
      : "/api/admin/orders/export";

    fetch(endpoint, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          const fallback = `Failed to download orders (${response.status}).`;
          try {
            const data = await response.json();
            throw new Error(data?.message || fallback);
          } catch {
            throw new Error(fallback);
          }
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const disposition = response.headers.get("content-disposition") || "";
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
        const filename = filenameMatch?.[1] || "orders-export.csv";

        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(objectUrl);

        setNotice("Orders CSV downloaded.");
      })
      .catch((error) => {
        setRowError(error?.message || GENERIC_ERROR);
      })
      .finally(() => {
        setIsDownloading(false);
      });
  };

  const onPrintInvoice = (invoiceParam) => {
    if (!invoiceParam) {
      setRowError("Order detail is unavailable for this record.");
      return;
    }
    const printWindow = window.open(
      `/admin/orders/${encodeURIComponent(invoiceParam)}?print=1`,
      "_blank"
    );
    if (!printWindow) {
      setRowError("Pop-up blocked. Allow pop-ups to print invoice.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Admin / Orders
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Orders
            </h1>
            <p className="text-sm text-slate-500">
              Manage customer orders, status updates, and invoice actions.
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onApplyFilters();
                }
              }}
              placeholder="Search by customer, email, or invoice"
              className={`${fieldClass} pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={headerBtnGreen}
              onClick={onApplyFilters}
            >
              <Filter className="h-4 w-4" />
              Apply
            </button>
            <button
              type="button"
              className={headerBtnOutline}
              onClick={onResetFilters}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              className={headerBtnOutline}
              onClick={onDownloadAll}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4" />
              {isDownloading ? "Downloading..." : "Export"}
            </button>
            {isRefetching ? <UiUpdatingBadge label={UPDATING} /> : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <select
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value)}
              className={fieldClass}
            >
              <option value="">All Status</option>
              {STATUS_FILTER_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={limitDaysInput}
              onChange={(event) => setLimitDaysInput(event.target.value)}
              className={fieldClass}
            >
              <option value="">Order Limit</option>
              <option value="5">Last 5 days</option>
              <option value="7">Last 7 days</option>
              <option value="15">Last 15 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>

          <div>
            <select
              value={methodInput}
              onChange={(event) => setMethodInput(event.target.value)}
              className={fieldClass}
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={startDateInput}
              onChange={(event) => setStartDateInput(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <input
              type="date"
              value={endDateInput}
              onChange={(event) => setEndDateInput(event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      {notice ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 shadow-sm">
          {notice}
        </div>
      ) : null}

      {isInitialLoading ? <UiSkeleton variant="table" rows={8} /> : null}

      {isErrorState ? (
        <UiErrorState
          title={GENERIC_ERROR}
          message={errorMessage}
          onRetry={() => ordersQuery.refetch()}
        />
      ) : null}

      {!isInitialLoading && !isErrorState ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {showInlineError ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Could not refresh orders. Showing previous data.
              <button
                type="button"
                onClick={() => ordersQuery.refetch()}
                className="ml-2 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : null}
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{items.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{meta.total || 0}</span> orders
          </div>
          <div className="-mx-4 w-auto overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3.5">Invoice No</th>
                <th className="whitespace-nowrap px-4 py-3.5">Order Time</th>
                <th className="whitespace-nowrap px-4 py-3.5">Customer Name</th>
                <th className="whitespace-nowrap px-4 py-3.5">Method</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-right">Amount</th>
                <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                <th className="w-[170px] whitespace-nowrap px-4 py-3.5">Action</th>
                <th className="w-[120px] whitespace-nowrap px-4 py-3.5 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {hasItems ? items.map((order, rowIndex) => {
                const uiStatus = toUIStatus(order.status || "pending");
                const actionStatus = toActionStatusValue(order.status || "pending");
                const isUpdating = pendingUpdateId === order.id;
                const orderId = order?.id;
                const invoiceParam = getInvoiceParam(order);
                const customerHint = getCustomerHint(order);
                const orderDateValue = getOrderDateValue(order);
                const rowKey =
                  orderId ||
                  `${getInvoiceLabel(order)}-${formatDateTime(orderDateValue)}`;
                return (
                <tr
                  key={rowKey}
                  className={`border-t border-slate-100 text-slate-700 transition hover:bg-slate-50 ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/35"
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{getInvoiceLabel(order)}</div>
                      <div className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Ref Ready
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                    {formatDateTime(orderDateValue)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    <div className="font-medium text-slate-900">{getCustomerName(order)}</div>
                    {customerHint ? (
                      <div className="text-xs text-slate-400">{customerHint}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{getMethodLabel(order)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">
                    {formatMoney(order.totalAmount || order.amount || 0)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-1.5">
                      <OrderStatusBadge status={uiStatus || "-"} />
                      <div className="text-[11px] font-medium text-slate-400">
                        {getStatusNote(order.status)}
                      </div>
                    </div>
                  </td>
                  <td className="w-[170px] px-4 py-3.5">
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Quick Update
                      </div>
                      <div className="flex items-center gap-2">
                      <select
                        value={actionStatus}
                        onChange={(event) => onUpdateStatus(order, event.target.value)}
                        disabled={isUpdating}
                        className="h-9 w-[140px] rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                      >
                        {STATUS_ACTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {isUpdating ? (
                        <UiUpdatingBadge label="Saving..." />
                      ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="w-[120px] px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onPrintInvoice(invoiceParam)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                        aria-label="Print invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {invoiceParam ? (
                        <Link
                          to={`/admin/orders/${encodeURIComponent(invoiceParam)}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                          aria-label="View order detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                          aria-label="View order detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              }) : (
                <tr className="border-t border-slate-100">
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <p className="text-base font-semibold text-slate-800">No orders found</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try adjusting search or filter values.
                    </p>
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                    >
                      Clear Filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      ) : null}

      {rowError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          <p>{rowError}</p>
          {lastStatusAttempt ? (
            <button
              type="button"
              onClick={retryLastStatusUpdate}
              disabled={updateMutation.isPending}
              className="mt-2 inline-flex h-9 items-center justify-center rounded-full border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateMutation.isPending ? "Retrying..." : "Retry status update"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-50"
          disabled={page <= 1}
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
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
