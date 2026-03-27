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

export type SellerWorkspaceStoreAccess = SellerWorkspaceContext;

type SellerStatusMeta = {
  code: string;
  label: string;
  tone: string;
  description?: string | null;
};

type SellerWorkspaceChecklistItem = {
  key: string;
  label: string;
  required: boolean;
  infoOnly: boolean;
  visible: boolean;
  isComplete: boolean;
  status: SellerStatusMeta;
  progress: {
    completed: number;
    total: number;
    missingFields: Array<{
      key: string;
      label: string;
    }>;
  };
  cta: {
    label: string;
    lane: string;
    actor: string;
    description?: string | null;
  } | null;
  governance: {
    canEdit: boolean;
    managedBy: string;
    note?: string | null;
  } | null;
  reviewStatus?: SellerStatusMeta | null;
  meta?: Record<string, any> | null;
};

export type SellerWorkspaceReadiness = {
  store: {
    id: number;
    name: string;
    slug: string;
    status: string;
    roleCode: string;
    accessMode: string;
    membershipStatus: string;
  };
  summary: SellerStatusMeta & {
    completedItems: number;
    totalItems: number;
    completionPercent: number;
  };
  checklist: SellerWorkspaceChecklistItem[];
  nextStep: {
    code: string;
    label: string;
    lane: string;
    actor: string;
    description?: string | null;
  } | null;
  boundaries: {
    sourceOfTruth: string | null;
    adminAuthority: string | null;
    storefrontBoundary: string | null;
  };
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

export type SellerAnalyticsSummary = {
  store: {
    id: number;
    name: string;
    slug: string;
    status: string;
    roleCode: string;
    accessMode: string;
    membershipStatus: string;
  };
  orderSnapshot: {
    visible: boolean;
    totalOrders: number;
    paidOrders: number;
    processingOrders: number;
    completedOrders: number;
    pendingPaymentOrders: number;
    exceptionOrders: number;
    hint: string | null;
  };
  revenueSnapshot: {
    visible: boolean;
    paidGrossAmount: number;
    averageOrderValue: number;
    processingGrossAmount: number;
    completedGrossAmount: number;
    hint: string | null;
    boundaryNote: string | null;
  };
  couponSnapshot: {
    visible: boolean;
    totalCoupons: number;
    activeCoupons: number;
    scheduledCoupons: number;
    expiredCoupons: number;
    inactiveCoupons: number;
    discountedOrders: number;
    discountedPaidOrders: number;
    hint: string | null;
    boundaryNote: string | null;
  };
  couponAttributionSnapshot: {
    visible: boolean;
    level: string;
    label: string;
    tone: string;
    summary: string | null;
    attributedSuborders: number;
    attributedPaidSuborders: number;
    unattributedDiscountedSuborders: number;
    totalDiscountAmount: number;
    paidDiscountAmount: number;
    topCouponCodes: Array<{
      code: string;
      scopeType: string;
      attributedSuborders: number;
      attributedPaidSuborders: number;
      totalDiscountAmount: number;
      paidDiscountAmount: number;
    }>;
    scopeBreakdown: Array<{
      scopeType: string;
      attributedSuborders: number;
      attributedPaidSuborders: number;
      totalDiscountAmount: number;
      paidDiscountAmount: number;
    }>;
    coverage: {
      discountedSuborders: number;
      attributedDiscountedSuborders: number;
      attributedCoveragePercent: number;
      note: string | null;
    };
    boundaryNote: string | null;
  };
  productSnapshot: {
    visible: boolean;
    totalProducts: number;
    activeProducts: number;
    draftProducts: number;
    storefrontVisibleProducts: number;
    reviewQueue: number;
    topProducts: Array<{
      productId: number;
      name: string;
      slug: string | null;
      status: string;
      stock: number;
      qtySold: number;
      revenueAmount: number;
      storefrontVisible: boolean;
    }>;
    hint: string | null;
  };
  insights: Array<{
    code: string;
    lane: string;
    tone: string;
    label: string;
    description: string | null;
  }>;
  couponAttributionReadiness: {
    visible: boolean;
    level: string;
    label: string;
    tone: string;
    summary: string | null;
    signals: Array<{
      key: string;
      label: string;
      status: string;
      description: string | null;
    }>;
    recommendedNextStep: string | null;
    boundaryNote: string | null;
  };
  boundaries: {
    tenantScope: string | null;
    adminAuthority: string | null;
    storefrontBoundary: string | null;
  };
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

const normalizeChecklistItem = (value: any): SellerWorkspaceChecklistItem | null => {
  if (!value || typeof value !== "object") return null;

  return {
    key: textOrFallback(value.key),
    label: textOrFallback(value.label, "Unknown"),
    required: Boolean(value.required),
    infoOnly: Boolean(value.infoOnly),
    visible: value.visible !== false,
    isComplete: Boolean(value.isComplete),
    status:
      normalizeStatusMeta(value.status, "Unknown") || {
        code: "UNKNOWN",
        label: "Unknown",
        tone: "stone",
        description: null,
      },
    progress: {
      completed: numberOrZero(value?.progress?.completed),
      total: numberOrZero(value?.progress?.total),
      missingFields: Array.isArray(value?.progress?.missingFields)
        ? value.progress.missingFields
            .map((entry: any) => ({
              key: textOrFallback(entry?.key),
              label: textOrFallback(entry?.label, "Unknown field"),
            }))
            .filter((entry: { key: string }) => Boolean(entry.key))
        : [],
    },
    cta: value?.cta
      ? {
          label: textOrFallback(value.cta.label, "Open lane"),
          lane: textOrFallback(value.cta.lane, "HOME"),
          actor: textOrFallback(value.cta.actor, "SELLER"),
          description: textOrNull(value.cta.description),
        }
      : null,
    governance: value?.governance
      ? {
          canEdit: Boolean(value.governance.canEdit),
          managedBy: textOrFallback(value.governance.managedBy, "SELLER_WORKSPACE"),
          note: textOrNull(value.governance.note),
        }
      : null,
    reviewStatus: normalizeStatusMeta(value.reviewStatus, "Unknown"),
    meta: value?.meta && typeof value.meta === "object" ? value.meta : null,
  };
};

const normalizeWorkspaceReadiness = (payload: any): SellerWorkspaceReadiness | null => {
  if (!payload || typeof payload !== "object") return null;

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
    summary: {
      ...(normalizeStatusMeta(payload?.summary, "In progress") || {
        code: "IN_PROGRESS",
        label: "In progress",
        tone: "sky",
        description: null,
      }),
      completedItems: numberOrZero(payload?.summary?.completedItems),
      totalItems: numberOrZero(payload?.summary?.totalItems),
      completionPercent: numberOrZero(payload?.summary?.completionPercent),
    },
    checklist: Array.isArray(payload?.checklist)
      ? payload.checklist
          .map((entry: any) => normalizeChecklistItem(entry))
          .filter((entry: SellerWorkspaceChecklistItem | null): entry is SellerWorkspaceChecklistItem =>
            Boolean(entry?.key)
          )
      : [],
    nextStep: payload?.nextStep
      ? {
          code: textOrFallback(payload.nextStep.code),
          label: textOrFallback(payload.nextStep.label, "Follow next step"),
          lane: textOrFallback(payload.nextStep.lane, "HOME"),
          actor: textOrFallback(payload.nextStep.actor, "SELLER"),
          description: textOrNull(payload.nextStep.description),
        }
      : null,
    boundaries: {
      sourceOfTruth: textOrNull(payload?.boundaries?.sourceOfTruth),
      adminAuthority: textOrNull(payload?.boundaries?.adminAuthority),
      storefrontBoundary: textOrNull(payload?.boundaries?.storefrontBoundary),
    },
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

const normalizeAnalyticsSummary = (payload: any): SellerAnalyticsSummary | null => {
  if (!payload || typeof payload !== "object") return null;

  const orderSnapshot = payload.orderSnapshot || {};
  const revenueSnapshot = payload.revenueSnapshot || {};
  const couponSnapshot = payload.couponSnapshot || {};
  const couponAttributionSnapshot = payload.couponAttributionSnapshot || {};
  const productSnapshot = payload.productSnapshot || {};
  const couponAttributionReadiness = payload.couponAttributionReadiness || {};

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
    orderSnapshot: {
      visible: Boolean(orderSnapshot.visible),
      totalOrders: numberOrZero(orderSnapshot.totalOrders),
      paidOrders: numberOrZero(orderSnapshot.paidOrders),
      processingOrders: numberOrZero(orderSnapshot.processingOrders),
      completedOrders: numberOrZero(orderSnapshot.completedOrders),
      pendingPaymentOrders: numberOrZero(orderSnapshot.pendingPaymentOrders),
      exceptionOrders: numberOrZero(orderSnapshot.exceptionOrders),
      hint: textOrNull(orderSnapshot.hint),
    },
    revenueSnapshot: {
      visible: Boolean(revenueSnapshot.visible),
      paidGrossAmount: numberOrZero(revenueSnapshot.paidGrossAmount),
      averageOrderValue: numberOrZero(revenueSnapshot.averageOrderValue),
      processingGrossAmount: numberOrZero(revenueSnapshot.processingGrossAmount),
      completedGrossAmount: numberOrZero(revenueSnapshot.completedGrossAmount),
      hint: textOrNull(revenueSnapshot.hint),
      boundaryNote: textOrNull(revenueSnapshot.boundaryNote),
    },
    couponSnapshot: {
      visible: Boolean(couponSnapshot.visible),
      totalCoupons: numberOrZero(couponSnapshot.totalCoupons),
      activeCoupons: numberOrZero(couponSnapshot.activeCoupons),
      scheduledCoupons: numberOrZero(couponSnapshot.scheduledCoupons),
      expiredCoupons: numberOrZero(couponSnapshot.expiredCoupons),
      inactiveCoupons: numberOrZero(couponSnapshot.inactiveCoupons),
      discountedOrders: numberOrZero(couponSnapshot.discountedOrders),
      discountedPaidOrders: numberOrZero(couponSnapshot.discountedPaidOrders),
      hint: textOrNull(couponSnapshot.hint),
      boundaryNote: textOrNull(couponSnapshot.boundaryNote),
    },
    couponAttributionSnapshot: {
      visible: Boolean(couponAttributionSnapshot.visible),
      level: textOrFallback(couponAttributionSnapshot.level, "HIDDEN"),
      label: textOrFallback(couponAttributionSnapshot.label, "Hidden"),
      tone: textOrFallback(couponAttributionSnapshot.tone, "stone"),
      summary: textOrNull(couponAttributionSnapshot.summary),
      attributedSuborders: numberOrZero(couponAttributionSnapshot.attributedSuborders),
      attributedPaidSuborders: numberOrZero(couponAttributionSnapshot.attributedPaidSuborders),
      unattributedDiscountedSuborders: numberOrZero(
        couponAttributionSnapshot.unattributedDiscountedSuborders
      ),
      totalDiscountAmount: numberOrZero(couponAttributionSnapshot.totalDiscountAmount),
      paidDiscountAmount: numberOrZero(couponAttributionSnapshot.paidDiscountAmount),
      topCouponCodes: Array.isArray(couponAttributionSnapshot.topCouponCodes)
        ? couponAttributionSnapshot.topCouponCodes
            .map((entry: any) => ({
              code: textOrFallback(entry?.code),
              scopeType: textOrFallback(entry?.scopeType, "UNKNOWN"),
              attributedSuborders: numberOrZero(entry?.attributedSuborders),
              attributedPaidSuborders: numberOrZero(entry?.attributedPaidSuborders),
              totalDiscountAmount: numberOrZero(entry?.totalDiscountAmount),
              paidDiscountAmount: numberOrZero(entry?.paidDiscountAmount),
            }))
            .filter((entry: { code: string }) => Boolean(entry.code))
        : [],
      scopeBreakdown: Array.isArray(couponAttributionSnapshot.scopeBreakdown)
        ? couponAttributionSnapshot.scopeBreakdown
            .map((entry: any) => ({
              scopeType: textOrFallback(entry?.scopeType, "UNKNOWN"),
              attributedSuborders: numberOrZero(entry?.attributedSuborders),
              attributedPaidSuborders: numberOrZero(entry?.attributedPaidSuborders),
              totalDiscountAmount: numberOrZero(entry?.totalDiscountAmount),
              paidDiscountAmount: numberOrZero(entry?.paidDiscountAmount),
            }))
            .filter((entry: { scopeType: string }) => Boolean(entry.scopeType))
        : [],
      coverage: {
        discountedSuborders: numberOrZero(couponAttributionSnapshot?.coverage?.discountedSuborders),
        attributedDiscountedSuborders: numberOrZero(
          couponAttributionSnapshot?.coverage?.attributedDiscountedSuborders
        ),
        attributedCoveragePercent: numberOrZero(
          couponAttributionSnapshot?.coverage?.attributedCoveragePercent
        ),
        note: textOrNull(couponAttributionSnapshot?.coverage?.note),
      },
      boundaryNote: textOrNull(couponAttributionSnapshot.boundaryNote),
    },
    productSnapshot: {
      visible: Boolean(productSnapshot.visible),
      totalProducts: numberOrZero(productSnapshot.totalProducts),
      activeProducts: numberOrZero(productSnapshot.activeProducts),
      draftProducts: numberOrZero(productSnapshot.draftProducts),
      storefrontVisibleProducts: numberOrZero(productSnapshot.storefrontVisibleProducts),
      reviewQueue: numberOrZero(productSnapshot.reviewQueue),
      topProducts: Array.isArray(productSnapshot.topProducts)
        ? productSnapshot.topProducts
            .map((entry: any) => ({
              productId: numberOrZero(entry?.productId),
              name: textOrFallback(entry?.name, "Unknown product"),
              slug: textOrNull(entry?.slug),
              status: textOrFallback(entry?.status, "unknown"),
              stock: numberOrZero(entry?.stock),
              qtySold: numberOrZero(entry?.qtySold),
              revenueAmount: numberOrZero(entry?.revenueAmount),
              storefrontVisible: Boolean(entry?.storefrontVisible),
            }))
            .filter((entry: { productId: number }) => entry.productId > 0)
        : [],
      hint: textOrNull(productSnapshot.hint),
    },
    insights: Array.isArray(payload?.insights)
      ? payload.insights.map((entry: any) => ({
          code: textOrFallback(entry?.code),
          lane: textOrFallback(entry?.lane, "HOME"),
          tone: textOrFallback(entry?.tone, "stone"),
          label: textOrFallback(entry?.label, "Monitor analytics baseline"),
          description: textOrNull(entry?.description),
        }))
      : [],
    couponAttributionReadiness: {
      visible: Boolean(couponAttributionReadiness.visible),
      level: textOrFallback(couponAttributionReadiness.level, "HIDDEN"),
      label: textOrFallback(couponAttributionReadiness.label, "Hidden"),
      tone: textOrFallback(couponAttributionReadiness.tone, "stone"),
      summary: textOrNull(couponAttributionReadiness.summary),
      signals: Array.isArray(couponAttributionReadiness.signals)
        ? couponAttributionReadiness.signals
            .map((entry: any) => ({
              key: textOrFallback(entry?.key),
              label: textOrFallback(entry?.label, "Unknown signal"),
              status: textOrFallback(entry?.status, "UNKNOWN"),
              description: textOrNull(entry?.description),
            }))
            .filter((entry: { key: string }) => Boolean(entry.key))
        : [],
      recommendedNextStep: textOrNull(couponAttributionReadiness.recommendedNextStep),
      boundaryNote: textOrNull(couponAttributionReadiness.boundaryNote),
    },
    boundaries: {
      tenantScope: textOrNull(payload?.boundaries?.tenantScope),
      adminAuthority: textOrNull(payload?.boundaries?.adminAuthority),
      storefrontBoundary: textOrNull(payload?.boundaries?.storefrontBoundary),
    },
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

export const listSellerWorkspaceStores = async () => {
  const { data } = await api.get("/seller/stores");
  return Array.isArray(data?.data) ? (data.data as SellerWorkspaceStoreAccess[]) : [];
};

export const getSellerFinanceSummary = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/finance-summary`);
  return normalizeFinanceSummary(data?.data ?? null);
};

export const getSellerWorkspaceReadiness = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/workspace-readiness`);
  return normalizeWorkspaceReadiness(data?.data ?? null);
};

export const getSellerAnalyticsSummary = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/analytics-summary`);
  return normalizeAnalyticsSummary(data?.data ?? null);
};
