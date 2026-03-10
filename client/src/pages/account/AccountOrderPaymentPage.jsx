import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  fetchOrderCheckoutPayment,
  submitPaymentProof,
} from "../../api/orderPayments.ts";
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

const createEmptyForm = () => ({
  proofImageUrl: "",
  senderName: "",
  senderBankOrWallet: "",
  transferAmount: "",
  transferTime: "",
  note: "",
});

function PaymentProofForm({ paymentId, disabled, onSubmit, isSubmitting }) {
  const [form, setForm] = useState(createEmptyForm());
  const [error, setError] = useState("");

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (disabled || isSubmitting) return;

    const proofImageUrl = String(form.proofImageUrl || "").trim();
    const senderName = String(form.senderName || "").trim();
    const senderBankOrWallet = String(form.senderBankOrWallet || "").trim();
    const transferAmount = Number(form.transferAmount);
    const transferTimeValue = String(form.transferTime || "").trim();

    if (!proofImageUrl || !senderName || !senderBankOrWallet || transferAmount < 1 || !transferTimeValue) {
      setError("Please complete all required proof fields.");
      return;
    }

    const transferDate = new Date(transferTimeValue);
    if (Number.isNaN(transferDate.getTime())) {
      setError("Transfer time is invalid.");
      return;
    }
    const isoTransferTime = transferDate.toISOString();

    try {
      await onSubmit(paymentId, {
        proofImageUrl,
        senderName,
        senderBankOrWallet,
        transferAmount,
        transferTime: isoTransferTime,
        note: String(form.note || "").trim(),
      });
      setForm(createEmptyForm());
      setError("");
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message || "Failed to submit payment proof."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Proof Image URL / Data URL *
        </label>
        <textarea
          value={form.proofImageUrl}
          onChange={(event) => handleChange("proofImageUrl", event.target.value)}
          disabled={disabled || isSubmitting}
          placeholder="Paste proof image URL or data URL"
          className="mt-2 h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sender Name *
          </label>
          <input
            type="text"
            value={form.senderName}
            onChange={(event) => handleChange("senderName", event.target.value)}
            disabled={disabled || isSubmitting}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bank / Wallet *
          </label>
          <input
            type="text"
            value={form.senderBankOrWallet}
            onChange={(event) => handleChange("senderBankOrWallet", event.target.value)}
            disabled={disabled || isSubmitting}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Transfer Amount *
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.transferAmount}
            onChange={(event) => handleChange("transferAmount", event.target.value)}
            disabled={disabled || isSubmitting}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Transfer Time *
          </label>
          <input
            type="datetime-local"
            value={form.transferTime}
            onChange={(event) => handleChange("transferTime", event.target.value)}
            disabled={disabled || isSubmitting}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Note
        </label>
        <textarea
          value={form.note}
          onChange={(event) => handleChange("note", event.target.value)}
          disabled={disabled || isSubmitting}
          placeholder="Optional payment note"
          className="mt-2 h-20 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
        />
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={disabled || isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting..." : "Saya Sudah Bayar"}
      </button>
    </form>
  );
}

