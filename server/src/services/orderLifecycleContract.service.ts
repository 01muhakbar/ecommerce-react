import { buildBuyerOrderPaymentEntry } from "./paymentCheckoutView.service.js";

const normalizeUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const normalizeLower = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toLowerCase();

export type ContractTone =
  | "stone"
  | "amber"
  | "sky"
  | "indigo"
  | "emerald"
  | "rose"
  | "orange"
  | "teal";

export type SharedAction = {
  code: string;
  label: string;
  enabled: boolean;
  reason: string | null;
  tone?: ContractTone;
  nextStatus?: string | null;
  scope?: string | null;
};

export const normalizeSharedOrderStatus = (raw: unknown) => {
  const value = normalizeLower(raw, "pending");
  if (!value) return "pending";
  if (["pending", "pending_payment", "awaiting_payment", "unpaid", "paid"].includes(value)) {
    return "pending";
  }
  if (["processing", "process", "packed", "confirmed"].includes(value)) {
    return "processing";
  }
  if (["shipped", "shipping", "in_transit"].includes(value)) return "shipping";
  if (["delivered", "completed", "complete"].includes(value)) return "delivered";
  if (["cancelled", "canceled", "cancel", "failed", "refunded"].includes(value)) {
    return "cancelled";
  }
  return "pending";
};

export const buildOrderStatusMeta = (raw: unknown) => {
  const code = normalizeSharedOrderStatus(raw);
  if (code === "processing") {
    return {
      code,
      label: "Processing",
      tone: "sky" as ContractTone,
      description: "Operational order is being prepared after payment readiness.",
      isFinal: false,
    };
  }
  if (code === "shipping") {
    return {
      code,
      label: "On delivery",
      tone: "indigo" as ContractTone,
      description: "Operational order is already handed off for delivery.",
      isFinal: false,
    };
  }
  if (code === "delivered") {
    return {
      code,
      label: "Delivered",
      tone: "emerald" as ContractTone,
      description: "Operational order is delivered and is now in a final state.",
      isFinal: true,
    };
  }
  if (code === "cancelled") {
    return {
      code,
      label: "Cancelled",
      tone: "stone" as ContractTone,
      description: "Operational order is closed and no longer moves through fulfillment.",
      isFinal: true,
    };
  }
  return {
    code: "pending",
    label: "Pending",
    tone: "amber" as ContractTone,
    description: "Operational order is waiting for payment or the next fulfillment action.",
    isFinal: false,
  };
};

export const buildPaymentStatusMeta = (raw: unknown) => {
  const code = normalizeUpper(raw, "UNPAID") || "UNPAID";
  if (code === "PAID") {
    return {
      code,
      label: "Paid",
      tone: "emerald" as ContractTone,
      description: "Payment is settled.",
      isFinal: true,
    };
  }
  if (code === "PARTIALLY_PAID") {
    return {
      code,
      label: "Partially Paid",
      tone: "sky" as ContractTone,
      description: "At least one payment lane is settled, but the full order is not complete yet.",
      isFinal: false,
    };
  }
  if (code === "PENDING_CONFIRMATION") {
    return {
      code,
      label: "Awaiting Review",
      tone: "amber" as ContractTone,
      description: "Payment proof exists and is waiting for review.",
      isFinal: false,
    };
  }
  if (code === "FAILED") {
    return {
      code,
      label: "Failed",
      tone: "rose" as ContractTone,
      description: "The payment attempt failed and is no longer actionable.",
      isFinal: true,
    };
  }
  if (code === "EXPIRED") {
    return {
      code,
      label: "Expired",
      tone: "orange" as ContractTone,
      description: "The payment window expired before settlement.",
      isFinal: true,
    };
  }
  if (code === "CANCELLED") {
    return {
      code,
      label: "Cancelled",
      tone: "stone" as ContractTone,
      description: "This payment lane was cancelled.",
      isFinal: true,
    };
  }
  if (code === "REJECTED") {
    return {
      code,
      label: "Rejected",
      tone: "rose" as ContractTone,
      description: "The latest payment proof was rejected.",
      isFinal: false,
    };
  }
  if (code === "CREATED") {
    return {
      code,
      label: "Created",
      tone: "sky" as ContractTone,
      description: "Payment record exists but settlement is not complete yet.",
      isFinal: false,
    };
  }
  return {
    code: "UNPAID",
    label: "Unpaid",
    tone: "stone" as ContractTone,
    description: "Payment is not settled yet.",
    isFinal: false,
  };
};

