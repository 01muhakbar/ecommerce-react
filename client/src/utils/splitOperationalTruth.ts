import { getGroupedPaymentReadModel } from "./groupedPaymentReadModel.ts";
import { getOrderContractSummary } from "./orderContract.ts";

const asObject = (value: unknown): Record<string, any> | null =>
  value && typeof value === "object" ? (value as Record<string, any>) : null;

const normalizeCode = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const asActionList = (value: unknown) =>
  Array.isArray(value) ? value.map(asObject).filter(Boolean) : [];

export const getSplitOperationalTruth = (split: unknown) =>
  asObject(asObject(split)?.operationalTruth);

export const getSplitOperationalPayment = (split: unknown) => {
  const truth = getSplitOperationalTruth(split);
  const payment = asObject(truth?.payment);
  const fallback = getGroupedPaymentReadModel(split);

  return {
    status: normalizeCode(
      payment?.settlementStatus ?? payment?.status,
      fallback.settlementStatus || fallback.status || "UNPAID"
    ),
    statusMeta:
      asObject(payment?.settlementStatusMeta) ??
      asObject(payment?.statusMeta) ??
      fallback.settlementStatusMeta ??
      fallback.statusMeta ??
      null,
    laneStatus: normalizeCode(payment?.status, fallback.status || "UNPAID"),
    laneStatusMeta: asObject(payment?.statusMeta) ?? fallback.statusMeta ?? null,
    isFinal: Boolean(payment?.isFinal ?? fallback.isFinal),
    isFinalNegative: Boolean(payment?.isFinalNegative),
    proofActionability:
      asObject(payment?.proofActionability) ?? fallback.proofActionability ?? null,
    cancelability: asObject(payment?.cancelability) ?? fallback.cancelability ?? null,
    isActionable: Boolean(payment?.isActionable ?? fallback.isActionable),
    isFromOperationalTruth: Boolean(payment),
  };
};

export const getSplitOperationalShipment = (split: unknown) => {
  const source = asObject(split);
  const truth = getSplitOperationalTruth(split);
  const shipment = asObject(truth?.shipment);

  return {
    status: normalizeCode(
      shipment?.status,
      source?.shippingStatus ?? source?.fulfillmentStatus ?? "WAITING_PAYMENT"
    ),
    statusMeta:
      asObject(shipment?.statusMeta) ??
      asObject(source?.shippingStatusMeta) ??
      asObject(source?.fulfillmentStatusMeta) ??
      null,
    isFinal: Boolean(
      shipment?.isFinal ??
        asObject(source?.shippingStatusMeta)?.isFinal ??
        asObject(source?.fulfillmentStatusMeta)?.isFinal
    ),
    isFinalNegative: Boolean(shipment?.isFinalNegative),
    isBlockedByPayment: Boolean(shipment?.isBlockedByPayment),
    blockedReason: shipment?.blockedReason ? String(shipment.blockedReason) : null,
    hasPersistedShipment:
      typeof shipment?.hasPersistedShipment === "boolean"
        ? shipment.hasPersistedShipment
        : Boolean(source?.hasPersistedShipment),
    usedLegacyFallback:
      typeof shipment?.usedLegacyFallback === "boolean"
        ? shipment.usedLegacyFallback
        : Boolean(source?.usedLegacyFallback),
    isActionable: Boolean(shipment?.isActionable),
    isFromOperationalTruth: Boolean(shipment),
  };
};

export const getSplitOperationalBridge = (split: unknown) => {
  const truth = getSplitOperationalTruth(split);
  const bridge = asObject(truth?.bridge);
  return {
    paymentToShipment: normalizeCode(bridge?.paymentToShipment, "UNKNOWN"),
    currentLane: normalizeCode(bridge?.currentLane, "PAYMENT"),
    shipmentBlocked: Boolean(bridge?.shipmentBlocked),
    shipmentBlockedReason: bridge?.shipmentBlockedReason
      ? String(bridge.shipmentBlockedReason)
      : null,
  };
};

