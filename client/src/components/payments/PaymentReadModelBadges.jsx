const baseClass =
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

const BADGE_STYLES = {
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  slate: "bg-slate-100 text-slate-700",
  slateStrong: "bg-slate-200 text-slate-700",
  rose: "bg-rose-100 text-rose-700",
  orange: "bg-orange-100 text-orange-700",
  teal: "bg-teal-100 text-teal-700",
};

const normalize = (value, fallback = "") =>
  String(value || fallback)
    .toUpperCase()
    .trim();

const toLabelText = (value, fallback = "") =>
  String(value || fallback).trim();

const getToneStyle = (tone) => {
  const value = String(tone || "").trim().toLowerCase();
  if (value === "emerald") return BADGE_STYLES.emerald;
  if (value === "amber") return BADGE_STYLES.amber;
  if (value === "sky") return BADGE_STYLES.sky;
  if (value === "rose") return BADGE_STYLES.rose;
  if (value === "orange") return BADGE_STYLES.orange;
  if (value === "teal") return BADGE_STYLES.teal;
  if (value === "stone") return BADGE_STYLES.slateStrong;
  return BADGE_STYLES.slate;
};

export const getPaymentStatusTone = (status) => {
  const value = normalize(status);
  if (value === "PAID") return BADGE_STYLES.emerald;
  if (value === "PARTIALLY_PAID") return BADGE_STYLES.sky;
  if (value === "PENDING_CONFIRMATION") return BADGE_STYLES.amber;
  if (value === "REJECTED" || value === "FAILED") return BADGE_STYLES.rose;
  if (value === "EXPIRED") return BADGE_STYLES.orange;
  if (value === "CANCELLED") return BADGE_STYLES.slateStrong;
  return BADGE_STYLES.slate;
};

export const getProofReviewTone = (status) => {
  const value = normalize(status, "PENDING");
  if (value === "APPROVED") return BADGE_STYLES.emerald;
  if (value === "REJECTED") return BADGE_STYLES.rose;
  return BADGE_STYLES.amber;
};

export const getCheckoutModeTone = (mode) => {
  const value = normalize(mode, "LEGACY");
  if (value === "MULTI_STORE") return BADGE_STYLES.teal;
  if (value === "SINGLE_STORE") return BADGE_STYLES.sky;
  return BADGE_STYLES.slate;
};

export const getPaymentStatusLabel = (status) => {
  const value = normalize(status, "UNPAID");
  if (value === "PAID") return "Paid";
  if (value === "PARTIALLY_PAID") return "Partially Paid";
  if (value === "PENDING_CONFIRMATION") return "Awaiting Review";
  if (value === "FAILED") return "Failed";
  if (value === "EXPIRED") return "Expired";
  if (value === "CANCELLED") return "Cancelled";
  if (value === "REJECTED") return "Rejected";
  if (value === "CREATED") return "Created";
  return "Unpaid";
};

export const getProofReviewLabel = (status) => {
  const value = normalize(status, "PENDING");
  if (value === "APPROVED") return "Approved";
  if (value === "REJECTED") return "Rejected";
  return "Pending";
};

function Badge({ children, className = "" }) {
  return <span className={`${baseClass} ${className}`}>{children}</span>;
}

export function PaymentStatusBadge({ status, prefix = "", label = "", tone = "" }) {
  const value = normalize(status, "UNPAID");
  const displayLabel = toLabelText(label, getPaymentStatusLabel(value));
  return (
    <Badge className={tone ? getToneStyle(tone) : getPaymentStatusTone(value)}>
      {prefix ? `${prefix} ${displayLabel}` : displayLabel}
    </Badge>
  );
}

export function ProofReviewBadge({ status, prefix = "", label = "" }) {
  const value = normalize(status, "PENDING");
  const displayLabel = toLabelText(label, getProofReviewLabel(value));
  return (
    <Badge className={getProofReviewTone(value)}>
      {prefix ? `${prefix} ${displayLabel}` : displayLabel}
    </Badge>
  );
}

export function CheckoutModeBadge({ mode, prefix = "" }) {
  const value = normalize(mode, "LEGACY");
  return <Badge className={getCheckoutModeTone(value)}>{prefix ? `${prefix} ${value}` : value}</Badge>;
}
