import { api } from "./axios.ts";
import { presentStoreApplicationStatus } from "../utils/storeOnboardingPresentation.ts";

export type StoreApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "cancelled";

export type StoreApplicationStep =
  | "owner_identity"
  | "store_information"
  | "operational_address"
  | "payout_payment"
  | "compliance"
  | "review";

export type StoreApplicationSnapshotState = {
  ownerIdentitySnapshot: {
    fullName: string | null;
    operationalContactName: string | null;
    email: string | null;
    phoneNumber: string | null;
    birthDate: string | null;
    identityType: string | null;
    identityLegalName: string | null;
  };
  storeInformationSnapshot: {
    storeName: string | null;
    storeSlug: string | null;
    storeCategory: string | null;
    description: string | null;
    sellerType: string | null;
    isSelfProduced: boolean;
    initialProductCount: number | null;
  };
  operationalAddressSnapshot: {
    contactName: string | null;
    phoneNumber: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    province: string | null;
    district: string | null;
    postalCode: string | null;
    country: string | null;
    notes: string | null;
  };
  payoutPaymentSnapshot: {
    payoutMethod: string | null;
    accountHolderName: string | null;
    accountNumber: string | null;
    bankName: string | null;
    qrisImageUrl: string | null;
    accountHolderMatchesIdentity: boolean;
  };
  complianceSnapshot: {
    supportEmail: string | null;
    supportPhone: string | null;
    taxId: string | null;
    identityNumber: string | null;
    productTypes: string | null;
    brandOwnershipType: string | null;
    authenticityConfirmed: boolean;
    prohibitedGoodsConfirmed: boolean;
    websiteUrl: string | null;
    socialMediaUrl: string | null;
    notes: string | null;
    agreedToTerms: boolean;
    agreedToAdminReview: boolean;
    agreedToPlatformPolicy: boolean;
    understandsStoreInactiveUntilApproved: boolean;
  };
};

export type StoreApplicationRecord = StoreApplicationSnapshotState & {
  id: number;
  status: StoreApplicationStatus;
  statusMeta: {
    code: StoreApplicationStatus;
    label: string;
    tone: string;
    description: string | null;
  };
  currentStep: StoreApplicationStep;
  currentStepMeta: {
    code: StoreApplicationStep;
    label: string;
    lane: string;
    description: string | null;
  };
  applicant: {
    userId: number;
    name: string | null;
    email: string | null;
  };
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: {
    id: number | null;
    name: string;
    email: string;
  } | null;
  revisionNote: string | null;
  rejectReason: string | null;
  completeness: {
    completedFields: number;
    totalFields: number;
    isComplete: boolean;
    label: string;
    description: string | null;
    missingFields: Array<{
      key: string;
      label: string;
      step: StoreApplicationStep;
    }>;
  };
  workflow: {
    canEdit: boolean;
    canSubmit: boolean;
    canResubmit: boolean;
    canCancel: boolean;
    nextAllowedTransitions: StoreApplicationStatus[];
    sourceOfTruth: string | null;
  };
  activation: {
    storeId: number | null;
    storeSlug: string | null;
    storeStatus: string | null;
    ownerMembershipId: number | null;
    ownerMembershipStatus: string | null;
    sellerAccessReady: boolean;
    provisionedAt: string | null;
    provisionedMode: string | null;
  };
  contract: {
    sourceOfTruth: string | null;
    supportedStatuses: string[];
    supportedSteps: string[];
    notes: string[];
  };
  internalMetadata: Record<string, any>;
  createdAt: string | null;
  updatedAt: string | null;
};

const textOrNull = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const textOrFallback = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const booleanOrFalse = (value: unknown) => Boolean(value);

const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};

export const createEmptyStoreApplicationSnapshots = (): StoreApplicationSnapshotState => ({
  ownerIdentitySnapshot: {
    fullName: null,
    operationalContactName: null,
    email: null,
    phoneNumber: null,
    birthDate: null,
    identityType: null,
    identityLegalName: null,
  },
  storeInformationSnapshot: {
    storeName: null,
    storeSlug: null,
    storeCategory: null,
    description: null,
    sellerType: null,
    isSelfProduced: false,
    initialProductCount: null,
  },
  operationalAddressSnapshot: {
    contactName: null,
    phoneNumber: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    province: null,
    district: null,
    postalCode: null,
    country: "Indonesia",
    notes: null,
  },
  payoutPaymentSnapshot: {
    payoutMethod: null,
    accountHolderName: null,
    accountNumber: null,
    bankName: null,
    qrisImageUrl: null,
    accountHolderMatchesIdentity: false,
  },
  complianceSnapshot: {
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
  },
});