export const buildFulfillmentStatusMeta = (raw: unknown) => {
  const code = normalizeUpper(raw, "UNFULFILLED") || "UNFULFILLED";
  if (code === "PROCESSING") {
    return {
      code,
      label: "Processing",
      tone: "sky" as ContractTone,
      description: "The seller is preparing or packing the order.",
      isFinal: false,
    };
  }
  if (code === "SHIPPED") {
    return {
      code,
      label: "Shipped",
      tone: "indigo" as ContractTone,
      description: "The order is already in delivery.",
      isFinal: false,
    };
  }
  if (code === "DELIVERED") {
    return {
      code,
      label: "Delivered",
      tone: "emerald" as ContractTone,
      description: "The order reached the buyer.",
      isFinal: true,
    };
  }
  if (code === "CANCELLED") {
    return {
      code,
      label: "Cancelled",
      tone: "stone" as ContractTone,
      description: "The fulfillment lane was cancelled.",
      isFinal: true,
    };
  }
  return {
    code: "UNFULFILLED",
    label: "Unfulfilled",
    tone: "stone" as ContractTone,
    description: "Fulfillment has not started yet.",
    isFinal: false,
  };
};

const mapPaymentActionabilityTone = (code: string, counts: Record<string, number>) => {
  if (code === "ACTION_REQUIRED") return "amber" as ContractTone;
  if (code === "UNDER_REVIEW") return "amber" as ContractTone;
  if (code === "PAID") return "emerald" as ContractTone;
  if (counts.FAILED > 0) return "rose" as ContractTone;
  if (counts.EXPIRED > 0) return "orange" as ContractTone;
  return "stone" as ContractTone;
};

export const buildPaymentActionability = (displayStatuses: unknown[]) => {
  const normalizedStatuses = (Array.isArray(displayStatuses) ? displayStatuses : [])
    .map((status) => normalizeUpper(status))
    .filter(Boolean);
  const paymentEntry = buildBuyerOrderPaymentEntry(normalizedStatuses);
  const counts = {
    CREATED: paymentEntry.actionableCount,
    REJECTED: paymentEntry.actionableCount,
    PENDING_CONFIRMATION: paymentEntry.reviewCount,
    PAID: paymentEntry.paidCount,
    FAILED: paymentEntry.failedCount,
    CANCELLED: paymentEntry.cancelledCount,
    EXPIRED: paymentEntry.expiredCount,
  };
  return {
    code: paymentEntry.summaryStatus,
    statusCode:
      paymentEntry.summaryStatus === "FAILED"
        ? "FAILED"
        : paymentEntry.failedCount > 0
          ? "FAILED"
          : paymentEntry.expiredCount > 0
            ? "EXPIRED"
            : paymentEntry.cancelledCount > 0
              ? "CANCELLED"
              : paymentEntry.summaryStatus,
    label: paymentEntry.summaryLabel,
    tone: mapPaymentActionabilityTone(paymentEntry.summaryStatus, counts),
    ctaLabel: paymentEntry.visible ? paymentEntry.label : null,
    canPay: paymentEntry.summaryStatus === "ACTION_REQUIRED",
    visible: paymentEntry.visible,
    isFinal:
      paymentEntry.summaryStatus === "PAID" ||
      paymentEntry.summaryStatus === "FAILED" ||
      paymentEntry.summaryStatus === "FINAL",
    actionableCount: paymentEntry.actionableCount,
    reviewCount: paymentEntry.reviewCount,
    paidCount: paymentEntry.paidCount,
    failedCount: paymentEntry.failedCount,
    cancelledCount: paymentEntry.cancelledCount,
    expiredCount: paymentEntry.expiredCount,
    totalGroups: paymentEntry.totalGroups,
    reason:
      paymentEntry.summaryStatus === "ACTION_REQUIRED"
        ? null
        : paymentEntry.summaryLabel || "Payment is no longer actionable.",
  };
};

