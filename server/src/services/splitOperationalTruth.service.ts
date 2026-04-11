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
