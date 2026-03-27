import { api } from "./axios.ts";

const textOrNull = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const textOrFallback = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
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

const normalizeActor = (value: any) =>
  value
    ? {
        id: Number(value.id || 0) || null,
        name: textOrFallback(value.name),
        email: textOrNull(value.email),
      }
    : null;

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
    readiness: {
      code: textOrFallback(value?.readiness?.code, "INCOMPLETE"),
      label: textOrFallback(value?.readiness?.label, "Incomplete"),
      tone: textOrFallback(value?.readiness?.tone, "warning"),
      description: textOrNull(value?.readiness?.description),
      isReady: Boolean(value?.readiness?.isReady),
      completedFields: Number(value?.readiness?.completedFields || 0),
      totalFields: Number(value?.readiness?.totalFields || 0),
      missingFields: normalizeMissingFields(value?.readiness?.missingFields),
    },
    verifiedAt: value.verifiedAt || null,
    updatedAt: value.updatedAt || null,
  };
};

const normalizePendingRequest = (value: any, snapshot: any) => {
  if (!value) return null;

  return {
    id: Number(value.id || 0) || null,
    storeId: Number(value.storeId || snapshot?.storeId || 0) || null,
    basedOnProfileId: Number(value.basedOnProfileId || 0) || null,
    requestStatus: textOrFallback(value.requestStatus, "SUBMITTED"),
    accountName: textOrFallback(value.accountName, snapshot?.accountName || ""),
    merchantName: textOrFallback(value.merchantName, snapshot?.merchantName || ""),
    merchantId: textOrNull(value.merchantId),
    qrisImageUrl: textOrNull(value.qrisImageUrl),
    qrisPayload: textOrNull(value.qrisPayload),
    instructionText: textOrNull(value.instructionText),
    sellerNote: textOrNull(value.sellerNote),
    adminReviewNote: textOrNull(value.adminReviewNote),
    readiness: {
      code: textOrFallback(value?.readiness?.code, "INCOMPLETE"),
      label: textOrFallback(value?.readiness?.label, "Incomplete"),
      tone: textOrFallback(value?.readiness?.tone, "warning"),
      description: textOrNull(value?.readiness?.description),
      isReady: Boolean(value?.readiness?.isReady),
      completedFields: Number(value?.readiness?.completedFields || 0),
      totalFields: Number(value?.readiness?.totalFields || 0),
      missingFields: normalizeMissingFields(value?.readiness?.missingFields),
    },
    submittedAt: value.submittedAt || null,
    reviewedAt: value.reviewedAt || null,
    submittedBy: normalizeActor(value.submittedBy),
    reviewedBy: normalizeActor(value.reviewedBy),
  };
};

const normalizeWorkflow = (value: any) => ({
  primaryStatus: normalizeStatusChip(
    value?.primaryStatus,
    "Waiting for seller setup",
    "neutral",
    "WAITING_SELLER"
  ),
  requestState: {
    ...normalizeStatusChip(
      value?.requestState,
      "No open request",
      "neutral",
      "INACTIVE"
    ),
  },
  reviewStatus: {
    ...normalizeStatusChip(
      value?.reviewStatus,
      "Not reviewed yet",
      "neutral",
      "NOT_CONFIGURED"
    ),
    reviewedAt: value?.reviewStatus?.reviewedAt || null,
    reviewedBy: normalizeActor(value?.reviewStatus?.reviewedBy),
    adminReviewNote: textOrNull(value?.reviewStatus?.adminReviewNote),
    source: textOrFallback(value?.reviewStatus?.source, "ACTIVE_SNAPSHOT"),
  },
  completeness: {
    completedFields: Number(value?.completeness?.completedFields || 0),
    totalFields: Number(value?.completeness?.totalFields || 0),
    allRequiredPresent: Boolean(value?.completeness?.allRequiredPresent),
    missingFields: normalizeMissingFields(value?.completeness?.missingFields),
  },
  nextStep: {
    code: textOrFallback(value?.nextStep?.code, "WAIT_FOR_SUBMISSION"),
    label: textOrFallback(value?.nextStep?.label, "Wait for seller submission"),
    lane: textOrFallback(value?.nextStep?.lane, "SELLER_PAYMENT_SETUP"),
    actor: textOrFallback(value?.nextStep?.actor, "SELLER"),
    description: textOrNull(value?.nextStep?.description),
  },
  governance: {
    managedBy: textOrFallback(value?.governance?.managedBy, "ADMIN_FINAL_APPROVAL"),
    canApprovePromotion: Boolean(value?.governance?.canApprovePromotion),
    canRequestRevision: Boolean(value?.governance?.canRequestRevision),
    canToggleActiveSnapshot: Boolean(value?.governance?.canToggleActiveSnapshot),
    note: textOrNull(value?.governance?.note),
  },
});

