import {
  getOrderStatusBadgeClass,
  getOrderStatusLabel,
  normalizeOrderStatus,
} from "../../utils/orderStatus.js";

export default function OrderStatusBadge({ status }) {
  const label = getOrderStatusLabel(status);
  const styles = getOrderStatusBadgeClass(status);
  const tone = normalizeOrderStatus(status);
  const dotClassNameMap = {
    pending: "bg-amber-500",
    processing: "bg-indigo-500",
    shipping: "bg-sky-500",
    complete: "bg-emerald-500",
    cancelled: "bg-red-500",
    unknown: "bg-slate-400",
  };
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          dotClassNameMap[tone] || dotClassNameMap.unknown
        }`}
      />
      {label}
    </span>
  );
}
