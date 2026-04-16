import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/axios.ts";
import { fetchOrderCheckoutPayment } from "../../api/orderPayments.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
  ProofReviewBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";
import {
  getFirstEnabledOrderContractAction,
  getOrderContractSummary,
  isOrderContractFinal,
} from "../../utils/orderContract.ts";
import {
  getGroupedPaymentReadModel,
  isGroupedPaymentFinal,
} from "../../utils/groupedPaymentReadModel.ts";
import { getOrderTruthStatus } from "../../utils/orderTruth.js";
import { ENABLE_MULTISTORE_SHIPMENT_MVP } from "../../config/featureFlags.js";
import { normalizeShipmentList } from "../../utils/shipmentReadModel.ts";
import { getBuyerShipmentPresentation } from "../../utils/buyerShipmentPresentation.js";
import {
  getSplitOperationalPayment,
  getSplitOperationalShipment,
  getSplitOperationalStatusSummary,
  isSplitOperationallyFinal,
} from "../../utils/splitOperationalTruth.ts";
import { getSplitAttentionStatus } from "../../utils/splitOrderAggregateTruth.js";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
} from "../../components/primitives/state/index.js";

const fetchOrder = async (orderId) => {
  const { data } = await api.get(`/store/orders/my/${orderId}`);
  return data;
};

const money = (value) => formatCurrency(Number(value || 0));