export default function AccountOrderPaymentPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["account", "order", "payment", id],
    queryFn: () => fetchOrderCheckoutPayment(id),
    enabled: Boolean(id),
  });

  const proofMutation = useMutation({
    mutationFn: ({ paymentId, payload }) => submitPaymentProof(paymentId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "order", "payment", id] }),
        queryClient.invalidateQueries({ queryKey: ["payment", variables.paymentId] }),
      ]);
    },
  });

  if (!id) {
    return <div className="text-sm text-slate-500">Invalid order id.</div>;
  }

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading payment groups...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error?.response?.data?.message || "Failed to load grouped payment details."}
      </div>
    );
  }

  const order = data?.data;
  if (!order) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Order payment view not found.
      </div>
    );
  }

  const handleSubmitProof = async (paymentId, payload) =>
    proofMutation.mutateAsync({ paymentId, payload });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Payment by Store</p>
          <h1 className="text-2xl font-bold text-slate-900">{order.invoiceNo || order.ref}</h1>
          <div className="mt-2">
            <CheckoutModeBadge mode={order.checkoutMode} />
          </div>
        </div>
        <PaymentStatusBadge status={order.paymentStatus} prefix="Parent" />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{order.summary.totalItems}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatCurrency(order.summary.subtotalAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatCurrency(order.summary.shippingAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grand Total</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatCurrency(order.summary.grandTotal)}
          </p>
        </div>
      </div>

      {order.checkoutMode === "LEGACY" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This order was created before split-payment flow was enabled. No per-store proof upload
          is available for this legacy order.
        </div>
      ) : null}

      <div className="space-y-5">
        {order.groups.map((group) => {
          const payment = group.payment;
          const currentStatus = payment?.status || group.paymentStatus || "UNPAID";
          const canSubmitProof = Boolean(payment?.id) && currentStatus === "CREATED";
          return (
            <section
              key={`${group.suborderId || group.storeId || group.storeName}`}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{group.storeName}</h2>
                    <PaymentStatusBadge status={group.paymentStatus} prefix="Suborder" />
                    <PaymentStatusBadge status={currentStatus} prefix="Payment" />
                    {payment?.proof?.reviewStatus ? (
                      <ProofReviewBadge
                        status={payment.proof.reviewStatus}
                        prefix="Proof"
                      />
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Suborder {group.suborderNumber || "-"} • Fulfillment {group.fulfillmentStatus}
                  </p>
                  {group.warning ? (
                    <p className="mt-2 text-sm text-amber-700">{group.warning}</p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Store Total
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(group.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Items
                    </p>
                    <div className="mt-3 space-y-3">
                      {group.items.map((item) => (
                        <div
                          key={`${group.suborderId || group.storeId}-${item.productId}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-xs text-slate-500">
                              {item.qty} × {formatCurrency(item.price)}
                            </p>
                          </div>
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Subtotal
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatCurrency(group.subtotalAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Shipping
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatCurrency(group.shippingAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payment Amount
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatCurrency(payment?.amount || group.totalAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      QRIS Payment
                    </p>
                    {payment?.qrImageUrl ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
                        <img
                          src={payment.qrImageUrl}
                          alt={`QRIS ${group.storeName}`}
                          className="mx-auto max-h-60 w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                        QRIS image is not available for this payment.
                      </div>
                    )}
                    <div className="mt-3 text-xs text-slate-500">
                      <p>Reference: {payment?.internalReference || "-"}</p>
                      <p>Type: {payment?.paymentType || group.paymentMethod || "-"}</p>
                      <p>Expires: {formatDateTime(payment?.expiresAt)}</p>
                    </div>
                  </div>

                  {payment?.proof ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Submitted Proof
                      </p>
                      <div className="mt-3 space-y-1.5">
                        <p>Sender: {payment.proof.senderName}</p>
                        <p>Wallet/Bank: {payment.proof.senderBankOrWallet}</p>
                        <p>Amount: {formatCurrency(payment.proof.transferAmount)}</p>
                        <p>Transfer Time: {formatDateTime(payment.proof.transferTime)}</p>
                        <div>
                          <ProofReviewBadge
                            status={payment.proof.reviewStatus}
                            prefix="Review"
                          />
                        </div>
                        {payment.proof.note ? <p>Note: {payment.proof.note}</p> : null}
                        {payment.proof.reviewNote ? (
                          <p>Review Note: {payment.proof.reviewNote}</p>
                        ) : null}
                        {payment.proof.reviewedAt ? (
                          <p>Reviewed At: {formatDateTime(payment.proof.reviewedAt)}</p>
                        ) : null}
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
                  ) : null}

                  {payment?.id ? (
                    <PaymentProofForm
                      paymentId={payment.id}
                      disabled={!canSubmitProof}
                      isSubmitting={
                        proofMutation.isPending &&
                        proofMutation.variables?.paymentId === payment.id
                      }
                      onSubmit={handleSubmitProof}
                    />
                  ) : null}

                  {!payment?.id ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Payment record is not available for this group yet.
                    </div>
                  ) : null}

                  {payment?.id && !canSubmitProof ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Proof submission is locked because payment status is currently{" "}
                      <span className="font-semibold text-slate-900">{currentStatus}</span>.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to={`/user/my-orders/${id}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Order Detail
        </Link>
        <Link
          to="/user/my-orders"
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Orders
        </Link>
      </div>
    </div>
  );
}
