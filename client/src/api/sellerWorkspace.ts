import { api } from "./axios.ts";

export type SellerWorkspaceContext = {
  store: {
    id: number;
    name: string;
    slug: string;
    status: string;
  };
  access: {
    accessMode: "OWNER_BRIDGE" | "MEMBER";
    roleCode: string;
    permissionKeys: string[];
    membershipStatus: string;
    isOwner: boolean;
    memberId: number | null;
  };
};

type SellerStatusMeta = {
  code: string;
  label: string;
  tone: string;
  description?: string | null;
};

export type SellerFinanceSummary = {
  store: {
    id: number;
    name: string;
    slug: string;
    status: string;
    roleCode: string;
    accessMode: string;
    membershipStatus: string;
  };
  paymentProfileReadiness: {
    visible: boolean;
    exists: boolean;
    code: string;
    label: string;
    tone: string;
    description: string | null;
    isReady?: boolean;
    completedFields: number;
    totalFields: number;
    missingFields: Array<{
      key: string;
      label: string;
    }>;
    reviewStatus: SellerStatusMeta | null;
    nextStep: {
      code: string;
      label: string;
      lane: string;
      actor: string;
      description?: string | null;
    } | null;
    governance?: {
      mode: string;
      note?: string | null;
    } | null;
    profile?: {
      id: number;
      providerCode: string;
      paymentType: string;
      merchantName: string;
      accountName: string;
      verificationStatus: string;
      isActive: boolean;
      updatedAt?: string | null;
    } | null;
  };
  paymentReviewCounts: {
    visible: boolean;
    totalRecords: number;
    awaitingReview: number;
    settled: number;
    rejected: number;
    exceptionCount: number;
    hint: string | null;
  };
  suborderPaymentSummary: {
    visible: boolean;
    totalSuborders: number;
    unpaidCount: number;
    pendingConfirmationCount: number;
    paidCount: number;
    exceptionCount: number;
    paidGrossAmount: number;
    hint: string | null;
  };
  eligiblePaidSubordersSummary: {
    visible: boolean;
    count: number;
    grossAmount: number;
    awaitingFulfillmentCount: number;
    inProgressCount: number;
    deliveredCount: number;
    basis: string[];
    hint: string | null;
    boundaryNote: string | null;
  };
  boundaries: {
    tenantScope: string | null;
    payoutDisclaimer: string | null;
    adminAuthority: string | null;
    workspaceMode: string | null;
  };
  nextActions: Array<{
    code: string;
    lane: string;
    priority: string;
    tone: string;
    label: string;
    description: string | null;
  }>;
};

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

const normalizeStatusMeta = (value: any, fallbackLabel: string): SellerStatusMeta | null => {
  if (!value || typeof value !== "object") return null;
  return {
    code: textOrFallback(value.code),
    label: textOrFallback(value.label, fallbackLabel),
    tone: textOrFallback(value.tone, "stone"),
    description: textOrNull(value.description),
  };
};

