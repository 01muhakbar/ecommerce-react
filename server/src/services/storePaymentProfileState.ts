const requiredStorePaymentProfileFields = [
  { key: "accountName", label: "Account name" },
  { key: "merchantName", label: "Merchant name" },
  { key: "qrisImageUrl", label: "QRIS image" },
] as const;

const editableSellerPaymentProfileFields = [
  "accountName",
  "merchantName",
  "merchantId",
  "qrisImageUrl",
  "qrisPayload",
  "instructionText",
  "sellerNote",
] as const;

const openSellerPaymentRequestStatuses = ["DRAFT", "SUBMITTED", "NEEDS_REVISION"] as const;
const adminVisibleStorePaymentRequestStatuses = ["SUBMITTED", "NEEDS_REVISION"] as const;

const storePaymentProfileRequestAttributes = [
  "id",
  "storeId",
  "basedOnProfileId",
  "requestStatus",
  "accountName",
  "merchantName",
  "merchantId",
  "qrisImageUrl",
  "qrisPayload",
  "instructionText",
  "sellerNote",
  "adminReviewNote",
  "submittedByUserId",
  "submittedAt",
  "reviewedByAdminId",
  "reviewedAt",
  "promotedProfileId",
  "createdAt",
  "updatedAt",
] as const;

const getStorePaymentProfileAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const hasStorePaymentProfileText = (value: unknown) => String(value || "").trim().length > 0;

const normalizeStorePaymentProfileNullableText = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const normalizeStorePaymentProfileRequiredText = (value: unknown) => String(value || "").trim();

const getEditableStorePaymentProfileDraftValue = (
  payload: Record<string, unknown>,
  key: string,
  fallback: unknown
) => (Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : fallback);

const getStorePaymentProfileRequestStatusCode = (request: any) =>
  String(getStorePaymentProfileAttr(request, "requestStatus") || "").trim().toUpperCase();

const buildEmptyStorePaymentProfileReadiness = () => ({
  code: "INCOMPLETE",
  label: "Incomplete",
  tone: "warning",
  description:
    "Some required payment destination fields are still missing. Complete them, save draft if needed, then submit for admin review.",
  isReady: false,
  isIncomplete: true,
  completedFields: 0,
  totalFields: requiredStorePaymentProfileFields.length,
  missingFields: requiredStorePaymentProfileFields.map((field) => ({
    key: field.key,
    label: field.label,
  })),
});

const buildStorePaymentProfileVerificationMeta = (verificationStatusValue: unknown) => {
  const code = String(verificationStatusValue || "PENDING").toUpperCase();

  if (code === "ACTIVE") {
    return {
      code,
      label: "Verified",
      tone: "success",
      description: "Admin review has marked this payment profile as approved.",
    };
  }

  if (code === "REJECTED") {
    return {
      code,
      label: "Rejected",
      tone: "danger",
      description:
        "Admin review rejected this payment profile. The seller must revise the request and submit it again before the setup can go live.",
    };
  }

  if (code === "INACTIVE") {
    return {
      code,
      label: "Inactive",
      tone: "neutral",
      description: "The payment profile exists, but it is not active for seller operations.",
    };
  }

  return {
    code,
    label: "Pending review",
    tone: "warning",
    description: "Payment profile data has been submitted and is still waiting for admin review.",
  };
};

const buildStorePaymentProfileActivityMeta = (isActiveValue: unknown) => {
  const isActive = Boolean(isActiveValue);
  return {
    code: isActive ? "ACTIVE" : "INACTIVE",
    label: isActive ? "Active" : "Inactive",
    tone: isActive ? "success" : "neutral",
    description: isActive
      ? "This payment destination is active for the store."
      : "This payment destination is not active yet.",
  };
};

const buildStorePaymentProfileReadiness = (profile: any) => {
  const missingFields = requiredStorePaymentProfileFields
    .filter((field) => !hasStorePaymentProfileText(getStorePaymentProfileAttr(profile, field.key)))
    .map((field) => ({
      key: field.key,
      label: field.label,
    }));

  const totalFields = requiredStorePaymentProfileFields.length;
  const completedFields = totalFields - missingFields.length;
  const verificationStatus = String(
    getStorePaymentProfileAttr(profile, "verificationStatus") || "PENDING"
  ).toUpperCase();
  const isActive = Boolean(getStorePaymentProfileAttr(profile, "isActive"));
  let code = "PENDING_REVIEW";
  let label = "Pending review";
  let tone = "warning";
  let description =
    "Required payment fields are present, but admin review still decides whether the profile can go live.";

  if (missingFields.length > 0) {
    code = "INCOMPLETE";
    label = "Incomplete";
    tone = "warning";
    description =
      "Some required payment destination fields are still missing. Complete them in the seller payment setup lane, then submit for admin review.";
  } else if (verificationStatus === "REJECTED") {
    code = "REJECTED";
    label = "Rejected";
    tone = "danger";
    description =
      "The payment profile was reviewed and rejected. Seller can only monitor the snapshot here.";
  } else if (verificationStatus === "ACTIVE" && isActive) {
    code = "READY";
    label = "Ready";
    tone = "success";
    description = "The payment profile is complete, approved, and active for seller operations.";
  } else if (verificationStatus === "INACTIVE" || !isActive) {
    code = "INACTIVE";
    label = "Inactive";
    tone = "neutral";
    description =
      "The payment profile exists, but activation is still blocked by the existing review or store configuration flow.";
  }

  return {
    code,
    label,
    tone,
    description,
    isReady: code === "READY",
    isIncomplete: code === "INCOMPLETE",
    completedFields,
    totalFields,
    missingFields,
  };
};

