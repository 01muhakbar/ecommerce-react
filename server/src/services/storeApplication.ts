import { z } from "zod";

export const STORE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "revision_requested",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const STORE_APPLICATION_OPEN_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "revision_requested",
] as const;

export const STORE_APPLICATION_STEPS = [
  "owner_identity",
  "store_information",
  "operational_address",
  "payout_payment",
  "compliance",
  "review",
] as const;

export type StoreApplicationStatus = (typeof STORE_APPLICATION_STATUSES)[number];
export type StoreApplicationStep = (typeof STORE_APPLICATION_STEPS)[number];

const nullableTrimmedString = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const normalized = String(value).trim();
      return normalized ? normalized : null;
    },
    z.string().max(max).nullable().optional()
  );

const nullableEmail = () =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const normalized = String(value).trim();
      return normalized ? normalized : null;
    },
    z.string().email().max(160).nullable().optional()
  );

const nullableInteger = () =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : value;
    },
    z.number().int().min(0).nullable().optional()
  );

export const ownerIdentitySnapshotSchema = z
  .object({
    fullName: nullableTrimmedString(160),
    operationalContactName: nullableTrimmedString(160),
    email: nullableEmail(),
    phoneNumber: nullableTrimmedString(64),
    birthDate: nullableTrimmedString(32),
    identityType: nullableTrimmedString(64),
    identityLegalName: nullableTrimmedString(160),
  })
  .strict();

export const storeInformationSnapshotSchema = z
  .object({
    storeName: nullableTrimmedString(160),
    storeSlug: nullableTrimmedString(180),
    storeCategory: nullableTrimmedString(120),
    description: nullableTrimmedString(4000),
    sellerType: nullableTrimmedString(80),
    isSelfProduced: z.boolean().optional(),
    initialProductCount: nullableInteger(),
  })
  .strict();

export const operationalAddressSnapshotSchema = z
  .object({
    contactName: nullableTrimmedString(160),
    phoneNumber: nullableTrimmedString(64),
    addressLine1: nullableTrimmedString(255),
    addressLine2: nullableTrimmedString(255),
    city: nullableTrimmedString(120),
    province: nullableTrimmedString(120),
    district: nullableTrimmedString(120),
    postalCode: nullableTrimmedString(32),
    country: nullableTrimmedString(120),
    notes: nullableTrimmedString(1000),
  })
  .strict();

export const payoutPaymentSnapshotSchema = z
  .object({
    payoutMethod: nullableTrimmedString(80),
    accountHolderName: nullableTrimmedString(160),
    accountNumber: nullableTrimmedString(120),
    bankName: nullableTrimmedString(160),
    qrisImageUrl: nullableTrimmedString(2048),
    accountHolderMatchesIdentity: z.boolean().optional(),
  })
  .strict();

export const complianceSnapshotSchema = z
  .object({
    supportEmail: nullableEmail(),
    supportPhone: nullableTrimmedString(64),
    taxId: nullableTrimmedString(64),
    identityNumber: nullableTrimmedString(64),
    productTypes: nullableTrimmedString(255),
    brandOwnershipType: nullableTrimmedString(80),
    authenticityConfirmed: z.boolean().optional(),
    prohibitedGoodsConfirmed: z.boolean().optional(),
    websiteUrl: nullableTrimmedString(2048),
    socialMediaUrl: nullableTrimmedString(2048),
    notes: nullableTrimmedString(4000),
    agreedToTerms: z.boolean().optional(),
    agreedToAdminReview: z.boolean().optional(),
    agreedToPlatformPolicy: z.boolean().optional(),
    understandsStoreInactiveUntilApproved: z.boolean().optional(),
  })
  .strict();

type OwnerIdentitySnapshot = z.infer<typeof ownerIdentitySnapshotSchema>;
type StoreInformationSnapshot = z.infer<typeof storeInformationSnapshotSchema>;
type OperationalAddressSnapshot = z.infer<typeof operationalAddressSnapshotSchema>;
type PayoutPaymentSnapshot = z.infer<typeof payoutPaymentSnapshotSchema>;
type ComplianceSnapshot = z.infer<typeof complianceSnapshotSchema>;

