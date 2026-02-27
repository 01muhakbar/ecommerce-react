import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminOrders, updateAdminOrderStatus } from "../../lib/adminApi.js";
import { ORDER_STATUS_OPTIONS, toUIStatus } from "../../constants/orderStatus.js";
import { prevData } from "../../lib/rq.ts";
import { moneyIDR } from "../../utils/money.js";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";
import { Download, Eye, Filter, Printer, RotateCcw } from "lucide-react";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
import {
  GENERIC_ERROR,
  NO_ORDERS_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";

const statusLabelMap = {
  pending: "Pending",
  processing: "Processing",
  shipping: "Shipping",
  complete: "Delivered",
  cancelled: "Cancel",
};

const headerBtnBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;

const toText = (value) => String(value ?? "").trim();

const getOrderDate = (order) => {
  const raw = order?.createdAt || order?.created_at || null;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatOrderTime = (order) => {
  const date = getOrderDate(order);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getInvoiceLabel = (order) => {
  const raw = toText(order?.invoiceNo || order?.invoice || order?.ref || order?.id);
  if (!raw) return "-";
  return raw.length <= 14 ? raw : raw.slice(0, 14);
};

const getCustomerName = (order) =>
  toText(order?.customerName || order?.customer?.name || order?.customer?.email) || "Guest";

const getCustomerHint = (order) => toText(order?.customer?.email || order?.ref) || "";

const getMethodLabel = (order) =>
  toText(order?.paymentMethod || order?.method || "COD").toUpperCase() || "COD";

const toDayStart = (yyyyMmDd) => {
  const parsed = new Date(`${yyyyMmDd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toDayEnd = (yyyyMmDd) => {
  const parsed = new Date(`${yyyyMmDd}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export default function Orders() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState("");
  const [methodInput, setMethodInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    q: "",
    status: "",
    method: "",
    startDate: "",
    endDate: "",
  });
  const [pendingUpdateId, setPendingUpdateId] = useState(null);
  const [rowError, setRowError] = useState("");
  const [notice, setNotice] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const queryClient = useQueryClient();

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
      status: appliedFilters.status || undefined,
    }),
    [page, limit, appliedFilters.q, appliedFilters.status]
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
  const methodOptions = useMemo(() => {
    const found = new Set(["COD"]);
    items.forEach((order) => {
      const method = getMethodLabel(order);
      if (method) found.add(method);
    });
    return Array.from(found);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((order) => {
      const keyword = appliedFilters.q.toLowerCase();
      if (keyword) {
        const haystack = [
          getCustomerName(order),
          getCustomerHint(order),
          getInvoiceLabel(order),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }

      const uiStatus = toUIStatus(order?.status || "pending");
      if (appliedFilters.status && uiStatus !== appliedFilters.status) return false;

      if (appliedFilters.method) {
        if (getMethodLabel(order) !== appliedFilters.method) return false;
      }

      const orderDate = getOrderDate(order);
      if (appliedFilters.startDate) {
        const start = toDayStart(appliedFilters.startDate);
        if (!orderDate || !start || orderDate < start) return false;
      }
      if (appliedFilters.endDate) {
        const end = toDayEnd(appliedFilters.endDate);
        if (!orderDate || !end || orderDate > end) return false;
      }

      return true;
    });
  }, [items, appliedFilters]);

  const meta = ordersQuery.data?.meta || { page: 1, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const hasItems = filteredItems.length > 0;
  const isInitialLoading = ordersQuery.isLoading && !ordersQuery.data;
  const isRefetching = ordersQuery.isFetching && !isInitialLoading;
  const isErrorState = ordersQuery.isError && !ordersQuery.data;
  const showInlineError = ordersQuery.isError && Boolean(ordersQuery.data);
  const isEmpty = !isInitialLoading && !ordersQuery.isError && !hasItems;
  const errorMessage =
    ordersQuery.error?.response?.data?.message ||
    ordersQuery.error?.message ||
    GENERIC_ERROR;

  const onApplyFilters = () => {
    setAppliedFilters({
      q: searchInput.trim(),
      status: statusInput,
      method: methodInput,
      startDate: startDateInput,
      endDate: endDateInput,
    });
    setPage(1);
  };

  const onResetFilters = () => {
    setSearchInput("");
    setStatusInput("");
    setMethodInput("");
    setStartDateInput("");
    setEndDateInput("");
    setAppliedFilters({ q: "", status: "", method: "", startDate: "", endDate: "" });
    setLimit(10);
    setPage(1);
  };

  const onUpdateStatus = (order, nextStatus) => {
    if (!nextStatus) return;
    if (!order?.id) return;
    setRowError("");
    setPendingUpdateId(order.id);
    updateMutation.mutate({ orderId: order.id, payload: { status: nextStatus } });
  };

  const onDownloadAll = () => {
    if (isDownloading) return;
    setRowError("");
    setIsDownloading(true);
    const params = new URLSearchParams();
    if (appliedFilters.q) params.set("q", appliedFilters.q);
    if (appliedFilters.status) params.set("status", appliedFilters.status);
    const query = params.toString();
    const endpoint = query
      ? `/api/admin/orders/export.csv?${query}`
      : "/api/admin/orders/export.csv";

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

  const onPrintInvoice = (orderId) => {
    if (!orderId) {
      setRowError("Order detail is unavailable for this record.");
      return;
    }
    const printWindow = window.open(`/admin/orders/${orderId}?print=1`, "_blank");
    if (!printWindow) {
      setRowError("Pop-up blocked. Allow pop-ups to print invoice.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500">Track and manage order flow.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
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
            placeholder="Search by Customer Name"
            className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />

          <select
            value={statusInput}
            onChange={(event) => setStatusInput(event.target.value)}
            className="h-10 min-w-[150px] rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Status</option>
            {ORDER_STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {statusLabelMap[value] || value}
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value) || 10);
              setPage(1);
            }}
            className="h-10 min-w-[130px] rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value={10}>10 Orders</option>
            <option value={20}>20 Orders</option>
            <option value={50}>50 Orders</option>
          </select>

          <select
            value={methodInput}
            onChange={(event) => setMethodInput(event.target.value)}
            className="h-10 min-w-[130px] rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Methods</option>
            {methodOptions.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={headerBtnOutline}
            onClick={onDownloadAll}
            disabled={isDownloading}
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Downloading..." : "Download All Orders"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={startDateInput}
            onChange={(event) => setStartDateInput(event.target.value)}
            className="h-10 min-w-[170px] rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="date"
            value={endDateInput}
            onChange={(event) => setEndDateInput(event.target.value)}
            className="h-10 min-w-[170px] rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />

          <button type="button" className={headerBtnGreen} onClick={onApplyFilters}>
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button type="button" className={headerBtnOutline} onClick={onResetFilters}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          {isRefetching ? <UiUpdatingBadge label={UPDATING} /> : null}
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
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

      {isEmpty ? (
        <UiEmptyState
          title={NO_ORDERS_FOUND}
          description="Try adjusting or clearing your search and status filter."
          actions={
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Clear filters
            </button>
          }
        />
      ) : null}

      {!isInitialLoading && !isErrorState && !isEmpty ? (
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
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Order Time</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((order) => {
                const uiStatus = toUIStatus(order.status || "pending");
                const isUpdating = pendingUpdateId === order.id;
                const orderId = order?.id;
                const customerHint = getCustomerHint(order);
                const rowKey = orderId || `${getInvoiceLabel(order)}-${formatOrderTime(order)}`;
                return (
                <tr key={rowKey} className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {getInvoiceLabel(order)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatOrderTime(order)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="font-medium text-slate-900">{getCustomerName(order)}</div>
                    {customerHint ? (
                      <div className="text-xs text-slate-400">{customerHint}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {getMethodLabel(order)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{moneyIDR(order.totalAmount || 0)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={uiStatus || "-"} />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={uiStatus}
                      onChange={(event) => onUpdateStatus(order, event.target.value)}
                      disabled={isUpdating}
                      className="h-9 min-w-[145px] rounded-xl border border-slate-200 px-2 text-xs focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                    >
                      {ORDER_STATUS_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {statusLabelMap[value] || value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onPrintInvoice(orderId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                        aria-label="Print invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {orderId ? (
                        <Link
                          to={`/admin/orders/${orderId}`}
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
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : null}

      {rowError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {rowError}
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm">
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
