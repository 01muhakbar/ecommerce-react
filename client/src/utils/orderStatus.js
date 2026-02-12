export const ORDER_STATUS_OPTIONS = [
  "pending",
  "processing",
  "shipping",
  "complete",
  "cancelled",
];

const STATUS_GROUPS = {
  pending: new Set(["pending", "unpaid", "awaiting_payment"]),
  processing: new Set(["processing", "process", "packed", "confirmed", "paid"]),
  shipping: new Set(["shipped", "shipping", "in_transit"]),
  complete: new Set(["delivered", "complete", "completed"]),
  cancelled: new Set(["cancelled", "canceled", "cancel", "refunded", "failed"]),
};

const STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  shipping: "Shipping",
  complete: "Delivered",
  cancelled: "Cancelled",
  unknown: "Unknown",
};

const STATUS_BADGES = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  processing: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  shipping: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  complete: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-1 ring-red-200",
  unknown: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
};

export const normalizeOrderStatus = (raw) => {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "unknown";
  if (STATUS_GROUPS.pending.has(value)) return "pending";
  if (STATUS_GROUPS.processing.has(value)) return "processing";
  if (STATUS_GROUPS.shipping.has(value)) return "shipping";
  if (STATUS_GROUPS.complete.has(value)) return "complete";
  if (STATUS_GROUPS.cancelled.has(value)) return "cancelled";
  return "unknown";
};

export const toUIStatus = (raw) => normalizeOrderStatus(raw);

export const getOrderStatusLabel = (raw) =>
  STATUS_LABELS[normalizeOrderStatus(raw)] || STATUS_LABELS.unknown;

export const getOrderStatusBadgeClass = (raw) =>
  STATUS_BADGES[normalizeOrderStatus(raw)] || STATUS_BADGES.unknown;