export const storeApplicationDraftPatchSchema = z
  .object({
    currentStep: z.enum(STORE_APPLICATION_STEPS).optional(),
    ownerIdentitySnapshot: ownerIdentitySnapshotSchema.partial().optional(),
    storeInformationSnapshot: storeInformationSnapshotSchema.partial().optional(),
    operationalAddressSnapshot: operationalAddressSnapshotSchema.partial().optional(),
    payoutPaymentSnapshot: payoutPaymentSnapshotSchema.partial().optional(),
    complianceSnapshot: complianceSnapshotSchema.partial().optional(),
  })
  .strict();

const DEFAULT_OWNER_IDENTITY_SNAPSHOT: OwnerIdentitySnapshot = {
  fullName: null,
  operationalContactName: null,
  email: null,
  phoneNumber: null,
  birthDate: null,
  identityType: null,
  identityLegalName: null,
};

const DEFAULT_STORE_INFORMATION_SNAPSHOT: StoreInformationSnapshot = {
  storeName: null,
  storeSlug: null,
  storeCategory: null,
  description: null,
  sellerType: null,
  isSelfProduced: false,
  initialProductCount: null,
};

const DEFAULT_OPERATIONAL_ADDRESS_SNAPSHOT: OperationalAddressSnapshot = {
  contactName: null,
  phoneNumber: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  province: null,
  district: null,
  postalCode: null,
  country: null,
  notes: null,
};

const DEFAULT_PAYOUT_PAYMENT_SNAPSHOT: PayoutPaymentSnapshot = {
  payoutMethod: null,
  accountHolderName: null,
  accountNumber: null,
  bankName: null,
  qrisImageUrl: null,
  accountHolderMatchesIdentity: false,
};

const DEFAULT_COMPLIANCE_SNAPSHOT: ComplianceSnapshot = {
  supportEmail: null,
  supportPhone: null,
  taxId: null,
  identityNumber: null,
  productTypes: null,
  brandOwnershipType: null,
  authenticityConfirmed: false,
  prohibitedGoodsConfirmed: false,
  websiteUrl: null,
  socialMediaUrl: null,
  notes: null,
  agreedToTerms: false,
  agreedToAdminReview: false,
  agreedToPlatformPolicy: false,
  understandsStoreInactiveUntilApproved: false,
};

const TRANSITION_GRAPH: Record<StoreApplicationStatus, StoreApplicationStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "revision_requested", "approved", "rejected", "cancelled"],
  under_review: ["revision_requested", "approved", "rejected"],
  revision_requested: ["submitted", "cancelled"],
  approved: [],
  rejected: [],
  cancelled: [],
};

const STATUS_META: Record<
  StoreApplicationStatus,
  { label: string; tone: string; description: string }
> = {
  draft: {
    label: "Draft",
    tone: "stone",
    description:
      "The application is still editable and has not entered marketplace review.",
  },
  submitted: {
    label: "Submitted",
    tone: "warning",
    description:
      "The application has been submitted and is waiting for marketplace review intake.",
  },
  under_review: {
    label: "Under review",
    tone: "sky",
    description:
      "Marketplace review is in progress. The applicant can monitor the application but cannot change it.",
  },
  revision_requested: {
    label: "Revision requested",
    tone: "rose",
    description:
      "Marketplace review asked for revisions. The applicant can update the same application and resubmit it.",
  },
  approved: {
    label: "Approved",
    tone: "emerald",
    description:
      "The application was approved and provisioned into the seller store boundary. Public operations still follow backend store status and readiness.",
  },
  rejected: {
    label: "Rejected",
    tone: "rose",
    description:
      "The application was rejected and is closed for this workflow iteration.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "stone",
    description:
      "The applicant cancelled the application before it moved into a terminal approval outcome.",
  },
};

const STEP_META: Record<
  StoreApplicationStep,
  { label: string; lane: string; description: string }
