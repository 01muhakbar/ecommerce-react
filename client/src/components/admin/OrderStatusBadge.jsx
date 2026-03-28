import {
  getAdminOrderLifecycleBadgeClass,
  getAdminOrderLifecycleDotClass,
  getAdminOrderLifecycleLabel,
} from "../../pages/admin/orderLifecyclePresentation.js";

export default function OrderStatusBadge({ status }) {
  const label = getAdminOrderLifecycleLabel(status);
  const styles = getAdminOrderLifecycleBadgeClass(status);
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${getAdminOrderLifecycleDotClass(status)}`}
      />
      {label}
    </span>
  );
}
