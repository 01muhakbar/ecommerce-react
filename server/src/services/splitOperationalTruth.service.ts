import { buildPaymentStatusMeta } from "./orderLifecycleContract.service.js";
import {
  buildShipmentStatusMeta,
  normalizeShipmentStatus,
} from "./orderShippingReadModel.service.js";

const normalizeUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const PAYMENT_ACTION_REQUIRED = new Set(["UNPAID", "CREATED", "REJECTED"]);
const PAYMENT_UNDER_REVIEW = new Set(["PENDING_CONFIRMATION"]);
const PAYMENT_FINAL_NEGATIVE = new Set(["FAILED", "EXPIRED", "CANCELLED"]);
const SHIPMENT_FINAL_NEGATIVE = new Set(["RETURNED", "CANCELLED"]);
const AGGREGATE_SHIPMENT_PROGRESS = new Set(["READY_TO_FULFILL", "PROCESSING", "PACKED"]);
const AGGREGATE_SHIPMENT_DELIVERY = new Set(["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]);

const asObject = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, any>) : null;

const normalizeActions = (actions: unknown, fallbackScope: string) =>
  (Array.isArray(actions) ? actions : [])
    .map((action) => ({
      code: String((action as any)?.code || "").trim() || "UNKNOWN",
      label:
        String((action as any)?.label || (action as any)?.code || "").trim() || "Unknown action",
      enabled: (action as any)?.enabled !== false,
      reason: (action as any)?.reason ? String((action as any).reason) : null,
      tone: (action as any)?.tone ? String((action as any).tone) : null,
      nextStatus: (action as any)?.nextStatus ? String((action as any).nextStatus) : null,
      scope: (action as any)?.scope ? String((action as any).scope) : fallbackScope,
    }))
    .filter((action) => action.code !== "UNKNOWN" || action.label !== "Unknown action");

const buildBuyerPaymentActions = (paymentReadModel: any) => {
  if (!paymentReadModel || typeof paymentReadModel !== "object") return [];
  return normalizeActions(
    [
      {
        code: "SUBMIT_PAYMENT_PROOF",
        label: "Submit payment proof",
        enabled: Boolean(paymentReadModel?.proofActionability?.canStartProof),
        reason: paymentReadModel?.proofActionability?.reason || null,
        tone: "amber",
        scope: "SPLIT_PAYMENT",
      },
      {
        code: "CANCEL_PAYMENT",
        label: "Cancel payment",
        enabled: Boolean(paymentReadModel?.cancelability?.canCancel),
        reason: paymentReadModel?.cancelability?.reason || null,
        tone: "stone",
        scope: "SPLIT_PAYMENT",
      },
    ],
    "SPLIT_PAYMENT"
  );
};

const resolveShipmentFallbackStatus = (paymentStatus: string) =>
  paymentStatus === "PAID" ? "READY_TO_FULFILL" : "WAITING_PAYMENT";

export const buildSplitOperationalTruth = (input: {
  paymentStatus?: unknown;
  paymentReadModel?: any;
  shipmentReadModel?: any;
  buyerActions?: any[];
  sellerFulfillmentActions?: any[];
  sellerShipmentActions?: any[];
  adminActions?: any[];
}) => {
  const paymentReadModel =
    input.paymentReadModel && typeof input.paymentReadModel === "object"
      ? input.paymentReadModel
      : null;
  const shipmentReadModel =
    input.shipmentReadModel && typeof input.shipmentReadModel === "object"
      ? input.shipmentReadModel
      : null;

  const paymentStatus = normalizeUpper(
    paymentReadModel?.status ?? paymentReadModel?.settlementStatus ?? input.paymentStatus,
    "UNPAID"
  );
  const settlementStatus = normalizeUpper(
    paymentReadModel?.settlementStatus ?? input.paymentStatus ?? paymentStatus,
    paymentStatus
  );
  const paymentStatusMeta = paymentReadModel?.statusMeta ?? buildPaymentStatusMeta(paymentStatus);
  const settlementStatusMeta =
    paymentReadModel?.settlementStatusMeta ?? buildPaymentStatusMeta(settlementStatus);

  const shipmentStatus = normalizeShipmentStatus(
    shipmentReadModel?.shippingStatus ??
      shipmentReadModel?.shipmentStatus ??
      resolveShipmentFallbackStatus(settlementStatus)
  );
  const shipmentStatusMeta =
    shipmentReadModel?.shippingStatusMeta ??
    shipmentReadModel?.shipmentStatusMeta ??
    buildShipmentStatusMeta(shipmentStatus);

  const buyerActions = normalizeActions(
    input.buyerActions ?? buildBuyerPaymentActions(paymentReadModel),
    "SPLIT_PAYMENT"
  );
  const sellerFulfillmentActions = normalizeActions(
    input.sellerFulfillmentActions,
    "SELLER_FULFILLMENT"
  );
  const sellerShipmentActions = normalizeActions(
    input.sellerShipmentActions ??
      shipmentReadModel?.availableShippingActions ??
      shipmentReadModel?.shipments?.[0]?.availableShippingActions,
    "SELLER_SHIPMENT"
  );
  const adminActions = normalizeActions(input.adminActions, "ADMIN_ORDER");

  const paymentIsFinalNegative = PAYMENT_FINAL_NEGATIVE.has(paymentStatus);
  const shipmentIsFinalNegative = SHIPMENT_FINAL_NEGATIVE.has(shipmentStatus);
  const shipmentBlockedByPayment = settlementStatus !== "PAID";
  const hasShipmentActions = sellerShipmentActions.some((action) => action.enabled);
  const hasFulfillmentActions = sellerFulfillmentActions.some((action) => action.enabled);

  const shipmentBlockedReason = paymentIsFinalNegative
    ? settlementStatusMeta?.description || "Shipment is closed because payment is no longer valid."
    : PAYMENT_UNDER_REVIEW.has(settlementStatus)
      ? "Shipment remains blocked while the latest split payment is under review."
      : shipmentBlockedByPayment
        ? "Shipment remains blocked until this store split payment is settled."
        : sellerShipmentActions.find((action) => !action.enabled && action.reason)?.reason || null;

  const statusSummary = paymentIsFinalNegative
    ? {
        lane: "PAYMENT",
        code: paymentStatus,
        label: settlementStatusMeta?.label || paymentStatusMeta?.label || paymentStatus,
        tone: settlementStatusMeta?.tone || paymentStatusMeta?.tone || "stone",
        description:
          settlementStatusMeta?.description ||
          paymentStatusMeta?.description ||
          "Split payment is closed.",
        isFinal: true,
      }
    : PAYMENT_UNDER_REVIEW.has(settlementStatus)
      ? {
          lane: "PAYMENT",
          code: "UNDER_REVIEW",
          label: settlementStatusMeta?.label || "Awaiting Review",
          tone: settlementStatusMeta?.tone || "amber",
          description:
            settlementStatusMeta?.description ||
            "Split payment is under review before shipment can begin.",
          isFinal: false,
        }
      : settlementStatus !== "PAID"
        ? {
            lane: "PAYMENT",
            code: "AWAITING_PAYMENT",
            label: settlementStatusMeta?.label || paymentStatusMeta?.label || paymentStatus,
            tone: settlementStatusMeta?.tone || paymentStatusMeta?.tone || "amber",
            description:
              settlementStatusMeta?.description ||
              paymentStatusMeta?.description ||
              "Split payment must be settled before shipment starts.",
            isFinal: false,
          }
        : shipmentIsFinalNegative
          ? {
              lane: "SHIPMENT",
              code: shipmentStatus,
              label: shipmentStatusMeta?.label || shipmentStatus,
              tone: shipmentStatusMeta?.tone || "stone",
              description:
                shipmentStatusMeta?.description ||
                "Split shipment is closed in a final-negative state.",
              isFinal: true,
            }
          : {
              lane: "SHIPMENT",
              code: shipmentStatus,
              label: shipmentStatusMeta?.label || shipmentStatus,
              tone: shipmentStatusMeta?.tone || "sky",
              description:
                shipmentStatusMeta?.description ||
                "Split shipment is the current operational lane.",
              isFinal: Boolean(shipmentStatusMeta?.isFinal),
            };

  return {
    scope: {
      entity: "STORE_SPLIT",
      label: "Store split",
      description: "Operational truth stays scoped to one seller/store split only.",
    },
    payment: {
      status: paymentStatus,
      statusMeta: paymentStatusMeta,
      settlementStatus,
      settlementStatusMeta,
      isFinal: Boolean(paymentStatusMeta?.isFinal),
      isFinalNegative: paymentIsFinalNegative,
      proofActionability: paymentReadModel?.proofActionability || null,
      cancelability: paymentReadModel?.cancelability || null,
      isActionable: Boolean(
        paymentReadModel?.isActionable || buyerActions.some((action) => action.enabled)
      ),
    },
    shipment: {
      status: shipmentStatus,
      statusMeta: shipmentStatusMeta,
      isFinal: Boolean(shipmentStatusMeta?.isFinal),
      isFinalNegative: shipmentIsFinalNegative,
      hasPersistedShipment: Boolean(shipmentReadModel?.hasPersistedShipment),
      usedLegacyFallback: Boolean(shipmentReadModel?.usedLegacyFallback),
      isBlockedByPayment: shipmentBlockedByPayment,
      blockedReason: shipmentBlockedReason,
      isActionable: hasShipmentActions || hasFulfillmentActions,
    },
    bridge: {
      paymentToShipment: shipmentBlockedByPayment ? "BLOCKED" : "READY",
      currentLane: settlementStatus === "PAID" ? "SHIPMENT" : "PAYMENT",
      shipmentBlocked: shipmentBlockedByPayment || paymentIsFinalNegative,
      shipmentBlockedReason: shipmentBlockedReason,
    },
    finality: {
      isFinal: Boolean(paymentIsFinalNegative || shipmentStatusMeta?.isFinal),
      isFinalNegative: Boolean(paymentIsFinalNegative || shipmentIsFinalNegative),
      paymentIsFinal: Boolean(paymentStatusMeta?.isFinal),
      shipmentIsFinal: Boolean(shipmentStatusMeta?.isFinal),
    },
    actions: {
      buyer: buyerActions,
      sellerFulfillment: sellerFulfillmentActions,
      sellerShipment: sellerShipmentActions,
      admin: adminActions,
      availableCount: [...buyerActions, ...sellerFulfillmentActions, ...sellerShipmentActions, ...adminActions]
        .filter((action) => action.enabled).length,
    },
    statusSummary,
  };
};

export const buildBuyerAggregateStatusSummary = (
  splits: unknown[],
  fallbackSummary?: unknown
) => {
  const normalizedFallback = asObject(fallbackSummary);
  const entries = (Array.isArray(splits) ? splits : [])
    .map((split) => {
      const truth = asObject(asObject(split)?.operationalTruth);
      const summary = asObject(truth?.statusSummary);
      if (!summary) return null;

      const finality = asObject(truth?.finality);
      return {
        code: normalizeUpper(summary.code),
        lane: normalizeUpper(summary.lane),
        label: String(summary.label || "").trim() || null,
        tone: String(summary.tone || "").trim() || null,
        description: String(summary.description || "").trim() || null,
        isFinal: Boolean(summary.isFinal),
        isFinalNegative: Boolean(finality?.isFinalNegative),
      };
    })
    .filter(Boolean) as Array<{
    code: string;
    lane: string;
    label: string | null;
    tone: string | null;
    description: string | null;
    isFinal: boolean;
    isFinalNegative: boolean;
  }>;

  if (entries.length === 0) return normalizedFallback;

  const awaitingPaymentCount = entries.filter((entry) => entry.code === "AWAITING_PAYMENT").length;
  if (awaitingPaymentCount > 0) {
    return {
      code: "AWAITING_PAYMENT",
      label: "Split Payment Required",
      tone: "amber",
      description: `Complete payment for ${awaitingPaymentCount} store split${
        awaitingPaymentCount === 1 ? "" : "s"
      } before shipment can continue.`,
      isFinal: false,
    };
  }

  const underReviewCount = entries.filter((entry) => entry.code === "UNDER_REVIEW").length;
  if (underReviewCount > 0) {
    return {
      code: "UNDER_REVIEW",
      label: "Split Payment Under Review",
      tone: "amber",
      description: `${underReviewCount} store split payment${
        underReviewCount === 1 ? " is" : "s are"
      } still under backend review.`,
      isFinal: false,
    };
  }

  const finalNegativeEntries = entries.filter((entry) => entry.isFinalNegative);
  if (finalNegativeEntries.length > 0) {
    const allFinalNegative = finalNegativeEntries.length === entries.length;
    const uniqueCodes = Array.from(new Set(finalNegativeEntries.map((entry) => entry.code)));
    const sharedEntry = uniqueCodes.length === 1 ? finalNegativeEntries[0] : null;

    if (sharedEntry && allFinalNegative) {
      return {
        code: sharedEntry.code,
        label: sharedEntry.label || sharedEntry.code,
        tone: sharedEntry.tone || "rose",
        description:
          sharedEntry.description ||
          "Every store split is already closed in the same final state.",
        isFinal: true,
      };
    }

    return {
      code: allFinalNegative ? "FINAL_NEGATIVE" : "MIXED_EXCEPTION",
      label: allFinalNegative ? "Order Closed" : "Order Needs Attention",
      tone: "rose",
      description: allFinalNegative
        ? "Every store split is already closed or failed. Check the latest split-level status before taking the next step."
        : `${finalNegativeEntries.length} store split${
            finalNegativeEntries.length === 1 ? " is" : "s are"
          } already closed or failed. Check the latest split-level status before taking the next step.`,
      isFinal: allFinalNegative,
    };
  }

  const shipmentEntries = entries.filter((entry) => entry.lane === "SHIPMENT");
  if (shipmentEntries.length > 0) {
    if (shipmentEntries.every((entry) => entry.code === "DELIVERED" && entry.isFinal)) {
      return {
        code: "DELIVERED",
        label: "Delivered",
        tone: "emerald",
        description: "Every active store split has already been delivered.",
        isFinal: true,
      };
    }

    if (shipmentEntries.some((entry) => AGGREGATE_SHIPMENT_DELIVERY.has(entry.code))) {
      return {
        code: "IN_DELIVERY",
        label: "On delivery",
        tone: "indigo",
        description: "At least one store split is already on the delivery lane.",
        isFinal: false,
      };
    }

    if (shipmentEntries.some((entry) => AGGREGATE_SHIPMENT_PROGRESS.has(entry.code))) {
      return {
        code: "IN_PROGRESS",
        label: "In progress",
        tone: "sky",
        description: "Payment is settled and seller fulfillment is already moving on at least one store split.",
        isFinal: false,
      };
    }
  }

  return normalizedFallback ?? {
    code: entries[0].code || "PENDING",
    label: entries[0].label || "Pending",
    tone: entries[0].tone || "amber",
    description:
      entries[0].description || "Order is waiting for the next buyer or seller action.",
    isFinal: Boolean(entries[0].isFinal),
  };
};
