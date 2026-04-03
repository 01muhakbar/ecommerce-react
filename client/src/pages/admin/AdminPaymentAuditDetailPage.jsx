import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminPaymentAuditDetail } from "../../api/adminPaymentAudit.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
  ProofReviewBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";

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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{detail.counts.paidSuborders}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {detail.counts.pendingSuborders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unpaid</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {detail.counts.unpaidSuborders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rejected
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {detail.counts.rejectedPayments}
              </p>
            </div>
          </div>
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
          </div>
          {detail.split.checkoutMode === "LEGACY" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This order predates split-payment flow. Audit is limited to legacy parent order data.
            </div>
          ) : null}
        </section>
      </div>

      <div className="space-y-4">
        {detail.suborders.map((suborder) => (
          <section
            key={suborder.suborderId}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{suborder.suborderNumber}</h2>
                  <PaymentStatusBadge
                    status={suborder.paymentStatus}
                    label={suborder.paymentStatusMeta?.label}
                    tone={suborder.paymentStatusMeta?.tone}
                    prefix="Suborder"
                  />
                  <StatusMetaBadge
                    label={suborder.fulfillmentStatusMeta?.label || suborder.fulfillmentStatus}
                    tone={suborder.fulfillmentStatusMeta?.tone}
                  />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {suborder.store.name} • Store ID {suborder.store.id || "-"} • Paid{" "}
                  {formatDateTime(suborder.paidAt)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {suborder.paymentStatusMeta?.description || suborder.fulfillmentStatusMeta?.description || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Store Total
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
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
                {suborder.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Payment
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {payment.internalReference}
                        </p>
                      </div>
                      <PaymentStatusBadge
                        status={payment.status}
                        label={payment.statusMeta?.label}
                        tone={payment.statusMeta?.tone}
                        prefix="Payment"
                      />
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm text-slate-700">
                      <p>Channel: {payment.paymentChannel}</p>
                      <p>Type: {payment.paymentType}</p>
                      <p>Amount: {formatCurrency(payment.amount)}</p>
                      <p>Paid At: {formatDateTime(payment.paidAt)}</p>
                      <p>Expires: {formatDateTime(payment.expiresAt)}</p>
                      <p>Proof Submitted: {payment.proofSubmitted ? "Yes" : "No"}</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {payment.statusMeta?.description || "-"}
                    </p>
                    {payment.proof ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">Latest Proof</p>
                          <ProofReviewBadge
                            status={payment.proof.reviewStatus}
                            label={payment.proof.reviewMeta?.label}
                            prefix="Proof"
                          />
                        </div>
                        <div className="mt-3 space-y-1.5">
                          <p>Sender: {payment.proof.senderName}</p>
                          <p>Wallet/Bank: {payment.proof.senderBankOrWallet}</p>
                          <p>Transfer Amount: {formatCurrency(payment.proof.transferAmount)}</p>
                          <p>Transfer Time: {formatDateTime(payment.proof.transferTime)}</p>
                          <p>Buyer Note: {payment.proof.note || "-"}</p>
                          <p>Review Note: {payment.proof.reviewNote || "-"}</p>
                          <p>Review Status: {payment.proof.reviewMeta?.label || payment.proof.reviewStatus}</p>
                          <p>Uploaded By: {payment.proof.uploadedByName || "-"}</p>
                          <p>Reviewed By: {payment.proof.reviewedByName || "-"}</p>
                          <p>Reviewed At: {formatDateTime(payment.proof.reviewedAt)}</p>
                          {payment.proof.proofImageUrl ? (
                            <a
                              href={payment.proof.proofImageUrl}
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
                          {(payment.logs || []).length} event
                          {(payment.logs || []).length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {Array.isArray(payment.logs) && payment.logs.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {payment.logs.map((log) => (
                            <div
                              key={`${payment.id}-log-${log.id}`}
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
                              {log.note ? <p className="mt-2 text-sm text-slate-600">{log.note}</p> : null}
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
        ))}
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
