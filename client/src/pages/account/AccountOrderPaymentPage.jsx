import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Clock3,
  Copy,
  Download,
  Expand,
  QrCode,
  Upload,
  X,
} from "lucide-react";
import {
  cancelPaymentTransaction,
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
import {
  getGroupedPaymentReadModel,
  hasGroupedPaymentDeadlinePassed,
  shouldPollGroupedPaymentGroups,
} from "../../utils/groupedPaymentReadModel.ts";

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
    // fall through
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
      detail: "Seller has approved this payment. The store split is now ready for processing.",
      tone: "emerald",
      Icon: CheckCircle2,
    };
  }
  if (code === "PENDING_CONFIRMATION") {
    return {
      title: "Waiting seller review",
      detail: "Proof was submitted and is waiting for seller confirmation.",
      tone: "amber",
      Icon: Clock3,
    };
  }
  if (code === "REJECTED") {
    return {
      title: "Payment proof rejected",
      detail: "Review note is available below. You can pay again and submit a new proof.",
      tone: "rose",
      Icon: AlertTriangle,
    };
  }
  if (code === "FAILED") {
    return {
      title: "Payment closed",
      detail: "This payment can no longer continue. Check the latest activity and create a new payment later if needed.",
      tone: "rose",
      Icon: CircleX,
    };
  }
  if (code === "EXPIRED") {
    return {
      title: "Payment deadline expired",
      detail: "This payment already passed the deadline before final confirmation.",
      tone: "orange",
      Icon: AlertTriangle,
    };
  }
  if (code === "CANCELLED") {
    return {
      title: "Transaction cancelled",
      detail: "This payment was cancelled before final confirmation. Create a new payment later if needed.",
      tone: "slate",
      Icon: CircleX,
    };
  }
  return {
    title: "Scan QR code to pay",
    detail: "Pay the exact amount for this store, then continue with proof submission from the same card.",
    tone: "sky",
    Icon: QrCode,
  };
};

const stepToneClass = (tone) => {
  if (tone === "emerald") return "bg-emerald-100 text-emerald-700";
  if (tone === "amber") return "bg-amber-100 text-amber-700";
  if (tone === "rose") return "bg-rose-100 text-rose-700";
  if (tone === "orange") return "bg-orange-100 text-orange-700";
  if (tone === "slate") return "bg-slate-200 text-slate-700";
  return "bg-sky-100 text-sky-700";
};

const stepToneTextClass = (tone) => {
  if (tone === "emerald") return "text-emerald-700";
  if (tone === "amber") return "text-amber-700";
  if (tone === "rose" || tone === "orange") return "text-rose-700";
  if (tone === "slate") return "text-slate-700";
  return "text-sky-700";
};

const getBuyerPaymentProgress = (status) => {
  const code = String(status || "").toUpperCase();
  const steps = [
    "Payment created",
    "Waiting for transfer",
    "Under review",
    "Payment confirmed",
  ];

  if (code === "PAID") {
    return {
      steps,
      currentStep: 4,
      summary: "Confirmed",
      tone: "emerald",
      isFinal: true,
    };
  }

  if (code === "PENDING_CONFIRMATION") {
    return {
      steps,
      currentStep: 3,
      summary: "Under review",
      tone: "amber",
      isFinal: false,
    };
  }

  if (code === "REJECTED") {
    return {
      steps,
      currentStep: 2,
      summary: "Transfer needs review update",
      tone: "rose",
      isFinal: false,
    };
  }

  if (code === "FAILED") {
    return {
      steps,
      currentStep: 1,
      summary: "Closed",
      tone: "rose",
      isFinal: true,
    };
  }

  if (code === "CANCELLED") {
    return {
      steps,
      currentStep: 1,
      summary: "Cancelled",
      tone: "slate",
      isFinal: true,
    };
  }

  if (code === "EXPIRED") {
    return {
      steps,
      currentStep: 1,
      summary: "Expired",
      tone: "rose",
      isFinal: true,
    };
  }

  return {
    steps,
    currentStep: 2,
    summary: "Awaiting payment",
    tone: "sky",
    isFinal: false,
  };
};

