const normalize = (value) => String(value || "").toLowerCase().trim();

export const normalizeAdminOrderLifecycle = (raw) => {
  const value = normalize(raw);
  if (!value) return "unknown";
  if (["pending", "pending_payment", "awaiting_payment", "unpaid"].includes(value)) {
    return "pending";
  }
  if (["processing", "process", "packed", "confirmed", "paid"].includes(value)) {
    return "processing";
  }
  if (["shipped", "shipping", "in_transit"].includes(value)) {
    return "in_delivery";
  }
  if (["delivered", "complete", "completed"].includes(value)) {
    return "delivered";
  }
  if (["cancelled", "canceled", "cancel", "failed", "refunded"].includes(value)) {
    return "cancelled";
  }
  return "unknown";
};

export const getAdminOrderLifecycleLabel = (raw) => {
  const key = normalizeAdminOrderLifecycle(raw);
  if (key === "pending") return "Pending";
  if (key === "processing") return "Processing";
  if (key === "in_delivery") return "In Delivery";
  if (key === "delivered") return "Delivered";
  if (key === "cancelled") return "Cancelled";
  return "Unknown";
};

export const getAdminOrderLifecycleBadgeClass = (raw) => {
  const key = normalizeAdminOrderLifecycle(raw);
  if (key === "pending") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (key === "processing") return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
  if (key === "in_delivery") return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  if (key === "delivered") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (key === "cancelled") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  return "bg-slate-50 text-slate-600 ring-1 ring-slate-200";
};

export const getAdminOrderLifecycleDotClass = (raw) => {
  const key = normalizeAdminOrderLifecycle(raw);
  if (key === "pending") return "bg-amber-500";
  if (key === "processing") return "bg-indigo-500";
  if (key === "in_delivery") return "bg-sky-500";
  if (key === "delivered") return "bg-emerald-500";
  if (key === "cancelled") return "bg-red-500";
  return "bg-slate-400";
};

export const getAdminOrderLifecycleNote = (raw) => {
  const key = normalizeAdminOrderLifecycle(raw);
  if (key === "pending") return "Operational order is waiting for payment or the next fulfillment action.";
  if (key === "processing") return "Operational order is being prepared after payment readiness.";
  if (key === "in_delivery") return "Operational order is already handed off for delivery.";
  if (key === "delivered") return "Operational order is delivered and can move to final archive flow.";
  if (key === "cancelled") return "Operational order is closed and no longer moves through fulfillment.";
  return "Operational order lifecycle is tracked separately from payment review.";
};

export const ADMIN_ORDER_ACTION_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipping", label: "In Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancel", label: "Cancelled" },
];

export const toAdminOrderActionValue = (raw) => {
  const key = normalizeAdminOrderLifecycle(raw);
  if (key === "in_delivery") return "shipping";
  if (key === "delivered") return "delivered";
  if (key === "cancelled") return "cancel";
  if (key === "processing") return "processing";
  return "pending";
};
