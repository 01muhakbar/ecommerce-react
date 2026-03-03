import {
  getOrderStatusBadgeClass,
  getOrderStatusLabel,
} from "../../utils/orderStatus.js";

export default function OrderStatusBadge({ status }) {
  const label = getOrderStatusLabel(status);
  const styles = getOrderStatusBadgeClass(status);
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {label}
    </span>
  );
}