export const buildFulfillmentReadiness = (input: {
  orderStatus?: unknown;
  paymentStatus?: unknown;
  fulfillmentStatuses?: unknown[];
}) => {
  const orderStatusMeta = buildOrderStatusMeta(input.orderStatus);
  if (orderStatusMeta.code === "cancelled") {
    return {
      code: "CANCELLED",
      label: "Cancelled",
      tone: "stone" as ContractTone,
      description: "Fulfillment is closed because the order is cancelled.",
      isFinal: true,
    };
  }
  if (orderStatusMeta.code === "delivered") {
    return {
      code: "FINAL",
      label: "Delivered",
      tone: "emerald" as ContractTone,
      description: "Fulfillment is complete.",
      isFinal: true,
    };
  }

  const statuses = (Array.isArray(input.fulfillmentStatuses) ? input.fulfillmentStatuses : [])
    .map((status) => buildFulfillmentStatusMeta(status));
  if (statuses.some((status) => status.code === "SHIPPED")) {
    return {
      code: "IN_DELIVERY",
      label: "In delivery",
      tone: "indigo" as ContractTone,
      description: "At least one active fulfillment lane is already in delivery.",
      isFinal: false,
    };
  }
  if (statuses.some((status) => status.code === "PROCESSING")) {
    return {
      code: "IN_PROGRESS",
      label: "In progress",
      tone: "sky" as ContractTone,
      description: "Seller fulfillment has started.",
      isFinal: false,
    };
  }

  const paymentStatus = buildPaymentStatusMeta(input.paymentStatus);
  if (paymentStatus.code !== "PAID") {
    return {
      code: "BLOCKED_BY_PAYMENT",
      label: "Awaiting payment",
      tone: "amber" as ContractTone,
      description: "Fulfillment should not move forward until payment is settled.",
      isFinal: false,
    };
  }

  return {
    code: "READY",
    label: "Ready for processing",
    tone: "sky" as ContractTone,
    description: "Payment is settled and fulfillment can move forward.",
    isFinal: false,
  };
};

