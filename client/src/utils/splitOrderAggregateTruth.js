import {
  getSplitOperationalFinality,
  getSplitOperationalStatusSummary,
} from "./splitOperationalTruth.ts";

const FINAL_NEGATIVE_CODES = new Set(["FAILED", "EXPIRED", "CANCELLED", "RETURNED"]);

export const summarizeSplitOperationalTruth = (splits) => {
  const summary = {
    totalCount: 0,
    awaitingPaymentCount: 0,
    underReviewCount: 0,
    finalNegativeCount: 0,
    shipmentLaneCount: 0,
  };

  (Array.isArray(splits) ? splits : []).forEach((split) => {
    const splitSummary = getSplitOperationalStatusSummary(split);
    const finality = getSplitOperationalFinality(split);
    const code = String(splitSummary?.code || "").trim().toUpperCase();
    const lane = String(splitSummary?.lane || "").trim().toUpperCase();

    summary.totalCount += 1;

    if (code === "AWAITING_PAYMENT") {
      summary.awaitingPaymentCount += 1;
      return;
    }

    if (code === "UNDER_REVIEW") {
      summary.underReviewCount += 1;
      return;
    }

    if (finality.isFinalNegative && FINAL_NEGATIVE_CODES.has(code)) {
      summary.finalNegativeCount += 1;
      return;
    }

    if (lane === "SHIPMENT") {
      summary.shipmentLaneCount += 1;
    }
  });

  return summary;
};

export const getSplitAttentionStatus = (splits) => {
  const summary = summarizeSplitOperationalTruth(splits);

  if (summary.awaitingPaymentCount > 0) {
    return {
      ...summary,
      code: "AWAITING_PAYMENT",
      label: "Split Payment Required",
      tone: "amber",
      isFinal: false,
      description: `Complete payment for ${summary.awaitingPaymentCount} store split${
        summary.awaitingPaymentCount === 1 ? "" : "s"
      } before shipment can continue.`,
    };
  }

  if (summary.underReviewCount > 0) {
    return {
      ...summary,
      code: "UNDER_REVIEW",
      label: "Split Payment Under Review",
      tone: "amber",
      isFinal: false,
      description: `${summary.underReviewCount} store split payment${
        summary.underReviewCount === 1 ? " is" : "s are"
      } still under backend review.`,
    };
  }

  if (summary.finalNegativeCount > 0) {
    const allSplitsAreFinalNegative =
      summary.totalCount > 0 && summary.finalNegativeCount === summary.totalCount;

    return {
      ...summary,
      code: allSplitsAreFinalNegative ? "FINAL_NEGATIVE" : "MIXED_EXCEPTION",
      label: "Order Needs Attention",
      tone: "rose",
      isFinal: allSplitsAreFinalNegative,
      description: allSplitsAreFinalNegative
        ? "Every store split is already closed or failed. Check the split cards below for the latest backend truth."
        : `${summary.finalNegativeCount} store split${
            summary.finalNegativeCount === 1 ? " is" : "s are"
          } already closed or failed. Check the split cards below for the latest backend truth.`,
    };
  }

  return null;
};
