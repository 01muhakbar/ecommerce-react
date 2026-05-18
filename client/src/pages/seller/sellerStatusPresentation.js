export const sellerStatusBadge = {
  active: { label: "Active", tone: "emerald" },
  ready: { label: "Ready", tone: "emerald" },
  needsSetup: { label: "Needs setup", tone: "amber" },
  pendingReview: { label: "Pending review", tone: "amber" },
  blocked: { label: "Blocked", tone: "rose" },
  incomplete: { label: "Incomplete", tone: "amber" },
  readOnly: { label: "Read-only", tone: "stone" },
};

export function getSellerStatusBadge(value, fallback = sellerStatusBadge.incomplete) {
  const code = String(value?.code || value?.label || value || "").trim().toUpperCase();

  if (!code) return fallback;
  if (code.includes("BLOCK") || code.includes("FAILED") || code.includes("REJECT")) {
    return sellerStatusBadge.blocked;
  }
  if (code.includes("PENDING") || code.includes("SUBMITTED") || code.includes("REVIEW")) {
    return sellerStatusBadge.pendingReview;
  }
  if (code.includes("INCOMPLETE") || code.includes("NEEDS_ACTION")) {
    return sellerStatusBadge.incomplete;
  }
  if (code.includes("NEEDS_SETUP") || code.includes("MISSING") || code.includes("DRAFT")) {
    return sellerStatusBadge.needsSetup;
  }
  if (code.includes("READY") || code.includes("APPROVED") || code.includes("VERIFIED")) {
    return sellerStatusBadge.ready;
  }
  if (code.includes("ACTIVE") || code.includes("PAID")) {
    return sellerStatusBadge.active;
  }

  return fallback;
}

export function getPaymentSetupSummary({ paymentSetupReady, requestStatus, reviewStatus }) {
  const requestCode = String(requestStatus?.code || "").trim().toUpperCase();
  const reviewCode = String(reviewStatus?.code || "").trim().toUpperCase();

  if (paymentSetupReady) {
    return {
      ...sellerStatusBadge.ready,
      title: "Ready to receive payments",
      message: "Checkout can use this payment setup.",
    };
  }

  if (requestCode === "SUBMITTED" || reviewCode.includes("PENDING")) {
    return {
      ...sellerStatusBadge.pendingReview,
      title: "Waiting for admin review",
      message: "The active setup stays unchanged until approval.",
    };
  }

  return {
    ...sellerStatusBadge.needsSetup,
    title: "Payment is not ready",
    message: "Complete the required info and submit it for review.",
  };
}