const getExpiryMeta = (status, expiresAt, now) => {
  const code = String(status || "").toUpperCase();
  if (!expiresAt || !["CREATED", "REJECTED"].includes(code)) {
    return {
      tone: "neutral",
      message: null,
      cardClass: "border-slate-200 bg-slate-50",
      textClass: "text-slate-900",
    };
  }

  const remaining = getRemainingMs(expiresAt, now);
  if (remaining === null) {
    return {
      tone: "neutral",
      message: null,
      cardClass: "border-slate-200 bg-slate-50",
      textClass: "text-slate-900",
    };
  }

  if (remaining <= 0) {
    return {
      tone: "expired",
      message: "This payment has expired. Transfer and proof actions are closed.",
      cardClass: "border-rose-200 bg-rose-50",
      textClass: "text-rose-700",
    };
  }

  if (remaining <= 15 * 60 * 1000) {
    return {
      tone: "critical",
      message: "Less than 15 minutes left. Complete the transfer now to avoid expiry.",
      cardClass: "border-rose-200 bg-rose-50",
      textClass: "text-rose-700",
    };
  }

  if (remaining <= 60 * 60 * 1000) {
    return {
      tone: "warning",
      message: "Less than 1 hour left to complete this payment.",
      cardClass: "border-amber-200 bg-amber-50",
      textClass: "text-amber-700",
    };
  }

  return {
    tone: "neutral",
    message: null,
    cardClass: "border-slate-200 bg-slate-50",
    textClass: "text-slate-900",
  };
};