const normalizeSnapshots = (payload: any): StoreApplicationSnapshotState => {
  const empty = createEmptyStoreApplicationSnapshots();
  const owner = asObject(payload?.ownerIdentitySnapshot);
  const store = asObject(payload?.storeInformationSnapshot);
  const address = asObject(payload?.operationalAddressSnapshot);
  const payout = asObject(payload?.payoutPaymentSnapshot);
  const compliance = asObject(payload?.complianceSnapshot);

  return {
    ownerIdentitySnapshot: {
      fullName: textOrNull(owner.fullName),
      operationalContactName: textOrNull(owner.operationalContactName),
      email: textOrNull(owner.email),
      phoneNumber: textOrNull(owner.phoneNumber),
      birthDate: textOrNull(owner.birthDate),
      identityType: textOrNull(owner.identityType),
      identityLegalName: textOrNull(owner.identityLegalName),
    },
    storeInformationSnapshot: {
      storeName: textOrNull(store.storeName),
      storeSlug: textOrNull(store.storeSlug),
      storeCategory: textOrNull(store.storeCategory),
      description: textOrNull(store.description),
      sellerType: textOrNull(store.sellerType),
      isSelfProduced:
        typeof store.isSelfProduced === "boolean"
          ? store.isSelfProduced
          : empty.storeInformationSnapshot.isSelfProduced,
      initialProductCount: numberOrNull(store.initialProductCount),
    },
    operationalAddressSnapshot: {
      contactName: textOrNull(address.contactName),
      phoneNumber: textOrNull(address.phoneNumber),
      addressLine1: textOrNull(address.addressLine1),
      addressLine2: textOrNull(address.addressLine2),
      city: textOrNull(address.city),
      province: textOrNull(address.province),
      district: textOrNull(address.district),
      postalCode: textOrNull(address.postalCode),
      country: textOrNull(address.country) || empty.operationalAddressSnapshot.country,
      notes: textOrNull(address.notes),
    },
    payoutPaymentSnapshot: {
      payoutMethod: textOrNull(payout.payoutMethod),
      accountHolderName: textOrNull(payout.accountHolderName),
      accountNumber: textOrNull(payout.accountNumber),
      bankName: textOrNull(payout.bankName),
      qrisImageUrl: textOrNull(payout.qrisImageUrl),
      accountHolderMatchesIdentity: booleanOrFalse(payout.accountHolderMatchesIdentity),
    },
    complianceSnapshot: {
      supportEmail: textOrNull(compliance.supportEmail),
      supportPhone: textOrNull(compliance.supportPhone),
      taxId: textOrNull(compliance.taxId),
      identityNumber: textOrNull(compliance.identityNumber),
      productTypes: textOrNull(compliance.productTypes),
      brandOwnershipType: textOrNull(compliance.brandOwnershipType),
      authenticityConfirmed: booleanOrFalse(compliance.authenticityConfirmed),
      prohibitedGoodsConfirmed: booleanOrFalse(compliance.prohibitedGoodsConfirmed),
      websiteUrl: textOrNull(compliance.websiteUrl),
      socialMediaUrl: textOrNull(compliance.socialMediaUrl),
      notes: textOrNull(compliance.notes),
      agreedToTerms: booleanOrFalse(compliance.agreedToTerms),
      agreedToAdminReview: booleanOrFalse(compliance.agreedToAdminReview),
      agreedToPlatformPolicy: booleanOrFalse(compliance.agreedToPlatformPolicy),
      understandsStoreInactiveUntilApproved: booleanOrFalse(
        compliance.understandsStoreInactiveUntilApproved
      ),
    },
  };
};

