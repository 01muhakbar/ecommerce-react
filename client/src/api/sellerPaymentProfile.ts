import { api } from "./axios.ts";

const textOrNull = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const textOrFallback = (value: unknown, fallback = "", secondaryFallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback || secondaryFallback;
};

const normalizeMissingFields = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => ({
          key: textOrFallback((entry as any)?.key),
          label: textOrFallback((entry as any)?.label, "Unknown field"),
        }))
        .filter((entry) => entry.key)
    : [];

const normalizeActor = (value: any) =>
  value
    ? {
        id: Number(value.id || 0) || null,
        name: textOrFallback(value.name),
        email: textOrNull(value.email),
      }
    : null;

const normalizeStatusChip = (
  value: any,
  fallbackLabel: string,
  fallbackTone: string,
  fallbackCode: string
) => ({
  code: textOrFallback(value?.code, fallbackCode),
  label: textOrFallback(value?.label, fallbackLabel),
  tone: textOrFallback(value?.tone, fallbackTone),
  description: textOrNull(value?.description),
});

const normalizeReadiness = (value: any, fallbackLabel = "Incomplete") => {
  const missingFields = normalizeMissingFields(value?.missingFields);
  const totalFields = Number(value?.totalFields || missingFields.length || 0);
  const completedFields = Number(value?.completedFields ?? Math.max(totalFields - missingFields.length, 0));

  return {
    code: textOrFallback(value?.code, "INCOMPLETE"),
    label: textOrFallback(value?.label, fallbackLabel),
    tone: textOrFallback(value?.tone, "warning"),
    description: textOrNull(value?.description),
    isReady: Boolean(value?.isReady),
    isIncomplete:
      value?.isIncomplete !== undefined ? Boolean(value.isIncomplete) : missingFields.length > 0,
    completedFields,
    totalFields,
    missingFields,
  };
};

const normalizeSnapshot = (value: any) => {
  if (!value) return null;

  return {
    id: Number(value.id || 0) || null,
    storeId: Number(value.storeId || 0) || null,
    providerCode: textOrFallback(value.providerCode, "MANUAL_QRIS"),
    paymentType: textOrFallback(value.paymentType, "QRIS_STATIC"),
    version: Number(value.version || 1),
    snapshotStatus: textOrFallback(value.snapshotStatus, "INACTIVE"),
    accountName: textOrNull(value.accountName),
    merchantName: textOrNull(value.merchantName),
    merchantId: textOrNull(value.merchantId),
    qrisImageUrl: textOrNull(value.qrisImageUrl),
    qrisPayload: textOrNull(value.qrisPayload),
    instructionText: textOrNull(value.instructionText),
    isActive: Boolean(value.isActive),
    verificationStatus: textOrFallback(value.verificationStatus, "INACTIVE"),
    verificationMeta: normalizeStatusChip(
      value.verificationMeta,
      value.isActive ? "Verified" : "Inactive",
      value.isActive ? "success" : "neutral",
      value.verificationStatus || "INACTIVE"
    ),
    activityMeta: normalizeStatusChip(
      value.activityMeta,
      value.isActive ? "Active" : "Inactive",
      value.isActive ? "success" : "neutral",
      value.isActive ? "ACTIVE" : "INACTIVE"
    ),
    readiness: normalizeReadiness(value.readiness, "Pending review"),
    verifiedAt: value.verifiedAt || null,
    updatedAt: value.updatedAt || null,
    createdAt: value.createdAt || null,
  };
};

const normalizePendingRequest = (value: any, activeSnapshot: any) => {
  if (!value) return null;

  return {
    id: Number(value.id || 0) || null,
    storeId: Number(value.storeId || activeSnapshot?.storeId || 0) || null,
    basedOnProfileId: Number(value.basedOnProfileId || 0) || null,
    requestStatus: textOrFallback(value.requestStatus, "DRAFT"),
    accountName: textOrFallback(value.accountName, activeSnapshot?.accountName || ""),
    merchantName: textOrFallback(value.merchantName, activeSnapshot?.merchantName || ""),
    merchantId: textOrNull(value.merchantId ?? activeSnapshot?.merchantId),
    qrisImageUrl: textOrFallback(value.qrisImageUrl, activeSnapshot?.qrisImageUrl || ""),
    qrisPayload: textOrNull(value.qrisPayload ?? activeSnapshot?.qrisPayload),
    instructionText: textOrNull(value.instructionText ?? activeSnapshot?.instructionText),
    sellerNote: textOrNull(value.sellerNote),
    adminReviewNote: textOrNull(value.adminReviewNote),
    readiness: normalizeReadiness(value.readiness, "Draft request"),
    submittedAt: value.submittedAt || null,
    reviewedAt: value.reviewedAt || null,
    submittedBy: normalizeActor(value.submittedBy),
    reviewedBy: normalizeActor(value.reviewedBy),
    updatedAt: value.updatedAt || null,
    createdAt: value.createdAt || null,
  };
};

