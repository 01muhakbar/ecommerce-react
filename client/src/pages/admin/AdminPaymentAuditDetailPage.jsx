import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminPaymentAuditDetail } from "../../api/adminPaymentAudit.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
  ProofReviewBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";
import {
  getSplitOperationalBridge,
  getSplitOperationalFinality,
  getSplitOperationalPayment,
  getSplitOperationalShipment,
  getSplitOperationalStatusSummary,
} from "../../utils/splitOperationalTruth.ts";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const renderStatusTransition = (log) => {
  const oldLabel = log?.oldStatusMeta?.label || log?.oldStatus || null;
  const nextLabel = log?.newStatusMeta?.label || log?.newStatus || "-";
  if (!oldLabel) return nextLabel;
  return `${oldLabel} -> ${nextLabel}`;
};

const getToneBadgeClass = (tone) => {
  const value = String(tone || "").trim().toLowerCase();
  if (value === "amber") return "bg-amber-100 text-amber-700";
  if (value === "sky") return "bg-sky-100 text-sky-700";
  if (value === "indigo") return "bg-indigo-100 text-indigo-700";
  if (value === "emerald") return "bg-emerald-100 text-emerald-700";
  if (value === "rose") return "bg-rose-100 text-rose-700";
  if (value === "orange") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-700";
};

