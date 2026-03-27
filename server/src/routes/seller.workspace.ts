import { Router } from "express";
import { Op } from "sequelize";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import requireAuth from "../middleware/requireAuth.js";
import {
  Order,
  Payment,
  PaymentProof,
  Store,
  StorePaymentProfile,
  StorePaymentProfileRequest,
  Suborder,
} from "../models/index.js";
import {
  resolveSellerAccessBySlug,
  listSellerAccessContexts,
  sellerHasPermission,
} from "../services/seller/resolveSellerAccess.js";
import {
  resolvePreferredStorePaymentProfile,
  STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES,
} from "../services/sharedContracts/storePaymentProfileCompat.js";
import {
  buildWorkspaceReadinessSummary,
  emptyProductPipelineSummary,
  emptyTeamWorkspaceSummary,
  loadProductPipelineSummaryByStoreIds,
  loadTeamWorkspaceSummaryByStoreIds,
} from "../services/sellerWorkspaceReadiness.js";
import { loadSellerWorkspaceAnalyticsSummary } from "../services/sellerWorkspaceAnalytics.js";
import {
  openSellerPaymentRequestStatuses,
  storePaymentProfileRequestAttributes,
} from "../services/sharedContracts/storePaymentProfileState.js";

const router = Router();

const serializeSellerWorkspaceContext = (sellerAccess: any) => ({
  store: {
    id: Number(sellerAccess.store.id),
    name: String(sellerAccess.store.name || ""),
    slug: String(sellerAccess.store.slug || ""),
    status: String(sellerAccess.store.status || "ACTIVE"),
  },
  access: {
    accessMode: sellerAccess.accessMode,
    roleCode: sellerAccess.roleCode,
    permissionKeys: sellerAccess.permissionKeys,
    membershipStatus: sellerAccess.membershipStatus,
    isOwner: Boolean(sellerAccess.isOwner),
    memberId: sellerAccess.memberId,
  },
});

const requiredPaymentProfileFields = [
  { key: "accountName", label: "Account name" },
  { key: "merchantName", label: "Merchant name" },
  { key: "qrisImageUrl", label: "QRIS image" },
] as const;

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const toLower = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toLowerCase();

const hasText = (value: unknown) => String(value || "").trim().length > 0;

const getLatestByCreatedAt = (items: any[]) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return [...items].sort((left, right) => {
    const leftTime = new Date(getAttr(left, "createdAt") || 0).getTime();
    const rightTime = new Date(getAttr(right, "createdAt") || 0).getTime();
    return rightTime - leftTime;
  })[0];
};

