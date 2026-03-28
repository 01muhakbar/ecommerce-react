import { api } from "./axios.ts";

const textOrNull = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const textOrFallback = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const numberOrZero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatusMeta = (value: any, fallbackCode = "draft", fallbackLabel = "Draft") => ({
  code: textOrFallback(value?.code, fallbackCode),
  label: textOrFallback(value?.label, fallbackLabel),
  tone: textOrFallback(value?.tone, "stone"),
});

const normalizeCompleteness = (value: any) => ({
  completedFields: numberOrZero(value?.completedFields),
  totalFields: numberOrZero(value?.totalFields),
  isComplete: Boolean(value?.isComplete),
  label: textOrFallback(value?.label, "Needs completion"),
  description: textOrNull(value?.description),
  missingFields: Array.isArray(value?.missingFields)
    ? value.missingFields
        .map((entry: any) => ({
          key: textOrFallback(entry?.key),
          label: textOrFallback(entry?.label, "Unknown field"),
          step: textOrNull(entry?.step),
        }))
        .filter((entry: { key: string }) => Boolean(entry.key))
    : [],
});

const normalizeReviewedBy = (value: any) =>
  value
    ? {
        id: numberOrZero(value.id) || null,
        name: textOrFallback(value.name),
        email: textOrNull(value.email),
      }
    : null;

const normalizeActionGovernance = (value: any) => ({
  canApprove: Boolean(value?.canApprove),
  canRequestRevision: Boolean(value?.canRequestRevision),
  canReject: Boolean(value?.canReject),
  boundaryNote: textOrNull(value?.boundaryNote),
});

const normalizeIdentityMatch = (value: any) => ({
  matchedCount: numberOrZero(value?.matchedCount),
  totalComparable: numberOrZero(value?.totalComparable),
  summaryLabel: textOrFallback(value?.summaryLabel, "No comparable identity fields"),
  fields: Array.isArray(value?.fields)
    ? value.fields
        .map((entry: any) => ({
          key: textOrFallback(entry?.key),
          label: textOrFallback(entry?.label, "Unknown field"),
          matched: Boolean(entry?.matched),
          accountValue: textOrNull(entry?.accountValue),
          applicationValue: textOrNull(entry?.applicationValue),
        }))
        .filter((entry: { key: string }) => Boolean(entry.key))
    : [],
});

const normalizeListItem = (value: any) => ({
  id: numberOrZero(value?.id),
  status: textOrFallback(value?.status, "draft"),
  statusMeta: normalizeStatusMeta(value?.statusMeta, value?.status, "Draft"),
  currentStep: textOrFallback(value?.currentStep, "owner_identity"),
  currentStepMeta: {
    code: textOrFallback(value?.currentStepMeta?.code || value?.currentStep, "owner_identity"),
    label: textOrFallback(value?.currentStepMeta?.label, "Owner identity"),
  },
  applicant: {
    userId: numberOrZero(value?.applicant?.userId),
    accountName: textOrNull(value?.applicant?.accountName),
    accountEmail: textOrNull(value?.applicant?.accountEmail),
    accountPhone: textOrNull(value?.applicant?.accountPhone),
    identityMatch: {
      matchedCount: numberOrZero(value?.applicant?.identityMatch?.matchedCount),
      totalComparable: numberOrZero(value?.applicant?.identityMatch?.totalComparable),
      summaryLabel: textOrFallback(
        value?.applicant?.identityMatch?.summaryLabel,
        "No comparable identity fields"
      ),
    },
  },
  storeInformation: {
    storeName: textOrNull(value?.storeInformation?.storeName),
    storeSlug: textOrNull(value?.storeInformation?.storeSlug),
    storeCategory: textOrNull(value?.storeInformation?.storeCategory),
    sellerType: textOrNull(value?.storeInformation?.sellerType),
  },
  completeness: normalizeCompleteness(value?.completeness),
  submittedAt: value?.submittedAt || null,
  reviewedAt: value?.reviewedAt || null,
  reviewedBy: normalizeReviewedBy(value?.reviewedBy),
  reviewSummary: {
    revisionNote: textOrNull(value?.reviewSummary?.revisionNote),
    rejectReason: textOrNull(value?.reviewSummary?.rejectReason),
    internalAdminNote: textOrNull(value?.reviewSummary?.internalAdminNote),
  },
  actionGovernance: normalizeActionGovernance(value?.actionGovernance),
  createdAt: value?.createdAt || null,
  updatedAt: value?.updatedAt || null,
});

