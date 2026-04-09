import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminOrderByInvoice, updateAdminOrderStatus } from "../../lib/adminApi.js";
import QueryState from "../../components/primitives/ui/QueryState.jsx";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";
import OrderStatusTimeline from "../../components/admin/OrderStatusTimeline.jsx";
import useAdminLocale from "../../hooks/useAdminLocale.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";
import {
  ADMIN_ORDER_ACTION_OPTIONS,
  getAdminOrderTransitionErrorMeta,
  toAdminOrderActionValue,
} from "./orderLifecyclePresentation.js";
import { ENABLE_MULTISTORE_SHIPMENT_MVP } from "../../config/featureFlags.js";

const labelize = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

const formatCoverageLabel = (value) => {
  const code = String(value || "").trim().toUpperCase();
  if (code === "ALL_PERSISTED") return "All shipments persisted";
  if (code === "PARTIAL_PERSISTED") return "Partial persisted coverage";
  if (code === "LEGACY_ONLY") return "Legacy fallback only";
  return "No shipment scope";
};

export default function OrderDetail() {
  const { invoiceNo } = useParams();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { formatDateTime, formatMoney } = useAdminLocale();
  const [status, setStatus] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const noticeTimerRef = useRef(null);
  const autoPrintDoneRef = useRef(false);

  const orderQuery = useQuery({
    queryKey: ["admin-order", invoiceNo],
    queryFn: () => fetchAdminOrderByInvoice(invoiceNo),
    enabled: Boolean(invoiceNo),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, payload }) => updateAdminOrderStatus(orderId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-order", invoiceNo] });
      qc.invalidateQueries({ queryKey: ["admin-orders"], exact: false });
      orderQuery.refetch();
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
      setErrorMessage("");
      setSuccessMessage("Berhasil memperbarui status.");
      noticeTimerRef.current = setTimeout(() => {
        setSuccessMessage("");
        noticeTimerRef.current = null;
      }, 3000);
    },
    onError: (err) => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      const errorMeta = getAdminOrderTransitionErrorMeta(err);
      const msg = [errorMeta.title, errorMeta.message, errorMeta.detail]
        .filter(Boolean)
        .join(". ");
      setSuccessMessage("");
      setErrorMessage(msg);
    },
  });

  const order =
    orderQuery.data?.data ??
    orderQuery.data?.data?.data ??
    orderQuery.data?.data?.order ??
    null;
  const items = order?.items || [];
  const currentStatus = (order?.status ?? "").toString();
  const contract = order?.contract || null;
  const selectedStatus = status;
  const norm = (value) => (value || "").toString().trim().toLowerCase();
  const currentActionStatus = toAdminOrderActionValue(order?.rawStatus || currentStatus);
  const isSameStatus = norm(selectedStatus) === norm(currentActionStatus);
  const actionOptions = Array.isArray(contract?.availableActions) && contract.availableActions.length > 0
    ? contract.availableActions
    : ADMIN_ORDER_ACTION_OPTIONS.map((option) => ({
        code: option.value,
        label: option.label,
        enabled: true,
        reason: null,
      }));
  const selectedAction = actionOptions.find((option) => option.code === selectedStatus) || null;
  const selectedDisabledReason =
    selectedAction && selectedAction.enabled === false ? selectedAction.reason || "" : "";
  const isSelectedDisabled = Boolean(selectedDisabledReason);
  const shouldAutoPrint = searchParams.get("print") === "1";

  useEffect(() => {
    if (!shouldAutoPrint) return;
    document.body.classList.add("order-print-mode");
    return () => {
      document.body.classList.remove("order-print-mode");
    };
  }, [shouldAutoPrint]);

  useEffect(() => {
    autoPrintDoneRef.current = false;
  }, [invoiceNo, shouldAutoPrint]);

  useEffect(() => {
    setStatus(currentActionStatus || "");
  }, [currentActionStatus]);
  useEffect(() => () => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!shouldAutoPrint) return;
    if (autoPrintDoneRef.current) return;
    if (orderQuery.isLoading || orderQuery.isError || !order) return;
    autoPrintDoneRef.current = true;
    const timer = setTimeout(() => {
      window.print();
    }, 350);
    return () => clearTimeout(timer);
  }, [shouldAutoPrint, orderQuery.isLoading, orderQuery.isError, order]);

  const invoiceRef =
    order?.invoiceNo || order?.invoice || order?.ref || invoiceNo || "—";
  const createdAtLabel = formatDateTime(order?.createdAt, { includeTime: false });
  const createdAtFull = formatDateTime(order?.createdAt);
  const updatedAtValue = order?.updatedAt || order?.updated_at || order?.updatedAt;
  const customerEmail = order?.customerEmail || order?.customer?.email || null;
  const paymentMethod = order?.method || order?.paymentMethod || "COD";
  const subtotal = Number(order?.subtotal || 0);
  const discount = Number(order?.discount || 0);
  const shipping = Number(order?.shipping || 0);
  const tax = Number(order?.tax || 0);
  const totalAmount = Number(order?.totalAmount || order?.total || 0);
  const customerName = order?.customerName || order?.customer?.name || "Guest";
  const customerPhone = order?.customerPhone || order?.customer?.phone || "—";
  const customerAddress =
    order?.customerAddress ||
    order?.shippingAddress ||
    order?.shipping?.address ||
    order?.customer?.address ||
    "—";
  const orderNote = String(
    order?.customerNote || order?.note || order?.notes || ""
  ).trim();
  const statusHelper =
    contract?.statusSummary?.description ||
    contract?.fulfillmentReadiness?.description ||
    "Operational order lifecycle is tracked separately from payment review.";
  const paymentStatusMeta = order?.paymentStatusMeta || contract?.paymentStatusMeta || null;
  const shipmentAuditMeta = order?.shipmentAuditMeta || null;
  const suborderShipmentSummary = Array.isArray(order?.suborderShipmentSummary)
    ? order.suborderShipmentSummary
    : [];
  const auditCoverageLabel = formatCoverageLabel(shipmentAuditMeta?.persistedCoverage);
  const auditIssues = [
    shipmentAuditMeta?.usedLegacyFallback
      ? `${shipmentAuditMeta.legacyFallbackSuborderCount || 0} suborder still uses legacy fallback`
      : null,
    Number(shipmentAuditMeta?.compatibilityMismatchCount || 0) > 0
      ? `${shipmentAuditMeta.compatibilityMismatchCount} compatibility mismatch detected`
      : null,
    Number(shipmentAuditMeta?.missingTrackingTimelineCount || 0) > 0
      ? `${shipmentAuditMeta.missingTrackingTimelineCount} shipment misses expected timeline`
      : null,
    Number(shipmentAuditMeta?.incompleteTrackingDataCount || 0) > 0
      ? `${shipmentAuditMeta.incompleteTrackingDataCount} shipment has incomplete courier or tracking data`
      : null,
  ].filter(Boolean);

  const handleCopy = async (value, label) => {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(String(value));
      setSuccessMessage(`${label} copied.`);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        setSuccessMessage("");
        noticeTimerRef.current = null;
      }, 2000);
    } catch {
      setErrorMessage("Failed to copy to clipboard.");
    }
  };

  const handlePrint = () => {
    window.print();
  };
  const isEmpty = !orderQuery.isLoading && !orderQuery.isError && !order;
  return (
    <div className="order-print-root mx-auto w-full max-w-7xl space-y-5 px-4 py-6 lg:px-6 lg:py-8">
      <div className="admin-no-print flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/admin" className="hover:text-slate-800">
          Admin
        </Link>
        <span>/</span>
        <Link to="/admin/orders" className="hover:text-slate-800">
          Orders
        </Link>
        <span>/</span>
        <span className="text-slate-700">Details</span>
      </div>

      <QueryState
        isLoading={orderQuery.isLoading}
        isError={orderQuery.isError}
        error={orderQuery.error}
        isEmpty={isEmpty}
        emptyTitle="Order tidak ditemukan"
        emptyHint="Cek kembali link / ref order."
        onRetry={() => orderQuery.refetch()}
      >
        <div className="space-y-3">
          {successMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="admin-print-area space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Order Detail
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                      Order #{invoiceRef}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Created {createdAtLabel}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                        {createdAtFull}
                      </span>
                      <OrderStatusBadge
                        status={order?.rawStatus || order?.status || "-"}
                        meta={contract?.statusSummary || null}
                      />
                      <CheckoutModeBadge mode={order?.checkoutMode} />
                      <PaymentStatusBadge
                        status={order?.paymentStatus}
                        label={paymentStatusMeta?.label}
                        tone={paymentStatusMeta?.tone}
                        prefix="Parent Payment"
                      />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                        Total {formatMoney(totalAmount)}
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm sm:max-w-xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                        Status Guidance
                      </p>
                      <p className="mt-1.5 leading-6">{statusHelper}</p>
                    </div>
                  </div>
                  <div className="admin-no-print flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(invoiceRef, "Order ref")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      Copy Ref
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Print
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 md:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Customer
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{customerName}</p>
                  {customerEmail ? <p className="mt-1 text-sm text-slate-600">{customerEmail}</p> : null}
                  <p className="mt-1 text-sm text-slate-600">{customerPhone}</p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Shipping Address
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{customerAddress}</p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Payment
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{paymentMethod}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CheckoutModeBadge mode={order?.checkoutMode} />
                    <PaymentStatusBadge
                      status={order?.paymentStatus}
                      label={paymentStatusMeta?.label}
                      tone={paymentStatusMeta?.tone}
                      prefix="Parent Payment"
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Invoice: {invoiceRef}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Payment state is tracked separately from operational order progression.
                  </p>
                  {order?.id && String(order?.checkoutMode || "LEGACY").toUpperCase() !== "LEGACY" ? (
                    <Link
                      to={`/admin/online-store/payment-audit/${order.id}`}
                      className="mt-3 inline-flex text-sm font-semibold text-emerald-700 underline underline-offset-2"
                    >
                      Open split payment audit
                    </Link>
                  ) : null}
                </article>

                {ENABLE_MULTISTORE_SHIPMENT_MVP ? (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Shipping
                    </p>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <p>
                        Summary:{" "}
                        <span className="font-semibold text-slate-900">
                          {order?.shippingStatusMeta?.label || order?.shippingStatus || "Legacy fallback"}
                        </span>
                      </p>
                      <p>
                        Shipments:{" "}
                        <span className="font-semibold text-slate-900">
                          {Number(order?.shipmentCount || 0)}
                        </span>
                      </p>
                      <p>
                        Tracking:{" "}
                        <span className="font-semibold text-slate-900">
                          {order?.hasTrackingNumber ? "Available" : "Not assigned yet"}
                        </span>
                      </p>
                      <p>
                        Coverage:{" "}
                        <span className="font-semibold text-slate-900">{auditCoverageLabel}</span>
                      </p>
                      <p>
                        Source:{" "}
                        <span className="font-semibold text-slate-900">
                          {order?.usedLegacyFallback ? "Mixed persisted + legacy fallback" : "Persisted shipment truth"}
                        </span>
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {order?.shippingStatusMeta?.description ||
                        "Shipment truth is available for audit in read-only mode."}
                    </p>
                    {auditIssues.length > 0 ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                        {auditIssues.map((issue) => (
                          <p key={issue}>{issue}</p>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
                        Shipment compatibility storage stays aligned with persisted shipping truth for this order.
                      </div>
                    )}
                  </article>
                ) : null}

                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Order Summary
                  </p>
                  <div className="mt-3 space-y-2.5 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(subtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Discount</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(discount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Shipping</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(shipping)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tax</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(tax)}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">Total</span>
                        <span className="text-lg font-bold tabular-nums text-slate-900">
                          {formatMoney(totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            {orderNote ? (
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Notes
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{orderNote}</p>
              </section>
            ) : null}

            {ENABLE_MULTISTORE_SHIPMENT_MVP &&
            Array.isArray(order?.shipments) &&
            order.shipments.length > 0 ? (
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Shipment Audit
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      Persisted shipment truth
                    </h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {order.shipments.length} shipment{order.shipments.length === 1 ? "" : "s"}
                  </span>
                </div>
                {suborderShipmentSummary.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {suborderShipmentSummary.map((summary) => (
                      <article
                        key={`suborder-shipment-summary-${summary.suborderId || summary.suborderNumber || summary.storeId}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {summary.storeName || summary.suborderNumber || "Store split"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {summary.suborderNumber || "Suborder"} • {summary.shipmentCount || 0} shipment
                              {Number(summary.shipmentCount || 0) === 1 ? "" : "s"}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {summary.shippingStatusMeta?.label || summary.shippingStatus || "Unknown"}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-600">
                          <p>
                            Source:{" "}
                            <span className="font-semibold text-slate-900">
                              {summary.usedLegacyFallback ? "Legacy fallback" : "Persisted shipment"}
                            </span>
                          </p>
                          <p>
                            Compatibility storage:{" "}
                            <span className="font-semibold text-slate-900">
                              {summary.storedFulfillmentStatusMeta?.label ||
                                summary.storedFulfillmentStatus ||
                                "-"}
                            </span>
                          </p>
                          <p>
                            Canonical compatibility:{" "}
                            <span className="font-semibold text-slate-900">
                              {summary.compatibilityFulfillmentStatusMeta?.label ||
                                summary.compatibilityFulfillmentStatus ||
                                "-"}
                            </span>
                          </p>
                          <p>
                            Latest event:{" "}
                            <span className="font-semibold text-slate-900">
                              {summary.latestTrackingEvent?.statusMeta?.label ||
                                summary.latestTrackingEvent?.status ||
                                "No timeline yet"}
                            </span>
                          </p>
                        </div>
                        <div
                          className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                            summary.compatibilityMatchesStorage === false
                              ? "border border-rose-200 bg-rose-50 text-rose-700"
                              : "border border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {summary.compatibilityMatchesStorage === false
                            ? "Compatibility storage drift detected between shipment truth and stored fulfillment status."
                            : summary.usedLegacyFallback
                              ? "This suborder still reads shipping truth from legacy fallback."
                              : "Shipment truth and compatibility storage are aligned for this suborder."}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3">
                  {order.shipments.map((shipment) => (
                    <article
                      key={shipment.shipmentId || `shipment-${shipment.suborderId || shipment.storeId || shipment.storeName}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {shipment.storeName || shipment.suborderNumber || "Shipment"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {shipment.suborderNumber || "-"} • Tracking {shipment.trackingNumber || "Pending"}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {shipment.shipmentStatusMeta?.label || shipment.shipmentStatus}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                        <p>
                          Source:{" "}
                          <span className="font-semibold text-slate-900">
                            {shipment.usedLegacyFallback ? "Legacy fallback" : "Persisted shipment"}
                          </span>
                        </p>
                        <p>
                          Courier:{" "}
                          <span className="font-semibold text-slate-900">
                            {shipment.courierService || shipment.courierCode || "Pending"}
                          </span>
                        </p>
                        <p>
                          Compatibility storage:{" "}
                          <span className="font-semibold text-slate-900">
                            {shipment.storedFulfillmentStatusMeta?.label ||
                              shipment.storedFulfillmentStatus ||
                              "-"}
                          </span>
                        </p>
                        <p>
                          Timeline events:{" "}
                          <span className="font-semibold text-slate-900">
                            {shipment.trackingEventCount || shipment.trackingEvents?.length || 0}
                          </span>
                        </p>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {shipment.shipmentStatusMeta?.description || "Shipment timeline is available below."}
                      </p>
                      {shipment.compatibilityMatchesStorage === false ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          Compatibility storage drift detected for this shipment.
                        </div>
                      ) : null}
                      {shipment.incompleteTrackingData ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Shipment status requires courier or tracking detail follow-up.
                        </div>
                      ) : null}
                      {shipment.missingTrackingTimeline ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Shipment status looks operational but tracking timeline is still empty.
                        </div>
                      ) : null}
                      {Array.isArray(shipment.trackingEvents) && shipment.trackingEvents.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {shipment.trackingEvents.map((event) => (
                            <div
                              key={event.eventId || `${event.status}-${event.happenedAt || "event"}`}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  {event.statusMeta?.label || event.status || "Update"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatDateTime(event.happenedAt)}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-slate-600">
                                {event.note || event.statusMeta?.description || "Shipment updated."}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Items</h2>
                <p className="text-xs font-medium text-slate-500">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                {items.length === 0 ? (
                  <div className="bg-white p-6 text-sm text-slate-500">
                    No items found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3.5">Item</th>
                          <th className="px-4 py-3.5 text-right">Price</th>
                          <th className="px-4 py-3.5 text-right">Qty</th>
                          <th className="px-4 py-3.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => {
                          const name =
                            item.product?.name || item.name || `Product #${item.productId}`;
                          const qty = item.quantity || item.qty || 0;
                          const price = item.price || item.unitPrice || 0;
                          const amount = item.lineTotal || price * qty;
                          return (
                            <tr
                              key={item.id || `${item.productId}-${index}`}
                              className="border-t border-slate-100 transition hover:bg-slate-50"
                            >
                              <td className="px-4 py-3.5 font-medium text-slate-900">
                                {name}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                                {formatMoney(price)}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                                {qty}
                              </td>
                              <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                                {formatMoney(amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="admin-no-print space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Current Status
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <OrderStatusBadge
                  status={order?.rawStatus || order?.status || "-"}
                  meta={contract?.statusSummary || null}
                />
                <PaymentStatusBadge
                  status={order?.paymentStatus}
                  label={paymentStatusMeta?.label}
                  tone={paymentStatusMeta?.tone}
                  prefix="Parent Payment"
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {statusHelper}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Last update: {formatDateTime(updatedAtValue || order?.createdAt)}
              </p>
            </section>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                    Action Panel
                  </div>
                  <div className="text-sm font-semibold text-slate-900">Update Status</div>
                  <p className="text-sm text-slate-500">
                    Update the operational order lifecycle. Payment review stays on the parent payment lane.
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  <select
                    value={selectedStatus}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    <option value="">Select status</option>
                    {actionOptions.map((option) => (
                      <option
                        key={option.code}
                        value={option.code}
                        disabled={Boolean(option.enabled === false)}
                      >
                        {labelize(option.label)}
                      </option>
                    ))}
                  </select>
                  {actionOptions.filter((option) => option.enabled === false).length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">Unavailable now</p>
                      <div className="mt-2 space-y-1.5">
                        {actionOptions
                          .filter((option) => option.enabled === false)
                          .map((action) => (
                          <p key={action.code} className="leading-6">
                            <span className="font-medium text-slate-900">
                              {labelize(action.label)}
                            </span>
                            : {action.reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selectedDisabledReason ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p className="font-semibold text-rose-900">Action unavailable</p>
                      <p className="mt-1 leading-6">{selectedDisabledReason}</p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({
                        orderId: order.id,
                        payload: { status: selectedStatus },
                      })
                    }
                    disabled={
                      updateMutation.isPending ||
                      !selectedStatus ||
                      isSameStatus ||
                      isSelectedDisabled
                    }
                    className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Status"}
                  </button>
                  <p className="text-xs leading-5 text-slate-500">
                    Backend remains the final gate for seller suborder readiness and payment
                    validity. Use split payment audit for multi-store parent orders before
                    forcing the parent lifecycle forward.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy(invoiceRef, "Invoice")}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Copy Invoice No.
                  </button>
                  <Link
                    to={`/order/${encodeURIComponent(invoiceRef)}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Open Customer Invoice
                  </Link>
                </div>
              </div>

              <OrderStatusTimeline
                status={order?.status}
                createdAt={order?.createdAt}
                updatedAt={updatedAtValue}
              />
            </div>
          </aside>
        </div>
      </QueryState>
    </div>
  );
}
