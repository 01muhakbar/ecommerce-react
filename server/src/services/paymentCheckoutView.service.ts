const normalizeStatus = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const countStatuses = (statuses: string[]) =>
  statuses.reduce<Record<string, number>>((accumulator, status) => {
    accumulator[status] = (accumulator[status] || 0) + 1;
    return accumulator;
  }, {});

export const resolveBuyerFacingPaymentStatus = (input: {
  paymentStatus?: unknown;
  suborderPaymentStatus?: unknown;
  expiresAt?: unknown;
}) => {
  const suborderPaymentStatus = normalizeStatus(input.suborderPaymentStatus, "UNPAID");
  if (suborderPaymentStatus === "CANCELLED") return "CANCELLED";
  const paymentStatus = normalizeStatus(input.paymentStatus, "CREATED");
  if (paymentStatus === "EXPIRED") return "EXPIRED";
  if (paymentStatus === "CREATED" || paymentStatus === "REJECTED") {
    const expiresAt = new Date(String(input.expiresAt || ""));
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return "EXPIRED";
    }
  }
  return paymentStatus;
};

export const buildBuyerProofActionability = (displayStatus: unknown) => {
  const status = normalizeStatus(displayStatus, "CREATED");
  if (status === "CREATED") {
    return {
      canStartProof: true,
      reason: null,
    };
  }
  if (status === "REJECTED") {
    return {
      canStartProof: true,
      reason: null,
    };
  }
  if (status === "PENDING_CONFIRMATION") {
    return {
      canStartProof: false,
      reason: "Seller is still reviewing the latest proof for this payment.",
    };
  }
  if (status === "PAID") {
    return {
      canStartProof: false,
      reason: "Payment has already been approved.",
    };
  }
  if (status === "EXPIRED") {
    return {
      canStartProof: false,
      reason: "Payment deadline has expired.",
    };
  }
  if (status === "CANCELLED") {
    return {
      canStartProof: false,
      reason: "This transaction has been cancelled.",
    };
  }
  return {
    canStartProof: false,
    reason: "This payment is no longer accepting proof submission.",
  };
};

export const buildBuyerCancelActionability = (displayStatus: unknown) => {
  const status = normalizeStatus(displayStatus, "CREATED");
  if (status === "CREATED" || status === "REJECTED") {
    return {
      canCancel: true,
      reason: null,
    };
  }
  if (status === "PENDING_CONFIRMATION") {
    return {
      canCancel: false,
      reason: "This payment is already waiting for seller review.",
    };
  }
  if (status === "PAID") {
    return {
      canCancel: false,
      reason: "This payment has already been approved.",
    };
  }
  if (status === "EXPIRED") {
    return {
      canCancel: false,
      reason: "This payment has already expired.",
    };
  }
  if (status === "CANCELLED") {
    return {
      canCancel: false,
      reason: "This transaction has already been cancelled.",
    };
  }
  return {
    canCancel: false,
    reason: "This transaction can no longer be cancelled.",
  };
};

export const buildBuyerOrderPaymentEntry = (displayStatuses: unknown[]) => {
  const normalizedStatuses = (Array.isArray(displayStatuses) ? displayStatuses : [])
    .map((status) => normalizeStatus(status))
    .filter(Boolean);
  const counts = countStatuses(normalizedStatuses);
  const actionableCount = (counts.CREATED || 0) + (counts.REJECTED || 0);
  const reviewCount = counts.PENDING_CONFIRMATION || 0;
  const paidCount = counts.PAID || 0;
  const cancelledCount = counts.CANCELLED || 0;
  const expiredCount = counts.EXPIRED || 0;
  const totalGroups = normalizedStatuses.length;

  if (actionableCount > 0) {
    return {
      visible: true,
      label: "Continue Payment",
      summaryStatus: "ACTION_REQUIRED",
      summaryLabel: "Awaiting payment",
      actionableCount,
      reviewCount,
      paidCount,
      cancelledCount,
      expiredCount,
      totalGroups,
    };
  }

  if (reviewCount > 0) {
    return {
      visible: true,
      label: "Order Payment",
      summaryStatus: "UNDER_REVIEW",
      summaryLabel: "Under review",
      actionableCount,
      reviewCount,
      paidCount,
      cancelledCount,
      expiredCount,
      totalGroups,
    };
  }

  return {
    visible: false,
    label: null,
    summaryStatus: paidCount > 0 && paidCount === totalGroups ? "PAID" : "FINAL",
    summaryLabel:
      paidCount > 0 && paidCount === totalGroups
        ? "Payment complete"
        : cancelledCount > 0
          ? "Transaction closed"
          : expiredCount > 0
            ? "Payment expired"
            : "Payment closed",
    actionableCount,
    reviewCount,
    paidCount,
    cancelledCount,
    expiredCount,
    totalGroups,
  };
};
