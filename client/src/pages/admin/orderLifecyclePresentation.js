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
  if (key === "in_delivery") return "On delivery";
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
  { value: "shipping", label: "On delivery" },
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

const normalizePaymentStatus = (raw) =>
  String(raw || "")
    .toUpperCase()
    .trim();

const normalizeCheckoutMode = (raw) =>
  String(raw || "LEGACY")
    .toUpperCase()
    .trim() || "LEGACY";

const CLOSED_NEGATIVE_PAYMENT_STATUSES = new Set(["FAILED", "CANCELLED", "EXPIRED"]);

const getActionLabel = (value) =>
  ADMIN_ORDER_ACTION_OPTIONS.find((option) => option.value === value)?.label || value;

const summarizeBlockingSuborders = (data) => {
  const blockingSuborders = Array.isArray(data?.blockingSuborders) ? data.blockingSuborders : [];
  if (blockingSuborders.length === 0) return null;

  const preview = blockingSuborders
    .slice(0, 2)
    .map((item) => item?.suborderNumber || (item?.storeId ? `Store #${item.storeId}` : "Store split"))
    .filter(Boolean)
    .join(", ");

  if (!preview) return `${blockingSuborders.length} store split(s) are still blocking this move.`;
  if (blockingSuborders.length <= 2) {
    return `Blocking store split: ${preview}.`;
  }
  return `Blocking store splits: ${preview}, plus ${blockingSuborders.length - 2} more.`;
};

export const getAdminOrderTransitionErrorMeta = (error) => {
  const code = String(error?.response?.data?.code || "").trim().toUpperCase();
  const backendMessage =
    error?.response?.data?.message || error?.message || "Failed to update status.";
  const data = error?.response?.data?.data || null;
  const blockingSummary = summarizeBlockingSuborders(data);

  if (code === "PARENT_PROCESSING_BLOCKED_BY_SUBORDER_STATE") {
    return {
      title: "Processing is blocked by store split readiness",
      message:
        "Parent order cannot move to processing yet because active seller suborders are still unpaid or not started.",
      detail: blockingSummary || backendMessage,
    };
  }

  if (code === "PARENT_SHIPPING_BLOCKED_BY_SUBORDER_FULFILLMENT") {
    return {
      title: "Shipping is blocked by seller fulfillment",
      message:
        "Parent order cannot move to shipping until every active seller suborder has already reached shipped or delivered state.",
      detail: blockingSummary || backendMessage,
    };
  }

  if (code === "PARENT_FINALIZATION_BLOCKED_BY_SUBORDER_FULFILLMENT") {
    return {
      title: "Delivery finalization is blocked",
      message:
        "Parent order cannot be finalized yet because one or more active seller suborders are still not delivered.",
      detail: blockingSummary || backendMessage,
    };
  }

  if (code === "PARENT_ORDER_HAS_NO_ACTIVE_SUBORDERS") {
    return {
      title: "No active seller suborders remain",
      message:
        "This parent order no longer has an active seller fulfillment lane, so the operational status cannot move forward.",
      detail: backendMessage,
    };
  }

  if (code === "PARENT_ORDER_FINALIZED") {
    return {
      title: "Delivered order is already final",
      message:
        "This parent order is already in a final delivered state, so operational rollback or cancellation is no longer allowed.",
      detail: backendMessage,
    };
  }

  return {
    title: "Status update failed",
    message: backendMessage,
    detail: null,
  };
};

export const getAdminOrderTransitionPrecheck = (input) => {
  const targetStatus = String(input?.targetStatus || "").toLowerCase().trim();
  const currentStatus = String(input?.currentStatus || "").toLowerCase().trim();
  const paymentStatus = normalizePaymentStatus(input?.paymentStatus);
  const checkoutMode = normalizeCheckoutMode(input?.checkoutMode);

  if (!targetStatus || targetStatus === currentStatus) return null;

  if (targetStatus === "processing" && paymentStatus !== "PAID") {
    return {
      tone: "amber",
      title: "Processing may still be blocked",
      message:
        checkoutMode === "MULTI_STORE"
          ? "Parent payment is not fully settled. Backend will only allow processing if active seller suborders have already started operationally."
          : "Parent payment is not fully settled. Backend may still block processing until payment or seller progress is valid.",
    };
  }

  if (targetStatus === "shipping") {
    return {
      tone: "amber",
      title: "Shipping requires seller-side progress",
      message:
        checkoutMode === "MULTI_STORE"
          ? "Backend now checks every active store split. Any suborder still unfulfilled or processing will block this parent move."
          : "Backend will block shipping until the underlying fulfillment state is already ready.",
    };
  }

  if (targetStatus === "delivered") {
    return {
      tone: "amber",
      title: "Delivered requires all active splits to be complete",
      message:
        checkoutMode === "MULTI_STORE"
          ? "Parent delivered is only valid after every active store split is delivered."
          : "Backend will only finalize delivery when the operational fulfillment lane is already complete.",
    };
  }

  return null;
};

export const getAdminOrderTransitionDisabledState = (input) => {
  const currentStatus = String(input?.currentStatus || "").toLowerCase().trim();
  const paymentStatus = normalizePaymentStatus(input?.paymentStatus);
  const disabledReasons = {};

  const registerDisabled = (targetStatus, reason) => {
    if (!targetStatus || disabledReasons[targetStatus]) return;
    disabledReasons[targetStatus] = reason;
  };

  if (currentStatus) {
    registerDisabled(currentStatus, "Order is already in this status.");
  }

  if (currentStatus === "cancel") {
    ["pending", "processing", "shipping", "delivered"].forEach((targetStatus) => {
      registerDisabled(
        targetStatus,
        "Order is already cancelled and cannot return to the active fulfillment flow."
      );
    });
  }

  if (currentStatus === "delivered") {
    ["pending", "processing", "shipping", "cancel"].forEach((targetStatus) => {
      registerDisabled(
        targetStatus,
        targetStatus === "cancel"
          ? "Order is already delivered and is now in a final operational state, so cancellation is no longer allowed."
          : "Order is already delivered, so earlier operational statuses are no longer relevant."
      );
    });
  }

  if (CLOSED_NEGATIVE_PAYMENT_STATUSES.has(paymentStatus)) {
    ["processing", "shipping", "delivered"].forEach((targetStatus) => {
      registerDisabled(
        targetStatus,
        `Parent payment is already ${paymentStatus.toLowerCase()}, so operational fulfillment cannot move forward from this snapshot.`
      );
    });
  }

  const disabledActions = Object.entries(disabledReasons).map(([value, reason]) => ({
    value,
    label: getActionLabel(value),
    reason,
  }));

  return {
    disabledReasons,
    disabledActions,
  };
};