const normalizeFinanceSummary = (payload: any): SellerFinanceSummary | null => {
  if (!payload) return null;

  const paymentProfileReadiness = payload.paymentProfileReadiness || {};
  const paymentReviewCounts = payload.paymentReviewCounts || {};
  const suborderPaymentSummary = payload.suborderPaymentSummary || {};
  const eligiblePaidSubordersSummary = payload.eligiblePaidSubordersSummary || {};

  return {
    store: {
      id: numberOrZero(payload?.store?.id),
      name: textOrFallback(payload?.store?.name, "Seller Workspace"),
      slug: textOrFallback(payload?.store?.slug, "store"),
      status: textOrFallback(payload?.store?.status, "ACTIVE"),
      roleCode: textOrFallback(payload?.store?.roleCode),
      accessMode: textOrFallback(payload?.store?.accessMode),
      membershipStatus: textOrFallback(payload?.store?.membershipStatus),
    },
    paymentProfileReadiness: {
      visible: Boolean(paymentProfileReadiness.visible),
      exists: Boolean(paymentProfileReadiness.exists),
      code: textOrFallback(paymentProfileReadiness.code, "UNKNOWN"),
      label: textOrFallback(paymentProfileReadiness.label, "Unknown"),
      tone: textOrFallback(paymentProfileReadiness.tone, "stone"),
      description: textOrNull(paymentProfileReadiness.description),
      isReady: Boolean(paymentProfileReadiness.isReady),
      completedFields: numberOrZero(paymentProfileReadiness.completedFields),
      totalFields: numberOrZero(paymentProfileReadiness.totalFields),
      missingFields: Array.isArray(paymentProfileReadiness.missingFields)
        ? paymentProfileReadiness.missingFields
            .map((entry: any) => ({
              key: textOrFallback(entry?.key),
              label: textOrFallback(entry?.label, "Unknown field"),
            }))
            .filter((entry: { key: string }) => Boolean(entry.key))
        : [],
      reviewStatus: normalizeStatusMeta(paymentProfileReadiness.reviewStatus, "Unknown"),
      nextStep: paymentProfileReadiness.nextStep
        ? {
            code: textOrFallback(paymentProfileReadiness.nextStep.code),
            label: textOrFallback(paymentProfileReadiness.nextStep.label, "Follow existing lane"),
            lane: textOrFallback(paymentProfileReadiness.nextStep.lane),
            actor: textOrFallback(paymentProfileReadiness.nextStep.actor),
            description: textOrNull(paymentProfileReadiness.nextStep.description),
          }
        : null,
      governance: paymentProfileReadiness.governance
        ? {
            mode: textOrFallback(paymentProfileReadiness.governance.mode, "READ_ONLY_SNAPSHOT"),
            note: textOrNull(paymentProfileReadiness.governance.note),
          }
        : null,
      profile: paymentProfileReadiness.profile
        ? {
            id: numberOrZero(paymentProfileReadiness.profile.id),
            providerCode: textOrFallback(
              paymentProfileReadiness.profile.providerCode,
              "MANUAL_QRIS"
            ),
            paymentType: textOrFallback(
              paymentProfileReadiness.profile.paymentType,
              "QRIS_STATIC"
            ),
            merchantName: textOrFallback(paymentProfileReadiness.profile.merchantName),
            accountName: textOrFallback(paymentProfileReadiness.profile.accountName),
            verificationStatus: textOrFallback(
              paymentProfileReadiness.profile.verificationStatus,
              "PENDING"
            ),
            isActive: Boolean(paymentProfileReadiness.profile.isActive),
            updatedAt: paymentProfileReadiness.profile.updatedAt || null,
          }
        : null,
    },
    paymentReviewCounts: {
      visible: Boolean(paymentReviewCounts.visible),
      totalRecords: numberOrZero(paymentReviewCounts.totalRecords),
      awaitingReview: numberOrZero(paymentReviewCounts.awaitingReview),
      settled: numberOrZero(paymentReviewCounts.settled),
      rejected: numberOrZero(paymentReviewCounts.rejected),
      exceptionCount: numberOrZero(paymentReviewCounts.exceptionCount),
      hint: textOrNull(paymentReviewCounts.hint),
    },
    suborderPaymentSummary: {
      visible: Boolean(suborderPaymentSummary.visible),
      totalSuborders: numberOrZero(suborderPaymentSummary.totalSuborders),
      unpaidCount: numberOrZero(suborderPaymentSummary.unpaidCount),
      pendingConfirmationCount: numberOrZero(suborderPaymentSummary.pendingConfirmationCount),
      paidCount: numberOrZero(suborderPaymentSummary.paidCount),
      exceptionCount: numberOrZero(suborderPaymentSummary.exceptionCount),
      paidGrossAmount: numberOrZero(suborderPaymentSummary.paidGrossAmount),
      hint: textOrNull(suborderPaymentSummary.hint),
    },
    eligiblePaidSubordersSummary: {
      visible: Boolean(eligiblePaidSubordersSummary.visible),
      count: numberOrZero(eligiblePaidSubordersSummary.count),
      grossAmount: numberOrZero(eligiblePaidSubordersSummary.grossAmount),
      awaitingFulfillmentCount: numberOrZero(
        eligiblePaidSubordersSummary.awaitingFulfillmentCount
      ),
      inProgressCount: numberOrZero(eligiblePaidSubordersSummary.inProgressCount),
      deliveredCount: numberOrZero(eligiblePaidSubordersSummary.deliveredCount),
      basis: Array.isArray(eligiblePaidSubordersSummary.basis)
        ? eligiblePaidSubordersSummary.basis
            .map((entry: unknown) => textOrNull(entry))
            .filter((entry: string | null): entry is string => Boolean(entry))
        : [],
      hint: textOrNull(eligiblePaidSubordersSummary.hint),
      boundaryNote: textOrNull(eligiblePaidSubordersSummary.boundaryNote),
    },
    boundaries: {
      tenantScope: textOrNull(payload?.boundaries?.tenantScope),
      payoutDisclaimer: textOrNull(payload?.boundaries?.payoutDisclaimer),
      adminAuthority: textOrNull(payload?.boundaries?.adminAuthority),
      workspaceMode: textOrNull(payload?.boundaries?.workspaceMode),
    },
    nextActions: Array.isArray(payload?.nextActions)
      ? payload.nextActions.map((entry: any) => ({
          code: textOrFallback(entry?.code),
          lane: textOrFallback(entry?.lane, "HOME"),
          priority: textOrFallback(entry?.priority, "low"),
          tone: textOrFallback(entry?.tone, "stone"),
          label: textOrFallback(entry?.label, "Monitor workspace"),
          description: textOrNull(entry?.description),
        }))
      : [],
  };
};

export const getSellerWorkspaceContext = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/context`);
  return (data?.data ?? null) as SellerWorkspaceContext | null;
};

export const getSellerWorkspaceContextBySlug = async (storeSlug: string) => {
  const { data } = await api.get(
    `/seller/stores/slug/${encodeURIComponent(String(storeSlug || "").trim())}/context`
  );
  return (data?.data ?? null) as SellerWorkspaceContext | null;
};

export const getSellerFinanceSummary = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/finance-summary`);
  return normalizeFinanceSummary(data?.data ?? null);
};