> = {
  owner_identity: {
    label: "Owner identity",
    lane: "ACCOUNT",
    description: "Applicant identity snapshot for the future store owner.",
  },
  store_information: {
    label: "Store information",
    lane: "APPLICATION",
    description: "Proposed store naming and store-facing summary information.",
  },
  operational_address: {
    label: "Operational address",
    lane: "APPLICATION",
    description: "Store operations address snapshot for onboarding review.",
  },
  payout_payment: {
    label: "Payout and payment",
    lane: "APPLICATION",
    description: "Seller payout and payment setup intent captured before activation.",
  },
  compliance: {
    label: "Compliance",
    lane: "APPLICATION",
    description: "Supporting compliance and support contact information for review.",
  },
  review: {
    label: "Review",
    lane: "REVIEW",
    description: "Submitted application is waiting for marketplace review handling.",
  },
};

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key] ?? row?.[key];

const toIsoString = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeObject = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
};

const normalizeMetadata = (value: unknown) => normalizeObject(value);

const mergeSnapshot = <T extends Record<string, any>>(
  base: T,
  patch: Partial<T> | undefined
): T => {
  if (!patch) return { ...base };
  return { ...base, ...patch };
};

export function createDefaultOwnerIdentitySnapshot(user: any) {
  const fullName = String(getAttr(user, "name") || "").trim() || null;
  const email = String(getAttr(user, "email") || "").trim() || null;
  const phoneNumber = String(
    getAttr(user, "phoneNumber") || getAttr(user, "phone_number") || ""
  ).trim() || null;

  return ownerIdentitySnapshotSchema.parse({
    ...DEFAULT_OWNER_IDENTITY_SNAPSHOT,
    fullName,
    email,
    phoneNumber,
  });
}

export function normalizeStoreApplicationDraftInput(input: unknown) {
  const parsed = storeApplicationDraftPatchSchema.parse(input ?? {});

  return {
    currentStep: parsed.currentStep,
    ownerIdentitySnapshot: parsed.ownerIdentitySnapshot
      ? ownerIdentitySnapshotSchema.parse(
          mergeSnapshot(DEFAULT_OWNER_IDENTITY_SNAPSHOT, parsed.ownerIdentitySnapshot)
        )
      : undefined,
    storeInformationSnapshot: parsed.storeInformationSnapshot
      ? storeInformationSnapshotSchema.parse(
          mergeSnapshot(DEFAULT_STORE_INFORMATION_SNAPSHOT, parsed.storeInformationSnapshot)
        )
      : undefined,
    operationalAddressSnapshot: parsed.operationalAddressSnapshot
      ? operationalAddressSnapshotSchema.parse(
          mergeSnapshot(
            DEFAULT_OPERATIONAL_ADDRESS_SNAPSHOT,
            parsed.operationalAddressSnapshot
          )
        )
      : undefined,
    payoutPaymentSnapshot: parsed.payoutPaymentSnapshot
      ? payoutPaymentSnapshotSchema.parse(
          mergeSnapshot(DEFAULT_PAYOUT_PAYMENT_SNAPSHOT, parsed.payoutPaymentSnapshot)
        )
      : undefined,
    complianceSnapshot: parsed.complianceSnapshot
      ? complianceSnapshotSchema.parse(
          mergeSnapshot(DEFAULT_COMPLIANCE_SNAPSHOT, parsed.complianceSnapshot)
        )
      : undefined,
  };
}

export function normalizeStoreApplicationSnapshots(application: any) {
  return {
    ownerIdentitySnapshot: ownerIdentitySnapshotSchema.parse(
      mergeSnapshot(
        DEFAULT_OWNER_IDENTITY_SNAPSHOT,
        normalizeObject(getAttr(application, "ownerIdentitySnapshot"))
      )
    ),
    storeInformationSnapshot: storeInformationSnapshotSchema.parse(
      mergeSnapshot(
        DEFAULT_STORE_INFORMATION_SNAPSHOT,
        normalizeObject(getAttr(application, "storeInformationSnapshot"))
      )
    ),
    operationalAddressSnapshot: operationalAddressSnapshotSchema.parse(
      mergeSnapshot(
        DEFAULT_OPERATIONAL_ADDRESS_SNAPSHOT,
        normalizeObject(getAttr(application, "operationalAddressSnapshot"))
      )
    ),
    payoutPaymentSnapshot: payoutPaymentSnapshotSchema.parse(
      mergeSnapshot(
        DEFAULT_PAYOUT_PAYMENT_SNAPSHOT,
        normalizeObject(getAttr(application, "payoutPaymentSnapshot"))
      )
    ),
    complianceSnapshot: complianceSnapshotSchema.parse(
      mergeSnapshot(
        DEFAULT_COMPLIANCE_SNAPSHOT,
        normalizeObject(getAttr(application, "complianceSnapshot"))
      )
    ),
  };
}

