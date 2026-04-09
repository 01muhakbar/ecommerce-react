import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingBag } from "lucide-react";
import { getSellerSuborders, updateSellerSuborderFulfillment } from "../../api/sellerOrders.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import {
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceFilterBar,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceStatePanel,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import {
  getOrderContractMeta,
  getOrderContractSummary,
} from "../../utils/orderContract.ts";

const PAYMENT_STATUS_CLASS = {
  UNPAID: "stone",
  PARTIALLY_PAID: "amber",
  PENDING_CONFIRMATION: "amber",
  PAID: "emerald",
  FAILED: "rose",
  EXPIRED: "stone",
  CANCELLED: "stone",
  CREATED: "sky",
  REJECTED: "rose",
};

const FULFILLMENT_STATUS_CLASS = {
  UNFULFILLED: "stone",
  PROCESSING: "sky",
  SHIPPED: "indigo",
  DELIVERED: "emerald",
  pending: "stone",
  paid: "emerald",
  processing: "sky",
  shipped: "indigo",
  delivered: "emerald",
  completed: "emerald",
  cancelled: "stone",
};

const CHECKOUT_MODE_CLASS = {
  LEGACY: "stone",
  SINGLE_STORE: "sky",
  MULTI_STORE: "teal",
};

const getStatusClass = (value, map) =>
  map[String(value || "").trim()] || map[String(value || "").toUpperCase()] ||
  "stone";

function StatusChip({ value, label, map = PAYMENT_STATUS_CLASS }) {
  return <SellerWorkspaceBadge label={label || String(value || "-")} tone={getStatusClass(value, map)} />;
}