export const buildStatusSummary = (input: {
  orderStatus?: unknown;
  paymentStatus?: unknown;
  paymentActionability?: {
    code?: string;
    label?: string;
    tone?: ContractTone;
  } | null;
}) => {
  const orderStatusMeta = buildOrderStatusMeta(input.orderStatus);
  const paymentStatusMeta = buildPaymentStatusMeta(input.paymentStatus);
  const paymentActionabilityCode = String(input.paymentActionability?.code || "").trim();
  const paymentActionabilityStateCode = String(
    (input.paymentActionability as any)?.statusCode || paymentActionabilityCode
  ).trim();

  if (orderStatusMeta.code === "cancelled") {
    return {
      code: "CANCELLED",
      label: "Cancelled",
      tone: "stone" as ContractTone,
      description: orderStatusMeta.description,
      isFinal: true,
    };
  }
  if (orderStatusMeta.code !== "delivered") {
    if (paymentActionabilityCode === "ACTION_REQUIRED") {
      return {
        code: "ACTION_REQUIRED",
        label: input.paymentActionability?.label || "Awaiting payment",
        tone: input.paymentActionability?.tone || ("amber" as ContractTone),
        description: "Payment is still actionable and must be completed before fulfillment can continue.",
        isFinal: false,
      };
    }
    if (paymentActionabilityCode === "UNDER_REVIEW") {
      return {
        code: "UNDER_REVIEW",
        label: input.paymentActionability?.label || "Under review",
        tone: input.paymentActionability?.tone || ("amber" as ContractTone),
        description: "Payment proof is waiting for review.",
        isFinal: false,
      };
    }
    if (
      paymentActionabilityStateCode === "FAILED" ||
      paymentActionabilityStateCode === "EXPIRED" ||
      paymentActionabilityStateCode === "CANCELLED" ||
      paymentStatusMeta.code === "FAILED" ||
      paymentStatusMeta.code === "EXPIRED"
    ) {
      const meta = buildPaymentStatusMeta(
        paymentActionabilityStateCode === "FAILED" ||
          paymentActionabilityStateCode === "EXPIRED" ||
          paymentActionabilityStateCode === "CANCELLED"
          ? paymentActionabilityStateCode
          : paymentStatusMeta.code
      );
      return {
        code: meta.code,
        label: meta.label,
        tone: meta.tone,
        description: meta.description,
        isFinal: true,
      };
    }
  }

  return {
    code: orderStatusMeta.code.toUpperCase(),
    label: orderStatusMeta.label,
    tone: orderStatusMeta.tone,
    description: orderStatusMeta.description,
    isFinal: orderStatusMeta.isFinal,
  };
};

export const buildAction = (input: SharedAction) => ({
  code: input.code,
  label: input.label,
  enabled: Boolean(input.enabled),
  reason: input.reason || null,
  tone: input.tone || "stone",
  nextStatus: input.nextStatus || null,
  scope: input.scope || null,
});

export const buildBuyerOrderContract = (input: {
  orderStatus?: unknown;
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  displayStatuses?: unknown[];
  fulfillmentStatuses?: unknown[];
}) => {
  const orderStatus = normalizeSharedOrderStatus(input.orderStatus);
  const orderStatusMeta = buildOrderStatusMeta(orderStatus);
  const paymentStatus = normalizeUpper(input.paymentStatus, "UNPAID") || "UNPAID";
  const paymentStatusMeta = buildPaymentStatusMeta(paymentStatus);
  const paymentActionability = buildPaymentActionability(input.displayStatuses || []);
  const fulfillmentReadiness = buildFulfillmentReadiness({
    orderStatus,
    paymentStatus,
    fulfillmentStatuses: input.fulfillmentStatuses,
  });
  const statusSummary = buildStatusSummary({
    orderStatus,
    paymentStatus,
    paymentActionability,
  });
  const paymentMethod = normalizeUpper(input.paymentMethod);
  const availableActions: SharedAction[] = [];

  if (paymentActionability.canPay) {
    availableActions.push(
      buildAction({
        code: paymentMethod === "STRIPE" ? "CONTINUE_STRIPE_PAYMENT" : "CONTINUE_PAYMENT",
        label: paymentActionability.ctaLabel || "Continue Payment",
        enabled: true,
        reason: null,
        tone: "amber",
        scope: "ORDER_PAYMENT",
      })
    );
  }

  availableActions.push(
    buildAction({
      code: "TRACK_ORDER",
      label: "Track Order",
      enabled: true,
      reason: null,
      tone: "stone",
      scope: "ORDER",
    })
  );

  return {
    orderStatus,
    orderStatusMeta,
    paymentStatus,
    paymentStatusMeta,
    paymentActionability,
    fulfillmentReadiness,
    statusSummary,
    availableActions,
  };
};

