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
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("id-ID");
};

export default function OrderStatusTimeline({ status, createdAt, updatedAt }) {
  const normalized = normalizeAdminOrderLifecycle(status);
  const isCancelled = normalized === "cancelled";
  const createdLabel = formatDate(createdAt);
  const updatedLabel = formatDate(updatedAt);
  const activeIndex = STATUS_FLOW.findIndex((step) => step.key === normalized);

  const steps = isCancelled
    ? [...STATUS_FLOW, { key: "cancelled", label: "Cancelled" }]
    : STATUS_FLOW;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">Order Timeline</h3>
      <div className="mt-4 space-y-4">
        {steps.map((step, index) => {
          const isActive = isCancelled
            ? step.key === "cancelled" || step.key === "pending"
            : activeIndex >= 0 && index <= activeIndex;
          const dotClass = STATUS_COLORS[step.key] || "bg-slate-400";
          const labelColor = isActive ? "text-slate-900" : "text-slate-400";
          const lineColor = !isCancelled && isActive ? "bg-slate-200" : "bg-slate-100";
          const showCreated = step.key === "pending" && createdLabel;
          const showUpdated = step.key === normalized && updatedLabel;

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