export function buildStoreApplicationCompleteness(application: any) {
  const snapshots = normalizeStoreApplicationSnapshots(application);
  const missingFields: Array<{ key: string; label: string; step: StoreApplicationStep }> = [];

  if (!snapshots.ownerIdentitySnapshot.fullName) {
    missingFields.push({
      key: "ownerIdentitySnapshot.fullName",
      label: "Owner full name",
      step: "owner_identity",
    });
  }
  if (!snapshots.ownerIdentitySnapshot.email) {
    missingFields.push({
      key: "ownerIdentitySnapshot.email",
      label: "Owner email",
      step: "owner_identity",
    });
  }
  if (!snapshots.storeInformationSnapshot.storeName) {
    missingFields.push({
      key: "storeInformationSnapshot.storeName",
      label: "Store name",
      step: "store_information",
    });
  }
  if (!snapshots.operationalAddressSnapshot.addressLine1) {
    missingFields.push({
      key: "operationalAddressSnapshot.addressLine1",
      label: "Address line 1",
      step: "operational_address",
    });
  }
  if (!snapshots.operationalAddressSnapshot.city) {
    missingFields.push({
      key: "operationalAddressSnapshot.city",
      label: "City",
      step: "operational_address",
    });
  }
  if (!snapshots.operationalAddressSnapshot.province) {
    missingFields.push({
      key: "operationalAddressSnapshot.province",
      label: "Province",
      step: "operational_address",
    });
  }
  if (!snapshots.operationalAddressSnapshot.country) {
    missingFields.push({
      key: "operationalAddressSnapshot.country",
      label: "Country",
      step: "operational_address",
    });
  }
  if (!snapshots.payoutPaymentSnapshot.payoutMethod) {
    missingFields.push({
      key: "payoutPaymentSnapshot.payoutMethod",
      label: "Payout method",
      step: "payout_payment",
    });
  }
  if (!snapshots.payoutPaymentSnapshot.accountHolderName) {
    missingFields.push({
      key: "payoutPaymentSnapshot.accountHolderName",
      label: "Account holder name",
      step: "payout_payment",
    });
  }
  if (!snapshots.complianceSnapshot.supportEmail) {
    missingFields.push({
      key: "complianceSnapshot.supportEmail",
      label: "Support email",
      step: "compliance",
    });
  }
  if (!snapshots.complianceSnapshot.agreedToTerms) {
    missingFields.push({
      key: "complianceSnapshot.agreedToTerms",
      label: "Terms acknowledgement",
      step: "compliance",
    });
  }

  const totalFields = 11;
  const completedFields = totalFields - missingFields.length;
  const isComplete = missingFields.length === 0;

  return {
    completedFields,
    totalFields,
    isComplete,
    label: isComplete ? "Ready to submit" : "Needs completion",
    description: isComplete
      ? "The minimum onboarding application fields are complete and ready for submission."
      : "Complete the missing application fields before submitting this store onboarding request.",
    missingFields,
  };
}

export function canTransitionStoreApplicationStatus(
  fromStatus: StoreApplicationStatus,
  toStatus: StoreApplicationStatus
) {
  return TRANSITION_GRAPH[fromStatus]?.includes(toStatus) || false;
}

export function buildStoreApplicationWorkflow(application: any) {
  const status = String(getAttr(application, "status") || "draft") as StoreApplicationStatus;
  const completeness = buildStoreApplicationCompleteness(application);
  const canEdit = status === "draft" || status === "revision_requested";
  const canSubmit = status === "draft" && completeness.isComplete;
  const canResubmit = status === "revision_requested" && completeness.isComplete;
  const canCancel =
    status === "draft" || status === "submitted" || status === "revision_requested";

  return {
    canEdit,
    canSubmit,
    canResubmit,
    canCancel,
    nextAllowedTransitions: [...(TRANSITION_GRAPH[status] || [])],
    sourceOfTruth:
      "Store onboarding application status is owned by the backend workflow and must not be inferred on the frontend.",
  };
}