const statusStyles = (status = "") => {
  const s = String(status).toLowerCase();
  if (s.includes("emerald")) return "bg-emerald-100 text-emerald-700";
  if (s.includes("indigo")) return "bg-blue-100 text-blue-700";
  if (s.includes("sky") || s.includes("amber"))
    return "bg-amber-100 text-amber-700";
  if (s.includes("rose") || s.includes("orange")) return "bg-rose-100 text-rose-700";
  if (s.includes("stone")) return "bg-slate-100 text-slate-600";
  if (s.includes("deliver")) return "bg-emerald-100 text-emerald-700";
  if (s.includes("ship")) return "bg-blue-100 text-blue-700";
  if (s.includes("process") || s.includes("pending"))
    return "bg-amber-100 text-amber-700";
  if (s.includes("cancel") || s.includes("fail")) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const isGroupOperationallyFinal = (group) => isSplitOperationallyFinal(group);

const shouldPollGroupedOrder = (groupedOrder) => {
  if (!groupedOrder || typeof groupedOrder !== "object") return false;
  if (!isOrderContractFinal(groupedOrder?.contract)) return true;
  const groups = Array.isArray(groupedOrder.groups) ? groupedOrder.groups : [];
  return groups.some((group) => !isGroupOperationallyFinal(group));
};

export default function AccountOrderDetailPage() {
  const { id } = useParams();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["account", "orders", id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const order = query.state.data?.data ?? query.state.data?.data?.data ?? null;
      return !isOrderContractFinal(order?.contract) ? 15000 : false;
    },
  });
  const groupedQuery = useQuery({
    queryKey: ["account", "orders", "grouped", id],
    queryFn: () => fetchOrderCheckoutPayment(id),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const groupedOrder = query.state.data?.data ?? null;
      return shouldPollGroupedOrder(groupedOrder) ? 15000 : false;
    },
  });

  if (!id) {
    return (
      <UiEmptyState
        title="Invalid order id"
        description="Open this page from My Orders so the buyer detail lane can load the right order."
        actions={
          <Link
            to="/user/my-orders"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to orders
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return <UiSkeleton variant="invoice" rows={5} />;
  }

  if (isError) {
    return (
      <UiErrorState
        title="Failed to load order details."
        message={
          error?.response?.data?.message ||
          error?.message ||
          "Buyer order detail could not be loaded right now."
        }
        onRetry={() => refetch()}
      />
    );
  }

  const order = data?.data ?? data?.data?.data ?? null;
  if (!order) {
    return (
      <UiEmptyState
        title="Order not found"
        description="The selected buyer order is no longer available from this link."
        actions={
          <Link
            to="/user/my-orders"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to orders
          </Link>
        }
      />
    );
  }

  const orderRef = order.invoiceNo || order.ref || `#${order.id}`;
  const discountValue = order.discount ?? order.discountAmount ?? 0;
  const subtotalValue = order.subtotal ?? 0;
  const groupedOrder = groupedQuery.data?.data ?? null;
  const effectiveContract = groupedOrder?.contract || order.contract || null;
  const parentPaymentStatus = groupedOrder?.paymentStatus || order.paymentStatus;
  const parentPaymentMeta = groupedOrder?.paymentStatusMeta || order.paymentStatusMeta || null;
  const groupedQueryErrorMessage =
    groupedQuery.error?.response?.data?.message ||
    groupedQuery.error?.message ||
    "Split payment and shipment detail is temporarily unavailable.";
  const paymentEntry = groupedOrder?.paymentEntry || order.paymentEntry || null;
  const continuePaymentAction = getFirstEnabledOrderContractAction(effectiveContract, [
    "CONTINUE_PAYMENT",
    "CONTINUE_STRIPE_PAYMENT",
  ]);
  const paymentPath =
    paymentEntry?.visible && paymentEntry?.targetPath
      ? paymentEntry.targetPath
      : continuePaymentAction?.targetPath || null;
  const paymentLabel =
    paymentEntry?.label || continuePaymentAction?.label || "Order Payment";
  const paymentHint =
    paymentEntry?.summaryLabel ||
    continuePaymentAction?.description ||
    "Payment is no longer actionable from this page.";
  const statusSummary = getOrderContractSummary(effectiveContract);
  const truthStatus = getOrderTruthStatus(
    effectiveContract ? { ...order, contract: effectiveContract } : order
  );
  const shipments = normalizeShipmentList(groupedOrder?.shipments || order.shipments);
  const splitAttentionStatus = getSplitAttentionStatus(groupedOrder?.groups || []);
  const statusLabel =
    splitAttentionStatus?.label || truthStatus.label || statusSummary?.label || order.status;
  const statusTone =
    splitAttentionStatus?.tone || truthStatus.tone || statusSummary?.tone || order.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Order</p>
          <h2 className="text-lg font-semibold text-slate-900">
            {orderRef}
          </h2>
          <p className="text-xs text-slate-500">Placed {formatDate(order.createdAt)}</p>
          {splitAttentionStatus?.description ? (
            <p className="mt-2 max-w-2xl text-xs text-slate-500">
              {splitAttentionStatus.description}
            </p>
          ) : null}
          <div className="mt-2">
            <CheckoutModeBadge mode={order.checkoutMode || groupedOrder?.checkoutMode} />
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles(
            statusTone
          )}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <div>Payment: {order.paymentMethod || "-"}</div>
            <div>
              <PaymentStatusBadge
                status={parentPaymentStatus}
                label={parentPaymentMeta?.label}
                tone={parentPaymentMeta?.tone}
                prefix="Parent"
              />
            </div>
            <div>Total: {money(order.totalAmount || 0)}</div>
            <div>Discount: {money(discountValue)}</div>
            <div>Subtotal: {money(subtotalValue)}</div>
        </div>
        {order.id && paymentPath ? (
          <div className="mt-4">
            <Link
              to={paymentPath}
              className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              {paymentLabel}
            </Link>
          </div>
        ) : order.id ? (
          <p className="mt-4 text-sm text-slate-500">
            {paymentHint}
          </p>
        ) : null}
      </div>

      {groupedQuery.isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold text-amber-900">Split detail is temporarily unavailable.</p>
          <p className="mt-1">{groupedQueryErrorMessage}</p>
          <button
            type="button"
            onClick={() => groupedQuery.refetch()}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
          >
            Retry split sync
          </button>
        </div>
      ) : null}

      {!groupedQuery.isError &&
      !groupedQuery.isLoading &&
      String(order.checkoutMode || groupedOrder?.checkoutMode || "").toUpperCase() ===
        "MULTI_STORE" &&
      !groupedOrder ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold text-amber-900">
            Parent order is available, but split payment detail has not loaded yet.
          </p>
          <p className="mt-1">
            Retry this page before using the parent summary as an operational source of truth.
          </p>
          <button
            type="button"
            onClick={() => groupedQuery.refetch()}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
          >
            Retry split sync
          </button>
        </div>
      ) : null}

      {ENABLE_MULTISTORE_SHIPMENT_MVP && shipments.length > 0 ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Shipment Summary</h3>
              <p className="mt-1 text-xs text-slate-500">
                Shipment truth per store. Buyer view stays read-only on this page.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {shipments.length} shipment{shipments.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {groupedOrder?.usedLegacyFallback || order?.usedLegacyFallback
              ? "This order still reads some shipping truth through legacy compatibility fallback."
              : "This buyer lane reads the same shipment truth exposed to seller and admin."}
          </p>
          <div className="mt-4 space-y-3">
            {shipments.map((shipment) => {
              const buyerShipment = getBuyerShipmentPresentation(
                shipment.shipmentStatus,
                shipment.shipmentStatusMeta
              );

              return (
                <div
                  key={shipment.shipmentId || `shipment-${shipment.suborderId || shipment.storeId || shipment.storeName}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {shipment.storeName || shipment.suborderNumber || "Shipment"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {shipment.suborderNumber || "Shipment"} • Fee {money(shipment.shippingFee || 0)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles(
                      buyerShipment.tone || shipment.shipmentStatus
                    )}`}
                  >
                    {buyerShipment.label}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    Source:{" "}
                    <span className="font-medium text-slate-900">
                      {shipment.usedLegacyFallback ? "Legacy fallback" : "Persisted shipment"}
                    </span>
                  </div>
                  <div>
                    Tracking:{" "}
                    <span className="font-medium text-slate-900">
                      {shipment.trackingNumber || "Not assigned yet"}
                    </span>
                  </div>
                  <div>
                    Courier:{" "}
                    <span className="font-medium text-slate-900">
                      {shipment.courierService || shipment.courierCode || "Pending seller assignment"}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {buyerShipment.description ||
                    "Shipment summary is available for this store shipment."}
                </p>
                {shipment.compatibilityMatchesStorage === false ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    Shipment truth and legacy compatibility storage are not aligned yet.
                  </div>
                ) : null}
                {shipment.incompleteTrackingData ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Courier or tracking detail is still incomplete for this shipment stage.
                  </div>
                ) : null}
                {Array.isArray(shipment.trackingEvents) && shipment.trackingEvents.length > 0 ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tracking Timeline
                    </p>
                    {shipment.trackingEvents.map((event) => (
                      <div
                        key={event.eventId || `${event.status}-${event.happenedAt || "event"}`}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {event.statusMeta?.label || event.status || "Update"}
                          </p>
                          <p className="text-xs text-slate-500">{formatDate(event.happenedAt)}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {event.note || event.statusMeta?.description || "Shipment updated."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {groupedOrder ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Store Breakdown</h3>
              <p className="mt-1 text-xs text-slate-500">
                Read-only payment lifecycle by store for this order.
              </p>
            </div>
            <PaymentStatusBadge
              status={groupedOrder.paymentStatus}
              label={groupedOrder.paymentStatusMeta?.label}
              tone={groupedOrder.paymentStatusMeta?.tone}
              prefix="Parent"
            />
          </div>
          {groupedOrder.checkoutMode === "LEGACY" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Legacy order. Split payment detail is not available for this order.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {groupedOrder.groups.map((group) => {
                const splitPayment = getSplitOperationalPayment(group);
                const splitShipment = getSplitOperationalShipment(group);
                const groupStatusSummary = getSplitOperationalStatusSummary(group);
                const buyerShipment = getBuyerShipmentPresentation(
                  splitShipment.status,
                  splitShipment.statusMeta
                );
                const groupUsesShipmentLane =
                  String(groupStatusSummary?.lane || "").trim().toUpperCase() === "SHIPMENT";
                const groupStatusLabel = groupUsesShipmentLane
                  ? buyerShipment.label
                  : groupStatusSummary?.label;
                const groupStatusDescription = groupUsesShipmentLane
                  ? buyerShipment.description
                  : groupStatusSummary?.description;
                return (
                  <div
                    key={`${group.suborderId || group.storeId || group.storeName}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{group.storeName}</h4>
                          <PaymentStatusBadge
                            status={groupStatusSummary?.code || group.paymentStatus}
                            label={groupStatusSummary?.label || group.paymentStatusMeta?.label}
                            tone={groupStatusSummary?.tone || group.paymentStatusMeta?.tone}
                            prefix="Split"
                          />
                          {group.payment?.status || group.paymentReadModel ? (
                            <PaymentStatusBadge
                              status={splitPayment.status}
                              label={splitPayment.statusMeta?.label}
                              tone={splitPayment.statusMeta?.tone}
                              prefix="Payment"
                            />
                          ) : null}
                          <PaymentStatusBadge
                            status={splitShipment.status}
                            label={buyerShipment.label}
                            tone={buyerShipment.tone}
                            prefix="Shipment"
                          />
                          {group.payment?.proof?.reviewStatus ? (
                            <ProofReviewBadge
                              status={group.payment.proof.reviewStatus}
                              prefix="Proof"
                            />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.suborderNumber || "Legacy"} • {group.items.length} item
                          {group.items.length === 1 ? "" : "s"}
                        </p>
                        {group.payment?.proof?.reviewNote ? (
                          <p className="mt-2 text-sm text-slate-600">
                            Review note: {group.payment.proof.reviewNote}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">{money(group.totalAmount)}</p>
                        <p>
                          Status:{" "}
                          {groupStatusLabel ||
                            buyerShipment.label ||
                            group.fulfillmentStatusMeta?.label ||
                            group.fulfillmentStatus}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                        {group.payment?.qrImageUrl ? (
                          <img
                            src={group.payment.qrImageUrl}
                            alt={`QRIS ${group.storeName}`}
                            className="mx-auto h-28 w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-xs text-slate-500">
                            QRIS image unavailable
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <p>
                          <span className="font-semibold text-slate-900">Merchant:</span>{" "}
                          {group.payment?.merchantName || group.merchantName || "-"}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-slate-900">Account Label:</span>{" "}
                          {group.payment?.accountName || group.accountName || "-"}
                        </p>
                        <p className="mt-2 leading-6">
                          {groupStatusDescription ||
                            buyerShipment.description ||
                            group.payment?.instructionText ||
                            group.paymentInstruction ||
                            "Per-store payment instructions are available on the payment page."}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Items</h3>
        <div className="mt-3 space-y-3">
          {(order.items || []).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.quantity} × {money(item.price)}
                </p>
              </div>
              <div className="font-semibold text-slate-900">
                {money(item.lineTotal)}
              </div>
            </div>
          ))}
          {(!order.items || !order.items.length) && (
            <p className="text-sm text-slate-500">No items found.</p>
          )}
        </div>
      </div>

      <Link to="/user/my-orders" className="text-sm font-medium text-slate-700 hover:text-slate-900">
        ← Back to orders
      </Link>
    </div>
  );
}
