import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  QrCode,
  Upload,
} from "lucide-react";
import {
  fetchOrderCheckoutPayment,
  submitPaymentProof,
  uploadPaymentProofImage,
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

const getRemainingMs = (value, now) => {
  if (!value) return null;
  const expiresTime = new Date(value).getTime();
  if (!Number.isFinite(expiresTime)) return null;
  return expiresTime - now;
};

const isLocallyExpired = (status, expiresAt, now) => {
  const code = String(status || "").toUpperCase();
  if (code === "EXPIRED") return true;
  if (code !== "CREATED") return false;
  const remaining = getRemainingMs(expiresAt, now);
  return remaining !== null && remaining <= 0;
};

const formatCountdown = (value, now) => {
  const remaining = getRemainingMs(value, now);
  if (remaining === null) return "-";
  if (remaining <= 0) return "Expired";
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

const createEmptyForm = (amount = "") => ({
  proofImageUrl: "",
  senderName: "",
  senderBankOrWallet: "",
  transferAmount: amount,
  transferTime: "",
  note: "",
});

const copyText = async (value) => {
  const text = String(value || "").trim();
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }
  try {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "readonly");
    helper.style.position = "absolute";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(helper);
    return copied;
  } catch {
    return false;
  }
};

const resolveBuyerPaymentStep = (status) => {
  const code = String(status || "").toUpperCase();
  if (code === "PAID") {
    return {
      title: "Payment received",
      detail: "Seller has approved this store payment. The store split is now ready for processing.",
      tone: "emerald",
      Icon: CheckCircle2,
    };
  }
  if (code === "PENDING_CONFIRMATION") {
    return {
      title: "Waiting seller review",
      detail: "Proof was submitted. The seller still needs to confirm this payment for the current store.",
      tone: "amber",
      Icon: Clock3,
    };
  }
  if (code === "REJECTED") {
    return {
      title: "Payment proof rejected",
      detail:
        "Review note is available below. Pay again if needed, then upload a new proof for this same store payment.",
      tone: "rose",
      Icon: AlertTriangle,
    };
  }
  if (code === "EXPIRED") {
    return {
      title: "Payment deadline expired",
      detail:
        "This store payment missed its deadline before a valid confirmation was submitted. Checkout no longer treats this store payment as active.",
      tone: "rose",
      Icon: AlertTriangle,
    };
  }
  return {
    title: "Scan QR code to pay",
    detail: "Pay the exact amount for this store, then tap I have transferred to continue with proof submission in the same store panel.",
    tone: "sky",
    Icon: QrCode,
  };
};

function PaymentProofForm({
  paymentId,
  paymentAmount,
  storeName,
  mode,
  disabled,
  onSubmit,
  isSubmitting,
}) {
  const [form, setForm] = useState(createEmptyForm(String(Number(paymentAmount || 0) || "")));
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
  };

  const handleProofFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadedUrl = await uploadPaymentProofImage(file);
      setForm((prev) => ({ ...prev, proofImageUrl: uploadedUrl }));
      setError("");
    } catch (uploadError) {
      setError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          "Failed to upload payment proof image."
      );
    } finally {
      setIsUploading(false);
    }
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
      setForm(createEmptyForm(String(Number(paymentAmount || 0) || "")));
      setError("");
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message || "Failed to submit payment proof."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
        Upload proof for <span className="font-semibold text-slate-900">{storeName}</span>. This
        submission stays store-scoped and will wait for seller review before it is accepted.
      </div>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Proof Image *
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            <Upload className="h-3.5 w-3.5" />
            {isUploading ? "Uploading..." : "Upload proof image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="sr-only"
              disabled={disabled || isSubmitting || isUploading}
              onChange={handleProofFileUpload}
            />
          </label>
        </div>
        <textarea
          value={form.proofImageUrl}
          onChange={(event) => handleChange("proofImageUrl", event.target.value)}
          disabled={disabled || isSubmitting || isUploading}
          placeholder="Paste proof image URL or upload an image"
          className="mt-2 h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
        />
        {form.proofImageUrl ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <img
              src={form.proofImageUrl}
              alt={`Uploaded proof ${storeName}`}
              className="mx-auto max-h-44 w-full object-contain"
            />
          </div>
        ) : null}
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
        {isSubmitting
          ? "Submitting..."
          : mode === "resubmit"
            ? "Submit new payment proof"
            : "Submit payment confirmation"}
      </button>
    </form>
  );
}

