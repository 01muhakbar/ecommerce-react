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

const normalizeReadModel = (payload: any) => {
  const completeness = payload?.readModel?.completeness || {};
  return {
    primaryStatus: {
      code: textOrFallback(payload?.readModel?.primaryStatus?.code, payload?.readiness?.code, "PENDING_ADMIN_REVIEW"),
      label: textOrFallback(payload?.readModel?.primaryStatus?.label, payload?.readiness?.label, "Pending admin review"),
      tone: textOrFallback(payload?.readModel?.primaryStatus?.tone, payload?.readiness?.tone, "warning"),
      description:
        textOrNull(payload?.readModel?.primaryStatus?.description) ||
        textOrNull(payload?.readiness?.description),
    },
    reviewStatus: {
      code: textOrFallback(
        payload?.readModel?.reviewStatus?.code,
        payload?.verificationMeta?.code || payload?.verificationStatus,
        "PENDING"
      ),
      label: textOrFallback(
        payload?.readModel?.reviewStatus?.label,
        payload?.verificationMeta?.label,
        "Pending review"
      ),
      tone: textOrFallback(
        payload?.readModel?.reviewStatus?.tone,
        payload?.verificationMeta?.tone,
        "warning"
      ),
      description:
        textOrNull(payload?.readModel?.reviewStatus?.description) ||
        textOrNull(payload?.verificationMeta?.description),
      authority: textOrFallback(payload?.readModel?.reviewStatus?.authority, "ADMIN"),
      reviewedAt: payload?.readModel?.reviewStatus?.reviewedAt || payload?.verifiedAt || null,
      reviewedBy: payload?.readModel?.reviewStatus?.reviewedBy
        ? {
            id: Number(payload.readModel.reviewStatus.reviewedBy.id || 0) || null,
            name: textOrFallback(payload.readModel.reviewStatus.reviewedBy.name),
            email: textOrNull(payload.readModel.reviewStatus.reviewedBy.email),
          }
        : null,
    },
    completeness: {
      completedFields: Number(
        completeness?.completedFields ??
          payload?.readiness?.completedFields ??
          0
      ),
      totalFields: Number(
        completeness?.totalFields ??
          payload?.readiness?.totalFields ??
          0
      ),
      allRequiredPresent:
        completeness?.allRequiredPresent !== undefined
          ? Boolean(completeness.allRequiredPresent)
          : normalizeMissingFields(completeness?.missingFields ?? payload?.readiness?.missingFields)
              .length === 0,
      missingFields: normalizeMissingFields(
        completeness?.missingFields ?? payload?.readiness?.missingFields
      ),
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

  const readiness = payload?.readiness || {};
  const missingFields = normalizeMissingFields(readiness?.missingFields);
  const totalFields = Number(readiness?.totalFields || missingFields.length || 0);
  const completedFields = Number(
    readiness?.completedFields ??
      Math.max(totalFields - missingFields.length, 0)
  );

  return {
    id: Number(payload?.id || 0),
    storeId: Number(payload?.storeId || 0),
    providerCode: textOrFallback(payload?.providerCode, "MANUAL_QRIS"),
    paymentType: textOrFallback(payload?.paymentType, "QRIS_STATIC"),
    accountName: textOrNull(payload?.accountName),
    merchantName: textOrNull(payload?.merchantName),
    merchantId: textOrNull(payload?.merchantId),
    qrisImageUrl: textOrNull(payload?.qrisImageUrl),
    qrisPayload: textOrNull(payload?.qrisPayload),
    instructionText: textOrNull(payload?.instructionText),
    isActive: Boolean(payload?.isActive),
    verificationStatus: textOrFallback(payload?.verificationStatus, "PENDING"),
    verificationMeta: {
      code: textOrFallback(payload?.verificationMeta?.code || payload?.verificationStatus, "PENDING"),
      label: textOrFallback(payload?.verificationMeta?.label, "Pending review"),
      tone: textOrFallback(payload?.verificationMeta?.tone, "warning"),
      description: textOrNull(payload?.verificationMeta?.description),
    },
    activityMeta: {
      code: textOrFallback(payload?.activityMeta?.code, payload?.isActive ? "ACTIVE" : "INACTIVE"),
      label: textOrFallback(payload?.activityMeta?.label, payload?.isActive ? "Active" : "Inactive"),
      tone: textOrFallback(payload?.activityMeta?.tone, payload?.isActive ? "success" : "neutral"),
      description: textOrNull(payload?.activityMeta?.description),
    },
    readiness: {
      code: textOrFallback(payload?.readiness?.code, "PENDING_REVIEW"),
      label: textOrFallback(payload?.readiness?.label, "Pending review"),
      tone: textOrFallback(payload?.readiness?.tone, "warning"),
      description: textOrNull(payload?.readiness?.description),
      isReady: Boolean(payload?.readiness?.isReady),
      isIncomplete: Boolean(payload?.readiness?.isIncomplete),
      completedFields,
      totalFields,
      missingFields,
    },
    readModel: normalizeReadModel(payload),
    governance: {
      canView: payload?.governance?.canView !== false,
      canEdit: Boolean(payload?.governance?.canEdit),
      mode: textOrFallback(payload?.governance?.mode, "READ_ONLY_SNAPSHOT"),
      managedBy: textOrFallback(payload?.governance?.managedBy, "ACCOUNT_ADMIN"),
      note: textOrNull(payload?.governance?.note),
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
    verifiedAt: payload?.verifiedAt || null,
    updatedAt: payload?.updatedAt || null,
    createdAt: payload?.createdAt || null,
  };
};

export const getSellerPaymentProfile = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/payment-profile`);
  return normalizeSellerPaymentProfile(data?.data ?? null);
};