export const getSplitOperationalFinality = (split: unknown) => {
  const truth = getSplitOperationalTruth(split);
  const finality = asObject(truth?.finality);
  const payment = getSplitOperationalPayment(split);
  const shipment = getSplitOperationalShipment(split);

  return {
    isFinal: Boolean((finality?.isFinal ?? payment.isFinal) || shipment.isFinal),
    isFinalNegative: Boolean(
      (finality?.isFinalNegative ?? payment.isFinalNegative) || shipment.isFinalNegative
    ),
    paymentIsFinal: Boolean(finality?.paymentIsFinal ?? payment.isFinal),
    shipmentIsFinal: Boolean(finality?.shipmentIsFinal ?? shipment.isFinal),
  };
};

export const getSplitOperationalStatusSummary = (split: unknown) => {
  const source = asObject(split);
  const truth = getSplitOperationalTruth(split);
  const summary = asObject(truth?.statusSummary);
  if (summary) return summary;

  const contractSummary = getOrderContractSummary(source?.contract);
  if (contractSummary) return contractSummary;

  const payment = getSplitOperationalPayment(split);
  const shipment = getSplitOperationalShipment(split);
  const bridge = getSplitOperationalBridge(split);

  if (bridge.currentLane === "SHIPMENT" || payment.status === "PAID") {
    return {
      lane: "SHIPMENT",
      code: shipment.status,
      label: shipment.statusMeta?.label || shipment.status,
      tone: shipment.statusMeta?.tone || "sky",
      description:
        shipment.blockedReason ||
        shipment.statusMeta?.description ||
        "Split shipment is the current operational lane.",
      isFinal: Boolean(shipment.isFinal),
    };
  }

  return {
    lane: "PAYMENT",
    code: payment.status,
    label: payment.statusMeta?.label || payment.status,
    tone: payment.statusMeta?.tone || "amber",
    description:
      payment.statusMeta?.description ||
      "Split payment must be settled before shipment starts.",
    isFinal: Boolean(payment.isFinal),
  };
};

export const getSplitOperationalBuyerAction = (split: unknown, code: string) => {
  const truth = getSplitOperationalTruth(split);
  const targetCode = normalizeCode(code);
  return (
    asActionList(asObject(truth?.actions)?.buyer).find(
      (action) => normalizeCode(action?.code) === targetCode
    ) || null
  );
};

export const getSplitOperationalEnabledBuyerAction = (
  split: unknown,
  code: string
) => {
  const action = getSplitOperationalBuyerAction(split, code);
  return action?.enabled ? action : null;
};

export const getSplitOperationalSellerFulfillmentActions = (split: unknown) => {
  const truth = getSplitOperationalTruth(split);
  return asActionList(asObject(truth?.actions)?.sellerFulfillment);
};

export const getSplitOperationalSellerShipmentActions = (split: unknown) => {
  const truth = getSplitOperationalTruth(split);
  return asActionList(asObject(truth?.actions)?.sellerShipment);
};

export const getSplitOperationalEnabledSellerFulfillmentActions = (split: unknown) =>
  getSplitOperationalSellerFulfillmentActions(split).filter(
    (action) => action?.enabled !== false
  );

export const getSplitOperationalEnabledSellerShipmentActions = (split: unknown) =>
  getSplitOperationalSellerShipmentActions(split).filter((action) => action?.enabled);

export const isSplitOperationallyFinal = (split: unknown) => {
  const truth = getSplitOperationalTruth(split);
  if (truth) return Boolean(getSplitOperationalFinality(split).isFinal);

  const payment = getGroupedPaymentReadModel(split);
  const shipmentMeta =
    asObject(asObject(split)?.shippingStatusMeta) ??
    asObject(asObject(split)?.fulfillmentStatusMeta);
  const contractSummary = getOrderContractSummary(asObject(split)?.contract);

  return Boolean(contractSummary?.isFinal && payment.isFinal && shipmentMeta?.isFinal);
};