export default function AccountOrderPaymentPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [copiedPaymentId, setCopiedPaymentId] = useState(null);
  const [proofIntent, setProofIntent] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["account", "order", "payment", id],
    queryFn: () => fetchOrderCheckoutPayment(id),
    enabled: Boolean(id),
  });

  const proofMutation = useMutation({
    mutationFn: ({ paymentId, payload }) => submitPaymentProof(paymentId, payload),
    onSuccess: async (_, variables) => {
      setProofIntent((current) => ({
        ...current,
        [variables.paymentId]: false,
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "order", "payment", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", "grouped", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", "my"] }),
        queryClient.invalidateQueries({ queryKey: ["payment", variables.paymentId] }),
      ]);
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const order = data?.data;
  const groups = Array.isArray(order?.groups) ? order.groups : [];

  useEffect(() => {
    if (groups.length === 0) return;
    const hasLocalExpiry = groups.some((group) =>
      isLocallyExpired(group.payment?.status, group.payment?.expiresAt, now)
    );
    if (!hasLocalExpiry) return;
    const timeout = window.setTimeout(() => {
      refetch();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [groups, now, refetch]);

  const groupedStats = useMemo(() => {
    const expiringCount = groups.filter((group) =>
      isLocallyExpired(group.payment?.status, group.payment?.expiresAt, now)
    ).length;
    return { expiringCount };
  }, [groups, now]);

  const fromCheckout = searchParams.get("checkoutCreated") === "true";

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
  if (!order) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Order payment view not found.
      </div>
    );
  }

  const handleSubmitProof = async (paymentId, payload) =>
    proofMutation.mutateAsync({ paymentId, payload });

  const handleCopyAmount = async (paymentId, amount) => {
    const ok = await copyText(String(Number(amount || 0)));
    setCopiedPaymentId(ok ? paymentId : null);
    if (ok) {
      window.setTimeout(() => {
        setCopiedPaymentId((current) => (current === paymentId ? null : current));
      }, 1800);
    }
  };

  return (
    <div className="space-y-6">
      {fromCheckout ? (
        <div className="rounded-[28px] border border-sky-200 bg-sky-50/90 p-4 text-sm text-sky-900">
          Order created successfully. Scan the QR code for each store below, pay the exact amount,
          then click <span className="font-semibold">I have transferred</span> to continue to the
          confirmation form.
        </div>
      ) : null}

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

      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <QrCode className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Scan QR code to pay
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Pay by store, then submit proof by store
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {order.checkoutMode === "MULTI_STORE"
                ? "This order is split across stores. Pay each store with its own QRIS panel and submit proof inside the matching store card below."
                : "This order uses one store-scoped QRIS destination. Pay the exact amount below, then continue with proof submission in the same panel."}
            </p>
            {groupedStats.expiringCount > 0 ? (
              <p className="mt-2 text-sm leading-6 text-rose-700">
                One or more store payments have already passed the payment deadline and are no
                longer accepting new confirmation.
              </p>
            ) : null}
          </div>
        </div>
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
          const expired = isLocallyExpired(payment?.status, payment?.expiresAt, now);
          const currentStatus = expired
            ? "EXPIRED"
            : payment?.status || group.paymentStatus || "UNPAID";
          const canSubmitProof =
            Boolean(payment?.id) &&
            (currentStatus === "CREATED" || currentStatus === "REJECTED");
          const canTriggerTransferred =
            Boolean(payment?.id) && (currentStatus === "CREATED" || currentStatus === "REJECTED");
          const isProofIntentActive = Boolean(proofIntent[payment?.id || group.suborderId]);
          const countdown = formatCountdown(payment?.expiresAt, now);
          const step = resolveBuyerPaymentStep(currentStatus);
          const StepIcon = step.Icon;
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
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          step.tone === "emerald"
                            ? "bg-emerald-100 text-emerald-700"
                            : step.tone === "amber"
                              ? "bg-amber-100 text-amber-700"
                              : step.tone === "rose"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        <StepIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          QRIS Payment
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-slate-900">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
                      </div>
                    </div>
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
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Amount to Pay
                      </p>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-2xl font-semibold text-slate-900">
                            {formatCurrency(payment?.amount || group.totalAmount)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Pay exactly this amount for {group.storeName}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyAmount(payment?.id || group.suborderId, payment?.amount || group.totalAmount)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Copy className="h-4 w-4" />
                          {copiedPaymentId === (payment?.id || group.suborderId)
                            ? "Amount copied"
                            : "Copy amount"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Time Remaining
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{countdown}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Deadline {formatDateTime(payment?.expiresAt)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Payment Reference
                        </p>
                        <div className="mt-2 text-xs leading-6 text-slate-500">
                          <p>Reference: {payment?.internalReference || "-"}</p>
                          <p>Type: {payment?.paymentType || group.paymentMethod || "-"}</p>
                          <p>Merchant: {payment?.merchantName || group.merchantName || "-"}</p>
                          <p>Account Label: {payment?.accountName || group.accountName || "-"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {payment?.qrImageUrl ? (
                        <a
                          href={payment.qrImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Download className="h-4 w-4" />
                          Save QR image
                        </a>
                      ) : null}
                      {canTriggerTransferred ? (
                        <button
                          type="button"
                          onClick={() =>
                            setProofIntent((current) => ({
                              ...current,
                              [payment.id]: true,
                            }))
                          }
                          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          {currentStatus === "REJECTED" ? "I have paid again" : "I have transferred"}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-600">
                      {payment?.instructionText ||
                        group.paymentInstruction ||
                        "Follow the QRIS instructions for this store, then upload proof in this same store section."}
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

                  {payment?.id && isProofIntentActive && canSubmitProof ? (
                    <PaymentProofForm
                      paymentId={payment.id}
                      paymentAmount={payment.amount || group.totalAmount}
                      storeName={group.storeName}
                      mode={currentStatus === "REJECTED" ? "resubmit" : "submit"}
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

                  {payment?.id && canTriggerTransferred && !isProofIntentActive ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                      Finish the transfer for <span className="font-semibold">{group.storeName}</span>,
                      then tap <span className="font-semibold">I have transferred</span> to open the
                      confirmation form for this store-scoped payment.
                    </div>
                  ) : null}

                  {payment?.id && currentStatus === "EXPIRED" ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      The payment deadline for this store has expired. New proof submission is
                      blocked for this payment record.
                    </div>
                  ) : null}

                  {payment?.id && !canSubmitProof && currentStatus !== "EXPIRED" ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Proof submission is locked because payment status is currently{" "}
                      <span className="font-semibold text-slate-900">{currentStatus}</span>. You can
                      submit a new proof only while this store payment is in `CREATED` or after a
                      `REJECTED` review.
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
