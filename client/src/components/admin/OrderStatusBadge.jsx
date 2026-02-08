const STATUS_STYLES = {
  PENDING: "border-slate-200 bg-slate-50 text-slate-600",
  PROCESSING: "border-amber-200 bg-amber-50 text-amber-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function OrderStatusBadge({ status }) {
  const normalized = (status || "").toString().toUpperCase();
  const styles = STATUS_STYLES[normalized] || "border-slate-200 bg-slate-50 text-slate-600";
  const label = normalized ? normalized.toLowerCase() : "unknown";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${styles}`}>
      {label}
    </span>
  );
}