function PaymentProgressBar({ progress }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Payment Progress
        </p>
        <span className={`text-xs font-semibold ${stepToneTextClass(progress.tone)}`}>
          {progress.summary}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {progress.steps.map((label, index) => {
          const stepNumber = index + 1;
          const isDone = progress.currentStep > stepNumber || (progress.currentStep === 4 && stepNumber === 4);
          const isCurrent = progress.currentStep === stepNumber && !progress.isFinal;
          return (
            <div key={label} className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    isDone || isCurrent
                      ? progress.tone === "emerald"
                        ? "bg-emerald-500"
                        : progress.tone === "amber"
                          ? "bg-amber-500"
                          : progress.tone === "rose"
                            ? "bg-rose-500"
                            : progress.tone === "slate"
                              ? "bg-slate-500"
                              : "bg-sky-500"
                      : "bg-transparent"
                  }`}
                  style={{ width: isDone || isCurrent ? "100%" : "0%" }}
                />
              </div>
              <p className={`text-xs ${isDone || isCurrent ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StorePaymentStepList({ groups }) {
  if (!Array.isArray(groups) || groups.length === 0) return null;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Store Payment Steps
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {groups.length > 1 ? "Track each store split separately" : "Track this store payment"}
          </h2>
        </div>
        {groups.length > 1 ? (
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
            {groups.length} stores
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const readModel = getGroupedPaymentReadModel(group);
          const status = readModel.status;
          const progress = getBuyerPaymentProgress(status);
          const statusLabel = readModel.statusMeta?.label || progress.summary;
          return (
            <div key={`${group.suborderId || group.storeId}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{group.storeName}</p>
                  <p className="mt-1 text-xs text-slate-500">{statusLabel}</p>
                </div>
                <PaymentStatusBadge
                  status={status}
                  label={readModel.statusMeta?.label}
                  tone={readModel.statusMeta?.tone}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentDetailField({
  label,
  value,
  helper = null,
  mono = false,
  copyKey = null,
  copiedKey = null,
  onCopyValue = null,
}) {
  const resolvedValue = String(value || "-").trim() || "-";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 flex items-start gap-2">
        <p
          className={`min-w-0 flex-1 break-words text-sm font-semibold text-slate-900 ${
            mono ? "font-mono text-[13px]" : ""
          }`}
          title={resolvedValue}
        >
          {resolvedValue}
        </p>
        {copyKey && onCopyValue ? (
          <button
            type="button"
            onClick={() => onCopyValue(copyKey, resolvedValue)}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copiedKey === copyKey ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  );
}

function OverlayDialog({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-[32px] bg-white p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Payment Page
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

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
  const formRef = useRef(null);
  const senderNameRef = useRef(null);

  useEffect(() => {
    formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        senderNameRef.current?.focus?.();
      }, 120);
    });
  }, []);

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

    try {
      await onSubmit(paymentId, {
        proofImageUrl,
        senderName,
        senderBankOrWallet,
        transferAmount,
        transferTime: transferDate.toISOString(),
        note: String(form.note || "").trim(),
      });
      setForm(createEmptyForm(String(Number(paymentAmount || 0) || "")));
      setError("");
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to submit payment proof.");
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
        Upload proof for <span className="font-semibold text-slate-900">{storeName}</span>. This
        confirmation stays store-scoped and will wait for seller review.
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
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sender Name *
          </span>
          <input
            ref={senderNameRef}
            type="text"
            value={form.senderName}
            onChange={(event) => handleChange("senderName", event.target.value)}
            disabled={disabled || isSubmitting}
            placeholder="Sender account name"
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bank / Wallet *
          </span>
          <input
            type="text"
            value={form.senderBankOrWallet}
            onChange={(event) => handleChange("senderBankOrWallet", event.target.value)}
            disabled={disabled || isSubmitting}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Transfer Amount *
          </span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.transferAmount}
            onChange={(event) => handleChange("transferAmount", event.target.value)}
            disabled={disabled || isSubmitting}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Transfer Time *
          </span>
          <input
            type="datetime-local"
            value={form.transferTime}
            onChange={(event) => handleChange("transferTime", event.target.value)}
            disabled={disabled || isSubmitting}
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note</span>
        <textarea
          value={form.note}
          onChange={(event) => handleChange("note", event.target.value)}
          disabled={disabled || isSubmitting}
          placeholder="Optional payment note"
          className="mt-2 h-20 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
        />
      </label>
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

function PaymentGroupCard({
  group,
  now,
  copiedPaymentId,
  onCopyAmount,
  proofIntent,
  setProofIntent,
  proofMutation,
  onSubmitProof,
  onOpenQrPreview,
  onOpenCancel,
}) {
  const payment = group.payment;
  const readModel = getGroupedPaymentReadModel(group);
  const currentStatus = readModel.status;
  const canSubmitProof =
    Boolean(payment?.id) && Boolean(readModel.proofActionability?.canStartProof);
  const canCancel = Boolean(payment?.id) && Boolean(readModel.cancelability?.canCancel);
  const cancelReason = readModel.cancelability?.reason || null;
  const isProofIntentActive = Boolean(proofIntent[payment?.id || group.suborderId]);
  const countdown = formatCountdown(readModel.expiresAt, now);
  const step = resolveBuyerPaymentStep(currentStatus);
  const progress = getBuyerPaymentProgress(currentStatus);
  const expiryMeta = getExpiryMeta(currentStatus, readModel.expiresAt, now);
  const currentStatusLabel = readModel.statusMeta?.label || currentStatus;
  const StepIcon = step.Icon;

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{group.storeName}</h2>
            <PaymentStatusBadge
              status={group.paymentStatus}
              label={group.paymentStatusMeta?.label}
              tone={group.paymentStatusMeta?.tone}
              prefix="Suborder"
            />
            <PaymentStatusBadge
              status={currentStatus}
              label={readModel.statusMeta?.label}
              tone={readModel.statusMeta?.tone}
              prefix="Payment"
            />
            {payment?.proof?.reviewStatus ? (
              <ProofReviewBadge status={payment.proof.reviewStatus} prefix="Proof" />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Suborder {group.suborderNumber || "-"} • Fulfillment {group.fulfillmentStatusMeta?.label || group.fulfillmentStatus}
          </p>
          {group.warning ? <p className="mt-2 text-sm text-amber-700">{group.warning}</p> : null}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Store Total
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCurrency(group.totalAmount)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${stepToneClass(step.tone)}`}
              >
                <StepIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  QRIS Payment
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Amount to Pay
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {formatCurrency(payment?.amount || group.totalAmount)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Pay exactly this amount for {group.storeName}.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className={`rounded-2xl border px-3 py-3 ${expiryMeta.cardClass}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Time Remaining
                    </p>
                    <p className={`mt-2 text-lg font-semibold ${expiryMeta.textClass}`}>{countdown}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Deadline {formatDateTime(readModel.expiresAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Reference
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                      {payment?.internalReference || "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {payment?.merchantName || group.merchantName || "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onCopyAmount(payment?.id || group.suborderId, payment?.amount || group.totalAmount)
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedPaymentId === (payment?.id || group.suborderId) ? "Amount copied" : "Copy amount"}
                  </button>
                  {payment?.qrImageUrl ? (
                    <>
                      <button
                        type="button"
                        data-testid={`payment-qr-preview-${payment.id}`}
                        onClick={() =>
                          onOpenQrPreview({
                            paymentId: payment.id,
                            storeName: group.storeName,
                            amount: payment.amount || group.totalAmount,
                            reference: payment.internalReference || "-",
                            qrImageUrl: payment.qrImageUrl,
                          })
                        }
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Expand className="h-4 w-4" />
                        <span className="sm:hidden">Mobile QR mode</span>
                        <span className="hidden sm:inline">View large QR</span>
                      </button>
                      <a
                        href={payment.qrImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4" />
                        Save QR image
                      </a>
                    </>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canSubmitProof ? (
                    <button
                      type="button"
                      onClick={() =>
                        setProofIntent((current) => ({
                          ...current,
                          [payment.id]: true,
                        }))
                      }
                      className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      {currentStatus === "REJECTED" ? "I have paid again" : "I have transferred"}
                    </button>
                  ) : null}
                  {canCancel ? (
                    <button
                      type="button"
                      data-testid={`payment-cancel-${payment.id}`}
                      onClick={() =>
                        onOpenCancel({
                          paymentId: payment.id,
                          storeName: group.storeName,
                          amount: payment.amount || group.totalAmount,
                          reference: payment.internalReference || "-",
                        })
                      }
                      className="inline-flex h-11 items-center justify-center rounded-full border border-rose-200 px-5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      Cancel Transaction
                    </button>
                  ) : null}
                </div>

                {cancelReason && !canCancel ? (
                  <p className="mt-3 text-sm text-slate-500">{cancelReason}</p>
                ) : null}

                {expiryMeta.message ? (
                  <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${expiryMeta.cardClass} ${expiryMeta.textClass}`}>
                    {expiryMeta.message}
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                {payment?.qrImageUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenQrPreview({
                        paymentId: payment.id,
                        storeName: group.storeName,
                        amount: payment.amount || group.totalAmount,
                        reference: payment.internalReference || "-",
                        qrImageUrl: payment.qrImageUrl,
                      })
                    }
                    className="block w-full bg-slate-50 p-4 transition hover:bg-slate-100"
                  >
                    <img
                      src={payment.qrImageUrl}
                      alt={`QRIS ${group.storeName}`}
                      className="mx-auto max-h-64 w-full object-contain"
                    />
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                      <Expand className="h-3.5 w-3.5" />
                      Tap to enlarge
                    </div>
                  </button>
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center px-4 py-10 text-center text-sm text-slate-500">
                    QRIS image is not available for this payment.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <PaymentProgressBar progress={progress} />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
              {payment?.instructionText ||
                group.paymentInstruction ||
                "Use this QRIS destination for the matching store only, then submit proof from the same payment card."}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
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
                  <div className="font-semibold text-slate-900">{formatCurrency(item.lineTotal)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(group.subtotalAmount)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping</p>
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment Details
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex items-start justify-between gap-3">
                <span>Reference</span>
                <span className="max-w-[16rem] break-all text-right font-medium text-slate-900">
                  {payment?.internalReference || "-"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span>Type</span>
                <span className="text-right font-medium text-slate-900">
                  {payment?.paymentType || group.paymentMethod || "-"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span>Merchant</span>
                <span className="text-right font-medium text-slate-900">
                  {payment?.merchantName || group.merchantName || "-"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span>Account Label</span>
                <span className="text-right font-medium text-slate-900">
                  {payment?.accountName || group.accountName || "-"}
                </span>
              </div>
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
                  <ProofReviewBadge status={payment.proof.reviewStatus} prefix="Review" />
                </div>
                {payment.proof.note ? <p>Note: {payment.proof.note}</p> : null}
                {payment.proof.reviewNote ? <p>Review Note: {payment.proof.reviewNote}</p> : null}
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
              isSubmitting={proofMutation.isPending && proofMutation.variables?.paymentId === payment.id}
              onSubmit={onSubmitProof}
            />
          ) : null}

          {!payment?.id ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Payment record is not available for this group yet.
            </div>
          ) : null}

          {payment?.id && canSubmitProof && !isProofIntentActive ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Finish the transfer for <span className="font-semibold">{group.storeName}</span>, then tap{" "}
              <span className="font-semibold">I have transferred</span> to open the confirmation form.
            </div>
          ) : null}

          {payment?.id && currentStatus === "EXPIRED" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              The payment deadline for this store has expired. New proof submission is blocked.
            </div>
          ) : null}

          {payment?.id && currentStatus === "CANCELLED" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              This transaction was cancelled. Transfer and proof actions are no longer available for this payment.
            </div>
          ) : null}

          {payment?.id && !canSubmitProof && currentStatus !== "EXPIRED" && currentStatus !== "CANCELLED" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Proof submission is locked because payment status is currently{" "}
              <span className="font-semibold text-slate-900">{currentStatusLabel}</span>.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function AccountOrderPaymentPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [copiedPaymentId, setCopiedPaymentId] = useState(null);
  const [proofIntent, setProofIntent] = useState({});
  const [qrPreview, setQrPreview] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["account", "order", "payment", id],
    queryFn: () => fetchOrderCheckoutPayment(id),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const groups = query.state.data?.data?.groups;
      return shouldPollGroupedPaymentGroups(groups) ? 15000 : false;
    },
  });

  const proofMutation = useMutation({
    mutationFn: ({ paymentId, payload }) => submitPaymentProof(paymentId, payload),
    onSuccess: async (_, variables) => {
      setActionNotice({
        tone: "emerald",
        message: "Payment proof submitted successfully. Waiting for seller review.",
      });
      setProofIntent((current) => ({ ...current, [variables.paymentId]: false }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "order", "payment", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", "grouped", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", "my"] }),
        queryClient.invalidateQueries({ queryKey: ["payment", variables.paymentId] }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (paymentId) => cancelPaymentTransaction(paymentId),
    onSuccess: async (_, paymentId) => {
      setCancelTarget(null);
      setProofIntent((current) => ({ ...current, [paymentId]: false }));
      setActionNotice({
        tone: "slate",
        message: "Transaction cancelled successfully. You can create a new payment later if needed.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "order", "payment", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", "grouped", id] }),
        queryClient.invalidateQueries({ queryKey: ["account", "orders", "my"] }),
        queryClient.invalidateQueries({ queryKey: ["payment", paymentId] }),
      ]);
    },
    onError: (mutationError) => {
      setActionNotice({
        tone: "rose",
        message:
          mutationError?.response?.data?.message ||
          mutationError?.message ||
          "Failed to cancel this transaction.",
      });
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const order = data?.data;
  const groups = Array.isArray(order?.groups) ? order.groups : [];
  const fromCheckout = searchParams.get("checkoutCreated") === "true";

  useEffect(() => {
    if (groups.length === 0) return;
    const hasLocalExpiry = groups.some((group) =>
      hasGroupedPaymentDeadlinePassed(group, now)
    );
    if (!hasLocalExpiry) return;
    const timeout = window.setTimeout(() => {
      refetch();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [groups, now, refetch]);

  const groupedStats = useMemo(() => {
    const expiredCount = groups.filter(
      (group) => getGroupedPaymentReadModel(group).status === "EXPIRED"
    ).length;
    return { expiredCount };
  }, [groups]);

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

  const primaryPayment = groups[0]?.payment ?? null;
  const primaryPaymentReadModel = groups[0] ? getGroupedPaymentReadModel(groups[0]) : null;

  return (
    <div className="space-y-6">
      {fromCheckout ? (
        <div className="rounded-[28px] border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900">
          Order created successfully. Pay each store from this page, then continue with proof submission only for the store payment you have completed.
        </div>
      ) : null}

      {actionNotice ? (
        <div
          className={`rounded-[28px] border px-4 py-3 text-sm ${
            actionNotice.tone === "rose"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : actionNotice.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {actionNotice.message}
        </div>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Order Payment
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {order.invoiceNo || order.ref}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CheckoutModeBadge mode={order.checkoutMode} />
              <PaymentStatusBadge
                status={order.paymentStatus}
                label={order.paymentStatusMeta?.label}
                tone={order.paymentStatusMeta?.tone}
                prefix="Parent"
              />
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
              {order.checkoutMode === "MULTI_STORE"
                ? "This order is split by store. Pay each store total from its own panel so seller review and status tracking stay consistent."
                : "Pay the exact store amount below, then continue with proof submission from the same panel."}
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Grand Total
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatCurrency(order.summary.grandTotal)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Deadline
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatCountdown(primaryPaymentReadModel?.expiresAt || primaryPayment?.expiresAt, now)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateTime(primaryPaymentReadModel?.expiresAt || primaryPayment?.expiresAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Store Groups
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{groups.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                {groupedStats.expiredCount > 0 ? `${groupedStats.expiredCount} expired` : "All active"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
      </section>

      {order.checkoutMode !== "LEGACY" ? <StorePaymentStepList groups={groups} /> : null}

      {order.checkoutMode === "LEGACY" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This order was created before split-payment flow was enabled. No per-store proof upload is available for this legacy order.
        </div>
      ) : null}

      <div className="space-y-5">
        {groups.map((group) => (
          <PaymentGroupCard
            key={`${group.suborderId || group.storeId || group.storeName}`}
            group={group}
            now={now}
            copiedPaymentId={copiedPaymentId}
            onCopyAmount={handleCopyAmount}
            proofIntent={proofIntent}
            setProofIntent={setProofIntent}
            proofMutation={proofMutation}
            onSubmitProof={handleSubmitProof}
            onOpenQrPreview={setQrPreview}
            onOpenCancel={setCancelTarget}
          />
        ))}
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

      <OverlayDialog
        open={Boolean(qrPreview)}
        title={qrPreview ? `${qrPreview.storeName} QRIS` : "QRIS"}
        onClose={() => setQrPreview(null)}
      >
        {qrPreview ? (
          <div data-testid="payment-qr-modal" className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <img
                src={qrPreview.qrImageUrl}
                alt={`Large QRIS ${qrPreview.storeName}`}
                className="mx-auto max-h-[70vh] w-full object-contain"
              />
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{qrPreview.storeName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatCurrency(qrPreview.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopyAmount(`qr-modal-${qrPreview.paymentId}`, qrPreview.amount)}
                  className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Copy className="h-4 w-4" />
                  {copiedPaymentId === `qr-modal-${qrPreview.paymentId}` ? "Amount copied" : "Copy amount"}
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reference
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                  {qrPreview.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrPreview(null)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close preview
              </button>
            </div>
          </div>
        ) : null}
      </OverlayDialog>

      <OverlayDialog
        open={Boolean(cancelTarget)}
        title="Cancel transaction"
        onClose={() => {
          if (!cancelMutation.isPending) setCancelTarget(null);
        }}
      >
        {cancelTarget ? (
          <div data-testid="payment-cancel-modal" className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              Batalkan transaksi ini? Anda dapat membuat transaksi baru nanti jika masih ingin melanjutkan pembayaran.
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{cancelTarget.storeName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatCurrency(cancelTarget.amount)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reference
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                  {cancelTarget.reference}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => cancelMutation.mutate(cancelTarget.paymentId)}
                disabled={cancelMutation.isPending}
                className="inline-flex h-11 items-center justify-center rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Yes, cancel transaction"}
              </button>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelMutation.isPending}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep this payment
              </button>
            </div>
          </div>
        ) : null}
      </OverlayDialog>
    </div>
  );
}