const buildPaymentProfileReadiness = (profile: any) => {
  if (!profile) {
    return {
      exists: false,
      code: "NOT_CONFIGURED",
      label: "Not configured",
      tone: "stone",
      description:
        "The active store does not expose a payment profile snapshot yet.",
      isReady: false,
      completedFields: 0,
      totalFields: requiredPaymentProfileFields.length,
      missingFields: requiredPaymentProfileFields.map((field) => ({
        key: field.key,
        label: field.label,
      })),
      reviewStatus: {
        code: "NOT_STARTED",
        label: "Not started",
        tone: "stone",
        description: "Admin review has not started because no payment profile snapshot exists yet.",
      },
      nextStep: {
        code: "OPEN_SELLER_PAYMENT_SETUP",
        label: "Open seller payment setup",
        lane: "SELLER_PAYMENT_SETUP",
        actor: "SELLER_OWNER_OR_ADMIN",
        description:
          "Create the first store-scoped payment setup draft in the seller workspace. Admin remains the final reviewer before any setup can go live.",
      },
      governance: {
        mode: "READ_ONLY_SNAPSHOT",
        note:
          "Seller workspace only reports payment setup readiness. It does not expose payment profile mutation in this phase.",
      },
    };
  }

  const missingFields = requiredPaymentProfileFields
    .filter((field) => !hasText(getAttr(profile, field.key)))
    .map((field) => ({
      key: field.key,
      label: field.label,
    }));
  const totalFields = requiredPaymentProfileFields.length;
  const completedFields = totalFields - missingFields.length;
  const verificationStatus = toUpper(getAttr(profile, "verificationStatus"), "PENDING");
  const isActive = Boolean(getAttr(profile, "isActive"));

  let code = "PENDING_REVIEW";
  let label = "Pending review";
  let tone = "amber";
  let description =
    "Required payment destination fields are present, but admin review still decides whether the profile can go live.";

  if (missingFields.length > 0) {
    code = "INCOMPLETE";
    label = "Incomplete";
    tone = "amber";
    description =
      "Some required payment destination fields are still missing. Complete them in the seller payment setup lane, then submit for admin review.";
  } else if (verificationStatus === "REJECTED") {
    code = "REJECTED";
    label = "Rejected";
    tone = "rose";
    description =
      "The payment profile was reviewed and rejected. Seller workspace remains a monitoring lane only.";
  } else if (verificationStatus === "ACTIVE" && isActive) {
    code = "READY";
    label = "Ready";
    tone = "emerald";
    description =
      "The payment profile is complete, approved, and active for seller payment operations.";
  } else if (verificationStatus === "INACTIVE" || !isActive) {
    code = "INACTIVE";
    label = "Inactive";
    tone = "stone";
    description =
      "The payment profile exists, but activation is still blocked by the existing review or store configuration flow.";
  }

  const reviewStatus =
    verificationStatus === "ACTIVE"
      ? {
          code: verificationStatus,
          label: "Verified",
          tone: "emerald",
          description: "Admin review has marked this payment profile as approved.",
        }
      : verificationStatus === "REJECTED"
        ? {
            code: verificationStatus,
          label: "Rejected",
          tone: "rose",
          description:
              "Admin review rejected this payment profile. The seller should update the request in the seller payment setup lane before review can restart.",
          }
        : verificationStatus === "INACTIVE"
          ? {
              code: verificationStatus,
              label: "Inactive",
              tone: "stone",
              description: "The payment profile exists, but it is not active for seller operations.",
            }
          : {
              code: verificationStatus,
              label: "Pending review",
              tone: "amber",
              description:
                "Payment profile data has been submitted and is still waiting for admin review.",
            };

  let nextStep = {
    code: "WAIT_ADMIN_REVIEW",
    label: "Wait for admin review",
    lane: "ADMIN_REVIEW",
    actor: "ADMIN",
    description:
      "No seller action is exposed in seller workspace while this payment profile is still under admin review.",
  };

  if (code === "INCOMPLETE") {
    nextStep = {
      code: "COMPLETE_PROFILE",
      label: "Complete profile in seller lane",
      lane: "SELLER_PAYMENT_SETUP",
      actor: "SELLER_OWNER_OR_ADMIN",
      description:
        "Complete the missing payment profile fields in the seller payment setup lane, then submit for admin review.",
    };
  } else if (code === "REJECTED") {
    nextStep = {
      code: "UPDATE_AND_RESUBMIT",
      label: "Update profile in seller lane",
      lane: "SELLER_PAYMENT_SETUP",
      actor: "SELLER_OWNER_OR_ADMIN",
      description:
        "Update the payment profile request in the seller payment setup lane before admin review can restart.",
    };
  } else if (code === "READY") {
    nextStep = {
      code: "NO_ACTION_REQUIRED",
      label: "No action required",
      lane: "MONITOR_ONLY",
      actor: "SELLER",
      description:
        "Payment setup is already ready. Buyer payment proof review and order operations stay on separate seller lanes.",
    };
  } else if (code === "INACTIVE") {
    nextStep = {
      code: "REVIEW_PAYMENT_SETUP",
      label: "Review payment setup status",
      lane: "SELLER_PAYMENT_SETUP",
      actor: "SELLER_OWNER_OR_ADMIN",
      description:
        "Review the latest active snapshot and request history in seller workspace. Admin still controls activation when the setup is otherwise complete.",
    };
  }

  return {
    exists: true,
    code,
    label,
    tone,
    description,
    isReady: code === "READY",
    completedFields,
    totalFields,
    missingFields,
    reviewStatus,
    nextStep,
    governance: {
      mode: "READ_ONLY_SNAPSHOT",
      note:
        "Seller workspace exposes the payment setup status for the active store, while admin remains the final reviewer and activation authority.",
    },
    profile: {
      id: toNumber(getAttr(profile, "id")),
      providerCode: String(getAttr(profile, "providerCode") || "MANUAL_QRIS"),
      paymentType: String(getAttr(profile, "paymentType") || "QRIS_STATIC"),
      merchantName: String(getAttr(profile, "merchantName") || ""),
      accountName: String(getAttr(profile, "accountName") || ""),
      verificationStatus,
      isActive,
      updatedAt: getAttr(profile, "updatedAt") || null,
    },
  };
};