const serializeStorePaymentProfileActiveSnapshot = (profile: any) => {
  if (!profile) return null;

  const verificationStatus = String(
    getStorePaymentProfileAttr(profile, "verificationStatus") || "PENDING"
  );
  const isActive = Boolean(getStorePaymentProfileAttr(profile, "isActive"));

  return {
    id: Number(getStorePaymentProfileAttr(profile, "id") || 0),
    storeId: Number(getStorePaymentProfileAttr(profile, "storeId") || 0),
    providerCode: String(getStorePaymentProfileAttr(profile, "providerCode") || "MANUAL_QRIS"),
    paymentType: String(getStorePaymentProfileAttr(profile, "paymentType") || "QRIS_STATIC"),
    version: Number(getStorePaymentProfileAttr(profile, "version") || 1),
    snapshotStatus: String(getStorePaymentProfileAttr(profile, "snapshotStatus") || "INACTIVE"),
    accountName: String(getStorePaymentProfileAttr(profile, "accountName") || ""),
    merchantName: String(getStorePaymentProfileAttr(profile, "merchantName") || ""),
    merchantId: getStorePaymentProfileAttr(profile, "merchantId")
      ? String(getStorePaymentProfileAttr(profile, "merchantId"))
      : null,
    qrisImageUrl: getStorePaymentProfileAttr(profile, "qrisImageUrl")
      ? String(getStorePaymentProfileAttr(profile, "qrisImageUrl"))
      : null,
    qrisPayload: getStorePaymentProfileAttr(profile, "qrisPayload")
      ? String(getStorePaymentProfileAttr(profile, "qrisPayload"))
      : null,
    instructionText: getStorePaymentProfileAttr(profile, "instructionText")
      ? String(getStorePaymentProfileAttr(profile, "instructionText"))
      : null,
    isActive,
    verificationStatus,
    verificationMeta: buildStorePaymentProfileVerificationMeta(verificationStatus),
    activityMeta: buildStorePaymentProfileActivityMeta(isActive),
    readiness: buildStorePaymentProfileReadiness(profile),
    verifiedAt: getStorePaymentProfileAttr(profile, "verifiedAt") || null,
    updatedAt: getStorePaymentProfileAttr(profile, "updatedAt") || null,
    createdAt: getStorePaymentProfileAttr(profile, "createdAt") || null,
  };
};

const serializeStorePaymentProfilePendingRequest = (request: any, activeProfile: any = null) => {
  if (!request) return null;

  const fallback = (key: string) => {
    const requestValue = getStorePaymentProfileAttr(request, key);
    if (requestValue !== undefined && requestValue !== null) return requestValue;
    return getStorePaymentProfileAttr(activeProfile, key);
  };
  const submittedByUser = request?.submittedByUser ?? request?.get?.("submittedByUser") ?? null;
  const reviewedByAdmin = request?.reviewedByAdmin ?? request?.get?.("reviewedByAdmin") ?? null;

  return {
    id: Number(getStorePaymentProfileAttr(request, "id") || 0),
    storeId: Number(
      getStorePaymentProfileAttr(request, "storeId") ||
        getStorePaymentProfileAttr(activeProfile, "storeId") ||
        0
    ),
    basedOnProfileId:
      Number(
        getStorePaymentProfileAttr(request, "basedOnProfileId") ||
          getStorePaymentProfileAttr(activeProfile, "id") ||
          0
      ) || null,
    requestStatus: getStorePaymentProfileRequestStatusCode(request) || "DRAFT",
    accountName: String(fallback("accountName") || ""),
    merchantName: String(fallback("merchantName") || ""),
    merchantId: fallback("merchantId") ? String(fallback("merchantId")) : null,
    qrisImageUrl: fallback("qrisImageUrl") ? String(fallback("qrisImageUrl")) : null,
    qrisPayload: fallback("qrisPayload") ? String(fallback("qrisPayload")) : null,
    instructionText: fallback("instructionText") ? String(fallback("instructionText")) : null,
    sellerNote: getStorePaymentProfileAttr(request, "sellerNote")
      ? String(getStorePaymentProfileAttr(request, "sellerNote"))
      : null,
    adminReviewNote: getStorePaymentProfileAttr(request, "adminReviewNote")
      ? String(getStorePaymentProfileAttr(request, "adminReviewNote"))
      : null,
    readiness: buildStorePaymentProfileReadiness({
      accountName: fallback("accountName"),
      merchantName: fallback("merchantName"),
      merchantId: fallback("merchantId"),
      qrisImageUrl: fallback("qrisImageUrl"),
      qrisPayload: fallback("qrisPayload"),
      instructionText: fallback("instructionText"),
      isActive: false,
      verificationStatus: "PENDING",
    }),
    submittedAt: getStorePaymentProfileAttr(request, "submittedAt") || null,
    reviewedAt: getStorePaymentProfileAttr(request, "reviewedAt") || null,
    submittedBy: submittedByUser
      ? {
          id: Number(getStorePaymentProfileAttr(submittedByUser, "id") || 0) || null,
          name: String(getStorePaymentProfileAttr(submittedByUser, "name") || ""),
          email: getStorePaymentProfileAttr(submittedByUser, "email")
            ? String(getStorePaymentProfileAttr(submittedByUser, "email"))
            : null,
        }
      : null,
    reviewedBy: reviewedByAdmin
      ? {
          id: Number(getStorePaymentProfileAttr(reviewedByAdmin, "id") || 0) || null,
          name: String(getStorePaymentProfileAttr(reviewedByAdmin, "name") || ""),
          email: getStorePaymentProfileAttr(reviewedByAdmin, "email")
            ? String(getStorePaymentProfileAttr(reviewedByAdmin, "email"))
            : null,
        }
      : null,
    updatedAt: getStorePaymentProfileAttr(request, "updatedAt") || null,
    createdAt: getStorePaymentProfileAttr(request, "createdAt") || null,
  };
};