const normalizeReadModel = (payload: any) => {
  const completeness = payload?.readModel?.completeness || {};

  return {
    primaryStatus: normalizeStatusChip(
      payload?.readModel?.primaryStatus,
      payload?.readiness?.label || "Pending admin review",
      payload?.readiness?.tone || "warning",
      payload?.readiness?.code || "PENDING_ADMIN_REVIEW"
    ),
    reviewStatus: {
      ...normalizeStatusChip(
        payload?.readModel?.reviewStatus,
        payload?.reviewFeedback?.label || payload?.verificationMeta?.label || "Pending review",
        payload?.reviewFeedback?.tone || payload?.verificationMeta?.tone || "warning",
        payload?.reviewFeedback?.code || payload?.verificationStatus || "PENDING"
      ),
      authority: textOrFallback(payload?.readModel?.reviewStatus?.authority, "ADMIN"),
      reviewedAt:
        payload?.readModel?.reviewStatus?.reviewedAt ||
        payload?.reviewFeedback?.reviewedAt ||
        payload?.verifiedAt ||
        null,
      reviewedBy: normalizeActor(
        payload?.readModel?.reviewStatus?.reviewedBy || payload?.reviewFeedback?.reviewedBy
      ),
      adminReviewNote:
        textOrNull(payload?.readModel?.reviewStatus?.adminReviewNote) ||
        textOrNull(payload?.reviewFeedback?.adminReviewNote),
      source: textOrFallback(payload?.readModel?.reviewStatus?.source, payload?.reviewFeedback?.source, "ACTIVE_SNAPSHOT"),
    },
    requestState: {
      code: textOrFallback(payload?.readModel?.requestState?.code, payload?.requestStatus?.code, "DRAFT"),
      label: textOrFallback(payload?.readModel?.requestState?.label, payload?.requestStatus?.label, "Draft request"),
      tone: textOrFallback(payload?.readModel?.requestState?.tone, payload?.requestStatus?.tone, "stone"),
      description:
        textOrNull(payload?.readModel?.requestState?.description) ||
        textOrNull(payload?.requestStatus?.description),
      isSubmitted: Boolean(
        payload?.readModel?.requestState?.isSubmitted ?? payload?.requestStatus?.isSubmitted
      ),
      isDraft: Boolean(payload?.readModel?.requestState?.isDraft ?? payload?.requestStatus?.isDraft),
    },
    completeness: {
      completedFields: Number(completeness?.completedFields ?? payload?.readiness?.completedFields ?? 0),
      totalFields: Number(completeness?.totalFields ?? payload?.readiness?.totalFields ?? 0),
      allRequiredPresent:
        completeness?.allRequiredPresent !== undefined
          ? Boolean(completeness.allRequiredPresent)
          : normalizeMissingFields(completeness?.missingFields ?? payload?.readiness?.missingFields).length === 0,
      missingFields: normalizeMissingFields(completeness?.missingFields ?? payload?.readiness?.missingFields),
      requiredFields: normalizeMissingFields(completeness?.requiredFields),
    },
    nextStep: {
      code: textOrFallback(payload?.readModel?.nextStep?.code, "WAIT_ADMIN_REVIEW"),
      label: textOrFallback(payload?.readModel?.nextStep?.label, "Wait for admin review"),
      lane: textOrFallback(payload?.readModel?.nextStep?.lane, "ADMIN_REVIEW"),
      actor: textOrFallback(payload?.readModel?.nextStep?.actor, "ADMIN"),
      description: textOrNull(payload?.readModel?.nextStep?.description),
    },
    boundaries: {
      readinessVsPaymentHistory: textOrNull(
        payload?.readModel?.boundaries?.readinessVsPaymentHistory
      ),
      paymentHistoryLane: textOrNull(payload?.readModel?.boundaries?.paymentHistoryLane),
      sellerWorkspaceMode: textOrNull(payload?.readModel?.boundaries?.sellerWorkspaceMode),
    },
  };
};