const summarizePaymentReviewCounts = (payments: any[]) => {
  const latestPaymentsBySuborder = new Map<number, any>();

  payments.forEach((payment) => {
    const suborderId = toNumber(getAttr(payment, "suborderId"), 0);
    if (!suborderId) return;

    const current = latestPaymentsBySuborder.get(suborderId);
    const currentTime = new Date(getAttr(current, "createdAt") || 0).getTime();
    const nextTime = new Date(getAttr(payment, "createdAt") || 0).getTime();
    if (!current || nextTime >= currentTime) {
      latestPaymentsBySuborder.set(suborderId, payment);
    }
  });

  const latestPayments = [...latestPaymentsBySuborder.values()];
  const awaitingReview = latestPayments.filter(
    (payment) => toUpper(getAttr(payment, "status")) === "PENDING_CONFIRMATION"
  ).length;
  const settled = latestPayments.filter(
    (payment) => toUpper(getAttr(payment, "status")) === "PAID"
  ).length;
  const rejected = latestPayments.filter((payment) => {
    const latestProof = getLatestByCreatedAt(payment?.proofs ?? []);
    return (
      toUpper(getAttr(payment, "status")) === "REJECTED" ||
      toUpper(getAttr(latestProof, "reviewStatus")) === "REJECTED"
    );
  }).length;
  const exceptionCount = latestPayments.filter((payment) =>
    ["FAILED", "EXPIRED"].includes(toUpper(getAttr(payment, "status")))
  ).length;

  return {
    visible: true,
    totalRecords: latestPayments.length,
    awaitingReview,
    settled,
    rejected,
    exceptionCount,
    hint:
      awaitingReview > 0
        ? "Latest payment proof records still waiting for seller review exist for this store."
        : "No latest payment proof record is currently waiting for seller review.",
  };
};

const summarizeSuborders = (suborders: any[]) => {
  const totalSuborders = suborders.length;
  const unpaidCount = suborders.filter(
    (suborder) => toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "UNPAID"
  ).length;
  const pendingConfirmationCount = suborders.filter(
    (suborder) =>
      toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "PENDING_CONFIRMATION"
  ).length;
  const paidSuborders = suborders.filter(
    (suborder) => toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "PAID"
  );
  const exceptionCount = suborders.filter((suborder) =>
    ["FAILED", "EXPIRED", "CANCELLED"].includes(
      toUpper(getAttr(suborder, "paymentStatus"), "UNPAID")
    )
  ).length;
  const paidGrossAmount = paidSuborders.reduce(
    (sum, suborder) => sum + toNumber(getAttr(suborder, "totalAmount")),
    0
  );

  return {
    visible: true,
    totalSuborders,
    unpaidCount,
    pendingConfirmationCount,
    paidCount: paidSuborders.length,
    exceptionCount,
    paidGrossAmount,
    hint:
      totalSuborders > 0
        ? "This snapshot is derived from store-owned suborders only."
        : "No store-owned suborders are visible for the active seller scope yet.",
  };
};