function StatusMetaBadge({ label, tone, prefix = "" }) {
  const text = String(label || "-").trim() || "-";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getToneBadgeClass(tone)}`}
    >
      {prefix ? `${prefix} ${text}` : text}
    </span>
  );
}

const NOT_CONFIRMED_HELPER =
  "Not confirmed groups unpaid, expired, failed, and cancelled store splits into one compatibility bucket.";

const getSuborderPaymentSummary = (suborder) => {
  const payment = getSplitOperationalPayment(suborder);
  const shipment = getSplitOperationalShipment(suborder);
  const bridge = getSplitOperationalBridge(suborder);
  const summary = getSplitOperationalStatusSummary(suborder);

  if (payment.status === "PAID" && suborder?.paidAt) {
    return `Paid ${formatDateTime(suborder.paidAt)}`;
  }
  if (bridge.shipmentBlockedReason) return bridge.shipmentBlockedReason;
  if (summary?.description) return summary.description;
  if (shipment.statusMeta?.description) return shipment.statusMeta.description;
  return `Payment ${payment.statusMeta?.label || payment.status || "-"}`;
};

const getSuborderOperationalDescription = (suborder) => {
  const summary = getSplitOperationalStatusSummary(suborder);
  const payment = getSplitOperationalPayment(suborder);
  const shipment = getSplitOperationalShipment(suborder);
  const bridge = getSplitOperationalBridge(suborder);
  const finality = getSplitOperationalFinality(suborder);

  if (finality.isFinalNegative) {
    return (
      summary?.description ||
      shipment.blockedReason ||
      shipment.statusMeta?.description ||
      payment.statusMeta?.description ||
      "This store split is closed in a final-negative state."
    );
  }
  if (bridge.shipmentBlockedReason) return bridge.shipmentBlockedReason;
  return (
    summary?.description ||
    payment.statusMeta?.description ||
    shipment.statusMeta?.description ||
    "-"
  );
};

const summarizeOperationalCounts = (suborders) =>
  (Array.isArray(suborders) ? suborders : []).reduce(
    (acc, suborder) => {
      const payment = getSplitOperationalPayment(suborder);
      const summary = getSplitOperationalStatusSummary(suborder);
      const finality = getSplitOperationalFinality(suborder);

      if (payment.status === "PAID") acc.paidSuborders += 1;
      else if (payment.status === "PENDING_CONFIRMATION") acc.pendingSuborders += 1;
      else acc.unpaidSuborders += 1;

      if (summary?.lane === "SHIPMENT" && !finality.isFinalNegative) {
        acc.shipmentLaneSuborders += 1;
      }
      if (finality.isFinalNegative) {
        acc.finalNegativeSuborders += 1;
      }

      return acc;
    },
    {
      paidSuborders: 0,
      pendingSuborders: 0,
      unpaidSuborders: 0,
      shipmentLaneSuborders: 0,
      finalNegativeSuborders: 0,
    }
  );

export default function AdminPaymentAuditDetailPage() {
  const { orderId } = useParams();
  const auditQuery = useQuery({
    queryKey: ["admin", "payment-audit", "detail", orderId],
    queryFn: () => fetchAdminPaymentAuditDetail(orderId),
    enabled: Boolean(orderId),
  });

  if (!orderId) {
    return <div className="text-sm text-slate-500">Invalid audit order id.</div>;
  }

  if (auditQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading audit detail...
      </div>
    );
  }

  if (auditQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {auditQuery.error?.response?.data?.message ||
          auditQuery.error?.message ||
          "Failed to load payment audit detail."}
      </div>
    );
  }

  const detail = auditQuery.data;
  if (!detail) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Audit detail not found.
      </div>
    );
  }

  const parent = detail.parent;
  const operationalCounts = summarizeOperationalCounts(detail.suborders);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <p className="text-sm text-slate-500">Payment Audit Detail</p>
          <h1 className="text-[22px] font-semibold text-slate-800">{parent.orderNumber}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CheckoutModeBadge mode={parent.checkoutMode} />
            <span className="text-sm text-slate-500">Buyer {parent.customerName}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PaymentStatusBadge
            status={parent.paymentStatus}
            label={parent.paymentStatusMeta?.label}
            tone={parent.paymentStatusMeta?.tone}
            prefix="Parent"
          />
          <StatusMetaBadge
            label={parent.orderStatusMeta?.label || parent.orderStatus}
            tone={parent.orderStatusMeta?.tone}
            prefix="Order"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <h2 className="text-base font-semibold text-slate-900">Parent Order Summary</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buyer</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{parent.customerName}</p>
                {parent.buyer?.email ? <p>{parent.buyer.email}</p> : null}
                {parent.customerPhone ? <p>{parent.customerPhone}</p> : null}
                {parent.customerAddress ? <p>{parent.customerAddress}</p> : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totals</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>Items: {parent.summary.totalItems}</p>
                <p>Subtotal: {formatCurrency(parent.summary.subtotalAmount)}</p>
                <p>Shipping: {formatCurrency(parent.summary.shippingAmount)}</p>
                <p>Service Fee: {formatCurrency(parent.summary.serviceFeeAmount)}</p>
                <p className="font-semibold text-slate-900">
                  Grand Total: {formatCurrency(parent.summary.grandTotal)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Paid Splits
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {operationalCounts.paidSuborders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Under Review
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {operationalCounts.pendingSuborders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Not Confirmed
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {operationalCounts.unpaidSuborders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rejected Proofs
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {detail.counts.rejectedPayments}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">{NOT_CONFIRMED_HELPER}</p>
          {operationalCounts.shipmentLaneSuborders > 0 ||
          operationalCounts.finalNegativeSuborders > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              {operationalCounts.shipmentLaneSuborders > 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Shipment lane {operationalCounts.shipmentLaneSuborders}
                </span>
              ) : null}
              {operationalCounts.finalNegativeSuborders > 0 ? (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                  Final-negative {operationalCounts.finalNegativeSuborders}
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <h2 className="text-base font-semibold text-slate-900">Audit Context</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>Invoice: {parent.invoiceNo || parent.orderNumber}</p>
            <p>Checkout Mode: {parent.checkoutMode}</p>
            <p>Payment Method: {parent.paymentMethod || "-"}</p>
            <p>Created: {formatDateTime(parent.createdAt)}</p>
            <p>Updated: {formatDateTime(parent.updatedAt)}</p>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>{parent.paymentStatusMeta?.description || "Parent payment meta is unavailable."}</p>
            <p>{parent.orderStatusMeta?.description || "Parent order meta is unavailable."}</p>
            <p>
              Parent badges stay aggregate. Store split cards below are the operational truth for
              split payment and split shipment state.
            </p>
          </div>
          {detail.split.checkoutMode === "LEGACY" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This order predates split-payment flow. Audit is limited to legacy parent order data.
            </div>
          ) : null}
        </section>
      </div>

      <div className="space-y-4">
        {detail.suborders.map((suborder) => {
          const summary = getSplitOperationalStatusSummary(suborder);
          const payment = getSplitOperationalPayment(suborder);
          const shipment = getSplitOperationalShipment(suborder);
          const bridge = getSplitOperationalBridge(suborder);
          const finality = getSplitOperationalFinality(suborder);

          return (
            <section
              key={suborder.suborderId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {suborder.suborderNumber}
                    </h2>
                    <StatusMetaBadge
                      label={summary?.label || summary?.code || "Operational status"}
                      tone={summary?.tone}
                      prefix={summary?.lane === "SHIPMENT" ? "Shipment Lane" : "Payment Lane"}
                    />
                    <PaymentStatusBadge
                      status={payment.status}
                      label={payment.statusMeta?.label}
                      tone={payment.statusMeta?.tone}
                      prefix="Split Payment"
                    />
                    <StatusMetaBadge
                      label={shipment.statusMeta?.label || shipment.status}
                      tone={shipment.statusMeta?.tone}
                      prefix="Shipment"
                    />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {suborder.store.name} • Store ID {suborder.store.id || "-"} •{" "}
                    {getSuborderPaymentSummary(suborder)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {getSuborderOperationalDescription(suborder)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {bridge.currentLane ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        Current lane {bridge.currentLane}
                      </span>
                    ) : null}
                    {bridge.shipmentBlocked ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                        Shipment blocked
                      </span>
                    ) : null}
                    {finality.isFinalNegative ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                        Final-negative split
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Store Split Total
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(suborder.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment Profile
                    </p>
                    {suborder.paymentProfile ? (
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p>Provider: {suborder.paymentProfile.providerCode}</p>
                        <p>Type: {suborder.paymentProfile.paymentType}</p>
                        <p>Account: {suborder.paymentProfile.accountName}</p>
                        <p>Merchant: {suborder.paymentProfile.merchantName}</p>
                        <p>Merchant ID: {suborder.paymentProfile.merchantId || "-"}</p>
                        <p>Status: {suborder.paymentProfile.verificationStatus}</p>
                        <p>Active: {suborder.paymentProfile.isActive ? "Yes" : "No"}</p>
                        {suborder.paymentProfile.instructionText ? (
                          <p>Instruction: {suborder.paymentProfile.instructionText}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No payment profile snapshot found.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Items
                    </p>
                    <div className="mt-3 space-y-3">
                      {suborder.items.map((item) => (
                        <div
                          key={`${suborder.suborderId}-${item.id || item.productId}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-xs text-slate-500">
                              {item.qty} × {formatCurrency(item.price)}
                              {item.sku ? ` • SKU ${item.sku}` : ""}
                            </p>
                          </div>
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(item.totalPrice)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {suborder.payments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      {finality.isFinalNegative
                        ? "No payment records remain attached. This store split is already closed in a final-negative state."
                        : bridge.shipmentBlockedReason ||
                          "No payment records are attached to this store split yet."}
                    </div>
                  ) : null}

                  {suborder.payments.map((paymentRecord) => (
                    <div
                      key={paymentRecord.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Payment
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {paymentRecord.internalReference}
                          </p>
                        </div>
                        <PaymentStatusBadge
                          status={paymentRecord.status}
                          label={paymentRecord.statusMeta?.label}
                          tone={paymentRecord.statusMeta?.tone}
                          prefix="Payment"
                        />
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                        <p>Channel: {paymentRecord.paymentChannel}</p>
                        <p>Type: {paymentRecord.paymentType}</p>
                        <p>Amount: {formatCurrency(paymentRecord.amount)}</p>
                        <p>Paid At: {formatDateTime(paymentRecord.paidAt)}</p>
                        <p>Expires: {formatDateTime(paymentRecord.expiresAt)}</p>
                        <p>Proof Submitted: {paymentRecord.proofSubmitted ? "Yes" : "No"}</p>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {paymentRecord.statusMeta?.description || "-"}
                      </p>

                      {paymentRecord.proof ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-slate-900">Latest Proof</p>
                            <ProofReviewBadge
                              status={paymentRecord.proof.reviewStatus}
                              label={paymentRecord.proof.reviewMeta?.label}
                              prefix="Proof"
                            />
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <p>Sender: {paymentRecord.proof.senderName}</p>
                            <p>Wallet/Bank: {paymentRecord.proof.senderBankOrWallet}</p>
                            <p>
                              Transfer Amount: {formatCurrency(paymentRecord.proof.transferAmount)}
                            </p>
                            <p>Transfer Time: {formatDateTime(paymentRecord.proof.transferTime)}</p>
                            <p>Buyer Note: {paymentRecord.proof.note || "-"}</p>
                            <p>Review Note: {paymentRecord.proof.reviewNote || "-"}</p>
                            <p>
                              Review Status:{" "}
                              {paymentRecord.proof.reviewMeta?.label ||
                                paymentRecord.proof.reviewStatus}
                            </p>
                            <p>Uploaded By: {paymentRecord.proof.uploadedByName || "-"}</p>
                            <p>Reviewed By: {paymentRecord.proof.reviewedByName || "-"}</p>
                            <p>Reviewed At: {formatDateTime(paymentRecord.proof.reviewedAt)}</p>
                            {paymentRecord.proof.proofImageUrl ? (
                              <a
                                href={paymentRecord.proof.proofImageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-sm font-semibold text-emerald-700 underline"
                              >
                                Open proof image
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                          No payment proof found for this payment.
                        </div>
                      )}

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            Payment Status Timeline
                          </p>
                          <span className="text-xs font-medium text-slate-500">
                            {(paymentRecord.logs || []).length} event
                            {(paymentRecord.logs || []).length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {Array.isArray(paymentRecord.logs) && paymentRecord.logs.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {paymentRecord.logs.map((log) => (
                              <div
                                key={`${paymentRecord.id}-log-${log.id}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-900">
                                    {renderStatusTransition(log)}
                                  </p>
                                  <span className="text-xs text-slate-500">
                                    {formatDateTime(log.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                  {log.actorType}
                                  {log.actorName ? ` • ${log.actorName}` : ""}
                                  {log.actorId ? ` • ID ${log.actorId}` : ""}
                                </p>
                                {log.newStatusMeta?.description ? (
                                  <p className="mt-2 text-sm text-slate-600">
                                    {log.newStatusMeta.description}
                                  </p>
                                ) : null}
                                {log.note ? (
                                  <p className="mt-2 text-sm text-slate-600">{log.note}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            No payment activity logs yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/online-store/payment-audit"
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Payment Audit
        </Link>
        <Link
          to="/admin/orders"
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Open Admin Orders
        </Link>
      </div>
    </div>
  );
}