const normalizeSellerPaymentProfile = (payload: any) => {
  if (!payload) return null;

  const activeSnapshot = normalizeSnapshot(payload?.activeSnapshot);
  const pendingRequest = normalizePendingRequest(payload?.pendingRequest, activeSnapshot);
  const requestDraft = payload?.requestDraft || {};
  const readModel = normalizeReadModel(payload);

  return {
    id: Number(payload?.id || activeSnapshot?.id || 0),
    storeId: Number(payload?.storeId || activeSnapshot?.storeId || pendingRequest?.storeId || 0),
    activeSnapshot,
    pendingRequest,
    requestStatus: {
      code: textOrFallback(payload?.requestStatus?.code, readModel.requestState.code, "DRAFT"),
      label: textOrFallback(payload?.requestStatus?.label, readModel.requestState.label, "Draft request"),
      tone: textOrFallback(payload?.requestStatus?.tone, readModel.requestState.tone, "stone"),
      description:
        textOrNull(payload?.requestStatus?.description) ||
        textOrNull(readModel.requestState.description),
      isSubmitted: Boolean(payload?.requestStatus?.isSubmitted ?? readModel.requestState.isSubmitted),
      isDraft: Boolean(payload?.requestStatus?.isDraft ?? readModel.requestState.isDraft),
    },
    reviewFeedback: {
      ...readModel.reviewStatus,
    },
    readModel,
    requestDraft: {
      accountName: textOrFallback(
        requestDraft?.accountName,
        pendingRequest?.accountName || activeSnapshot?.accountName || ""
      ),
      merchantName: textOrFallback(
        requestDraft?.merchantName,
        pendingRequest?.merchantName || activeSnapshot?.merchantName || ""
      ),
      merchantId: textOrNull(
        requestDraft?.merchantId ?? pendingRequest?.merchantId ?? activeSnapshot?.merchantId
      ),
      qrisImageUrl: textOrFallback(
        requestDraft?.qrisImageUrl,
        pendingRequest?.qrisImageUrl || activeSnapshot?.qrisImageUrl || ""
      ),
      qrisPayload: textOrNull(
        requestDraft?.qrisPayload ?? pendingRequest?.qrisPayload ?? activeSnapshot?.qrisPayload
      ),
      instructionText: textOrNull(
        requestDraft?.instructionText ?? pendingRequest?.instructionText ?? activeSnapshot?.instructionText
      ),
      sellerNote: textOrNull(requestDraft?.sellerNote ?? pendingRequest?.sellerNote),
    },
    governance: {
      canView: payload?.governance?.canView !== false,
      canEdit: Boolean(payload?.governance?.canEdit),
      mode: textOrFallback(payload?.governance?.mode, "READ_ONLY_SNAPSHOT"),
      managedBy: textOrFallback(payload?.governance?.managedBy, "ACCOUNT_ADMIN"),
      note: textOrNull(payload?.governance?.note),
      editableFields: Array.isArray(payload?.governance?.editableFields)
        ? payload.governance.editableFields
            .map((entry: unknown) => textOrNull(entry))
            .filter((entry: string | null): entry is string => Boolean(entry))
        : [],
      readOnlyFields: Array.isArray(payload?.governance?.readOnlyFields)
        ? payload.governance.readOnlyFields
            .map((entry: unknown) => textOrNull(entry))
            .filter((entry: string | null): entry is string => Boolean(entry))
        : [],
    },
    store: payload?.store
      ? {
          id: Number(payload.store.id || payload?.storeId || 0),
          name: textOrFallback(payload.store.name),
          slug: textOrFallback(payload.store.slug),
          status: textOrFallback(payload.store.status, "ACTIVE"),
        }
      : null,
    verifiedAt: payload?.verifiedAt || activeSnapshot?.verifiedAt || null,
    updatedAt: payload?.updatedAt || pendingRequest?.updatedAt || activeSnapshot?.updatedAt || null,
    createdAt: payload?.createdAt || activeSnapshot?.createdAt || null,
  };
};

export const getSellerPaymentProfile = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/payment-profile`);
  return normalizeSellerPaymentProfile(data?.data ?? null);
};

export const saveSellerPaymentProfileDraft = async (
  storeId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.put(`/seller/stores/${storeId}/payment-profile/request`, payload);
  return normalizeSellerPaymentProfile(data?.data ?? null);
};

export const submitSellerPaymentProfileRequest = async (
  storeId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.post(`/seller/stores/${storeId}/payment-profile/request/submit`, payload);
  return normalizeSellerPaymentProfile(data?.data ?? null);
};

export const uploadSellerPaymentProfileImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ data?: { url?: string } }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = textOrNull(data?.data?.url);
  if (!url) {
    throw new Error("Upload succeeded without URL.");
  }
  return url;
};
