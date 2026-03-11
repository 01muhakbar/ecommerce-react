import { useMemo, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingBag } from "lucide-react";
import { getSellerSuborders, updateSellerSuborderFulfillment } from "../../api/sellerOrders.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

const PAYMENT_STATUS_CLASS = {
  UNPAID: "border-stone-200 bg-stone-100 text-stone-700",
  PENDING_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  EXPIRED: "border-stone-300 bg-stone-200 text-stone-700",
  CANCELLED: "border-stone-300 bg-stone-200 text-stone-700",
  CREATED: "border-sky-200 bg-sky-50 text-sky-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
};

const FULFILLMENT_STATUS_CLASS = {
  UNFULFILLED: "border-stone-200 bg-stone-100 text-stone-700",
  PROCESSING: "border-sky-200 bg-sky-50 text-sky-700",
  SHIPPED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-stone-200 bg-stone-100 text-stone-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  processing: "border-sky-200 bg-sky-50 text-sky-700",
  shipped: "border-indigo-200 bg-indigo-50 text-indigo-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-stone-300 bg-stone-200 text-stone-700",
};

const CHECKOUT_MODE_CLASS = {
  LEGACY: "border-stone-200 bg-stone-100 text-stone-700",
  SINGLE_STORE: "border-sky-200 bg-sky-50 text-sky-700",
  MULTI_STORE: "border-teal-200 bg-teal-50 text-teal-700",
};

const getStatusClass = (value, map) =>
  map[String(value || "").trim()] || map[String(value || "").toUpperCase()] ||
  "border-stone-200 bg-stone-100 text-stone-700";

