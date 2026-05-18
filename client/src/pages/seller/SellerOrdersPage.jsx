import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CreditCard,
  Eye,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import {
  bulkDeleteSellerSuborders,
  getSellerSuborders,
  updateSellerSuborderFulfillment,
} from "../../api/sellerOrders.ts";
import { normalizeSellerOrder } from "../../services/adapters/orderAdapter.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { sellerStatusBadge } from "./sellerStatusPresentation.js";
import {
  sellerFieldClass,
  sellerSecondaryButtonClass,
  sellerTableCellClass,
  sellerTableHeadCellClass,
  sellerTableWrapClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatePanel,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";

const toolbarButtonBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition";
const toolbarButtonDisabled = `${toolbarButtonBase} cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 opacity-80`;
const toolbarButtonOutline = `${toolbarButtonBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const subtleLabelClass = "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const selectionCheckboxClass =
  "h-4 w-4 rounded border border-emerald-300 text-emerald-600 focus:ring-emerald-500";
const rowClass = "border-t border-slate-100 text-slate-700 transition hover:bg-slate-50";
const sellerHeadCellClass = `${sellerTableHeadCellClass} py-2 text-[10px] font-medium text-slate-400`;
const sellerBodyCellClass = `${sellerTableCellClass} px-2.5 py-2 text-[13px]`;
const compactBadgeClass = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold";

const PAYMENT_FILTER_OPTIONS = [
  { value: "", label: "All payment" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PENDING_CONFIRMATION", label: "Pending confirmation" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
];

const FULFILLMENT_FILTER_OPTIONS = [
  { value: "", label: "All status" },
  { value: "UNFULFILLED", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const normalizeStatusText = (value) => String(value || "").trim().toLowerCase();

const formatMoney = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatOrderTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("day")} ${get("month")}, ${get("year")} ${get("hour")}:${get(
    "minute"
  )} ${get("dayPeriod")}`;
};