const summarizeEligiblePaidSuborders = (suborders: any[]) => {
  const eligible = suborders.filter((suborder) => {
    const paymentStatus = toUpper(getAttr(suborder, "paymentStatus"), "UNPAID");
    const fulfillmentStatus = toUpper(
      getAttr(suborder, "fulfillmentStatus"),
      "UNFULFILLED"
    );
    const orderStatus = toLower(getAttr(suborder?.order, "status"), "pending");

    return (
      paymentStatus === "PAID" &&
      fulfillmentStatus !== "CANCELLED" &&
      orderStatus !== "cancelled"
    );
  });

  return {
    visible: true,
    count: eligible.length,
    grossAmount: eligible.reduce(
      (sum, suborder) => sum + toNumber(getAttr(suborder, "totalAmount")),
      0
    ),
    awaitingFulfillmentCount: eligible.filter(
      (suborder) => toUpper(getAttr(suborder, "fulfillmentStatus")) === "UNFULFILLED"
    ).length,
    inProgressCount: eligible.filter((suborder) =>
      ["PROCESSING", "SHIPPED"].includes(
        toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED")
      )
    ).length,
    deliveredCount: eligible.filter(
      (suborder) => toUpper(getAttr(suborder, "fulfillmentStatus")) === "DELIVERED"
    ).length,
    basis: [
      "SUBORDER.paymentStatus = PAID",
      "SUBORDER.fulfillmentStatus != CANCELLED",
      "ORDER.status != cancelled",
    ],
    hint:
      eligible.length > 0
        ? "These rows are operationally eligible paid suborders under the current read-only snapshot basis."
        : "No paid suborder currently matches the eligibility basis for this read-only snapshot.",
    boundaryNote:
      "This is not a payout balance, settlement statement, or withdrawable amount. Admin review, disputes, refunds, and future payout rules can still change the eventual finance outcome.",
  };
};