function StatusChip({ value, label, map = PAYMENT_STATUS_CLASS }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
        value,
        map
      )}`}
    >
      {label || String(value || "-")}
    </span>
  );
}

function InfoPill({ label, value }) {
  return (
    <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
      {label}: {value}
    </span>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <article className={cardClass}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-stone-950">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-6 text-stone-600">{hint}</p> : null}
    </article>
  );
}

const getHasActiveFilters = ({ paymentStatus, fulfillmentStatus, keyword }) =>
  Boolean(paymentStatus || fulfillmentStatus || keyword);

const PAYMENT_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "UNPAID", label: "UNPAID" },
  { value: "PENDING_CONFIRMATION", label: "PENDING_CONFIRMATION" },
  { value: "PAID", label: "PAID" },
  { value: "FAILED", label: "FAILED" },
  { value: "EXPIRED", label: "EXPIRED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

const FULFILLMENT_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "UNFULFILLED", label: "UNFULFILLED" },
  { value: "PROCESSING", label: "PROCESSING" },
  { value: "SHIPPED", label: "SHIPPED" },
  { value: "DELIVERED", label: "DELIVERED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

function buildOrderStats(items) {
  const paidCount = items.filter((item) => item.paymentStatus === "PAID").length;
  const reviewCount = items.filter((item) => item.paymentStatus === "PENDING_CONFIRMATION").length;
  const activeFulfillmentCount = items.filter((item) =>
    ["PROCESSING", "SHIPPED"].includes(item.fulfillmentStatus)
  ).length;
  return {
    paidCount,
    reviewCount,
    activeFulfillmentCount,
  };
}

const getParentLifecycleHint = (item) => {
  const parentOrderStatus = item.order?.statusMeta?.label || item.order?.status || "-";
  const parentPaymentStatus =
    item.order?.paymentStatusMeta?.label || item.order?.paymentStatus || "-";
  return `Parent order ${parentOrderStatus} · parent payment ${parentPaymentStatus}`;
};

const getPaymentSnapshotHint = (item) => {
  if (!item.paymentSummary) {
    return "No payment record is attached to this suborder yet.";
  }

  const proofLabel = item.paymentSummary?.proof?.reviewMeta?.label;
  return proofLabel
    ? `Payment record ${item.paymentSummary.statusMeta?.label || item.paymentSummary.status} · proof ${proofLabel}`
    : item.paymentSummary.statusMeta?.description || "Latest payment snapshot is attached to this suborder.";
};

const formatMoney = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatActionList = (items = []) =>
  Array.isArray(items) && items.length > 0
    ? items.map((item) => String(item || "").replaceAll("_", " ").toLowerCase()).join(", ")
    : "-";

const formatTransitionLabel = (status) =>
  String(status || "")
    .replaceAll("_", " ")
    .toLowerCase();

export default function SellerOrdersPage() {
  const { storeId } = useParams();
  const queryClient = useQueryClient();
  const { sellerContext } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedback, setFeedback] = useState(null);
  const [busyActionKey, setBusyActionKey] = useState("");

  const rawPage = Number(searchParams.get("page") || 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const paymentStatus = String(searchParams.get("paymentStatus") || "").trim();
  const fulfillmentStatus = String(searchParams.get("fulfillmentStatus") || "").trim();
  const keyword = String(searchParams.get("keyword") || "").trim();
  const hasOrderPermission = sellerContext?.access?.permissionKeys?.includes("ORDER_VIEW");

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
  const pagination = ordersQuery.data?.pagination ?? { page: 1, limit: 10, total: 0 };
  const fulfillmentGovernance = ordersQuery.data?.governance?.fulfillment ?? null;
  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 10)));

  const activeFilters = useMemo(
    () =>
      [
        paymentStatus ? `Payment: ${paymentStatus}` : null,
        fulfillmentStatus ? `Fulfillment: ${fulfillmentStatus}` : null,
        keyword ? `Keyword: ${keyword}` : null,
      ].filter(Boolean),
    [paymentStatus, fulfillmentStatus, keyword]
  );
  const hasActiveFilters = getHasActiveFilters({ paymentStatus, fulfillmentStatus, keyword });
  const orderStats = useMemo(() => buildOrderStats(items), [items]);

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
      await queryClient.invalidateQueries({ queryKey: ["seller", "suborders", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["seller", "suborder", "detail", storeId] });
    },
    onError: (error) => {
      const code = String(error?.response?.data?.code || "").toUpperCase();
      const message =
        code === "INVALID_FULFILLMENT_TRANSITION"
          ? "This fulfillment step is no longer valid for the current suborder state."
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

  if (!hasOrderPermission) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include order visibility.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#fef3c7_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Seller Orders
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Seller suborder overview
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              This module only shows suborders belonging to the current store. All access stays
              tenant-scoped and enforced by the backend seller access resolver.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {fulfillmentGovernance?.actorHasManagePermission
                ? `Phase 1 seller fulfillment is active here for direct suborder transitions only. It stays suborder-scoped and uses ${fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"} instead of parent order status updates.`
                : `Seller fulfillment remains read-only for this actor. The mutation lane is reserved for roles with ${fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"}.`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Payment
              </span>
              <select
                value={paymentStatus}
                onChange={(event) => patchSearch({ paymentStatus: event.target.value, page: 1 })}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
              >
                <option value="">All</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PENDING_CONFIRMATION">PENDING_CONFIRMATION</option>
                <option value="PAID">PAID</option>
                <option value="FAILED">FAILED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Fulfillment
              </span>
              <select
                value={fulfillmentStatus}
                onChange={(event) =>
                  patchSearch({ fulfillmentStatus: event.target.value, page: 1 })
                }
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
              >
                <option value="">All</option>
                <option value="UNFULFILLED">UNFULFILLED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Search
              </span>
              <div className="flex items-center rounded-2xl border border-stone-200 bg-white px-4">
                <Search className="h-4 w-4 text-stone-400" />
                <input
                  value={keyword}
                  onChange={(event) => patchSearch({ keyword: event.target.value, page: 1 })}
                  placeholder="Suborder or buyer"
                  className="h-12 w-full bg-transparent px-3 text-sm outline-none"
                />
              </div>
            </label>
          </div>
        </div>
      </section>

      {feedback ? (
        <section
          className={`rounded-[22px] border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </section>
      ) : null}

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((item) => (
            <span
              key={item}
              className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError ? (
        <section className={cardClass}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Fulfillment Governance
              </p>
              <h3 className="mt-2 text-lg font-semibold text-stone-950">
                {fulfillmentGovernance?.actorHasManagePermission
                  ? "Phase 1 seller fulfillment lane"
                  : "Fulfillment remains restricted for this actor"}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                {fulfillmentGovernance?.mutationBlockedReason ||
                  "Seller fulfillment mutations are still closed in the current workspace phase."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <InfoPill label="Entity" value={fulfillmentGovernance?.entity || "SUBORDER"} />
              <InfoPill
                label="Permission"
                value={
                  fulfillmentGovernance?.actorHasManagePermission
                    ? `${fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"} active`
                    : `${fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"} required`
                }
              />
              <InfoPill
                label="Audit"
                value={fulfillmentGovernance?.auditRequired ? "Required" : "Not specified"}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-stone-600 md:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <p className="font-semibold text-stone-900">Safe later for seller</p>
              <p className="mt-2 leading-6">
                {formatActionList(fulfillmentGovernance?.sellerCandidateActions)}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <p className="font-semibold text-stone-900">Read-only now</p>
              <p className="mt-2 leading-6">
                {formatActionList(fulfillmentGovernance?.readOnlyActions)}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <p className="font-semibold text-stone-900">Still admin-only</p>
              <p className="mt-2 leading-6">
                {formatActionList(fulfillmentGovernance?.adminOnlyActions)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError ? (
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Visible Suborders"
            value={String(pagination.total || 0)}
            hint="Rows scoped to the active seller store only."
          />
          <StatCard
            label="Paid Split Orders"
            value={String(orderStats.paidCount)}
            hint={`Awaiting proof review: ${orderStats.reviewCount}`}
          />
          <StatCard
            label="Active Fulfillment"
            value={String(orderStats.activeFulfillmentCount)}
            hint="Processing or shipped suborders in the current page."
          />
        </section>
      ) : null}

      {ordersQuery.isLoading ? (
        <section className={cardClass}>
          <p className="text-sm text-stone-500">Loading seller suborders...</p>
        </section>
      ) : null}

      {ordersQuery.isError ? (
        <section className={cardClass}>
          <p className="text-sm text-rose-600">
            {getSellerRequestErrorMessage(ordersQuery.error, {
              permissionMessage:
                "Your current seller access does not include order visibility.",
              fallbackMessage: "Failed to load seller suborders.",
            })}
          </p>
        </section>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && items.length === 0 ? (
        <section className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">
                {hasActiveFilters ? "No suborders match the current filters" : "No suborders found"}
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                {hasActiveFilters
                  ? "Try widening payment, fulfillment, or keyword filters for this store."
                  : "This store does not have seller-scoped suborders yet."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.suborderId} className={cardClass}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                      {item.suborderNumber}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-stone-950">
                      Parent Order {item.order?.orderNumber || item.orderNumber}
                    </h3>
                    <p className="mt-2 text-sm text-stone-500">{item.scope?.relationLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip
                      value={item.paymentStatus}
                      label={`Suborder ${item.paymentStatusMeta?.label || item.paymentStatus}`}
                      map={PAYMENT_STATUS_CLASS}
                    />
                    <StatusChip
                      value={item.fulfillmentStatus}
                      label={`Fulfillment ${item.fulfillmentStatusMeta?.label || item.fulfillmentStatus}`}
                      map={FULFILLMENT_STATUS_CLASS}
                    />
                    <StatusChip
                      value={item.order?.checkoutMode}
                      label={item.order?.checkoutModeMeta?.label || item.order?.checkoutMode || "-"}
                      map={CHECKOUT_MODE_CLASS}
                    />
                    {item.paymentSummary?.status ? (
                      <StatusChip
                        value={item.paymentSummary.status}
                        label={`Payment ${item.paymentSummary.statusMeta?.label || item.paymentSummary.status}`}
                        map={PAYMENT_STATUS_CLASS}
                      />
                    ) : null}
                  </div>
                  <div className="grid gap-3 text-sm text-stone-600 sm:grid-cols-2 xl:grid-cols-4">
                    <p>
                      <span className="font-semibold text-stone-900">Buyer:</span>{" "}
                      {item.buyer?.name || "-"}
                    </p>
                    <p>
                      <span className="font-semibold text-stone-900">Items:</span> {item.itemCount}
                    </p>
                    <p>
                      <span className="font-semibold text-stone-900">Total:</span>{" "}
                      {formatMoney(item.totalAmount)}
                    </p>
                    <p>
                      <span className="font-semibold text-stone-900">Created:</span>{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-stone-600">
                    <InfoPill
                      label="Parent lifecycle"
                      value={item.order?.statusMeta?.label || item.order?.status || "-"}
                    />
                    <InfoPill
                      label="Parent payment"
                      value={
                        item.order?.paymentStatusMeta?.label ||
                        item.order?.paymentStatus ||
                        "-"
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600 xl:w-[280px]">
                  <p className="font-semibold text-stone-900">Operational Snapshot</p>
                  <p className="mt-2">
                    Suborder Payment:{" "}
                    <span className="font-semibold text-stone-900">
                      {item.paymentStatusMeta?.label || item.paymentStatus}
                    </span>
                  </p>
                  <p className="mt-1">
                    Fulfillment:{" "}
                    <span className="font-medium text-stone-900">
                      {item.fulfillmentStatusMeta?.label || item.fulfillmentStatus}
                    </span>
                  </p>
                  <p className="mt-1">
                    Payment Record:{" "}
                    <span className="font-medium text-stone-900">
                      {item.paymentSummary?.statusMeta?.label || item.paymentSummary?.status || "-"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Parent:{" "}
                    <span className="font-medium text-stone-900">{getParentLifecycleHint(item)}</span>
                  </p>
                  <p className="mt-1">
                    Reference:{" "}
                    <span className="font-medium text-stone-900">
                      {item.paymentSummary?.internalReference || "-"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Proof Review:{" "}
                    <span className="font-medium text-stone-900">
                      {item.paymentSummary?.proof?.reviewMeta?.label ||
                        item.paymentSummary?.proof?.reviewStatus ||
                        "-"}
                    </span>
                  </p>
                  <p className="mt-3 text-xs leading-5 text-stone-500">
                    {getPaymentSnapshotHint(item)}
                  </p>

                  {item.governance?.fulfillment?.availableActions?.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {item.governance.fulfillment.availableActions.map((action) => {
                        const actionKey = `${item.suborderId}:${action.code}`;
                        return (
                          <button
                            key={action.code}
                            type="button"
                            onClick={() =>
                              fulfillmentMutation.mutate({
                                suborderId: item.suborderId,
                                action: action.code,
                              })
                            }
                            disabled={fulfillmentMutation.isPending}
                            className="w-full rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyActionKey === actionKey
                              ? "Saving..."
                              : `${action.label} -> ${formatTransitionLabel(action.nextStatus)}`}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs leading-5 text-stone-500">
                      {item.governance?.fulfillment?.mutationBlockedReason ||
                        "No fulfillment mutation is available for this suborder."}
                    </p>
                  )}

                  <Link
                    to={`/seller/stores/${storeId}/orders/${item.suborderId}`}
                    className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
                  >
                    View detail
                  </Link>
                </div>
              </div>
            </article>
          ))}

          <section className="flex items-center justify-between gap-3 rounded-[22px] border border-stone-200 bg-white px-5 py-4">
            <p className="text-sm text-stone-500">
              Page {pagination.page} of {totalPages} • {pagination.total} suborders
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => patchSearch({ page: Math.max(1, pagination.page - 1) })}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= totalPages}
                onClick={() => patchSearch({ page: Math.min(totalPages, pagination.page + 1) })}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