export function buildStoreApplicationMutationMetadata(
  currentMetadata: unknown,
  extras: Record<string, any> = {}
) {
  return {
    ...normalizeMetadata(currentMetadata),
    ...extras,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function serializeStoreApplication(application: any) {
  if (!application) return null;

  const status = String(getAttr(application, "status") || "draft") as StoreApplicationStatus;
  const currentStep = String(
    getAttr(application, "currentStep") || "owner_identity"
  ) as StoreApplicationStep;
  const completeness = buildStoreApplicationCompleteness(application);
  const workflow = buildStoreApplicationWorkflow(application);
  const snapshots = normalizeStoreApplicationSnapshots(application);
  const internalMetadata = normalizeMetadata(getAttr(application, "internalMetadata"));
  const activationMetadata = normalizeMetadata(internalMetadata.activation);
  const applicantUser =
    application?.applicantUser ?? application?.get?.("applicantUser") ?? null;
  const reviewedByUser =
    application?.reviewedByUser ?? application?.get?.("reviewedByUser") ?? null;

  return {
    id: Number(getAttr(application, "id") || 0),
    applicant: {
      userId: Number(getAttr(application, "applicantUserId") || 0),
      name: applicantUser ? String(getAttr(applicantUser, "name") || "") : null,
      email: applicantUser ? String(getAttr(applicantUser, "email") || "") : null,
    },
    status,
    statusMeta: {
      code: status,
      ...(STATUS_META[status] || STATUS_META.draft),
    },
    currentStep,
    currentStepMeta: {
      code: currentStep,
      ...(STEP_META[currentStep] || STEP_META.owner_identity),
    },
    ownerIdentitySnapshot: snapshots.ownerIdentitySnapshot,
    storeInformationSnapshot: snapshots.storeInformationSnapshot,
    operationalAddressSnapshot: snapshots.operationalAddressSnapshot,
    payoutPaymentSnapshot: snapshots.payoutPaymentSnapshot,
    complianceSnapshot: snapshots.complianceSnapshot,
    submittedAt: toIsoString(getAttr(application, "submittedAt")),
    reviewedAt: toIsoString(getAttr(application, "reviewedAt")),
    reviewedBy: reviewedByUser
      ? {
          id: Number(getAttr(reviewedByUser, "id") || 0) || null,
          name: String(getAttr(reviewedByUser, "name") || ""),
          email: String(getAttr(reviewedByUser, "email") || ""),
        }
      : null,
    revisionNote: getAttr(application, "revisionNote")
      ? String(getAttr(application, "revisionNote"))
      : null,
    rejectReason: getAttr(application, "rejectReason")
      ? String(getAttr(application, "rejectReason"))
      : null,
    completeness,
    workflow,
    activation: {
      storeId: Number(activationMetadata.storeId || 0) || null,
      storeSlug: activationMetadata.storeSlug ? String(activationMetadata.storeSlug) : null,
      storeStatus: activationMetadata.storeStatus ? String(activationMetadata.storeStatus) : null,
      ownerMembershipId: Number(activationMetadata.ownerMembershipId || 0) || null,
      ownerMembershipStatus: activationMetadata.ownerMembershipStatus
        ? String(activationMetadata.ownerMembershipStatus)
        : null,
      sellerAccessReady: Boolean(activationMetadata.sellerAccessReady),
      provisionedAt: activationMetadata.provisionedAt
        ? String(activationMetadata.provisionedAt)
        : null,
      provisionedMode: activationMetadata.provisionedMode
        ? String(activationMetadata.provisionedMode)
        : null,
    },
    internalMetadata,
    contract: {
      sourceOfTruth: "store_application",
      supportedStatuses: [...STORE_APPLICATION_STATUSES],
      supportedSteps: [...STORE_APPLICATION_STEPS],
      notes: [
        "Store application is an orchestration layer before seller workspace onboarding, not a replacement for the store domain.",
        "Creating or editing an application never creates a public or active store automatically.",
        "Approval can provision the existing store and owner membership boundary, while public operations remain gated by Store.status and backend readiness.",
      ],
    },
    createdAt: toIsoString(getAttr(application, "createdAt")),
    updatedAt: toIsoString(getAttr(application, "updatedAt")),
  };
}