const buildFinanceNextActions = (input: {
  sellerAccess: any;
  paymentProfileReadiness: any;
  paymentReviewCounts: any;
  eligiblePaidSubordersSummary: any;
}) => {
  const actions = [];
  const canViewPaymentProfile = sellerHasPermission(
    input.sellerAccess,
    "PAYMENT_PROFILE_VIEW"
  );
  const canViewPaymentReview =
    sellerHasPermission(input.sellerAccess, "ORDER_VIEW") &&
    sellerHasPermission(input.sellerAccess, "PAYMENT_STATUS_VIEW");
  const canViewOrders = sellerHasPermission(input.sellerAccess, "ORDER_VIEW");

  if (canViewPaymentProfile && input.paymentProfileReadiness.code === "NOT_CONFIGURED") {
    actions.push({
      code: "CHECK_PAYMENT_SETUP",
      lane: "PAYMENT_PROFILE",
      priority: "high",
      tone: "amber",
      label: "Review payment setup lane",
      description:
        "No payment setup snapshot exists yet for this store. Start the first seller payment setup draft before expecting live payment readiness.",
    });
  } else if (
    canViewPaymentProfile &&
    ["INCOMPLETE", "REJECTED", "INACTIVE"].includes(input.paymentProfileReadiness.code)
  ) {
    actions.push({
      code: "FOLLOW_PAYMENT_SETUP",
      lane: "PAYMENT_PROFILE",
      priority: "high",
      tone: input.paymentProfileReadiness.tone || "amber",
      label: input.paymentProfileReadiness.nextStep?.label || "Follow payment setup",
      description:
        input.paymentProfileReadiness.nextStep?.description ||
        input.paymentProfileReadiness.description,
    });
  }

  if (canViewPaymentReview && input.paymentReviewCounts.awaitingReview > 0) {
    actions.push({
      code: "REVIEW_PENDING_PAYMENTS",
      lane: "PAYMENT_REVIEW",
      priority: "high",
      tone: "amber",
      label: "Review pending payment proofs",
      description: `${input.paymentReviewCounts.awaitingReview} payment proof record(s) still wait for seller review in the active store scope.`,
    });
  }

  if (canViewOrders && input.eligiblePaidSubordersSummary.count > 0) {
    actions.push({
      code: "TRACK_PAID_SUBORDERS",
      lane: "ORDERS",
      priority: "medium",
      tone: "emerald",
      label: "Track paid suborders",
      description: `${input.eligiblePaidSubordersSummary.count} paid suborder snapshot(s) are currently eligible under the read-only basis and should stay monitored operationally.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      code: "MONITOR_WORKSPACE",
      lane: "HOME",
      priority: "low",
      tone: "sky",
      label: "Monitor workspace snapshot",
      description:
        "No urgent finance follow-up is derived right now. Keep using seller workspace as the operational read model for this store.",
    });
  }

  return actions;
};

const buildSellerFinanceSummary = (input: {
  sellerAccess: any;
  paymentProfile: any;
  suborders: any[];
  payments: any[];
}) => {
  const canViewPaymentProfile = sellerHasPermission(
    input.sellerAccess,
    "PAYMENT_PROFILE_VIEW"
  );
  const canViewOrders = sellerHasPermission(input.sellerAccess, "ORDER_VIEW");
  const canViewPaymentReview =
    canViewOrders && sellerHasPermission(input.sellerAccess, "PAYMENT_STATUS_VIEW");

  const paymentProfileReadiness = canViewPaymentProfile
    ? {
        visible: true,
        ...buildPaymentProfileReadiness(input.paymentProfile),
      }
    : {
        visible: false,
        code: "ACCESS_DENIED",
        label: "Locked",
        tone: "stone",
        description:
          "This seller role can access the workspace home, but payment setup readiness is not visible without PAYMENT_PROFILE_VIEW.",
        exists: false,
        completedFields: 0,
        totalFields: requiredPaymentProfileFields.length,
        missingFields: [],
        reviewStatus: null,
        nextStep: null,
        governance: {
          mode: "HIDDEN",
          note: "Payment setup readiness is hidden for this seller role.",
        },
      };

  const suborderPaymentSummary = canViewOrders
    ? summarizeSuborders(input.suborders)
    : {
        visible: false,
        totalSuborders: 0,
        unpaidCount: 0,
        pendingConfirmationCount: 0,
        paidCount: 0,
        exceptionCount: 0,
        paidGrossAmount: 0,
        hint:
          "This seller role can access the workspace home, but suborder payment snapshot is not visible without ORDER_VIEW.",
      };

  const eligiblePaidSubordersSummary = canViewOrders
    ? summarizeEligiblePaidSuborders(input.suborders)
    : {
        visible: false,
        count: 0,
        grossAmount: 0,
        awaitingFulfillmentCount: 0,
        inProgressCount: 0,
        deliveredCount: 0,
        basis: [],
        hint:
          "This seller role can access the workspace home, but eligible paid suborder snapshot is not visible without ORDER_VIEW.",
        boundaryNote:
          "No eligible paid suborder snapshot is exposed for this role.",
      };

  const paymentReviewCounts = canViewPaymentReview
    ? summarizePaymentReviewCounts(input.payments)
    : {
        visible: false,
        totalRecords: 0,
        awaitingReview: 0,
        settled: 0,
        rejected: 0,
        exceptionCount: 0,
        hint:
          "Payment review counts are hidden unless the seller role has both ORDER_VIEW and PAYMENT_STATUS_VIEW.",
      };

  return {
    store: {
      id: Number(input.sellerAccess.store.id),
      name: String(input.sellerAccess.store.name || ""),
      slug: String(input.sellerAccess.store.slug || ""),
      status: String(input.sellerAccess.store.status || "ACTIVE"),
      roleCode: String(input.sellerAccess.roleCode || ""),
      accessMode: String(input.sellerAccess.accessMode || ""),
      membershipStatus: String(input.sellerAccess.membershipStatus || ""),
    },
    paymentProfileReadiness,
    paymentReviewCounts,
    suborderPaymentSummary,
    eligiblePaidSubordersSummary,
    boundaries: {
      tenantScope:
        "This snapshot is strictly tenant-scoped to the active seller store from the route context.",
      payoutDisclaimer:
        "Eligible paid suborders are a read-only derivation only. They are not a payout balance, withdrawable balance, or final settlement statement.",
      adminAuthority:
        "Admin payment profile review and admin payment audit remain the authority for finance governance outside this seller workspace summary.",
      workspaceMode:
        "Seller workspace home is an operational dashboard that reuses existing payment profile, payment review, and suborder lanes without opening a payout workflow.",
    },
    nextActions: buildFinanceNextActions({
      sellerAccess: input.sellerAccess,
      paymentProfileReadiness,
      paymentReviewCounts,
      eligiblePaidSubordersSummary,
    }),
  };
};

const findLatestOpenStorePaymentProfileRequest = async (storeId: number) =>
  StorePaymentProfileRequest.findOne({
    where: {
      storeId,
      requestStatus: { [Op.in]: [...openSellerPaymentRequestStatuses] },
    },
    attributes: [...storePaymentProfileRequestAttributes],
    include: [
      {
        association: "submittedByUser",
        attributes: ["id", "name", "email"],
        required: false,
      },
      {
        association: "reviewedByAdmin",
        attributes: ["id", "name", "email"],
        required: false,
      },
    ],
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });

router.get("/stores/:storeId/context", requireSellerStoreAccess(), async (req, res) => {
  const sellerAccess = (req as any).sellerAccess;

  return res.json({
    success: true,
    data: serializeSellerWorkspaceContext(sellerAccess),
  });
});

router.get("/stores", async (req, res, next) => {
  requireAuth(req, res, async () => {
    try {
      const accessContexts = await listSellerAccessContexts({
        userId: Number((req as any).user?.id),
      });

      const items = accessContexts
        .map((access) => serializeSellerWorkspaceContext(access))
        .sort((left, right) => {
          const leftOwner = left?.access?.isOwner ? 1 : 0;
          const rightOwner = right?.access?.isOwner ? 1 : 0;
          if (leftOwner !== rightOwner) return rightOwner - leftOwner;
          return String(left?.store?.name || "").localeCompare(String(right?.store?.name || ""));
        });

      return res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  });
});

router.get(
  "/stores/:storeId/workspace-readiness",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const canViewPaymentProfile = sellerHasPermission(
        sellerAccess,
        "PAYMENT_PROFILE_VIEW"
      );

      const [store, pendingPaymentRequest, productSummaryMap, teamSummaryMap] = await Promise.all([
        Store.findByPk(storeId, {
          attributes: [
            "id",
            "name",
            "slug",
            "status",
            "description",
            "logoUrl",
            "bannerUrl",
            "email",
            "phone",
            "whatsapp",
            "websiteUrl",
            "instagramUrl",
            "tiktokUrl",
            "addressLine1",
            "addressLine2",
            "city",
            "province",
            "postalCode",
            "country",
            "activeStorePaymentProfileId",
          ],
          include: [
            {
              model: StorePaymentProfile,
              as: "paymentProfile",
              attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
              required: false,
            },
            {
              model: StorePaymentProfile,
              as: "activePaymentProfile",
              attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
              required: false,
            },
          ],
        }),
        canViewPaymentProfile
          ? findLatestOpenStorePaymentProfileRequest(storeId)
          : Promise.resolve(null),
        loadProductPipelineSummaryByStoreIds([storeId]),
        loadTeamWorkspaceSummaryByStoreIds([storeId]),
      ]);

      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found.",
        });
      }

      return res.json({
        success: true,
        data: {
          store: {
            id: Number(store.id),
            name: String(store.name || ""),
            slug: String(store.slug || ""),
            status: String(store.status || "ACTIVE"),
            roleCode: String(sellerAccess?.roleCode || ""),
            accessMode: String(sellerAccess?.accessMode || ""),
            membershipStatus: String(sellerAccess?.membershipStatus || ""),
          },
          ...buildWorkspaceReadinessSummary({
            store,
            activePaymentProfile: canViewPaymentProfile
              ? resolvePreferredStorePaymentProfile(store)
              : null,
            pendingPaymentRequest,
            productSummary: productSummaryMap.get(storeId) || emptyProductPipelineSummary(),
            teamSummary: teamSummaryMap.get(storeId) || emptyTeamWorkspaceSummary(),
            sellerAccess,
            includeTeamInfo: true,
          }),
        },
      });
    } catch (error) {
      console.error("[seller/workspace:readiness] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller workspace readiness.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/finance-summary",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const canViewPaymentProfile = sellerHasPermission(
        sellerAccess,
        "PAYMENT_PROFILE_VIEW"
      );
      const canViewOrders = sellerHasPermission(sellerAccess, "ORDER_VIEW");
      const canViewPaymentReview =
        canViewOrders && sellerHasPermission(sellerAccess, "PAYMENT_STATUS_VIEW");

      const [paymentProfile, suborders, payments] = await Promise.all([
        canViewPaymentProfile
          ? Store.findByPk(storeId, {
              attributes: ["id", "activeStorePaymentProfileId"],
              include: [
                {
                  model: StorePaymentProfile,
                  as: "paymentProfile",
                  attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
                  required: false,
                },
                {
                  model: StorePaymentProfile,
                  as: "activePaymentProfile",
                  attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
                  required: false,
                },
              ],
            })
              .then((store) => resolvePreferredStorePaymentProfile(store))
          : Promise.resolve(null),
        canViewOrders
          ? Suborder.findAll({
              where: { storeId },
              attributes: [
                "id",
                "orderId",
                "suborderNumber",
                "totalAmount",
                "paymentStatus",
                "fulfillmentStatus",
                "paidAt",
                "createdAt",
              ],
              include: [
                {
                  model: Order,
                  as: "order",
                  attributes: ["id", "status"],
                  required: false,
                },
              ],
            })
          : Promise.resolve([]),
        canViewPaymentReview
          ? Payment.findAll({
              where: { storeId },
              attributes: [
                "id",
                "suborderId",
                "status",
                "amount",
                "paidAt",
                "createdAt",
              ],
              include: [
                {
                  model: PaymentProof,
                  as: "proofs",
                  attributes: ["id", "reviewStatus", "createdAt"],
                  required: false,
                },
              ],
            })
          : Promise.resolve([]),
      ]);

      return res.json({
        success: true,
        data: buildSellerFinanceSummary({
          sellerAccess,
          paymentProfile,
          suborders,
          payments,
        }),
      });
    } catch (error) {
      console.error("[seller/workspace:finance-summary] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller finance summary.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/analytics-summary",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);

      return res.json({
        success: true,
        data: await loadSellerWorkspaceAnalyticsSummary({
          storeId,
          sellerAccess,
        }),
      });
    } catch (error) {
      console.error("[seller/workspace:analytics-summary] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller analytics summary.",
      });
    }
  }
);

router.get("/stores/slug/:storeSlug/context", async (req, res, next) => {
  requireAuth(req, res, async () => {
    try {
      const result = await resolveSellerAccessBySlug({
        storeSlug: String(req.params.storeSlug || ""),
        userId: Number((req as any).user?.id),
      });

      if (!result.ok) {
        return res.status(result.status).json({
          success: false,
          code: result.code,
          message: result.message,
        });
      }

      return res.json({
        success: true,
        data: serializeSellerWorkspaceContext(result.data),
      });
    } catch (error) {
      return next(error);
    }
  });
});

export default router;
