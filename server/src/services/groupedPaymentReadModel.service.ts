import {
  buildBuyerCancelActionability,
  buildBuyerProofActionability,
  resolveBuyerFacingPaymentStatus,
} from "./paymentCheckoutView.service.js";
import { buildPaymentStatusMeta } from "./orderLifecycleContract.service.js";

const normalizeUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const resolveMissingPaymentStatus = (suborderPaymentStatus: string) => {
  if (
    [
      "PAID",
      "PENDING_CONFIRMATION",
      "FAILED",
      "EXPIRED",
      "CANCELLED",
    ].includes(suborderPaymentStatus)
  ) {
    return suborderPaymentStatus;
  }
  return "UNPAID";
};

export const buildGroupedPaymentReadModel = (input: {
  paymentStatus?: unknown;
  suborderPaymentStatus?: unknown;
  expiresAt?: unknown;
  hasPaymentRecord?: unknown;
  missingPaymentReason?: unknown;
}) => {
  const settlementStatus = normalizeUpper(input.suborderPaymentStatus, "UNPAID") || "UNPAID";
  const hasPaymentRecord = input.hasPaymentRecord === undefined ? true : Boolean(input.hasPaymentRecord);
  const rawStatus = hasPaymentRecord
    ? normalizeUpper(input.paymentStatus, "CREATED") || "CREATED"
    : resolveMissingPaymentStatus(settlementStatus);
  const status = hasPaymentRecord
    ? resolveBuyerFacingPaymentStatus({
        paymentStatus: input.paymentStatus,
        suborderPaymentStatus: settlementStatus,
        expiresAt: input.expiresAt,
      })
    : rawStatus;
  const proofActionability = hasPaymentRecord
    ? buildBuyerProofActionability(status)
    : {
        canStartProof: false,
        reason: String(input.missingPaymentReason || "Payment record not found for this suborder."),
      };
  const cancelability = hasPaymentRecord
    ? buildBuyerCancelActionability(status)
    : {
        canCancel: false,
        reason: String(input.missingPaymentReason || "Payment record not found for this suborder."),
      };
  const statusMeta = buildPaymentStatusMeta(status);

  return {
    status,
    statusMeta,
    rawStatus,
    rawStatusMeta: buildPaymentStatusMeta(rawStatus),
    settlementStatus,
    settlementStatusMeta: buildPaymentStatusMeta(settlementStatus),
    expiresAt: input.expiresAt || null,
    proofActionability,
    cancelability,
    isFinal: Boolean(statusMeta?.isFinal),
    isActionable: Boolean(
      proofActionability?.canStartProof || cancelability?.canCancel
    ),
  };
};