const isSellerPaymentProfileRequestLockedForEdit = (pendingRequest: any) =>
  getStorePaymentProfileRequestStatusCode(pendingRequest) === "SUBMITTED";

const buildSellerPaymentProfileGovernance = ({
  canView = true,
  sellerCanEdit = false,
  pendingRequest = null,
  reviewStatus = null,
  nextStep = null,
}: {
  canView?: boolean;
  sellerCanEdit?: boolean;
  pendingRequest?: any;
  reviewStatus?: any;
  nextStep?: any;
}) => {
  const permissionCanEdit = Boolean(sellerCanEdit);
  const isReviewLocked = isSellerPaymentProfileRequestLockedForEdit(pendingRequest);
  const canEdit = permissionCanEdit && !isReviewLocked;

  return {
    canView,
    permissionCanEdit,
    canEdit,
    isReviewLocked,
    mode: canEdit
      ? "SELLER_EDITABLE_REQUEST"
      : permissionCanEdit && isReviewLocked
        ? "SELLER_REVIEW_LOCKED"
        : "READ_ONLY_SNAPSHOT",
    managedBy: "SELLER_REQUEST_ADMIN_FINAL_APPROVAL",
    editableFields: canEdit ? [...editableSellerPaymentProfileFields] : [],
    readOnlyFields: [
      "providerCode",
      "paymentType",
      "verificationStatus",
      "isActive",
      "verifiedByAdminId",
      "verifiedAt",
    ],
    reviewStatus: reviewStatus
      ? {
          code: String(reviewStatus.code || ""),
          label: String(reviewStatus.label || ""),
          tone: String(reviewStatus.tone || "stone"),
          description: reviewStatus.description ? String(reviewStatus.description) : null,
        }
      : null,
    submittedAt: getStorePaymentProfileAttr(pendingRequest, "submittedAt") || null,
    reviewedAt:
      getStorePaymentProfileAttr(pendingRequest, "reviewedAt") ||
      reviewStatus?.reviewedAt ||
      null,
    nextStep: nextStep
      ? {
          code: String(nextStep.code || ""),
          label: String(nextStep.label || ""),
          lane: String(nextStep.lane || ""),
          actor: String(nextStep.actor || ""),
          description: nextStep.description ? String(nextStep.description) : null,
        }
      : null,
    lockReason: isReviewLocked
      ? "Seller request is already submitted and locked while admin review is in progress."
      : null,
    note: canEdit
      ? "Seller can edit only the separate store-scoped payment request fields here. Admin still controls approval, rejection, activation, and deactivation."
      : permissionCanEdit && isReviewLocked
        ? "Seller write lane is temporarily locked because the latest request is already under admin review."
        : "Seller workspace only exposes a read-only payment setup snapshot. Final approval and activation still belong to admin governance.",
  };
};

export {
  adminVisibleStorePaymentRequestStatuses,
  buildEmptyStorePaymentProfileReadiness,
  buildSellerPaymentProfileGovernance,
  buildStorePaymentProfileActivityMeta,
  buildStorePaymentProfileReadiness,
  buildStorePaymentProfileVerificationMeta,
  editableSellerPaymentProfileFields,
  getEditableStorePaymentProfileDraftValue,
  getStorePaymentProfileAttr,
  getStorePaymentProfileRequestStatusCode,
  hasStorePaymentProfileText,
  isSellerPaymentProfileRequestLockedForEdit,
  normalizeStorePaymentProfileNullableText,
  normalizeStorePaymentProfileRequiredText,
  openSellerPaymentRequestStatuses,
  requiredStorePaymentProfileFields,
  serializeStorePaymentProfileActiveSnapshot,
  serializeStorePaymentProfilePendingRequest,
  storePaymentProfileRequestAttributes,
};