const getStatusBadgeClass = (status) => {
  const value = normalizeStatusText(status);
  if (value.includes("pending") || value === "unfulfilled" || value === "unpaid") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (value.includes("process")) {
    return "border-pink-200 bg-pink-50 text-pink-700";
  }
  if (value.includes("delivery") || value.includes("ship")) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (value.includes("deliver") || value.includes("paid")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value.includes("cancel") || value.includes("reject") || value.includes("fail")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (value.includes("expired")) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const formatStatusLabel = (status) => {
  const value = normalizeStatusText(status);
  if (value === "unfulfilled") return "Pending";
  if (value === "processing") return "Processing";
  if (value === "shipped") return "Out For Delivery";
  if (value === "delivered") return "Delivered";
  if (value === "cancelled") return "Cancelled";
  if (value === "pending confirmation") return "Pending Confirmation";
  if (value === "paid") return "Paid";
  if (value === "failed") return "Failed";
  if (value === "expired") return "Expired";
  if (!value) return "-";
  return String(status)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getSellerRowAction = (item) => {
  const actions = Array.isArray(item?.governance?.fulfillment?.availableActions)
    ? item.governance.fulfillment.availableActions
    : [];

  return (
    actions.find((action) => action?.code === "MARK_PROCESSING" && action?.enabled !== false) ||
    actions.find((action) => action?.enabled !== false) ||
    null
  );
};

const sellerFriendlyText = (value, fallback = "") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .replace(/\bmutations\b/gi, "actions")
    .replace(/\bmutation\b/gi, "action")
    .replace(/\bbackend\b/gi, "system")
    .replace(/\bmetadata\b/gi, "details");
};

const getSellerRowBlockedReason = (item) => {
  const actions = Array.isArray(item?.governance?.fulfillment?.availableActions)
    ? item.governance.fulfillment.availableActions
    : [];

  return sellerFriendlyText(
    actions.find((action) => action?.enabled === false && action?.reason)?.reason ||
      item?.governance?.fulfillment?.mutationBlockedReason,
    "No list action available."
  );
};

const getDeliveryLabel = (view) => view.deliveryName || "-";
export default function SellerOrdersPage() {
  const { sellerContext, workspaceStoreId: storeId, workspaceRoutes } =
    useSellerWorkspaceRoute();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedback, setFeedback] = useState(null);
  const [busyActionKey, setBusyActionKey] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [searchInput, setSearchInput] = useState(
    String(searchParams.get("keyword") || "").trim()
  );
  const hasOrderPermission = sellerContext?.access?.permissionKeys?.includes("ORDER_VIEW");
  const hasFulfillmentManagePermission = sellerContext?.access?.permissionKeys?.includes(
    "ORDER_FULFILLMENT_MANAGE"
  );

  const rawPage = Number(searchParams.get("page") || 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const paymentStatus = String(searchParams.get("paymentStatus") || "").trim();
  const fulfillmentStatus = String(searchParams.get("fulfillmentStatus") || "").trim();
  const keyword = String(searchParams.get("keyword") || "").trim();

  useEffect(() => {
    setSearchInput(keyword);
  }, [keyword]);

  const ordersQuery = useQuery({
    queryKey: [
      "seller",
      "suborders",
      storeId,
      {
        page,
        paymentStatus,
        fulfillmentStatus,
        keyword,
      },
    ],
    queryFn: () =>
      getSellerSuborders(storeId, {
        page,
        limit: 10,
        paymentStatus: paymentStatus || undefined,
        fulfillmentStatus: fulfillmentStatus || undefined,
        keyword: keyword || undefined,
      }),
    enabled: Boolean(storeId) && hasOrderPermission,
    retry: false,
  });

  const items = Array.isArray(ordersQuery.data?.items) ? ordersQuery.data.items : [];
  const storeShippingSetup = ordersQuery.data?.storeShippingSetup || null;
  const shippingReady = storeShippingSetup ? Boolean(storeShippingSetup.isShippingReady) : true;
  const shippingReadinessBadge = shippingReady
    ? sellerStatusBadge.ready
    : storeShippingSetup?.shippingSetupStatus?.code === "DISABLED"
      ? sellerStatusBadge.blocked
      : sellerStatusBadge.needsSetup;
  const pagination = ordersQuery.data?.pagination ?? { page: 1, limit: 10, total: 0 };
  const totalPages = Math.max(
    1,
    Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 10))
  );

  const rows = useMemo(
    () =>
      items.map((item) => ({
        raw: item,
        view: normalizeSellerOrder(item, {
          detailUrl: workspaceRoutes.orderDetail(item.suborderId),
        }),
      })),
    [items, workspaceRoutes]
  );
  const visibleSummary = useMemo(() => {
    const paymentCode = (item) => String(item?.raw?.paymentStatus || "").trim().toUpperCase();
    const fulfillmentCode = (item) =>
      String(item?.raw?.fulfillmentStatus || "").trim().toUpperCase();

    return {
      pendingPayment: rows.filter((item) =>
        ["UNPAID", "PENDING_CONFIRMATION", "PARTIALLY_PAID"].includes(paymentCode(item))
      ).length,
      paid: rows.filter((item) => paymentCode(item) === "PAID").length,
      needFulfillment: rows.filter(
        (item) =>
          paymentCode(item) === "PAID" &&
          ["UNFULFILLED", "PROCESSING"].includes(fulfillmentCode(item))
      ).length,
      completed: rows.filter((item) => fulfillmentCode(item) === "DELIVERED").length,
    };
  }, [rows]);

  useEffect(() => {
    const visibleIds = new Set(rows.map((entry) => Number(entry.raw?.suborderId)).filter(Boolean));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [rows]);

  const fulfillmentMutation = useMutation({
    mutationFn: ({ suborderId, action }) =>
      updateSellerSuborderFulfillment(storeId, suborderId, { action }),
    onMutate: ({ suborderId, action }) => {
      setFeedback(null);
      setBusyActionKey(`${suborderId}:${action}`);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Seller fulfillment updated.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "suborders", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "suborder", "detail", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "payment-review", storeId] }),
      ]);
    },
    onError: (error) => {
      const code = String(error?.response?.data?.code || "").toUpperCase();
      const message =
        code === "INVALID_FULFILLMENT_TRANSITION"
          ? "This fulfillment step is no longer valid for the current suborder state."
          : code === "SUBORDER_PAYMENT_NOT_SETTLED"
            ? "This store split must be paid before seller fulfillment can move forward."
            : code === "PARENT_ORDER_CANCELLED"
              ? "Parent order is cancelled, so seller fulfillment can no longer move forward."
              : code === "FULFILLMENT_STATUS_ALREADY_SET"
                ? "This suborder is already on the requested fulfillment status."
                : code === "SUBORDER_NOT_FOUND"
                  ? "Suborder not found for this store."
                  : code === "SELLER_PERMISSION_DENIED"
                    ? "Your current seller role cannot run fulfillment actions."
                    : error?.response?.data?.message ||
                      error?.message ||
                      "Failed to update seller fulfillment.";

      setFeedback({
        type: "error",
        message,
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => bulkDeleteSellerSuborders(storeId, ids),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: (result) => {
      setSelectedIds(new Set());
      setFeedback({
        type: "success",
        message: result?.message || "Selected seller orders deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["seller", "suborders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["seller", "suborder", "detail", storeId] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to delete selected seller orders.",
      });
    },
  });

  const patchSearch = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in patch)) {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const toggleRowSelection = (suborderId) => {
    const normalizedId = Number(suborderId || 0);
    if (!normalizedId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedId)) next.delete(normalizedId);
      else next.add(normalizedId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = rows.map((entry) => Number(entry.raw?.suborderId)).filter(Boolean);
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

  const onApplySearch = () => {
    patchSearch({ keyword: searchInput.trim(), page: 1 });
  };

  const onResetFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams({ page: "1" }));
  };

  const onDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (
      ids.length === 0 ||
      deleteMutation.isPending ||
      !hasFulfillmentManagePermission
    ) {
      return;
    }

    const confirmed = window.confirm(
      ids.length === 1
        ? "Delete the selected seller order? This action cannot be undone."
        : `Delete ${ids.length} selected seller orders? This action cannot be undone.`
    );
    if (!confirmed) return;

    deleteMutation.mutate(ids);
  };

  if (!hasOrderPermission) {
    return (
      <SellerWorkspaceStatePanel
        title="Order visibility is unavailable"
        description="Your current seller access does not include order visibility."
        tone="error"
        Icon={ShoppingBag}
      />
    );
  }

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    rows.length > 0 &&
    rows.every((entry) => selectedIds.has(Number(entry.raw?.suborderId || 0)));

  return (
    <div className="space-y-4">
      <SellerWorkspaceSectionHeader
        eyebrow="Seller Orders"
        title="Orders"
        description="Pack, ship, and track seller orders from one place."
        actions={[
          storeShippingSetup ? (
            <SellerWorkspaceBadge
              key="shipping"
              label={shippingReadinessBadge.label}
              tone={shippingReadinessBadge.tone}
            />
          ) : null,
          <button
            key="delete"
            type="button"
            className={
              selectedCount > 0 &&
              hasFulfillmentManagePermission &&
              !deleteMutation.isPending
                ? toolbarButtonOutline
                : toolbarButtonDisabled
            }
            disabled={
              selectedCount === 0 ||
              !hasFulfillmentManagePermission ||
              deleteMutation.isPending
            }
            onClick={onDeleteSelected}
            title={
              hasFulfillmentManagePermission
                ? selectedCount > 0
                  ? "Delete selected seller orders."
                  : "Select one or more seller orders to delete."
                : "Your current seller role cannot delete orders."
            }
          >
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending
              ? "Deleting..."
              : selectedCount > 0
                ? `Delete selected (${selectedCount})`
                : "Select orders to delete"}
          </button>,
        ]}
      />

      {!ordersQuery.isLoading &&
      !ordersQuery.isError &&
      storeShippingSetup &&
      !storeShippingSetup.isShippingReady ? (
        <SellerWorkspaceNotice
          type={storeShippingSetup.shippingSetupStatus?.code === "DISABLED" ? "info" : "warning"}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">
                Store not ready yet
              </p>
              <p className="mt-1 leading-5">
                {storeShippingSetup.shippingSetupMeta?.message ||
                  "Complete payment and shipping setup before going public."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={workspaceRoutes.paymentProfile()} className={sellerSecondaryButtonClass}>
                Payment setup
              </Link>
              <Link to={workspaceRoutes.shippingSetup()} className={sellerPrimaryButtonClass}>
                Review setup
              </Link>
            </div>
          </div>
        </SellerWorkspaceNotice>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError ? (
        <section className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          <SellerWorkspaceStatCard
            label="Pending Payment"
            value={String(visibleSummary.pendingPayment)}
            hint="Unpaid or awaiting proof."
            Icon={CreditCard}
            tone="amber"
          />
          <SellerWorkspaceStatCard
            label="Paid"
            value={String(visibleSummary.paid)}
            hint="Ready for fulfillment."
            Icon={BadgeCheck}
            tone="emerald"
          />
          <SellerWorkspaceStatCard
            label="Need Fulfillment"
            value={String(visibleSummary.needFulfillment)}
            hint="Pack or ship next."
            Icon={Truck}
          />
          <SellerWorkspaceStatCard
            label="Completed"
            value={String(visibleSummary.completed)}
            hint="Delivered orders."
            Icon={ShoppingBag}
          />
        </section>
      ) : null}

      <SellerWorkspacePanel className="p-4 shadow-sm sm:p-4">
        <div className="grid gap-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)]">
            <label className="grid gap-1.5">
              <span className={subtleLabelClass}>Search orders</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onApplySearch();
                    }
                  }}
                  placeholder="Search by buyer, invoice, or order number"
                  className={`${sellerFieldClass} pl-9`}
                />
              </div>
            </label>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_180px_180px_auto_auto] xl:items-end">
          <label className="grid gap-1.5 xl:col-start-2">
            <span className={subtleLabelClass}>Status</span>
            <select
              value={fulfillmentStatus}
              onChange={(event) =>
                patchSearch({ fulfillmentStatus: event.target.value, page: 1 })
              }
              className={sellerFieldClass}
            >
              {FULFILLMENT_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={subtleLabelClass}>Payment</span>
            <select
              value={paymentStatus}
              onChange={(event) => patchSearch({ paymentStatus: event.target.value, page: 1 })}
              className={sellerFieldClass}
            >
              {PAYMENT_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 xl:justify-end">
            <button type="button" className={`${toolbarButtonOutline} w-full xl:w-auto`} onClick={onApplySearch}>
              View
            </button>
            <button type="button" className={`${toolbarButtonOutline} w-full xl:w-auto`} onClick={onResetFilters}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
        </div>

      </SellerWorkspacePanel>

      {feedback ? (
        <SellerWorkspaceNotice type={feedback.type === "success" ? "success" : "error"}>
          {feedback.message}
        </SellerWorkspaceNotice>
      ) : null}

      {ordersQuery.isLoading ? (
        <SellerWorkspaceStatePanel
          title="Loading orders"
          description="Fetching store orders for the active seller workspace."
          Icon={ShoppingBag}
        />
      ) : null}

      {ordersQuery.isError ? (
        <SellerWorkspaceStatePanel
          title="Failed to load orders"
          description={getSellerRequestErrorMessage(ordersQuery.error, {
            permissionMessage:
              "Your current seller access does not include order visibility.",
            fallbackMessage: "Failed to load seller orders.",
          })}
          tone="error"
          Icon={ShoppingBag}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && rows.length === 0 ? (
        <SellerWorkspaceEmptyState
          title="No orders need processing yet"
          description={
            keyword || paymentStatus || fulfillmentStatus
              ? "No orders match this filter."
              : shippingReady
                ? "Orders will appear after checkout is completed."
                : "Complete setup before going public."
          }
          action={
            keyword || paymentStatus || fulfillmentStatus ? (
              <button type="button" className={sellerSecondaryButtonClass} onClick={onResetFilters}>
                Reset filters
              </button>
            ) : !shippingReady ? (
              <Link to={workspaceRoutes.shippingSetup()} className={sellerPrimaryButtonClass}>
                Review setup
              </Link>
            ) : null
          }
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && rows.length > 0 ? (
        <div className={`${sellerTableWrapClass} overflow-x-auto`}>
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-1.5 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{rows.length}</span> /{" "}
            <span className="font-semibold text-slate-700">{pagination.total || 0}</span>
          </div>
          <div className="min-w-[1080px]">
            <table className="w-full table-fixed text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${sellerHeadCellClass} w-[4%]`}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className={selectionCheckboxClass}
                      aria-label="Select all visible seller orders"
                    />
                  </th>
                  <th className={`${sellerHeadCellClass} w-[19%]`}>Invoice No</th>
                  <th className={`${sellerHeadCellClass} w-[16%]`}>Order Time</th>
                  <th className={`${sellerHeadCellClass} w-[16%]`}>Customer Name</th>
                  <th className={`${sellerHeadCellClass} w-[8%]`}>Payment</th>
                  <th className={`${sellerHeadCellClass} w-[10%] text-right`}>Amount</th>
                  <th className={`${sellerHeadCellClass} w-[11%]`}>Status</th>
                  <th className={`${sellerHeadCellClass} w-[7%]`}>Delivery</th>
                  <th className={`${sellerHeadCellClass} w-[13%]`}>Action</th>
                  <th className={`${sellerHeadCellClass} w-[8%] text-center`}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ raw, view }, index) => {
                  const rowAction = getSellerRowAction(raw);
                  const actionKey = rowAction ? `${raw.suborderId}:${rowAction.code}` : "";
                  const isSelected = selectedIds.has(Number(raw.suborderId || 0));
                  const deliveryName = getDeliveryLabel(view);
                  const blockedReason = getSellerRowBlockedReason(raw);

                  return (
                    <tr
                      key={raw.suborderId || view.id || view.invoiceNo}
                      className={`${rowClass} ${index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                    >
                      <td className={sellerBodyCellClass}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(raw.suborderId)}
                          className={selectionCheckboxClass}
                          aria-label={`Select order ${view.invoiceNo}`}
                        />
                      </td>
                      <td className={sellerBodyCellClass}>
                        <div className="space-y-1">
                          <div className="break-words text-[13px] font-semibold leading-4 text-slate-900">
                            {view.invoiceNo}
                          </div>
                          <div className="text-[10px] leading-4 text-slate-500">
                            Parent {raw.order?.orderNumber || raw.orderNumber || "-"}
                          </div>
                        </div>
                      </td>
                      <td className={`${sellerBodyCellClass} leading-4 text-slate-600`}>
                        {formatOrderTime(view.orderTime)}
                      </td>
                      <td className={sellerBodyCellClass}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="line-clamp-2 font-medium leading-4 text-slate-900">
                            {view.customerName}
                          </span>
                          {view.customerType === "guest" ? (
                            <span className={`${compactBadgeClass} border-amber-200 bg-amber-50 text-amber-700`}>
                              Guest
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${sellerBodyCellClass} font-medium text-slate-700`}>
                        {view.method}
                      </td>
                      <td
                        className={`${sellerBodyCellClass} whitespace-nowrap text-right font-semibold tabular-nums text-slate-900`}
                      >
                        {formatMoney(view.amount)}
                      </td>
                      <td className={sellerBodyCellClass}>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(
                            view.status
                          )}`}
                        >
                          {formatStatusLabel(view.status)}
                        </span>
                      </td>
                      <td className={sellerBodyCellClass}>
                        <span className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {view.deliveryAssigned ? deliveryName : "Not assigned"}
                        </span>
                      </td>
                      <td className={`${sellerBodyCellClass} w-[12%]`}>
                        {rowAction ? (
                          <button
                            type="button"
                            onClick={() =>
                              fulfillmentMutation.mutate({
                                suborderId: raw.suborderId,
                                action: rowAction.code,
                              })
                            }
                            disabled={fulfillmentMutation.isPending}
                            className={`${sellerSecondaryButtonClass} w-full px-2 text-[11px]`}
                          >
                            {busyActionKey === actionKey ? "Saving..." : rowAction.label}
                          </button>
                        ) : (
                          <div className="flex items-center">
                            <span
                              title={blockedReason}
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(
                                view.status
                              )}`}
                            >
                              {formatStatusLabel(view.status)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={`${sellerBodyCellClass} w-[10%] text-center`}>
                        {view.invoiceUrl ? (
                          <Link
                            to={view.invoiceUrl}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            aria-label="View order detail"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && rows.length > 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {totalPages} - {pagination.total} orders
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => patchSearch({ page: Math.max(1, pagination.page - 1) })}
              className={sellerSecondaryButtonClass}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => patchSearch({ page: Math.min(totalPages, pagination.page + 1) })}
              className={sellerSecondaryButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
