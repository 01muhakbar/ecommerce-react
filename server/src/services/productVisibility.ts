const normalizeProductStatus = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "inactive") return "inactive";
  return "draft";
};

const normalizeSubmissionStatus = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "submitted") return "submitted";
  if (normalized === "needs_revision") return "needs_revision";
  return "none";
};

const normalizeStoreStatus = (value: unknown) =>
  String(value || "").trim().toUpperCase();

export const isStorefrontStoreActive = (input: {
  storeStatus?: unknown;
  storeId?: unknown;
}) => {
  const storeStatus = normalizeStoreStatus(input?.storeStatus);
  if (storeStatus === "ACTIVE") {
    return true;
  }
  return false;
};

export const buildProductVisibilitySnapshot = (input: {
  isPublished: boolean;
  status: unknown;
  submissionStatus?: unknown;
  storeStatus?: unknown;
  storeId?: unknown;
}) => {
  const isPublished = Boolean(input?.isPublished);
  const status = normalizeProductStatus(input?.status);
  const submissionStatus = normalizeSubmissionStatus(input?.submissionStatus);
  const storeActive = isStorefrontStoreActive({
    storeStatus: input?.storeStatus,
    storeId: input?.storeId,
  });
  const reviewBlocked = submissionStatus !== "none";
  const storefrontVisible =
    isPublished && status === "active" && !reviewBlocked && storeActive;
  const blockingSignals: string[] = [];

  if (!isPublished) {
    blockingSignals.push("PUBLISH_OFF");
  }
  if (status !== "active") {
    blockingSignals.push("STATUS_NOT_ACTIVE");
  }
  if (submissionStatus === "submitted") {
    blockingSignals.push("SELLER_REVIEW_PENDING");
  }
  if (submissionStatus === "needs_revision") {
    blockingSignals.push("SELLER_REVISION_REQUIRED");
  }
  if (!storeActive) {
    blockingSignals.push("STORE_NOT_ACTIVE");
  }

  const stateCode = !isPublished
    ? "INTERNAL_ONLY"
    : storefrontVisible
      ? "STOREFRONT_VISIBLE"
      : "PUBLISHED_BLOCKED";
  const reasonCode = !isPublished
    ? "UNPUBLISHED"
    : submissionStatus === "submitted"
      ? "REVIEW_PENDING"
      : submissionStatus === "needs_revision"
        ? "REVISION_REQUIRED"
        : !storeActive
          ? "STORE_NOT_ACTIVE"
          : storefrontVisible
            ? "STOREFRONT_VISIBLE"
            : "STATUS_NOT_ACTIVE";

  const sellerLabel = !isPublished
    ? status === "draft"
      ? "Draft in seller workspace"
      : "Hidden from storefront"
    : storefrontVisible
      ? "Visible in storefront"
      : submissionStatus === "submitted"
        ? "Published but waiting admin review"
        : submissionStatus === "needs_revision"
          ? "Published but revision is still required"
          : !storeActive
            ? "Published but store is inactive"
            : "Published but blocked";
  const storefrontReason = !isPublished
    ? "Public storefront queries exclude this product because the publish flag is off."
    : storefrontVisible
      ? "Public storefront queries include this product because publish is on, status is active, and the store is active."
      : submissionStatus === "submitted"
        ? "Publish is on, but this product is still waiting for the final admin review outcome and stays hidden from storefront queries."
        : submissionStatus === "needs_revision"
          ? "Publish is on, but this product is still in revision-required review state and stays hidden from storefront queries."
          : !storeActive
            ? "Publish is on, but the linked store is not active, so storefront queries still exclude this product."
            : "Publish is on, but public storefront queries still exclude this product until status becomes active.";
  const sellerHint = !isPublished
    ? "Seller can still review this product here, but customers cannot see it yet."
    : storefrontVisible
      ? "Seller and customer views are aligned for visibility."
      : submissionStatus === "submitted"
        ? "Seller can see that publish is on, but admin review still blocks storefront visibility."
        : submissionStatus === "needs_revision"
          ? "Seller can see that publish is on, but revision follow-up still blocks storefront visibility."
          : !storeActive
            ? "Seller can keep this product published internally, but storefront visibility stays blocked until the store becomes active."
            : "Seller can review this product here, but customers will not see it until status becomes active.";

  return {
    isPublished,
    storefrontVisible,
    stateCode,
    label: isPublished ? "Published" : "Private",
    publishLabel: isPublished ? "Published" : "Private",
    sellerLabel,
    storefrontLabel: storefrontVisible ? "Visible in storefront" : "Hidden from storefront",
    storefrontReason,
    sellerHint,
    blockingSignals,
    reasonCode,
  };
};