const normalizeDetail = (value: any) => {
  if (!value || typeof value !== "object") return null;

  return {
    id: numberOrZero(value.id),
    status: textOrFallback(value.status, "draft"),
    statusMeta: normalizeStatusMeta(value.statusMeta, value.status, "Draft"),
    currentStep: textOrFallback(value.currentStep, "owner_identity"),
    currentStepMeta: {
      code: textOrFallback(value?.currentStepMeta?.code || value?.currentStep, "owner_identity"),
      label: textOrFallback(value?.currentStepMeta?.label, "Owner identity"),
    },
    applicant: {
      userId: numberOrZero(value?.applicant?.userId),
      accountName: textOrNull(value?.applicant?.accountName),
      accountEmail: textOrNull(value?.applicant?.accountEmail),
      accountPhone: textOrNull(value?.applicant?.accountPhone),
      accountRole: textOrNull(value?.applicant?.accountRole),
      accountStatus: textOrNull(value?.applicant?.accountStatus),
      identityMatch: normalizeIdentityMatch(value?.applicant?.identityMatch),
    },
    ownerIdentity: {
      fullName: textOrNull(value?.ownerIdentity?.fullName),
      operationalContactName: textOrNull(value?.ownerIdentity?.operationalContactName),
      identityType: textOrNull(value?.ownerIdentity?.identityType),
      identityNumber: textOrNull(value?.ownerIdentity?.identityNumber),
      identityLegalName: textOrNull(value?.ownerIdentity?.identityLegalName),
      birthDate: textOrNull(value?.ownerIdentity?.birthDate),
    },
    storeInformation: {
      storeName: textOrNull(value?.storeInformation?.storeName),
      storeSlug: textOrNull(value?.storeInformation?.storeSlug),
      storeCategory: textOrNull(value?.storeInformation?.storeCategory),
      description: textOrNull(value?.storeInformation?.description),
      sellerType: textOrNull(value?.storeInformation?.sellerType),
      isSelfProduced: Boolean(value?.storeInformation?.isSelfProduced),
      initialProductCount:
        value?.storeInformation?.initialProductCount === null
          ? null
          : numberOrZero(value?.storeInformation?.initialProductCount),
    },
    operationalVerification: {
      contactName: textOrNull(value?.operationalVerification?.contactName),
      phoneNumber: textOrNull(value?.operationalVerification?.phoneNumber),
      addressLine1: textOrNull(value?.operationalVerification?.addressLine1),
      addressLine2: textOrNull(value?.operationalVerification?.addressLine2),
      province: textOrNull(value?.operationalVerification?.province),
      city: textOrNull(value?.operationalVerification?.city),
      district: textOrNull(value?.operationalVerification?.district),
      postalCode: textOrNull(value?.operationalVerification?.postalCode),
      country: textOrNull(value?.operationalVerification?.country),
      addressNotes: textOrNull(value?.operationalVerification?.addressNotes),
      fullAddress: textOrNull(value?.operationalVerification?.fullAddress),
    },
    financialVerification: {
      payoutMethod: textOrNull(value?.financialVerification?.payoutMethod),
      accountHolderName: textOrNull(value?.financialVerification?.accountHolderName),
      bankChannel: textOrNull(value?.financialVerification?.bankChannel),
      accountNumberMasked: textOrNull(value?.financialVerification?.accountNumberMasked),
      accountHolderMatchesIdentity: Boolean(
        value?.financialVerification?.accountHolderMatchesIdentity
      ),
      taxId: textOrNull(value?.financialVerification?.taxId),
    },
    complianceRisk: {
      productTypes: textOrNull(value?.complianceRisk?.productTypes),
      brandOwnershipType: textOrNull(value?.complianceRisk?.brandOwnershipType),
      authenticityConfirmed: Boolean(value?.complianceRisk?.authenticityConfirmed),
      prohibitedGoodsConfirmed: Boolean(value?.complianceRisk?.prohibitedGoodsConfirmed),
      websiteUrl: textOrNull(value?.complianceRisk?.websiteUrl),
      socialMediaUrl: textOrNull(value?.complianceRisk?.socialMediaUrl),
      supportEmail: textOrNull(value?.complianceRisk?.supportEmail),
      supportPhone: textOrNull(value?.complianceRisk?.supportPhone),
      additionalNotes: textOrNull(value?.complianceRisk?.additionalNotes),
    },
    workflowSummary: {
      applicationStatus: textOrFallback(value?.workflowSummary?.applicationStatus, "draft"),
      currentStep: textOrFallback(value?.workflowSummary?.currentStep, "owner_identity"),
      completeness: normalizeCompleteness(value?.workflowSummary?.completeness),
      submittedAt: value?.workflowSummary?.submittedAt || null,
      reviewedAt: value?.workflowSummary?.reviewedAt || null,
      reviewedBy: normalizeReviewedBy(value?.workflowSummary?.reviewedBy),
      revisionNote: textOrNull(value?.workflowSummary?.revisionNote),
      rejectReason: textOrNull(value?.workflowSummary?.rejectReason),
      internalAdminNote: textOrNull(value?.workflowSummary?.internalAdminNote),
      revisionSummary: textOrNull(value?.workflowSummary?.revisionSummary),
      actionGovernance: normalizeActionGovernance(value?.workflowSummary?.actionGovernance),
      activation: {
        storeId: numberOrZero(value?.workflowSummary?.activation?.storeId) || null,
        storeSlug: textOrNull(value?.workflowSummary?.activation?.storeSlug),
        storeStatus: textOrNull(value?.workflowSummary?.activation?.storeStatus),
        ownerMembershipId:
          numberOrZero(value?.workflowSummary?.activation?.ownerMembershipId) || null,
        ownerMembershipStatus: textOrNull(
          value?.workflowSummary?.activation?.ownerMembershipStatus
        ),
        sellerAccessReady: Boolean(value?.workflowSummary?.activation?.sellerAccessReady),
        provisionedAt: textOrNull(value?.workflowSummary?.activation?.provisionedAt),
        provisionedMode: textOrNull(value?.workflowSummary?.activation?.provisionedMode),
      },
    },
    contract: {
      sourceOfTruth: textOrNull(value?.contract?.sourceOfTruth),
      notes: Array.isArray(value?.contract?.notes)
        ? value.contract.notes
            .map((entry: unknown) => textOrNull(entry))
            .filter((entry: string | null): entry is string => Boolean(entry))
        : [],
    },
    metadata: {
      submittedCount: numberOrZero(value?.metadata?.submittedCount),
      lastSubmittedAt: textOrNull(value?.metadata?.lastSubmittedAt),
      lastResubmittedAt: textOrNull(value?.metadata?.lastResubmittedAt),
      createdFrom: textOrNull(value?.metadata?.createdFrom),
    },
    createdAt: value?.createdAt || null,
    updatedAt: value?.updatedAt || null,
  };
};