const normalizeWorkspaceReadiness = (value: any) => {
  if (!value || typeof value !== "object") return null;

  return {
    summary: normalizeStatusChip(
      value?.summary,
      "In progress",
      "neutral",
      "IN_PROGRESS"
    ),
    completedItems: Number(value?.summary?.completedItems || 0),
    totalItems: Number(value?.summary?.totalItems || 0),
    completionPercent: Number(value?.summary?.completionPercent || 0),
    checklist: Array.isArray(value?.checklist)
      ? value.checklist
          .map((entry: any) => ({
            key: textOrFallback(entry?.key),
            label: textOrFallback(entry?.label, "Unknown"),
            required: Boolean(entry?.required),
            infoOnly: Boolean(entry?.infoOnly),
            visible: entry?.visible !== false,
            isComplete: Boolean(entry?.isComplete),
            status: normalizeStatusChip(entry?.status, "Unknown", "neutral", "UNKNOWN"),
            progress: {
              completed: Number(entry?.progress?.completed || 0),
              total: Number(entry?.progress?.total || 0),
              missingFields: normalizeMissingFields(entry?.progress?.missingFields),
            },
            cta: entry?.cta
              ? {
                  label: textOrFallback(entry.cta.label, "Open lane"),
                  lane: textOrFallback(entry.cta.lane, "HOME"),
                  actor: textOrFallback(entry.cta.actor, "SELLER"),
                  description: textOrNull(entry.cta.description),
                }
              : null,
          }))
          .filter((entry: any) => entry.key)
      : [],
    nextStep: value?.nextStep
      ? {
          code: textOrFallback(value.nextStep.code, "HOME"),
          label: textOrFallback(value.nextStep.label, "Follow next step"),
          lane: textOrFallback(value.nextStep.lane, "HOME"),
          actor: textOrFallback(value.nextStep.actor, "SELLER"),
          description: textOrNull(value.nextStep.description),
        }
      : null,
  };
};

const normalizeAdminStorePaymentProfile = (value: any) => {
  if (!value) return null;

  const paymentProfile = normalizeSnapshot(value.paymentProfile);
  const pendingRequest = normalizePendingRequest(value.pendingRequest, paymentProfile);
  const workflow = normalizeWorkflow(value.workflow);

  return {
    store: value.store
      ? {
          id: Number(value.store.id || 0) || null,
          ownerUserId: Number(value.store.ownerUserId || 0) || null,
          activeStorePaymentProfileId: Number(value.store.activeStorePaymentProfileId || 0) || null,
          name: textOrFallback(value.store.name),
          slug: textOrFallback(value.store.slug),
          status: textOrFallback(value.store.status, "ACTIVE"),
        }
      : null,
    owner: normalizeActor(value.owner),
    paymentProfile,
    pendingRequest,
    workflow,
    reviewStatus: workflow.reviewStatus,
    workspaceReadiness: normalizeWorkspaceReadiness(value.workspaceReadiness),
  };
};

export const getMyStore = async () => {
  const { data } = await api.get("/stores/mine");
  return data?.data ?? null;
};

export const getStorePaymentProfile = async (storeId: number | string) => {
  const { data } = await api.get(`/stores/${storeId}/payment-profile`);
  return data?.data ?? null;
};

export const upsertStorePaymentProfile = async (
  storeId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.post(`/stores/${storeId}/payment-profile`, payload);
  return data?.data ?? null;
};

export const fetchAdminStorePaymentProfiles = async () => {
  const { data } = await api.get("/admin/stores/payment-profiles");
  return Array.isArray(data?.data) ? data.data.map(normalizeAdminStorePaymentProfile).filter(Boolean) : [];
};

export const reviewAdminStorePaymentProfile = async (
  storeId: number | string,
  payload: { verificationStatus: string; adminReviewNote?: string | null }
) => {
  const { data } = await api.patch(`/admin/stores/${storeId}/payment-profile/review`, payload);
  return normalizeAdminStorePaymentProfile(data?.data ?? null);
};
