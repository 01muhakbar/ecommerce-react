import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkDeleteAdminOrders,
  fetchAdminOrders,
  updateAdminOrderStatus,
} from "../../lib/adminApi.js";
import { prevData } from "../../lib/rq.ts";
import useAdminLocale from "../../hooks/useAdminLocale.js";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";
import {
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import {
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/primitives/state/index.js";
import { GENERIC_ERROR } from "../../constants/uiMessages.js";
import {
  getAdminOrderTransitionErrorMeta,
  toAdminOrderActionValue,
} from "./orderLifecyclePresentation.js";
import { normalizeAdminOrder } from "../../services/adapters/orderAdapter.js";

const headerBtnBase =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const headerBtnSoft = `${headerBtnBase} border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white`;
const headerBtnDisabled = `${headerBtnBase} cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 opacity-80`;
const fieldClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none";
const tableHeadCell =
  "whitespace-nowrap px-2.5 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400";
const tableCell = "px-2.5 py-2 align-middle text-[13px] text-slate-700";
const selectionCheckboxClass =
  "h-4 w-4 rounded border border-emerald-300 text-emerald-600 focus:ring-emerald-500";
const subtleLabelClass = "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const BULK_OPERATIONS_AVAILABLE = false;
const compactBadgeClass = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold";

const toText = (value) => String(value ?? "").trim();

const getOrderDateValue = (order) => order?.createdAt || order?.created_at || null;

const getInvoiceParam = (order, view) =>
  toText(view?.invoiceNo || order?.invoiceNo || order?.invoice || order?.ref || order?.id);

const DELIVERY_TONE_CLASS = {
  stone: "border-slate-200 bg-slate-50 text-slate-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  teal: "border-teal-200 bg-teal-50 text-teal-700",
};

const getDeliveryBadgeClass = (tone) =>
  DELIVERY_TONE_CLASS[String(tone || "").trim()] || DELIVERY_TONE_CLASS.stone;

const getDeliveryPresentation = (order) => {
  const meta = order?.shippingStatusMeta || null;
  const latestNote = toText(order?.latestTrackingEvent?.note);
  const latestEventLabel = toText(order?.latestTrackingEvent?.statusMeta?.label);
  const legacyFallbackCount = Number(order?.shipmentAuditMeta?.legacyFallbackSuborderCount || 0);

  if (meta?.label) {
    return {
      label: meta.label,
      tone: meta.tone || "stone",
      hint:
        latestNote ||
        latestEventLabel ||
        meta.description ||
        (order?.hasTrackingNumber ? "Tracking is available for at least one shipment." : "No tracking number captured yet."),
    };
  }

  if (legacyFallbackCount > 0 || order?.usedLegacyFallback) {
    return {
      label: "Legacy fallback",
      tone: "amber",
      hint: "Shipment truth still relies on compatibility fallback for one or more store splits.",
    };
  }

  return {
    label: "No shipment",
    tone: "stone",
    hint: "Shipment truth has not started for this order yet.",
  };
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipping", label: "On delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancel", label: "Cancelled" },
];

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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [tableDensity, setTableDensity] = useState("comfortable");
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
      const errorMeta = getAdminOrderTransitionErrorMeta(error);
      setRowError(
        [errorMeta.title, errorMeta.message, errorMeta.detail].filter(Boolean).join(". ")
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => bulkDeleteAdminOrders(ids),
    onSuccess: (result) => {
      setRowError("");
      setNotice(result?.message || "Selected orders deleted.");
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-orders"], exact: false });
    },
    onError: (error) => {
      setRowError(
        error?.response?.data?.message || error?.message || "Failed to delete selected orders."
      );
    },
  });

  const items = Array.isArray(ordersQuery.data?.data) ? ordersQuery.data.data : [];
  const rows = useMemo(
    () =>
      items.map((order) => ({
        order,
        view: normalizeAdminOrder(order),
      })),
    [items]
  );

  const meta = ordersQuery.data?.meta || { page: 1, limit: pageSize, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const hasItems = rows.length > 0;
  const isInitialLoading = ordersQuery.isLoading && !ordersQuery.data;
  const isRefetching = ordersQuery.isFetching && !isInitialLoading;
  const isErrorState = ordersQuery.isError && !ordersQuery.data;
  const showInlineError = ordersQuery.isError && Boolean(ordersQuery.data);
  const errorMessage =
    ordersQuery.error?.response?.data?.message ||
    ordersQuery.error?.message ||
    GENERIC_ERROR;
  const selectedCount = selectedIds.size;

  useEffect(() => {
    const visibleIds = new Set(rows.map(({ view }) => Number(view?.id)).filter(Boolean));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [rows]);

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

  const toggleRowSelection = (orderId) => {
    const normalizedId = Number(orderId || 0);
    if (!normalizedId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedId)) next.delete(normalizedId);
      else next.add(normalizedId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = rows.map(({ view }) => Number(view?.id)).filter(Boolean);
    if (visibleIds.length === 0) return;
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
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

  const onDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || deleteMutation.isPending) return;

    const confirmed = window.confirm(
      ids.length === 1
        ? "Delete the selected order? This action cannot be undone."
        : `Delete ${ids.length} selected orders? This action cannot be undone.`
    );
    if (!confirmed) return;

    setRowError("");
    setNotice("");
    deleteMutation.mutate(ids);
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

  const visibleIds = rows.map(({ view }) => Number(view?.id)).filter(Boolean);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const tableRowClass =
    tableDensity === "compact"
      ? "border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
      : "border-t border-slate-100 text-slate-700 transition hover:bg-slate-50";

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1 pr-4 xl:max-w-[420px]">
            <div className="space-y-1">
              <h1 className="text-[1.85rem] font-semibold tracking-tight text-slate-900">Orders</h1>
              <p className="text-sm text-slate-500">Manage customer orders.</p>
            </div>
            {isRefetching ? <UiUpdatingBadge /> : null}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 xl:max-w-[860px] xl:flex-none xl:justify-end">
            <div className="flex min-w-[190px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value)}
                disabled={!BULK_OPERATIONS_AVAILABLE}
                className="h-9 w-full bg-transparent text-sm text-slate-500 focus:outline-none disabled:cursor-not-allowed"
                title="Bulk actions stay disabled until a backend bulk orders endpoint exists."
              >
                <option value="">Bulk Action</option>
                <option value="mark_processing">Mark processing</option>
                <option value="mark_shipping">Mark in delivery</option>
                <option value="mark_delivered">Mark delivered</option>
                <option value="mark_cancelled">Cancel selected</option>
              </select>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
            <button
              type="button"
              className={headerBtnDisabled}
              disabled
              title="Bulk delivery assignment is not wired to the backend."
            >
              <Truck className="h-4 w-4" />
              Assign Delivery{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
            <button
              type="button"
              className={headerBtnDisabled}
              disabled
              title="Bulk delivery unassign is not wired to the backend."
            >
              <XCircle className="h-4 w-4" />
              Unassign{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
            <button
              type="button"
              className={
                selectedCount > 0 && !deleteMutation.isPending
                  ? headerBtnOutline
                  : headerBtnDisabled
              }
              disabled={selectedCount === 0 || deleteMutation.isPending}
              onClick={onDeleteSelected}
              title={
                selectedCount > 0
                  ? "Delete selected orders."
                  : "Select one or more orders to delete."
              }
            >
              <Trash2 className="h-4 w-4" />
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              className={headerBtnGreen}
              onClick={onDownloadAll}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4" />
              {isDownloading ? "Downloading..." : "Download All Orders"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3">
          <div className="grid gap-3 xl:grid-cols-[180px_180px]">
            <label className="grid gap-1.5">
              <span className={subtleLabelClass}>Start Date</span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(event) => setStartDateInput(event.target.value)}
                  className={`${fieldClass} pr-9`}
                />
              </div>
            </label>
            <label className="grid gap-1.5">
              <span className={subtleLabelClass}>End Date</span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(event) => setEndDateInput(event.target.value)}
                  className={`${fieldClass} pr-9`}
                />
              </div>
            </label>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_150px_140px_120px_auto_auto] xl:items-end">
            <label className="grid gap-1.5 xl:col-start-1">
              <span className={subtleLabelClass}>Search by Customer Name</span>
              <div className="relative">
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
                  placeholder="Search by customer name"
                  className={`${fieldClass} pl-9`}
                />
              </div>
            </label>
            <select
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value)}
              className={`${fieldClass} w-full`}
            >
              <option value="">Status</option>
              {STATUS_FILTER_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={limitDaysInput}
              onChange={(event) => setLimitDaysInput(event.target.value)}
              className={`${fieldClass} w-full`}
            >
              <option value="">Order limits</option>
              <option value="5">Last 5 days</option>
              <option value="7">Last 7 days</option>
              <option value="15">Last 15 days</option>
              <option value="30">Last 30 days</option>
            </select>
            <select
              value={methodInput}
              onChange={(event) => setMethodInput(event.target.value)}
              className={`${fieldClass} w-full`}
            >
              <option value="">Method</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
            </select>
            <button
              type="button"
              className={`${headerBtnOutline} w-full xl:w-auto xl:justify-center`}
              onClick={onApplyFilters}
              aria-label="View orders"
              title="View orders"
            >
              View
            </button>
            <button
              type="button"
              className={`${headerBtnSoft} w-full xl:w-auto xl:justify-center`}
              onClick={onResetFilters}
              aria-label="Reset filters"
              title="Reset filters"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
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
          <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-0.5 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-700">{items.length}</span> /{" "}
            <span className="font-semibold text-slate-700">{meta.total || 0}</span>
          </div>
          <div className="w-full px-0 pb-1">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[4%]`}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className={selectionCheckboxClass}
                      aria-label="Select all visible orders"
                    />
                  </th>
                  <th className={`${tableHeadCell} w-[19%]`}>Invoice No</th>
                  <th className={`${tableHeadCell} w-[16%]`}>Order Time</th>
                  <th className={`${tableHeadCell} w-[16%]`}>Customer Name</th>
                  <th className={`${tableHeadCell} w-[8%]`}>Method</th>
                  <th className={`${tableHeadCell} w-[10%] text-right`}>Amount</th>
                  <th className={`${tableHeadCell} w-[11%]`}>Status</th>
                  <th className={`${tableHeadCell} w-[7%]`}>Delivery</th>
                  <th className={`${tableHeadCell} w-[13%]`}>Action</th>
                  <th className={`${tableHeadCell} w-[8%] text-center`}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {hasItems ? rows.map(({ order, view }, rowIndex) => {
                  const contract = order.contract || null;
                  const actionStatus = toAdminOrderActionValue(
                    order.rawStatus || order.status || "pending"
                  );
                  const actionOptions = Array.isArray(contract?.availableActions) &&
                    contract.availableActions.length > 0
                    ? contract.availableActions
                    : [
                        {
                          code: actionStatus,
                          label: contract?.statusSummary?.label || "Status unavailable",
                          enabled: false,
                          reason:
                            "Backend actionability is unavailable for this order row right now.",
                        },
                      ];
                  const hasBackendActions = Array.isArray(contract?.availableActions) &&
                    contract.availableActions.length > 0;
                  const isUpdating = pendingUpdateId === order.id;
                  const orderId = view?.id || order?.id;
                  const invoiceParam = getInvoiceParam(order, view);
                  const orderDateValue = view?.orderTime || getOrderDateValue(order);
                  const delivery = getDeliveryPresentation(order);
                  const isSelected = selectedIds.has(Number(orderId));
                  const rowKey =
                    orderId ||
                    `${view.invoiceNo}-${formatDateTime(orderDateValue)}`;
                  return (
                    <tr
                      key={rowKey}
                      className={`${tableRowClass} ${
                        rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/35"
                      }`}
                    >
                      <td className={`${tableCell} w-[4%]`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(orderId)}
                          className={selectionCheckboxClass}
                          aria-label={`Select order ${view.invoiceNo}`}
                        />
                      </td>
                      <td className={`${tableCell} w-[19%]`}>
                        <div className="space-y-0.5">
                          <div className="break-words text-[13px] font-semibold leading-4 text-slate-900">
                            {view.invoiceNo}
                          </div>
                          <div className="origin-left scale-90 opacity-85">
                            <CheckoutModeBadge mode={order.checkoutMode} />
                          </div>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[16%] leading-4 text-slate-600`}>
                        {formatDateTime(orderDateValue)}
                      </td>
                      <td className={`${tableCell} w-[16%] text-slate-600`}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="line-clamp-2 font-medium leading-4 text-slate-900">
                            {view.customerName}
                          </div>
                          {view.customerType === "guest" ? (
                            <span className={`${compactBadgeClass} border-amber-200 bg-amber-50 text-amber-700`}>
                              Guest
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${tableCell} w-[8%] text-slate-600`}>{view.method}</td>
                      <td className={`${tableCell} w-[10%] whitespace-nowrap text-right font-semibold tabular-nums text-slate-800`}>
                        {formatMoney(view.amount)}
                      </td>
                      <td className={`${tableCell} w-[11%]`}>
                        <div className="space-y-1">
                          <OrderStatusBadge
                            status={order.rawStatus || order.status || "-"}
                            meta={contract?.statusSummary || null}
                          />
                          <div className="origin-left scale-90 opacity-85">
                            <PaymentStatusBadge
                              status={order.paymentStatus}
                              label={order.paymentStatusMeta?.label}
                              tone={order.paymentStatusMeta?.tone}
                              prefix="Parent Payment"
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[7%]`}>
                        <span
                          className={`inline-flex w-full items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${getDeliveryBadgeClass(
                            delivery.tone
                          )}`}
                          title={view.deliveryName || delivery.label}
                        >
                          {view.deliveryName || (view.deliveryAssigned ? delivery.label : "Assign")}
                        </span>
                      </td>
                      <td className={`${tableCell} w-[13%]`}>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={actionStatus}
                            onChange={(event) => onUpdateStatus(order, event.target.value)}
                            disabled={isUpdating || !hasBackendActions}
                            className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                          >
                            {actionOptions.map((option) => (
                              <option
                                key={option.code}
                                value={option.code}
                                disabled={Boolean(option.enabled === false)}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[8%] text-center`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {view.invoiceUrl ? (
                            <Link
                              to={view.invoiceUrl}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                              aria-label="View order detail"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                              aria-label="View order detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onPrintInvoice(invoiceParam)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            aria-label="Print invoice"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr className="border-t border-slate-100">
                    <td colSpan={10} className="px-4 py-14 text-center">
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

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] shadow-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1 text-slate-700 disabled:opacity-50"
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
          className="rounded-full border border-slate-200 px-3 py-1 text-slate-700 disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