function InfoPill({ label, value }) {
  return <SellerWorkspaceBadge label={`${label}: ${value}`} />;
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
  const parentOrderStatus =
    getOrderContractMeta(item.contract, "parentOrderStatusMeta")?.label ||
    item.readModel?.parentOrder?.statusMeta?.label ||
    item.order?.statusMeta?.label ||
    item.order?.status ||
    "-";
  const parentPaymentStatus =
    getOrderContractMeta(item.contract, "parentPaymentStatusMeta")?.label ||
    item.readModel?.parentOrder?.paymentStatusMeta?.label ||
    item.order?.paymentStatusMeta?.label ||
    item.order?.paymentStatus ||
    "-";
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

const getSellerOperationalHint = (item) =>
  item.readModel?.operationalNote ||
  "Use suborder payment and seller fulfillment as the operational truth for this store split.";

const getSellerStatusMeta = (item) =>
  getOrderContractSummary(item.contract) ||
  item.readModel?.primaryStatus ||
  item.fulfillmentStatusMeta ||
  null;

const getSellerPaymentMeta = (item) =>
  getOrderContractMeta(item.contract, "paymentStatusMeta") ||
  item.readModel?.paymentState ||
  item.paymentStatusMeta ||
  null;

const getParentOrderMeta = (item) =>
  getOrderContractMeta(item.contract, "parentOrderStatusMeta") ||
  item.readModel?.parentOrder?.statusMeta ||
  item.order?.statusMeta ||
  null;

const getParentPaymentMeta = (item) =>
  getOrderContractMeta(item.contract, "parentPaymentStatusMeta") ||
  item.readModel?.parentOrder?.paymentStatusMeta ||
  item.order?.paymentStatusMeta ||
  null;

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
  const { sellerContext, workspaceStoreId: storeId, workspaceRoutes } =
    useSellerWorkspaceRoute();
  const queryClient = useQueryClient();
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
  const storeShippingSetup = ordersQuery.data?.storeShippingSetup ?? null;
  const storeShippingSetupStatus = storeShippingSetup?.shippingSetupStatus ?? null;
  const storeShippingSetupMeta = storeShippingSetup?.shippingSetupMeta ?? null;
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
      <SellerWorkspaceStatePanel
        title="Order visibility is unavailable"
        description="Your current seller access does not include order visibility."
        tone="error"
        Icon={ShoppingBag}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SellerWorkspaceSectionHeader
        eyebrow="Seller Orders"
        title="Seller suborder overview"
        description="This module only shows suborders belonging to the current store. Seller fulfillment is the primary operational status here, while parent order lifecycle stays a global reference."
        actions={[
          storeShippingSetupStatus ? (
            <SellerWorkspaceBadge
              key="shipping-setup"
              label={`Shipping ${storeShippingSetupStatus.label || "Unavailable"}`}
              tone={storeShippingSetupStatus.tone || "stone"}
            />
          ) : null,
          <SellerWorkspaceBadge
            key="mode"
            label={fulfillmentGovernance?.actorHasManagePermission ? "Mutation open" : "Read only"}
            tone={fulfillmentGovernance?.actorHasManagePermission ? "emerald" : "amber"}
          />,
          <SellerWorkspaceBadge
            key="perm"
            label={fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"}
          />,
        ]}
      >
        <p className="text-sm leading-6 text-slate-500">
          {fulfillmentGovernance?.actorHasManagePermission
            ? `Phase 1 seller fulfillment is active here for direct suborder transitions only. It stays suborder-scoped and uses ${fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"} instead of parent order status updates.`
            : `Seller fulfillment remains read-only for this actor. The mutation lane is reserved for roles with ${fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"}.`}
        </p>
      </SellerWorkspaceSectionHeader>

      <SellerWorkspaceFilterBar>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Payment
              </span>
              <select
                value={paymentStatus}
                onChange={(event) => patchSearch({ paymentStatus: event.target.value, page: 1 })}
                className={sellerFieldClass}
              >
                <option value="">All</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                <option value="PENDING_CONFIRMATION">PENDING_CONFIRMATION</option>
                <option value="PAID">PAID</option>
                <option value="FAILED">FAILED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Fulfillment
              </span>
              <select
                value={fulfillmentStatus}
                onChange={(event) =>
                  patchSearch({ fulfillmentStatus: event.target.value, page: 1 })
                }
                className={sellerFieldClass}
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
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Search
              </span>
              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => patchSearch({ keyword: event.target.value, page: 1 })}
                  placeholder="Suborder or buyer"
                  className="w-full bg-transparent px-3 text-sm text-slate-700 outline-none"
                />
              </div>
            </label>
          </div>
      </SellerWorkspaceFilterBar>

      {storeShippingSetupStatus ? (
        <SellerWorkspacePanel className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Store Shipping Setup
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {storeShippingSetupStatus.label || "Unavailable"}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {storeShippingSetupMeta?.message ||
                  storeShippingSetupStatus.description ||
                  "Seller shipping setup readiness is unavailable for this store."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <InfoPill
                label="Ready"
                value={storeShippingSetup?.isShippingReady ? "Yes" : "No"}
              />
              <InfoPill
                label="Missing"
                value={String(storeShippingSetup?.missingShippingFieldsCount || 0)}
              />
            </div>
          </div>
          {!storeShippingSetup?.isShippingReady ? (
            <SellerWorkspaceNotice
              type={storeShippingSetupStatus.code === "DISABLED" ? "info" : "warning"}
              className="mt-4"
            >
              Shipment actions can remain blocked until this store shipping setup is ready. Review
              the existing <Link to={workspaceRoutes.shippingSetup()} className="font-semibold underline"> Shipping Setup</Link> lane.
            </SellerWorkspaceNotice>
          ) : null}
        </SellerWorkspacePanel>
      ) : null}

      {feedback ? (
        <SellerWorkspaceNotice type={feedback.type === "success" ? "success" : "error"}>
          {feedback.message}
        </SellerWorkspaceNotice>
      ) : null}

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((item) => (
            <SellerWorkspaceBadge key={item} label={item} />
          ))}
        </div>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError ? (
        <SellerWorkspacePanel className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Fulfillment Governance
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {fulfillmentGovernance?.actorHasManagePermission
                  ? "Phase 1 seller fulfillment lane"
                  : "Fulfillment remains restricted for this actor"}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
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

          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
              <p className="font-semibold text-slate-900">Safe later for seller</p>
              <p className="mt-2 leading-6">
                {formatActionList(fulfillmentGovernance?.sellerCandidateActions)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
              <p className="font-semibold text-slate-900">Read-only now</p>
              <p className="mt-2 leading-6">
                {formatActionList(fulfillmentGovernance?.readOnlyActions)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
              <p className="font-semibold text-slate-900">Still admin-only</p>
              <p className="mt-2 leading-6">
                {formatActionList(fulfillmentGovernance?.adminOnlyActions)}
              </p>
            </div>
          </div>
        </SellerWorkspacePanel>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError ? (
        <section className="grid gap-3.5 md:grid-cols-3">
          <SellerWorkspaceStatCard
            label="Visible Suborders"
            value={String(pagination.total || 0)}
            hint="Rows scoped to the active seller store only."
          />
          <SellerWorkspaceStatCard
            label="Paid Split Orders"
            value={String(orderStats.paidCount)}
            hint={`Awaiting proof review: ${orderStats.reviewCount}`}
            tone="emerald"
          />
          <SellerWorkspaceStatCard
            label="Active Fulfillment"
            value={String(orderStats.activeFulfillmentCount)}
            hint="Processing or shipped suborders in the current page."
            tone="amber"
          />
        </section>
      ) : null}

      {ordersQuery.isLoading ? (
        <SellerWorkspaceStatePanel
          title="Loading seller suborders"
          description="Fetching seller-scoped suborders for the active store."
          Icon={ShoppingBag}
        />
      ) : null}

      {ordersQuery.isError ? (
        <SellerWorkspaceStatePanel
          title="Failed to load seller suborders"
          description={getSellerRequestErrorMessage(ordersQuery.error, {
            permissionMessage:
              "Your current seller access does not include order visibility.",
            fallbackMessage: "Failed to load seller suborders.",
          })}
          tone="error"
          Icon={ShoppingBag}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && items.length === 0 ? (
        <SellerWorkspaceEmptyState
          title={hasActiveFilters ? "No suborders match the current filters" : "No suborders found"}
          description={
            hasActiveFilters
              ? "Try widening payment, fulfillment, or keyword filters for this store."
              : "This store does not have seller-scoped suborders yet."
          }
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && items.length > 0 ? (
        <div className="space-y-3.5">
          {items.map((item) => {
            const sellerStatusMeta = getSellerStatusMeta(item);
            const sellerPaymentMeta = getSellerPaymentMeta(item);
            const parentOrderMeta = getParentOrderMeta(item);
            const parentPaymentMeta = getParentPaymentMeta(item);

            return (
              <SellerWorkspacePanel key={item.suborderId} className="p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Seller suborder
                    </p>
                    <h3 className="mt-1.5 text-lg font-semibold text-slate-900">
                      {item.suborderNumber}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Parent order {item.order?.orderNumber || item.orderNumber} ·{" "}
                      {item.scope?.relationLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip
                      value={item.fulfillmentStatus}
                      label={`Seller ${sellerStatusMeta?.label || item.fulfillmentStatus}`}
                      map={FULFILLMENT_STATUS_CLASS}
                    />
                    <StatusChip
                      value={item.paymentStatus}
                      label={`Store split ${sellerPaymentMeta?.label || item.paymentStatus}`}
                      map={PAYMENT_STATUS_CLASS}
                    />
                    <StatusChip
                      value={item.order?.checkoutMode}
                      label={
                        item.readModel?.parentOrder?.checkoutModeMeta?.label ||
                        item.order?.checkoutModeMeta?.label ||
                        item.order?.checkoutMode ||
                        "-"
                      }
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
                  <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                    <p>
                      <span className="font-semibold text-slate-900">Buyer:</span>{" "}
                      {item.buyer?.name || "-"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Items:</span> {item.itemCount}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Total:</span>{" "}
                      {formatMoney(item.totalAmount)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Created:</span>{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <InfoPill
                      label="Parent lifecycle"
                      value={parentOrderMeta?.label || item.order?.status || "-"}
                    />
                    <InfoPill
                      label="Parent payment"
                      value={parentPaymentMeta?.label || item.order?.paymentStatus || "-"}
                    />
                    <InfoPill label="Scope" value="Store-only items and totals" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5 text-sm text-slate-600 xl:w-[280px]">
                  <p className="font-semibold text-slate-900">Operational Snapshot</p>
                  <p className="mt-2">
                    Seller Status:{" "}
                    <span className="font-semibold text-slate-900">
                      {sellerStatusMeta?.label || item.fulfillmentStatus}
                    </span>
                  </p>
                  <p className="mt-1">
                    Store Split Payment:{" "}
                    <span className="font-medium text-slate-900">
                      {sellerPaymentMeta?.label || item.paymentStatus}
                    </span>
                  </p>
                  <p className="mt-1">
                    Seller Scope:{" "}
                    <span className="font-medium text-slate-900">
                      {item.readModel?.sellerScope?.itemCount || item.itemCount} item
                      {(item.readModel?.sellerScope?.itemCount || item.itemCount) === 1 ? "" : "s"} ·{" "}
                      {formatMoney(item.readModel?.sellerScope?.totalAmount || item.totalAmount)}
                    </span>
                  </p>
                  <p className="mt-1">
                    Parent:{" "}
                    <span className="font-medium text-slate-900">{getParentLifecycleHint(item)}</span>
                  </p>
                  <p className="mt-1">
                    Payment Snapshot:{" "}
                    <span className="font-medium text-slate-900">
                      {item.paymentSummary?.statusMeta?.label || item.paymentSummary?.status || "-"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Reference:{" "}
                    <span className="font-medium text-slate-900">
                      {item.paymentSummary?.internalReference || "-"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Proof Review:{" "}
                    <span className="font-medium text-slate-900">
                      {item.paymentSummary?.proof?.reviewMeta?.label ||
                        item.paymentSummary?.proof?.reviewStatus ||
                        "-"}
                    </span>
                  </p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {sellerStatusMeta?.description || getSellerOperationalHint(item)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {item.readModel?.parentOrder?.note || getPaymentSnapshotHint(item)}
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
                            className={sellerSecondaryButtonClass}
                          >
                            {busyActionKey === actionKey
                              ? "Saving..."
                              : `${action.label} -> ${formatTransitionLabel(action.nextStatus)}`}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs leading-5 text-slate-500">
                      {item.governance?.fulfillment?.mutationBlockedReason ||
                        "No fulfillment mutation is available for this suborder."}
                    </p>
                  )}

                  <Link
                    to={workspaceRoutes.orderDetail(item.suborderId)}
                    className={`mt-4 ${sellerPrimaryButtonClass}`}
                  >
                    View detail
                  </Link>
                </div>
              </div>
              </SellerWorkspacePanel>
            );
          })}

          <section className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {totalPages} • {pagination.total} suborders
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
          </section>
        </div>
      ) : null}
    </div>
  );
}
