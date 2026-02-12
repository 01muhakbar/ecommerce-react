import {
  getOrderStatusBadgeClass,
  getOrderStatusLabel,
} from "../../utils/orderStatus.js";

export default function OrderStatusBadge({ status }) {
  const label = getOrderStatusLabel(status);
  const styles = getOrderStatusBadgeClass(status);
  return <span className={`rounded-full px-2 py-0.5 text-xs ${styles}`}>{label}</span>;
}