export const fetchAdminStoreApplications = async (params: {
  page?: number;
  limit?: number;
  status?: string;
} = {}) => {
  const { data } = await api.get("/admin/store-applications", { params });
  const items = Array.isArray(data?.data) ? data.data.map(normalizeListItem).filter(Boolean) : [];
  return {
    items,
    meta: {
      page: numberOrZero(data?.meta?.page) || 1,
      limit: numberOrZero(data?.meta?.limit) || 10,
      total: numberOrZero(data?.meta?.total),
      totalPages: numberOrZero(data?.meta?.totalPages) || 1,
      statusFilter: textOrNull(data?.meta?.statusFilter),
    },
  };
};

export const fetchAdminStoreApplicationDetail = async (applicationId: number | string) => {
  const { data } = await api.get(`/admin/store-applications/${applicationId}`);
  return normalizeDetail(data?.data ?? null);
};

export const approveAdminStoreApplication = async (
  applicationId: number | string,
  payload: { internalAdminNote?: string | null } = {}
) => {
  const { data } = await api.patch(
    `/admin/store-applications/${applicationId}/approve`,
    payload
  );
  return normalizeDetail(data?.data ?? null);
};

export const requestAdminStoreApplicationRevision = async (
  applicationId: number | string,
  payload: {
    revisionNote: string;
    revisionSummary?: string | null;
    internalAdminNote?: string | null;
  }
) => {
  const { data } = await api.patch(
    `/admin/store-applications/${applicationId}/revision-request`,
    payload
  );
  return normalizeDetail(data?.data ?? null);
};

export const rejectAdminStoreApplication = async (
  applicationId: number | string,
  payload: {
    rejectReason: string;
    internalAdminNote?: string | null;
  }
) => {
  const { data } = await api.patch(
    `/admin/store-applications/${applicationId}/reject`,
    payload
  );
  return normalizeDetail(data?.data ?? null);
};
