import { Op } from "sequelize";
import { Router } from "express";
import { z } from "zod";
import { StoreApplication, User } from "../models/index.js";
import {
  buildStoreApplicationCompleteness,
  buildStoreApplicationMutationMetadata,
  canTransitionStoreApplicationStatus,
  normalizeStoreApplicationSnapshots,
} from "../services/storeApplication.js";
import { provisionApprovedStoreApplication } from "../services/storeApplicationActivation.js";

const router = Router();

const LISTABLE_STATUSES = new Set([
  "draft",
  "submitted",
  "under_review",
  "revision_requested",
  "approved",
  "rejected",
  "cancelled",
]);

const applicationInclude = [
  {
    model: User,
    as: "applicantUser",
    attributes: ["id", "name", "email", "phoneNumber", "role", "status"],
    required: false,
  },
  {
    model: User,
    as: "reviewedByUser",
    attributes: ["id", "name", "email", "role"],
    required: false,
  },
];

const approveSchema = z
  .object({
    internalAdminNote: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict();

const revisionRequestSchema = z
  .object({
    revisionNote: z.string().trim().min(4).max(4_000),
    revisionSummary: z.string().trim().max(2_000).nullable().optional(),
    internalAdminNote: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict();

const rejectSchema = z
  .object({
    rejectReason: z.string().trim().min(4).max(4_000),
    internalAdminNote: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict();

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key] ?? row?.[key];

const toIsoString = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toText = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const textOrFallback = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const getInternalMetadata = (application: any) =>
  normalizeObject(getAttr(application, "internalMetadata"));

const getAdminReviewMetadata = (application: any) =>
  normalizeObject(getInternalMetadata(application)?.adminReview);

const getActivationMetadata = (application: any) =>
  normalizeObject(getInternalMetadata(application)?.activation);

const maskAccountNumber = (value: unknown) => {
  const digits = String(value || "").replace(/\s+/g, "");
  if (!digits) return null;
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(digits.length - 4, 2))}${digits.slice(-4)}`;
};

const buildApplicantIdentityMatch = (application: any, applicantUser: any) => {
  const snapshots = normalizeStoreApplicationSnapshots(application);
  const accountName = toText(getAttr(applicantUser, "name"));
  const accountEmail = toText(getAttr(applicantUser, "email"));
  const accountPhone = toText(getAttr(applicantUser, "phoneNumber"));
  const identityName = toText(snapshots.ownerIdentitySnapshot.fullName);
  const identityEmail = toText(snapshots.ownerIdentitySnapshot.email);
  const identityPhone = toText(snapshots.ownerIdentitySnapshot.phoneNumber);

  const matches = [
    {
      key: "name",
      label: "Account name vs identity name",
      matched: Boolean(accountName && identityName && accountName === identityName),
      accountValue: accountName,
      applicationValue: identityName,
    },
    {
      key: "email",
      label: "Account email vs application email",
      matched: Boolean(accountEmail && identityEmail && accountEmail === identityEmail),
      accountValue: accountEmail,
      applicationValue: identityEmail,
    },
    {
      key: "phone",
      label: "Account phone vs application phone",
      matched: Boolean(accountPhone && identityPhone && accountPhone === identityPhone),
      accountValue: accountPhone,
      applicationValue: identityPhone,
    },
  ];

  const matchedCount = matches.filter((entry) => entry.matched).length;
  const totalComparable = matches.filter(
    (entry) => entry.accountValue || entry.applicationValue
  ).length;

  return {
    matchedCount,
    totalComparable,
    summaryLabel:
      totalComparable === 0
        ? "No comparable identity fields"
        : matchedCount === totalComparable
          ? "Account and application identity mostly match"
          : matchedCount === 0
            ? "Account and application identity do not match"
            : "Account and application identity partially match",
    fields: matches,
  };
};

const buildAdminActionGovernance = (application: any) => {
  const status = textOrFallback(getAttr(application, "status"), "draft");
  const canReview = ["submitted", "under_review"].includes(status);

  return {
    canApprove: canReview && canTransitionStoreApplicationStatus(status as any, "approved"),
    canRequestRevision:
      canReview && canTransitionStoreApplicationStatus(status as any, "revision_requested"),
    canReject: canReview && canTransitionStoreApplicationStatus(status as any, "rejected"),
    boundaryNote:
      "Approval provisions a seller store boundary and owner membership. Public storefront visibility stays gated by Store.status and backend operational readiness.",
  };
};

const serializeStatusMeta = (application: any) => {
  const status = textOrFallback(getAttr(application, "status"), "draft");
  const labelMap: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under review",
    revision_requested: "Revision requested",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  const toneMap: Record<string, string> = {
    draft: "stone",
    submitted: "amber",
    under_review: "sky",
    revision_requested: "rose",
    approved: "emerald",
    rejected: "rose",
    cancelled: "stone",
  };

  return {
    code: status,
    label: labelMap[status] || "Draft",
    tone: toneMap[status] || "stone",
  };
};

const serializeCurrentStepMeta = (application: any) => {
  const currentStep = textOrFallback(getAttr(application, "currentStep"), "owner_identity");
  const labelMap: Record<string, string> = {
    owner_identity: "Owner identity",
    store_information: "Store information",
    operational_address: "Operational address",
    payout_payment: "Payout and payment",
    compliance: "Compliance",
    review: "Review",
  };

  return {
    code: currentStep,
    label: labelMap[currentStep] || "Owner identity",
  };
};

const serializeAdminStoreApplicationDetail = (application: any) => {
  if (!application) return null;

  const applicantUser = application?.applicantUser ?? application?.get?.("applicantUser") ?? null;
  const reviewedByUser =
    application?.reviewedByUser ?? application?.get?.("reviewedByUser") ?? null;
  const snapshots = normalizeStoreApplicationSnapshots(application);
  const completeness = buildStoreApplicationCompleteness(application);
  const metadata = getInternalMetadata(application);
  const adminReview = getAdminReviewMetadata(application);
  const activation = getActivationMetadata(application);
  const applicantIdentityMatch = buildApplicantIdentityMatch(application, applicantUser);
  const accountStatus = textOrFallback(getAttr(applicantUser, "status"), "active");

  return {
    id: Number(getAttr(application, "id") || 0),
    status: textOrFallback(getAttr(application, "status"), "draft"),
    statusMeta: serializeStatusMeta(application),
    currentStep: textOrFallback(getAttr(application, "currentStep"), "owner_identity"),
    currentStepMeta: serializeCurrentStepMeta(application),
    applicant: {
      userId: Number(getAttr(application, "applicantUserId") || 0),
      accountName: toText(getAttr(applicantUser, "name")),
      accountEmail: toText(getAttr(applicantUser, "email")),
      accountPhone: toText(getAttr(applicantUser, "phoneNumber")),
      accountRole: toText(getAttr(applicantUser, "role")),
      accountStatus,
      identityMatch: applicantIdentityMatch,
    },
    ownerIdentity: {
      fullName: toText(snapshots.ownerIdentitySnapshot.fullName),
      operationalContactName: toText(snapshots.ownerIdentitySnapshot.operationalContactName),
      identityType: toText(snapshots.ownerIdentitySnapshot.identityType),
      identityNumber: toText(snapshots.complianceSnapshot?.identityNumber),
      identityLegalName: toText(snapshots.ownerIdentitySnapshot.identityLegalName),
      birthDate: toText(snapshots.ownerIdentitySnapshot.birthDate),
    },
    storeInformation: {
      storeName: toText(snapshots.storeInformationSnapshot.storeName),
      storeSlug: toText(snapshots.storeInformationSnapshot.storeSlug),
      storeCategory: toText(snapshots.storeInformationSnapshot.storeCategory),
      description: toText(snapshots.storeInformationSnapshot.description),
      sellerType: toText(snapshots.storeInformationSnapshot.sellerType),
      isSelfProduced: Boolean(snapshots.storeInformationSnapshot.isSelfProduced),
      initialProductCount: toNumber(snapshots.storeInformationSnapshot.initialProductCount),
    },
    operationalVerification: {
      contactName: toText(snapshots.operationalAddressSnapshot.contactName),
      phoneNumber: toText(snapshots.operationalAddressSnapshot.phoneNumber),
      addressLine1: toText(snapshots.operationalAddressSnapshot.addressLine1),
      addressLine2: toText(snapshots.operationalAddressSnapshot.addressLine2),
      province: toText(snapshots.operationalAddressSnapshot.province),
      city: toText(snapshots.operationalAddressSnapshot.city),
      district: toText(snapshots.operationalAddressSnapshot.district),
      postalCode: toText(snapshots.operationalAddressSnapshot.postalCode),
      country: toText(snapshots.operationalAddressSnapshot.country),
      addressNotes: toText(snapshots.operationalAddressSnapshot.notes),
      fullAddress: [
        toText(snapshots.operationalAddressSnapshot.addressLine1),
        toText(snapshots.operationalAddressSnapshot.addressLine2),
        toText(snapshots.operationalAddressSnapshot.district),
        toText(snapshots.operationalAddressSnapshot.city),
        toText(snapshots.operationalAddressSnapshot.province),
        toText(snapshots.operationalAddressSnapshot.postalCode),
        toText(snapshots.operationalAddressSnapshot.country),
      ]
        .filter(Boolean)
        .join(", "),
    },
    financialVerification: {
      payoutMethod: toText(snapshots.payoutPaymentSnapshot.payoutMethod),
      accountHolderName: toText(snapshots.payoutPaymentSnapshot.accountHolderName),
      bankChannel: toText(snapshots.payoutPaymentSnapshot.bankName),
      accountNumberMasked: maskAccountNumber(snapshots.payoutPaymentSnapshot.accountNumber),
      accountHolderMatchesIdentity: Boolean(
        snapshots.payoutPaymentSnapshot.accountHolderMatchesIdentity
      ),
      taxId: toText(snapshots.complianceSnapshot.taxId),
    },
    complianceRisk: {
      productTypes: toText(snapshots.complianceSnapshot.productTypes),
      brandOwnershipType: toText(snapshots.complianceSnapshot.brandOwnershipType),
      authenticityConfirmed: Boolean(snapshots.complianceSnapshot.authenticityConfirmed),
      prohibitedGoodsConfirmed: Boolean(
        snapshots.complianceSnapshot.prohibitedGoodsConfirmed
      ),
      websiteUrl: toText(snapshots.complianceSnapshot.websiteUrl),
      socialMediaUrl: toText(snapshots.complianceSnapshot.socialMediaUrl),
      supportEmail: toText(snapshots.complianceSnapshot.supportEmail),
      supportPhone: toText(snapshots.complianceSnapshot.supportPhone),
      additionalNotes: toText(snapshots.complianceSnapshot.notes),
    },
    workflowSummary: {
      applicationStatus: textOrFallback(getAttr(application, "status"), "draft"),
      currentStep: textOrFallback(getAttr(application, "currentStep"), "owner_identity"),
      completeness,
      submittedAt: toIsoString(getAttr(application, "submittedAt")),
      reviewedAt: toIsoString(getAttr(application, "reviewedAt")),
      reviewedBy: reviewedByUser
        ? {
            id: Number(getAttr(reviewedByUser, "id") || 0) || null,
            name: textOrFallback(getAttr(reviewedByUser, "name")),
            email: toText(getAttr(reviewedByUser, "email")),
          }
        : null,
      revisionNote: toText(getAttr(application, "revisionNote")),
      rejectReason: toText(getAttr(application, "rejectReason")),
      internalAdminNote: toText(adminReview.internalAdminNote),
      revisionSummary: toText(adminReview.revisionSummary),
      actionGovernance: buildAdminActionGovernance(application),
      activation: {
        storeId: toNumber(activation.storeId),
        storeSlug: toText(activation.storeSlug),
        storeStatus: toText(activation.storeStatus),
        ownerMembershipId: toNumber(activation.ownerMembershipId),
        ownerMembershipStatus: toText(activation.ownerMembershipStatus),
        sellerAccessReady: Boolean(activation.sellerAccessReady),
        provisionedAt: toText(activation.provisionedAt),
        provisionedMode: toText(activation.provisionedMode),
      },
    },
    contract: {
      sourceOfTruth: "store_application_admin_review",
      notes: [
        "Admin review reads normalized snapshots from the store application orchestration layer.",
        "Approve provisions the existing Store + StoreMember domain without creating a parallel seller system.",
        "Internal admin note stays private to admin review and is not exposed on public storefront flows.",
      ],
    },
    metadata: {
      submittedCount: Number(metadata?.submittedCount || 0),
      lastSubmittedAt: toText(metadata?.lastSubmittedAt),
      lastResubmittedAt: toText(metadata?.lastResubmittedAt),
      createdFrom: toText(metadata?.createdFrom),
    },
    createdAt: toIsoString(getAttr(application, "createdAt")),
    updatedAt: toIsoString(getAttr(application, "updatedAt")),
  };
};

const serializeAdminStoreApplicationListItem = (application: any) => {
  const detail = serializeAdminStoreApplicationDetail(application);
  if (!detail) return null;

  return {
    id: detail.id,
    status: detail.status,
    statusMeta: detail.statusMeta,
    currentStep: detail.currentStep,
    currentStepMeta: detail.currentStepMeta,
    applicant: {
      userId: detail.applicant.userId,
      accountName: detail.applicant.accountName,
      accountEmail: detail.applicant.accountEmail,
      accountPhone: detail.applicant.accountPhone,
      identityMatch: {
        matchedCount: detail.applicant.identityMatch.matchedCount,
        totalComparable: detail.applicant.identityMatch.totalComparable,
        summaryLabel: detail.applicant.identityMatch.summaryLabel,
      },
    },
    storeInformation: {
      storeName: detail.storeInformation.storeName,
      storeSlug: detail.storeInformation.storeSlug,
      storeCategory: detail.storeInformation.storeCategory,
      sellerType: detail.storeInformation.sellerType,
    },
    completeness: detail.workflowSummary.completeness,
    submittedAt: detail.workflowSummary.submittedAt,
    reviewedAt: detail.workflowSummary.reviewedAt,
    reviewedBy: detail.workflowSummary.reviewedBy,
    reviewSummary: {
      revisionNote: detail.workflowSummary.revisionNote,
      rejectReason: detail.workflowSummary.rejectReason,
      internalAdminNote: detail.workflowSummary.internalAdminNote,
    },
    actionGovernance: detail.workflowSummary.actionGovernance,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
};

const sendNotFound = (res: any) =>
  res.status(404).json({
    success: false,
    code: "STORE_APPLICATION_NOT_FOUND",
    message: "Store application not found.",
  });

const loadStoreApplicationById = async (applicationId: number) =>
  StoreApplication.findByPk(applicationId, {
    include: applicationInclude as any,
  });

const buildAdminReviewMetadata = (
  application: any,
  input: {
    action: "approved" | "revision_requested" | "rejected";
    internalAdminNote?: string | null;
    revisionSummary?: string | null;
  }
) => {
  const currentMetadata = getInternalMetadata(application);
  const currentAdminReview = getAdminReviewMetadata(application);

  return buildStoreApplicationMutationMetadata(currentMetadata, {
    adminReview: {
      ...currentAdminReview,
      internalAdminNote:
        input.internalAdminNote !== undefined
          ? input.internalAdminNote || null
          : currentAdminReview.internalAdminNote || null,
      revisionSummary:
        input.revisionSummary !== undefined
          ? input.revisionSummary || null
          : currentAdminReview.revisionSummary || null,
      lastAction: input.action,
      lastActionAt: new Date().toISOString(),
    },
  });
};

router.get("/store-applications", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10) || 10, 1), 100);
    const statusParam = textOrFallback(req.query.status);
    const where: Record<string, any> = {};

    if (statusParam && LISTABLE_STATUSES.has(statusParam)) {
      where.status = statusParam;
    }

    const offset = (page - 1) * limit;
    const { rows, count } = await StoreApplication.findAndCountAll({
      where: where as any,
      include: applicationInclude as any,
      order: [
        ["submittedAt", "DESC"],
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: rows
        .map((row: any) => serializeAdminStoreApplicationListItem(row))
        .filter(Boolean),
      meta: {
        page,
        limit,
        total: Number(count || 0),
        totalPages: Math.max(Math.ceil(Number(count || 0) / limit), 1),
        statusFilter: statusParam || null,
      },
    });
  } catch (error) {
    console.error("[admin.store-applications:list] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load store applications.",
    });
  }
});

router.get("/store-applications/:applicationId", async (req, res) => {
  try {
    const applicationId = Number(req.params.applicationId);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_ID",
        message: "Invalid store application id.",
      });
    }

    const application = await loadStoreApplicationById(applicationId);
    if (!application) return sendNotFound(res);

    return res.json({
      success: true,
      data: serializeAdminStoreApplicationDetail(application),
    });
  } catch (error) {
    console.error("[admin.store-applications:detail] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load the store application detail.",
    });
  }
});

router.patch("/store-applications/:applicationId/approve", async (req, res) => {
  try {
    const applicationId = Number(req.params.applicationId);
    const adminUserId = Number((req as any).user?.id || 0);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_ID",
        message: "Invalid store application id.",
      });
    }
    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsed = approveSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_REVIEW_PAYLOAD",
        message: "Invalid admin review payload.",
        errors: parsed.error.flatten(),
      });
    }

    const application = await loadStoreApplicationById(applicationId);
    if (!application) return sendNotFound(res);

    const currentStatus = textOrFallback(getAttr(application, "status"), "draft");
    if (!canTransitionStoreApplicationStatus(currentStatus as any, "approved")) {
      return res.status(409).json({
        success: false,
        code: "STORE_APPLICATION_APPROVE_NOT_ALLOWED",
        message: "This store application cannot be approved from its current status.",
        data: serializeAdminStoreApplicationDetail(application),
      });
    }

    await application.update(
      {
        status: "approved",
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
        revisionNote: null,
        rejectReason: null,
        internalMetadata: buildAdminReviewMetadata(application, {
          action: "approved",
          internalAdminNote: parsed.data.internalAdminNote || null,
        }),
      } as any
    );

    await provisionApprovedStoreApplication(application);

    const updated = await loadStoreApplicationById(applicationId);

    return res.json({
      success: true,
      message: "Store application approved.",
      data: serializeAdminStoreApplicationDetail(updated),
    });
  } catch (error) {
    console.error("[admin.store-applications:approve] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve the store application.",
    });
  }
});

router.patch("/store-applications/:applicationId/revision-request", async (req, res) => {
  try {
    const applicationId = Number(req.params.applicationId);
    const adminUserId = Number((req as any).user?.id || 0);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_ID",
        message: "Invalid store application id.",
      });
    }
    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsed = revisionRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_REVIEW_PAYLOAD",
        message: "Invalid admin review payload.",
        errors: parsed.error.flatten(),
      });
    }

    const application = await loadStoreApplicationById(applicationId);
    if (!application) return sendNotFound(res);

    const currentStatus = textOrFallback(getAttr(application, "status"), "draft");
    if (!canTransitionStoreApplicationStatus(currentStatus as any, "revision_requested")) {
      return res.status(409).json({
        success: false,
        code: "STORE_APPLICATION_REVISION_NOT_ALLOWED",
        message: "This store application cannot be sent back for revision from its current status.",
        data: serializeAdminStoreApplicationDetail(application),
      });
    }

    await application.update({
      status: "revision_requested",
      reviewedAt: new Date(),
      reviewedByUserId: adminUserId,
      revisionNote: parsed.data.revisionNote,
      rejectReason: null,
      internalMetadata: buildAdminReviewMetadata(application, {
        action: "revision_requested",
        internalAdminNote: parsed.data.internalAdminNote || null,
        revisionSummary: parsed.data.revisionSummary || null,
      }),
    } as any);

    const updated = await loadStoreApplicationById(applicationId);

    return res.json({
      success: true,
      message: "Store application sent back for revision.",
      data: serializeAdminStoreApplicationDetail(updated),
    });
  } catch (error) {
    console.error("[admin.store-applications:revision-request] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request a revision for the store application.",
    });
  }
});

router.patch("/store-applications/:applicationId/reject", async (req, res) => {
  try {
    const applicationId = Number(req.params.applicationId);
    const adminUserId = Number((req as any).user?.id || 0);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_ID",
        message: "Invalid store application id.",
      });
    }
    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsed = rejectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_REVIEW_PAYLOAD",
        message: "Invalid admin review payload.",
        errors: parsed.error.flatten(),
      });
    }

    const application = await loadStoreApplicationById(applicationId);
    if (!application) return sendNotFound(res);

    const currentStatus = textOrFallback(getAttr(application, "status"), "draft");
    if (!canTransitionStoreApplicationStatus(currentStatus as any, "rejected")) {
      return res.status(409).json({
        success: false,
        code: "STORE_APPLICATION_REJECT_NOT_ALLOWED",
        message: "This store application cannot be rejected from its current status.",
        data: serializeAdminStoreApplicationDetail(application),
      });
    }

    await application.update({
      status: "rejected",
      reviewedAt: new Date(),
      reviewedByUserId: adminUserId,
      revisionNote: null,
      rejectReason: parsed.data.rejectReason,
      internalMetadata: buildAdminReviewMetadata(application, {
        action: "rejected",
        internalAdminNote: parsed.data.internalAdminNote || null,
      }),
    } as any);

    const updated = await loadStoreApplicationById(applicationId);

    return res.json({
      success: true,
      message: "Store application rejected.",
      data: serializeAdminStoreApplicationDetail(updated),
    });
  } catch (error) {
    console.error("[admin.store-applications:reject] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject the store application.",
    });
  }
});

export default router;