export const buildSellerSuborderContract = (input: {
  orderStatus?: unknown;
  paymentStatus?: unknown;
  parentOrderStatus?: unknown;
  parentPaymentStatus?: unknown;
  availableActions?: any[];
}) => {
  const orderStatus = normalizeUpper(input.orderStatus, "UNFULFILLED") || "UNFULFILLED";
  const orderStatusMeta = buildFulfillmentStatusMeta(orderStatus);
  const paymentStatus = normalizeUpper(input.paymentStatus, "UNPAID") || "UNPAID";
  const paymentStatusMeta = buildPaymentStatusMeta(paymentStatus);
  const paymentActionability = {
    code:
      paymentStatus === "PAID"
        ? "SETTLED"
        : paymentStatus === "PENDING_CONFIRMATION"
          ? "UNDER_REVIEW"
          : paymentStatus === "FAILED" || paymentStatus === "EXPIRED" || paymentStatus === "CANCELLED"
            ? "FINAL"
            : "ACTION_REQUIRED",
    label:
      paymentStatus === "PAID"
        ? "Payment settled"
        : paymentStatus === "PENDING_CONFIRMATION"
          ? "Awaiting review"
          : paymentStatusMeta.label,
    tone:
      paymentStatus === "PAID"
        ? ("emerald" as ContractTone)
        : paymentStatus === "PENDING_CONFIRMATION"
          ? ("amber" as ContractTone)
          : paymentStatusMeta.tone,
    ctaLabel: null,
    canPay: false,
    visible: false,
    isFinal: paymentStatusMeta.isFinal,
    reason: paymentStatusMeta.description,
  };
  const fulfillmentReadiness = buildFulfillmentReadiness({
    orderStatus: input.parentOrderStatus,
    paymentStatus,
    fulfillmentStatuses: [orderStatus],
  });
  const statusSummary =
    orderStatus === "CANCELLED"
      ? {
          code: "CANCELLED",
          label: "Cancelled",
          tone: "stone" as ContractTone,
          description: orderStatusMeta.description,
          isFinal: true,
        }
      : paymentStatus !== "PAID"
        ? {
            code: "AWAITING_PAYMENT",
            label:
              paymentStatus === "PENDING_CONFIRMATION"
                ? "Payment under review"
                : paymentStatusMeta.label,
            tone:
              paymentStatus === "PENDING_CONFIRMATION"
                ? ("amber" as ContractTone)
                : paymentStatusMeta.tone,
            description: paymentStatusMeta.description,
            isFinal: paymentStatusMeta.isFinal,
          }
        : {
            code: orderStatus,
            label: orderStatusMeta.label,
            tone: orderStatusMeta.tone,
            description: orderStatusMeta.description,
            isFinal: orderStatusMeta.isFinal,
          };

  return {
    orderStatus,
    orderStatusMeta,
    paymentStatus,
    paymentStatusMeta,
    parentOrderStatus: normalizeSharedOrderStatus(input.parentOrderStatus),
    parentOrderStatusMeta: buildOrderStatusMeta(input.parentOrderStatus),
    parentPaymentStatus: normalizeUpper(input.parentPaymentStatus, "UNPAID") || "UNPAID",
    parentPaymentStatusMeta: buildPaymentStatusMeta(input.parentPaymentStatus),
    paymentActionability,
    fulfillmentReadiness,
    statusSummary,
    availableActions: Array.isArray(input.availableActions)
      ? input.availableActions.map((action) =>
          buildAction({
            code: String(action?.code || ""),
            label: String(action?.label || action?.code || ""),
            enabled: action?.enabled !== false,
            reason: action?.reason || null,
            tone: action?.tone || (action?.enabled === false ? "stone" : "emerald"),
            nextStatus: action?.nextStatus || null,
            scope: action?.scope || "SELLER_FULFILLMENT",
          })
        )
      : [],
  };
};

export const buildAdminOrderContract = (input: {
  orderStatus?: unknown;
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  displayStatuses?: unknown[];
  fulfillmentStatuses?: unknown[];
  availableActions?: SharedAction[];
}) => {
  const base = buildBuyerOrderContract(input);
  return {
    ...base,
    availableActions: Array.isArray(input.availableActions) ? input.availableActions : [],
  };
};
