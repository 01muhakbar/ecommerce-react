import {
  getAdminOrderLifecycleBadgeClass,
  getAdminOrderLifecycleDotClass,
  getAdminOrderLifecycleLabel,
} from "../../pages/admin/orderLifecyclePresentation.js";

const TONE_CLASS = {
  stone: "bg-slate-50 text-slate-700 border-slate-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
};

const TONE_DOT_CLASS = {
  stone: "bg-slate-400",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
};

export default function OrderStatusBadge({ status, meta = null }) {
  const label = meta?.label || getAdminOrderLifecycleLabel(status);
  const styles = meta?.tone
    ? TONE_CLASS[meta.tone] || TONE_CLASS.stone
    : getAdminOrderLifecycleBadgeClass(status);
  const dotClass = meta?.tone
    ? TONE_DOT_CLASS[meta.tone] || TONE_DOT_CLASS.stone
    : getAdminOrderLifecycleDotClass(status);
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