const normalizeStoreApplication = (payload: any): StoreApplicationRecord | null => {
  if (!payload || typeof payload !== "object") return null;

  const completeness = asObject(payload.completeness);
  const workflow = asObject(payload.workflow);
  const activation = asObject(payload.activation);
  const contract = asObject(payload.contract);
  const snapshots = normalizeSnapshots(payload);
  const normalizedStatus = presentStoreApplicationStatus(
    payload?.statusMeta,
    textOrFallback(payload.status, "draft") as StoreApplicationStatus
  );

  return {
    id: Number(payload.id || 0),
    applicant: {
      userId: Number(payload?.applicant?.userId || 0),
      name: textOrNull(payload?.applicant?.name),
      email: textOrNull(payload?.applicant?.email),
    },
    status: textOrFallback(payload.status, "draft") as StoreApplicationStatus,
    statusMeta: {
      code: normalizedStatus.code,
      label: normalizedStatus.label,
      tone: normalizedStatus.tone,
      description: normalizedStatus.description,
    },
    currentStep: textOrFallback(payload.currentStep, "owner_identity") as StoreApplicationStep,
    currentStepMeta: {
      code: textOrFallback(
        payload?.currentStepMeta?.code || payload?.currentStep,
        "owner_identity"
      ) as StoreApplicationStep,
      label: textOrFallback(payload?.currentStepMeta?.label, "Owner identity"),
      lane: textOrFallback(payload?.currentStepMeta?.lane, "APPLICATION"),
      description: textOrNull(payload?.currentStepMeta?.description),
    },
    ...snapshots,
    submittedAt: payload?.submittedAt || null,
    reviewedAt: payload?.reviewedAt || null,
    reviewedBy: payload?.reviewedBy
      ? {
          id: numberOrNull(payload.reviewedBy.id),
          name: textOrFallback(payload.reviewedBy.name),
          email: textOrFallback(payload.reviewedBy.email),
        }
      : null,
    revisionNote: textOrNull(payload.revisionNote),
    rejectReason: textOrNull(payload.rejectReason),
    completeness: {
      completedFields: Number(completeness.completedFields || 0),
      totalFields: Number(completeness.totalFields || 0),
      isComplete: Boolean(completeness.isComplete),
      label: textOrFallback(completeness.label, "Needs completion"),
      description: textOrNull(completeness.description),
      missingFields: Array.isArray(completeness.missingFields)
        ? completeness.missingFields
            .map((entry: any) => ({
              key: textOrFallback(entry?.key),
              label: textOrFallback(entry?.label, "Unknown field"),
              step: textOrFallback(entry?.step, "owner_identity") as StoreApplicationStep,
            }))
            .filter((entry: { key: string }) => Boolean(entry.key))
        : [],
    },
    workflow: {
      canEdit: Boolean(workflow.canEdit),
      canSubmit: Boolean(workflow.canSubmit),
      canResubmit: Boolean(workflow.canResubmit),
      canCancel: Boolean(workflow.canCancel),
      nextAllowedTransitions: Array.isArray(workflow.nextAllowedTransitions)
        ? workflow.nextAllowedTransitions
            .map((entry: unknown) => textOrFallback(entry))
            .filter(Boolean) as StoreApplicationStatus[]
        : [],
      sourceOfTruth: textOrNull(workflow.sourceOfTruth),
    },
    activation: {
      storeId: numberOrNull(activation.storeId),
      storeSlug: textOrNull(activation.storeSlug),
      storeStatus: textOrNull(activation.storeStatus),
      ownerMembershipId: numberOrNull(activation.ownerMembershipId),
      ownerMembershipStatus: textOrNull(activation.ownerMembershipStatus),
      sellerAccessReady: Boolean(activation.sellerAccessReady),
      provisionedAt: textOrNull(activation.provisionedAt),
      provisionedMode: textOrNull(activation.provisionedMode),
    },
    contract: {
      sourceOfTruth: textOrNull(contract.sourceOfTruth),
      supportedStatuses: Array.isArray(contract.supportedStatuses)
        ? contract.supportedStatuses.map((entry: unknown) => textOrFallback(entry)).filter(Boolean)
        : [],
      supportedSteps: Array.isArray(contract.supportedSteps)
        ? contract.supportedSteps.map((entry: unknown) => textOrFallback(entry)).filter(Boolean)
        : [],
      notes: Array.isArray(contract.notes)
        ? contract.notes.map((entry: unknown) => textOrFallback(entry)).filter(Boolean)
        : [],
    },
    internalMetadata: asObject(payload.internalMetadata),
    createdAt: payload?.createdAt || null,
    updatedAt: payload?.updatedAt || null,
  };
};

const unwrapStoreApplication = (payload: any) => {
  if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data ? normalizeStoreApplication(payload.data) : null;
  }
  return normalizeStoreApplication(payload);
};

export const getCurrentUserStoreApplication = async () => {
  const { data } = await api.get("/user/store-applications/current");
  return unwrapStoreApplication(data);
};

export const getUserStoreApplicationById = async (applicationId: number | string) => {
  const { data } = await api.get(`/user/store-applications/${applicationId}`);
  return unwrapStoreApplication(data);
};

export const createUserStoreApplicationDraft = async (payload: Record<string, unknown> = {}) => {
  const { data } = await api.post("/user/store-applications/draft", payload);
  return unwrapStoreApplication(data);
};

export const updateUserStoreApplicationDraft = async (
  applicationId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.patch(`/user/store-applications/${applicationId}/draft`, payload);
  return unwrapStoreApplication(data);
};

export const submitUserStoreApplication = async (applicationId: number | string) => {
  const { data } = await api.post(`/user/store-applications/${applicationId}/submit`);
  return unwrapStoreApplication(data);
};

export const resubmitUserStoreApplication = async (applicationId: number | string) => {
  const { data } = await api.post(`/user/store-applications/${applicationId}/resubmit`);
  return unwrapStoreApplication(data);
};

export const cancelUserStoreApplication = async (applicationId: number | string) => {
  const { data } = await api.post(`/user/store-applications/${applicationId}/cancel`);
  return unwrapStoreApplication(data);
};
