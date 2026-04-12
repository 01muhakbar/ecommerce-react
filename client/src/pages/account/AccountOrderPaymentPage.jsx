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
import {
  getSplitOperationalBridge,
  getSplitOperationalEnabledBuyerAction,
  getSplitOperationalFinality,
  getSplitOperationalPayment,
  getSplitOperationalShipment,
  getSplitOperationalStatusSummary,
} from "../../utils/splitOperationalTruth.ts";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
} from "../../components/primitives/state/index.js";

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

const OPEN_PAYMENT_STATUSES = new Set(["CREATED", "REJECTED"]);
const REVIEW_PAYMENT_STATUSES = new Set(["PENDING_CONFIRMATION"]);
const CLOSED_PAYMENT_STATUSES = new Set(["FAILED", "EXPIRED", "CANCELLED"]);

const summarizeGroupedPayments = (groups) => {
  const summary = {
    openCount: 0,
    reviewCount: 0,
    paidCount: 0,
    closedCount: 0,
    unavailableCount: 0,
    earliestOpenExpiresAt: null,
  };

  (Array.isArray(groups) ? groups : []).forEach((group) => {
    const readModel = getGroupedPaymentReadModel(group);
    const operationalPayment = getSplitOperationalPayment(group);
    const status = String(operationalPayment.status || readModel.status || "").toUpperCase();
    const expiresAt = readModel.expiresAt ? new Date(readModel.expiresAt).getTime() : Number.NaN;

    if (!group?.payment?.id && status === "UNPAID") {
      summary.unavailableCount += 1;
      return;
    }

    if (status === "PAID") {
      summary.paidCount += 1;
      return;
    }

    if (REVIEW_PAYMENT_STATUSES.has(status)) {
      summary.reviewCount += 1;
      return;
    }

    if (OPEN_PAYMENT_STATUSES.has(status)) {
      summary.openCount += 1;
      if (Number.isFinite(expiresAt)) {
        summary.earliestOpenExpiresAt =
          summary.earliestOpenExpiresAt === null
            ? readModel.expiresAt
            : new Date(summary.earliestOpenExpiresAt).getTime() > expiresAt
              ? readModel.expiresAt
              : summary.earliestOpenExpiresAt;
      }
      return;
    }

    if (CLOSED_PAYMENT_STATUSES.has(status)) {
      summary.closedCount += 1;
      return;
    }

    summary.unavailableCount += 1;
  });

  const summaryParts = [];
  if (summary.openCount > 0) summaryParts.push(`${summary.openCount} open`);
  if (summary.reviewCount > 0) summaryParts.push(`${summary.reviewCount} under review`);
  if (summary.paidCount > 0) summaryParts.push(`${summary.paidCount} confirmed`);
  if (summary.closedCount > 0) summaryParts.push(`${summary.closedCount} closed`);
  if (summary.unavailableCount > 0) summaryParts.push(`${summary.unavailableCount} unavailable`);

  return {
    ...summary,
    summaryText: summaryParts.length > 0 ? summaryParts.join(" • ") : "No store payment snapshot",
  };
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
      detail:
        "Seller has approved this payment. The store split is now preparing for shipment and waiting for seller packing.",
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

const resolveBuyerOperationalStep = (summary, paymentStatus) => {
  const baseStep = resolveBuyerPaymentStep(paymentStatus);
  if (!summary || typeof summary !== "object") return baseStep;
  return {
    ...baseStep,
    title: summary.label || baseStep.title,
    detail: summary.description || baseStep.detail,
    tone: summary.tone || baseStep.tone,
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

function SummaryMetricCard({
  eyebrow,
  value,
  helper = null,
  tone = "slate",
  featured = false,
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white/80";

  return (
    <div
      className={`rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur ${toneClass} ${
        featured ? "lg:min-h-[152px]" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {eyebrow}
      </p>
      <p className={`mt-3 font-semibold tracking-tight text-slate-900 ${featured ? "text-3xl" : "text-xl"}`}>
        {value}
      </p>
      {helper ? <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p> : null}
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
          const operationalPayment = getSplitOperationalPayment(group);
          const operationalSummary = getSplitOperationalStatusSummary(group);
          const status = operationalPayment.status || readModel.status;
          const progress = getBuyerPaymentProgress(status);
          const statusLabel =
            operationalSummary?.label ||
            operationalPayment.statusMeta?.label ||
            readModel.statusMeta?.label ||
            progress.summary;
          return (
            <div key={`${group.suborderId || group.storeId}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{group.storeName}</p>
                  <p className="mt-1 text-xs text-slate-500">{statusLabel}</p>
                </div>
                <PaymentStatusBadge
                  status={status}
                  label={statusLabel}
                  tone={operationalSummary?.tone || operationalPayment.statusMeta?.tone || readModel.statusMeta?.tone}
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
  const operationalPayment = getSplitOperationalPayment(group);
  const operationalShipment = getSplitOperationalShipment(group);
  const operationalBridge = getSplitOperationalBridge(group);
  const operationalFinality = getSplitOperationalFinality(group);
  const operationalSummary = getSplitOperationalStatusSummary(group);
  const submitProofAction = getSplitOperationalEnabledBuyerAction(
    group,
    "SUBMIT_PAYMENT_PROOF"
  );
  const cancelAction = getSplitOperationalEnabledBuyerAction(group, "CANCEL_PAYMENT");
  const currentStatus = operationalPayment.status || readModel.status;
  const canSubmitProof =
    Boolean(payment?.id) &&
    Boolean(submitProofAction?.enabled ?? readModel.proofActionability?.canStartProof);
  const canCancel =
    Boolean(payment?.id) &&
    Boolean(cancelAction?.enabled ?? readModel.cancelability?.canCancel);
  const cancelReason =
    cancelAction?.reason ||
    operationalPayment.cancelability?.reason ||
    readModel.cancelability?.reason ||
    null;
  const isProofIntentActive = Boolean(proofIntent[payment?.id || group.suborderId]);
  const countdown = formatCountdown(readModel.expiresAt, now);
  const step = resolveBuyerOperationalStep(operationalSummary, currentStatus);
  const progress = getBuyerPaymentProgress(currentStatus);
  const expiryMeta = getExpiryMeta(currentStatus, readModel.expiresAt, now);
  const currentStatusLabel =
    operationalSummary?.label ||
    operationalPayment.statusMeta?.label ||
    readModel.statusMeta?.label ||
    currentStatus;
  const StepIcon = step.Icon;
  const paymentAmount = payment?.amount || group.totalAmount;
  const paymentReference = payment?.internalReference || "-";
  const paymentMerchant = payment?.merchantName || group.merchantName || "-";
  const paymentAccountLabel = payment?.accountName || group.accountName || "-";

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{group.storeName}</h2>
            <PaymentStatusBadge
              status={operationalSummary?.code || group.paymentStatus}
              label={operationalSummary?.label || group.paymentStatusMeta?.label}
              tone={operationalSummary?.tone || group.paymentStatusMeta?.tone}
              prefix="Split"
            />
            <PaymentStatusBadge
              status={currentStatus}
              label={operationalPayment.statusMeta?.label || readModel.statusMeta?.label}
              tone={operationalPayment.statusMeta?.tone || readModel.statusMeta?.tone}
              prefix="Payment"
            />
            <PaymentStatusBadge
              status={operationalShipment.status}
              label={operationalShipment.statusMeta?.label}
              tone={operationalShipment.statusMeta?.tone}
              prefix="Shipment"
            />
            {payment?.proof?.reviewStatus ? (
              <ProofReviewBadge status={payment.proof.reviewStatus} prefix="Proof" />
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Suborder {group.suborderNumber || "-"} • Shipment{" "}
            {operationalShipment.statusMeta?.label ||
              operationalShipment.status ||
              group.fulfillmentStatusMeta?.label ||
              group.fulfillmentStatus}
          </p>
          {operationalBridge.shipmentBlockedReason ? (
            <p className="mt-2 text-sm text-slate-500">{operationalBridge.shipmentBlockedReason}</p>
          ) : null}
          {group.warning ? <p className="mt-2 text-sm text-amber-700">{group.warning}</p> : null}
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4 text-left shadow-sm xl:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Store Split Total
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {formatCurrency(paymentAmount)}
          </p>
          <p className="mt-2 text-xs text-slate-500">Keep the transfer amount exact for this split.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="space-y-4">
          <div className="rounded-[30px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 p-4 sm:p-5">
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

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Amount to Pay
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  {formatCurrency(paymentAmount)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Pay exactly this amount for {group.storeName}.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className={`rounded-[22px] border px-4 py-4 ${expiryMeta.cardClass}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Time Remaining
                    </p>
                    <p className={`mt-2 text-2xl font-semibold ${expiryMeta.textClass}`}>{countdown}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Deadline {formatDateTime(readModel.expiresAt)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Destination
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {payment?.paymentType || group.paymentMethod || "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{paymentMerchant}</p>
                    <p className="mt-1 text-xs text-slate-500">{paymentAccountLabel}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <PaymentDetailField
                    label="Reference"
                    value={paymentReference}
                    mono
                    copyKey={`reference-${payment?.id || group.suborderId}`}
                    copiedKey={copiedPaymentId}
                    onCopyValue={onCopyAmount}
                    helper="Use this reference if you need to match payment and proof review."
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyAmount(payment?.id || group.suborderId, paymentAmount)}
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
                            amount: paymentAmount,
                            reference: paymentReference,
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
                          amount: paymentAmount,
                          reference: paymentReference,
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
                  <div className={`mt-3 rounded-[22px] border px-4 py-3 text-sm ${expiryMeta.cardClass} ${expiryMeta.textClass}`}>
                    {expiryMeta.message}
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                {payment?.qrImageUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenQrPreview({
                        paymentId: payment.id,
                        storeName: group.storeName,
                        amount: paymentAmount,
                        reference: paymentReference,
                        qrImageUrl: payment.qrImageUrl,
                      })
                    }
                    className="block w-full bg-gradient-to-br from-slate-50 to-white p-5 transition hover:bg-slate-50"
                  >
                    <img
                      src={payment.qrImageUrl}
                      alt={`QRIS ${group.storeName}`}
                      className="mx-auto max-h-72 w-full object-contain"
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

            <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600 shadow-sm">
              {payment?.instructionText ||
                group.paymentInstruction ||
                "Use this QRIS destination for the matching store only, then submit proof from the same payment card."}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
            <div className="mt-3 space-y-3">
              {group.items.map((item) => (
                <div
                  key={`${group.suborderId || group.storeId}-${item.productId}`}
                  className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
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
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(group.subtotalAmount)}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(group.shippingAmount)}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment Amount
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(paymentAmount)}
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment Details
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <PaymentDetailField
                label="Reference"
                value={paymentReference}
                mono
                copyKey={`sidebar-reference-${payment?.id || group.suborderId}`}
                copiedKey={copiedPaymentId}
                onCopyValue={onCopyAmount}
              />
              <PaymentDetailField
                label="Type"
                value={payment?.paymentType || group.paymentMethod || "-"}
              />
              <PaymentDetailField label="Merchant" value={paymentMerchant} />
              <PaymentDetailField label="Account Label" value={paymentAccountLabel} />
            </div>
          </div>

          {payment?.proof ? (
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
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
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Payment record is not available for this group yet.
            </div>
          ) : null}

          {payment?.id && canSubmitProof && !isProofIntentActive ? (
            <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Finish the transfer for <span className="font-semibold">{group.storeName}</span>, then tap{" "}
              <span className="font-semibold">I have transferred</span> to open the confirmation form.
            </div>
          ) : null}

          {payment?.id && operationalSummary?.code === "EXPIRED" ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              The payment deadline for this store has expired. New proof submission is blocked.
            </div>
          ) : null}

          {payment?.id && operationalSummary?.code === "FAILED" ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              This transaction is already closed by the latest backend payment state. Transfer and proof actions are no longer available for this store split.
            </div>
          ) : null}

          {payment?.id && operationalSummary?.code === "CANCELLED" ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              This transaction was cancelled. Transfer and proof actions are no longer available for this payment.
            </div>
          ) : null}

          {payment?.id &&
          !canSubmitProof &&
          !operationalFinality.isFinalNegative &&
          operationalSummary?.code !== "EXPIRED" &&
          operationalSummary?.code !== "FAILED" &&
          operationalSummary?.code !== "CANCELLED" ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {submitProofAction?.reason ||
                operationalSummary?.description ||
                operationalBridge.shipmentBlockedReason ||
                (
                  <>
                    Proof submission is locked because payment status is currently{" "}
                    <span className="font-semibold text-slate-900">{currentStatusLabel}</span>.
                  </>
                )}
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

  const groupedStats = useMemo(() => summarizeGroupedPayments(groups), [groups]);
  const hasMissingSplitPayload =
    Boolean(order) &&
    String(order?.checkoutMode || "").toUpperCase() !== "LEGACY" &&
    groups.length === 0;

  const handleSubmitProof = async (paymentId, payload) =>
    proofMutation.mutateAsync({ paymentId, payload });

  const handleCopyAmount = async (paymentId, value) => {
    const ok = await copyText(String(value ?? "").trim());
    setCopiedPaymentId(ok ? paymentId : null);
    if (ok) {
      window.setTimeout(() => {
        setCopiedPaymentId((current) => (current === paymentId ? null : current));
      }, 1800);
    }
  };

  if (!id) {
    return (
      <UiEmptyState
        title="Invalid order id"
        description="Open this page from your order history so the payment lane can load the right store splits."
        actions={
          <Link
            to="/user/my-orders"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Orders
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
        title="Failed to load grouped payment details."
        message={
          error?.response?.data?.message ||
          error?.message ||
          "The latest split payment and shipment truth could not be loaded."
        }
        onRetry={() => refetch()}
      />
    );
  }

  if (!order) {
    return (
      <UiEmptyState
        title="Order payment view not found"
        description="This payment lane is unavailable for the selected order. Open your order list and choose an active payment flow."
        actions={
          <Link
            to="/user/my-orders"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Orders
          </Link>
        }
      />
    );
  }

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

      {groupedStats.reviewCount > 0 ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {groupedStats.reviewCount} store split payment
          {groupedStats.reviewCount === 1 ? " is" : "s are"} under review. If seller confirmation
          or settlement sync feels delayed, refresh this page before retrying any manual action.
        </div>
      ) : null}

      {hasMissingSplitPayload ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold text-amber-900">
            Store split payment details are temporarily unavailable.
          </p>
          <p className="mt-1">
            Parent order was loaded, but split payment panels are still missing from the latest
            payload. Retry the page before asking buyer or seller to continue.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
          >
            Retry payment sync
          </button>
        </div>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/50 p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] xl:items-start">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Order Payment
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                {order.invoiceNo || order.ref}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <CheckoutModeBadge mode={order.checkoutMode} />
                <PaymentStatusBadge
                  status={order.paymentStatus}
                  label={order.paymentStatusMeta?.label}
                  tone={order.paymentStatusMeta?.tone}
                  prefix="Parent"
                />
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                {order.checkoutMode === "MULTI_STORE"
                  ? "This order is split by store. Pay each store total from its own panel so seller review, shipment readiness, and proof tracking stay aligned."
                  : "Use the store payment panel below to pay the exact amount, then submit proof from the same section."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryMetricCard
                eyebrow="Grand Total"
                value={formatCurrency(order.summary.grandTotal)}
                helper="Total buyer obligation for this order."
                tone="emerald"
                featured
              />
              <SummaryMetricCard
                eyebrow="Open Payment Deadline"
                value={
                  groupedStats.earliestOpenExpiresAt
                    ? formatCountdown(groupedStats.earliestOpenExpiresAt, now)
                    : "No open payment"
                }
                helper={
                  groupedStats.earliestOpenExpiresAt
                    ? formatDateTime(groupedStats.earliestOpenExpiresAt)
                    : "All store splits are already closed, confirmed, or waiting review."
                }
                tone={groupedStats.earliestOpenExpiresAt ? "sky" : "slate"}
              />
              <SummaryMetricCard
                eyebrow="Store Groups"
                value={String(groups.length)}
                helper={groupedStats.summaryText}
              />
              <SummaryMetricCard
                eyebrow="Order Created"
                value={formatDateTime(order.createdAt)}
                helper="Latest parent order timestamp."
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{order.summary.totalItems}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(order.summary.subtotalAmount)}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(order.summary.shippingAmount)}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(order.createdAt)}</p>
            </div>
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
