import { normalizeAdminOrderLifecycle } from "../../pages/admin/orderLifecyclePresentation.js";

const STATUS_FLOW = [
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "in_delivery", label: "In Delivery" },
  { key: "delivered", label: "Delivered" },
];

const STATUS_COLORS = {
  pending: "bg-amber-500",
  processing: "bg-indigo-500",
  in_delivery: "bg-sky-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-red-500",
  halted: "bg-slate-500",
};

const TONE_DOT_CLASS = {
  stone: "bg-slate-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
};

const normalizeSummaryCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const PENDING_CODES = new Set([
  "ACTION_REQUIRED",
  "UNDER_REVIEW",
  "AWAITING_PAYMENT",
  "BLOCKED_BY_PAYMENT",
  "PENDING",
]);
const PROCESSING_CODES = new Set(["READY", "PROCESSING", "IN_PROGRESS"]);
const SHIPPING_CODES = new Set(["IN_DELIVERY", "SHIPPING", "SHIPPED"]);
const COMPLETE_CODES = new Set(["FINAL", "DELIVERED"]);
const HALTED_CODES = new Set(["FAILED", "EXPIRED", "CANCELLED"]);

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("id-ID");
};

export default function OrderStatusTimeline({ status, summary = null, createdAt, updatedAt }) {
  const normalizedSummaryCode = normalizeSummaryCode(summary?.code);
  const normalized =
    normalizedSummaryCode && PENDING_CODES.has(normalizedSummaryCode)
      ? "pending"
      : normalizedSummaryCode && PROCESSING_CODES.has(normalizedSummaryCode)
        ? "processing"
        : normalizedSummaryCode && SHIPPING_CODES.has(normalizedSummaryCode)
          ? "in_delivery"
          : normalizedSummaryCode && COMPLETE_CODES.has(normalizedSummaryCode)
            ? "delivered"
            : normalizeAdminOrderLifecycle(status);
  const isCancelled = normalizedSummaryCode === "CANCELLED" || normalized === "cancelled";
  const isHalted = HALTED_CODES.has(normalizedSummaryCode) && normalizedSummaryCode !== "CANCELLED";
  const createdLabel = formatDate(createdAt);
  const updatedLabel = formatDate(updatedAt);
  const activeIndex = STATUS_FLOW.findIndex((step) => step.key === normalized);

  const steps = isCancelled
    ? [...STATUS_FLOW, { key: "cancelled", label: summary?.label || "Cancelled" }]
    : isHalted
      ? [...STATUS_FLOW, { key: "halted", label: summary?.label || "Closed" }]
    : STATUS_FLOW;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">Order Timeline</h3>
      <div className="mt-4 space-y-4">
        {steps.map((step, index) => {
          const isActive = isCancelled
            ? step.key === "cancelled" || step.key === "pending"
            : isHalted
              ? step.key === "halted" || step.key === "pending"
            : activeIndex >= 0 && index <= activeIndex;
          const dotClass =
            step.key === "halted"
              ? TONE_DOT_CLASS[String(summary?.tone || "").trim()] || STATUS_COLORS.halted
              : STATUS_COLORS[step.key] || "bg-slate-400";
          const labelColor = isActive ? "text-slate-900" : "text-slate-400";
          const lineColor =
            !isCancelled && !isHalted && isActive ? "bg-slate-200" : "bg-slate-100";
          const showCreated = step.key === "pending" && createdLabel;
          const showUpdated =
            updatedLabel &&
            ((isCancelled && step.key === "cancelled") ||
              (isHalted && step.key === "halted") ||
              (!isCancelled && !isHalted && step.key === normalized));

          return (
            <div key={step.key} className="relative flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 h-3 w-3 rounded-full ${dotClass} ${
                    isActive ? "" : "opacity-40"
                  }`}
                />
                {index !== steps.length - 1 ? (
                  <span className={`mt-2 h-10 w-px ${lineColor}`} />
                ) : null}
              </div>
              <div>
                <div className={`text-sm font-medium ${labelColor}`}>
                  {step.label}
                </div>
                {showCreated ? (
                  <div className="text-xs text-slate-400">Order placed: {createdLabel}</div>
                ) : null}
                {showUpdated ? (
                  <div className="text-xs text-slate-400">Last updated: {updatedLabel}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
