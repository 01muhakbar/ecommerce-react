import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import {
  Store,
  StorePaymentProfile,
  StorePaymentProfileRequest,
} from "../models/index.js";
import {
  resolvePreferredStorePaymentProfileByStoreRow,
} from "../services/sharedContracts/storePaymentProfileCompat.js";
import {
  buildEmptyStorePaymentProfileReadiness as buildEmptyReadiness,
  buildSellerPaymentProfileGovernance,
  buildStorePaymentProfileActivityMeta as buildActivityMeta,
  buildStorePaymentProfileReadiness as buildPaymentProfileReadiness,
  buildStorePaymentProfileVerificationMeta as buildVerificationMeta,
  editableSellerPaymentProfileFields as editablePaymentProfileFields,
  getEditableStorePaymentProfileDraftValue as getEditableDraftValue,
  getStorePaymentProfileAttr as getAttr,
  getStorePaymentProfileRequestStatusCode as getOpenRequestStatusCode,
  hasStorePaymentProfileText as hasText,
  isSellerPaymentProfileRequestLockedForEdit,
  normalizeStorePaymentProfileNullableText as normalizeNullableText,
  normalizeStorePaymentProfileRequiredText as normalizeRequiredDraftText,
  openSellerPaymentRequestStatuses,
  requiredStorePaymentProfileFields as requiredPaymentProfileFields,
  serializeStorePaymentProfileActiveSnapshot as serializeActiveSnapshot,
  serializeStorePaymentProfilePendingRequest as serializePendingRequest,
  storePaymentProfileRequestAttributes,
} from "../services/sharedContracts/storePaymentProfileState.js";

const router = Router();

const sellerPaymentProfileDraftSchema = z
  .object({
    accountName: z.string().trim().max(160).optional().nullable(),
    merchantName: z.string().trim().max(160).optional().nullable(),
    merchantId: z.string().trim().max(160).optional().nullable(),
    qrisImageUrl: z.string().trim().max(2_000_000).optional().nullable(),
    qrisPayload: z.string().trim().max(2_000_000).optional().nullable(),
    instructionText: z.string().trim().max(4_000).optional().nullable(),
    sellerNote: z.string().trim().max(4_000).optional().nullable(),
  })
  .strict();

const buildRequestStatusMeta = (request: any, sellerAccess: any = null) => {
  const canEdit = Boolean(sellerAccess?.permissionKeys?.includes("PAYMENT_PROFILE_EDIT"));
  const statusCode = getOpenRequestStatusCode(request);

  if (statusCode === "SUBMITTED") {
    return {
      code: "SUBMITTED",
      label: "Submitted for review",
      tone: "warning",
      description:
        "Seller has submitted the latest payment setup request. Admin remains the final authority before any new setup can go live.",
      isSubmitted: true,
      isDraft: false,
    };
  }

  if (statusCode === "NEEDS_REVISION") {
    return {
      code: "NEEDS_REVISION",
      label: "Needs revision",
      tone: "danger",
      description:
        "Admin asked for revision on the latest request. Seller can update this request and resubmit without affecting the current active setup.",
      isSubmitted: false,
      isDraft: false,
    };
  }

  if (request) {
    return {
      code: "DRAFT",
      label: "Draft request",
      tone: canEdit ? "stone" : "neutral",
      description: canEdit
        ? "Seller can continue editing this draft request. Checkout still uses only the current active approved setup."
        : "A seller payment setup draft exists for this store.",
      isSubmitted: false,
      isDraft: canEdit,
    };
  }

  if (canEdit) {
    return {
      code: "DRAFT",
      label: "Draft request",
      tone: "stone",
      description:
        "No open seller request exists yet. Seller can start a draft without changing the current active approved setup.",
      isSubmitted: false,
      isDraft: true,
    };
  }

  return {
    code: "INACTIVE",
    label: "Inactive",
    tone: "neutral",
    description: "No editable seller request is available for this store.",
    isSubmitted: false,
    isDraft: false,
  };
};

const buildSellerPaymentRequestState = (
  activeProfile: any,
  pendingRequest: any,
  sellerAccess: any = null
) => {
  if (pendingRequest) {
    return buildRequestStatusMeta(pendingRequest, sellerAccess);
  }

  const canEdit = Boolean(sellerAccess?.permissionKeys?.includes("PAYMENT_PROFILE_EDIT"));
  const verificationStatus = String(getAttr(activeProfile, "verificationStatus") || "PENDING").toUpperCase();
  const isActive = Boolean(getAttr(activeProfile, "isActive"));
  const readiness = activeProfile ? buildPaymentProfileReadiness(activeProfile) : buildEmptyReadiness();
  const reviewedAt = getAttr(activeProfile, "verifiedAt") || null;

  if (verificationStatus === "ACTIVE" && isActive) {
    return {
      code: "ACTIVE",
      label: "Active",
      tone: "success",
      description:
        "Admin has approved this payment setup and checkout can use it as the active store payment destination.",
      isSubmitted: false,
      isDraft: false,
    };
  }

  if (verificationStatus === "INACTIVE" && reviewedAt) {
    return {
      code: "INACTIVE",
      label: "Inactive",
      tone: "neutral",
      description:
        "The active payment setup exists but is inactive. Checkout remains blocked until admin activates a valid reviewed setup.",
      isSubmitted: false,
      isDraft: false,
    };
  }

  return {
    code: canEdit ? "DRAFT" : "INACTIVE",
    label: canEdit ? "Draft request" : "Inactive",
    tone: canEdit ? "stone" : "neutral",
    description: canEdit
      ? readiness.isIncomplete
        ? "Seller can start a separate request draft, then submit once the required fields are complete."
        : "Seller can start a separate request draft for admin review without changing the current active setup."
      : "No active payment setup is available for this store yet.",
    isSubmitted: false,
    isDraft: canEdit,
  };
};

const buildReviewStatusMeta = (activeProfile: any, pendingRequest: any) => {
  if (pendingRequest) {
    const requestStatusCode = getOpenRequestStatusCode(pendingRequest);
    const reviewedAt = getAttr(pendingRequest, "reviewedAt") || null;
    const reviewedByAdmin = pendingRequest?.reviewedByAdmin ?? pendingRequest?.get?.("reviewedByAdmin") ?? null;
    let label = "Not reviewed yet";
    let tone = "stone";
    let description = "No admin review feedback is attached to the current seller request yet.";

    if (requestStatusCode === "SUBMITTED") {
      label = "Pending review";
      tone = "warning";
      description = "Admin review is still pending for the current seller request.";
    } else if (requestStatusCode === "NEEDS_REVISION") {
      label = "Needs revision";
      tone = "danger";
      description =
        "Admin reviewed the current request and asked for revision. Seller can update the request without changing the active snapshot.";
    }

    return {
      code: requestStatusCode || "DRAFT",
      label,
      tone,
      description,
      authority: "ADMIN",
      reviewedAt,
      reviewedBy: reviewedByAdmin
        ? {
            id: Number(getAttr(reviewedByAdmin, "id") || 0) || null,
            name: String(getAttr(reviewedByAdmin, "name") || ""),
            email: getAttr(reviewedByAdmin, "email") ? String(getAttr(reviewedByAdmin, "email")) : null,
          }
        : null,
      adminReviewNote: getAttr(pendingRequest, "adminReviewNote")
        ? String(getAttr(pendingRequest, "adminReviewNote"))
        : null,
      source: "PENDING_REQUEST",
    };
  }

  const verificationStatus = String(getAttr(activeProfile, "verificationStatus") || "PENDING").toUpperCase();
  const verificationMeta = buildVerificationMeta(verificationStatus);
  const reviewedAt = getAttr(activeProfile, "verifiedAt") || null;
  const verifiedByAdmin = activeProfile?.verifiedByAdmin ?? activeProfile?.get?.("verifiedByAdmin") ?? null;

  return {
    code: verificationStatus,
    label: verificationMeta.label,
    tone: verificationMeta.tone,
    description: verificationMeta.description,
    authority: "ADMIN",
    reviewedAt,
    reviewedBy: verifiedByAdmin
      ? {
          id: Number(getAttr(verifiedByAdmin, "id") || 0) || null,
          name: String(getAttr(verifiedByAdmin, "name") || ""),
          email: getAttr(verifiedByAdmin, "email") ? String(getAttr(verifiedByAdmin, "email")) : null,
        }
      : null,
    adminReviewNote: null,
    source: "ACTIVE_SNAPSHOT",
  };
};

const buildPaymentProfileReadModel = (
  activeProfile: any,
  pendingRequest: any,
  sellerAccess: any = null
) => {
  const readinessSource = pendingRequest || activeProfile;
  const readiness = readinessSource ? buildPaymentProfileReadiness(readinessSource) : buildEmptyReadiness();
  const actorIsOwner = Boolean(sellerAccess?.isOwner);
  const actorCanEdit = Boolean(sellerAccess?.permissionKeys?.includes("PAYMENT_PROFILE_EDIT"));
  const requestState = buildSellerPaymentRequestState(activeProfile, pendingRequest, sellerAccess);
  const reviewStatus = buildReviewStatusMeta(activeProfile, pendingRequest);

  let primaryStatus = {
    code: "PENDING_ADMIN_REVIEW",
    label: "Pending admin review",
    tone: "warning",
    description:
      "Required payment destination fields are present, but admin review still decides whether the store is ready for payment operations.",
  };
  let nextStep = {
    code: "WAIT_ADMIN_REVIEW",
    label: "Wait for admin review",
    lane: "ADMIN_REVIEW",
    actor: "ADMIN",
    description:
      "No seller activation authority is exposed in seller workspace. Admin remains the final reviewer.",
  };

  if (pendingRequest && requestState.code === "SUBMITTED") {
    primaryStatus = {
      code: "PENDING_ADMIN_REVIEW",
      label: "Pending admin review",
      tone: "warning",
      description:
        "The latest seller request is waiting for admin review. Checkout keeps using the current active approved snapshot until a later approval-and-promotion phase.",
    };
  } else if (pendingRequest && requestState.code === "NEEDS_REVISION") {
    primaryStatus = {
      code: "NEEDS_ACTION",
      label: "Needs action",
      tone: "danger",
      description:
        "Admin asked for revision on the current seller request. The active snapshot remains unchanged while seller revises this request.",
    };
    nextStep = {
      code: "UPDATE_AND_RESUBMIT",
      label: actorCanEdit ? "Revise request and resubmit" : "Wait for owner or admin action",
      lane: "SELLER_PAYMENT_SETUP",
      actor: actorCanEdit ? "SELLER_EDITOR" : actorIsOwner ? "SELLER_OWNER_OR_ADMIN" : "STORE_OWNER_OR_ADMIN",
      description: actorCanEdit
        ? "Update the pending request, save the draft if needed, then submit again for admin review."
        : "This seller access is read-only for payment setup changes.",
    };
  } else if (pendingRequest && requestState.code === "DRAFT") {
    primaryStatus = {
      code: "NEEDS_ACTION",
      label: "Draft in progress",
      tone: readiness.isIncomplete ? "warning" : "stone",
      description: readiness.isIncomplete
        ? "The current seller request is still incomplete. Complete the required fields, then submit for admin review."
        : "The current seller request is saved as a draft and is ready to be submitted for admin review.",
    };
    nextStep = {
      code: readiness.isIncomplete ? "COMPLETE_PROFILE" : "SUBMIT_FOR_REVIEW",
      label: readiness.isIncomplete ? "Complete draft" : "Submit for review",
      lane: "SELLER_PAYMENT_SETUP",
      actor: actorCanEdit ? "SELLER_EDITOR" : "SELLER_VIEWER",
      description: actorCanEdit
        ? readiness.isIncomplete
          ? "Complete the required payment setup fields in the pending request, then submit for admin review."
          : "Submit the current seller request. The active snapshot will stay unchanged until admin approval in a later phase."
        : "This seller access is read-only for payment setup changes.",
    };
  } else if (readiness.isIncomplete) {
    primaryStatus = {
      code: "NEEDS_ACTION",
      label: "Needs action",
      tone: "warning",
      description:
        "Required payment destination fields are still incomplete, so the store is not ready for payment operations yet.",
    };
    nextStep = {
      code: "COMPLETE_PROFILE",
      label: actorCanEdit
        ? "Start payment request"
        : "Ask owner or admin to complete setup",
      lane: "SELLER_PAYMENT_SETUP",
      actor: actorCanEdit ? "SELLER_EDITOR" : actorIsOwner ? "SELLER_OWNER" : "STORE_OWNER_OR_ADMIN",
      description: actorCanEdit
        ? "Start a seller payment setup draft from the active snapshot, complete the required fields, then submit for admin review."
        : "Seller workspace is read-only here. A seller owner or admin with payment setup authority must complete the request in the canonical seller lane.",
    };
  } else if (readiness.isReady) {
    primaryStatus = {
      code: "READY",
      label: "Ready for payment operations",
      tone: "success",
      description:
        "The current active payment profile is complete, approved, and active for store payment operations.",
    };
    nextStep = {
      code: "NO_ACTION_REQUIRED",
      label: "No action required",
      lane: "MONITOR_ONLY",
      actor: "SELLER",
      description:
        "Seller can monitor the active snapshot here. Buyer payment proof review and order payment events stay on separate payment lanes.",
    };
  } else if (readiness.code === "INACTIVE") {
    primaryStatus = {
      code: "INACTIVE",
      label: "Inactive",
      tone: "neutral",
      description:
        "The active setup exists but is not active for payment operations yet, even though the required fields are present.",
    };
    nextStep = {
      code: requestState.code === "DRAFT" ? "SUBMIT_REQUEST" : "REVIEW_PAYMENT_SETUP",
      label: requestState.code === "DRAFT"
        ? "Prepare request"
        : "Review payment setup status",
      lane: "SELLER_PAYMENT_SETUP",
      actor:
        requestState.code === "DRAFT"
          ? "SELLER_EDITOR"
          : actorIsOwner
            ? "SELLER_OWNER_OR_ADMIN"
            : "STORE_OWNER_OR_ADMIN",
      description:
        requestState.code === "DRAFT"
          ? "The active setup is inactive. Seller can prepare a separate request and submit it for admin review."
          : "Seller workspace does not expose activation controls. Review the current request and active snapshot here while admin keeps activation authority.",
    };
  }

  return {
    primaryStatus,
    requestState,
    reviewStatus,
    completeness: {
      completedFields: readiness.completedFields,
      totalFields: readiness.totalFields,
      allRequiredPresent: readiness.missingFields.length === 0,
      missingFields: readiness.missingFields,
      requiredFields: requiredPaymentProfileFields.map((field) => ({
        key: field.key,
        label: field.label,
      })),
    },
    nextStep,
    boundaries: {
      readinessVsPaymentHistory:
        "Payment readiness only describes whether the store payment destination is complete, reviewed, and active. It does not describe buyer payment proof history, order settlement outcomes, or seller payout balance.",
      paymentHistoryLane:
        "Buyer payment proofs and payment history stay in the seller order and payment review lanes, not in this payment profile readiness snapshot.",
      payoutLane:
        "No seller payout, balance, withdrawal, or settlement statement lane is exposed from this snapshot yet.",
      sellerWorkspaceMode:
        actorCanEdit
          ? "Seller workspace edits only a separate store-scoped request here. Admin stays the final reviewer and activation authority, and checkout still reads only the current final active approved setup."
          : "Seller workspace is read-only for this payment profile snapshot. Seller can monitor status here while admin keeps final approval and activation authority.",
    },
  };
};

const serializeSellerPaymentProfile = (
  activeProfile: any,
  pendingRequest: any,
  options: { store?: any; sellerAccess?: any } = {}
) => {
  const activeSnapshot = serializeActiveSnapshot(activeProfile);
  const serializedPendingRequest = serializePendingRequest(pendingRequest, activeProfile);
  const readModel = buildPaymentProfileReadModel(activeProfile, pendingRequest, options.sellerAccess);
  const canEditPermission = Boolean(
    options.sellerAccess?.permissionKeys?.includes("PAYMENT_PROFILE_EDIT")
  );
  const requestDraftSource = ((serializedPendingRequest || activeSnapshot || {}) as Record<
    string,
    unknown
  >);

  return {
    id: Number(activeSnapshot?.id || 0),
    storeId: Number(activeSnapshot?.storeId || serializedPendingRequest?.storeId || options.store?.id || 0),
    providerCode: String(activeSnapshot?.providerCode || "MANUAL_QRIS"),
    paymentType: String(activeSnapshot?.paymentType || "QRIS_STATIC"),
    accountName: String(activeSnapshot?.accountName || ""),
    merchantName: String(activeSnapshot?.merchantName || ""),
    merchantId: activeSnapshot?.merchantId || null,
    qrisImageUrl: activeSnapshot?.qrisImageUrl || null,
    qrisPayload: activeSnapshot?.qrisPayload || null,
    instructionText: activeSnapshot?.instructionText || null,
    isActive: Boolean(activeSnapshot?.isActive),
    verificationStatus: String(activeSnapshot?.verificationStatus || "INACTIVE"),
    verificationMeta: activeSnapshot?.verificationMeta || buildVerificationMeta("INACTIVE"),
    activityMeta: activeSnapshot?.activityMeta || buildActivityMeta(false),
    readiness: activeSnapshot?.readiness || buildEmptyReadiness(),
    activeSnapshot,
    pendingRequest: serializedPendingRequest,
    readModel,
    requestStatus: readModel.requestState,
    reviewFeedback: readModel.reviewStatus,
    requestState: readModel.requestState,
    requestDraft: Object.fromEntries(
      editablePaymentProfileFields.map((field) => [
        field,
        field === "merchantId" ||
        field === "qrisPayload" ||
        field === "instructionText" ||
        field === "sellerNote"
          ? requestDraftSource?.[field]
            ? String(requestDraftSource[field])
            : null
          : String(requestDraftSource?.[field] || ""),
      ])
    ),
    governance: buildSellerPaymentProfileGovernance({
      canView: true,
      sellerCanEdit: canEditPermission,
      pendingRequest,
      reviewStatus: readModel.reviewStatus,
      nextStep: readModel.nextStep,
    }),
    store: options.store
      ? {
          id: Number(options.store.id || activeSnapshot?.storeId || serializedPendingRequest?.storeId || 0),
          name: String(options.store.name || ""),
          slug: String(options.store.slug || ""),
          status: String(options.store.status || "ACTIVE"),
        }
      : null,
    verifiedAt: activeSnapshot?.verifiedAt || null,
    updatedAt: serializedPendingRequest?.updatedAt || activeSnapshot?.updatedAt || null,
    createdAt: activeSnapshot?.createdAt || null,
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

const loadActiveStorePaymentProfile = async (storeId: number) => {
  const store = await Store.findByPk(storeId, {
    attributes: ["id", "activeStorePaymentProfileId"],
  });

  return resolvePreferredStorePaymentProfileByStoreRow(StorePaymentProfile, store, {
    includeVerifiedByAdmin: true,
  });
};

const buildSellerRequestPayload = (
  parsedData: Record<string, unknown>,
  existingRequest: any = null,
  activeProfile: any = null
) => {
  const fallbackValue = (key: string) => {
    const requestValue = getAttr(existingRequest, key);
    if (requestValue !== undefined && requestValue !== null) return requestValue;
    return getAttr(activeProfile, key);
  };

  return {
    storeId: Number(getAttr(existingRequest, "storeId") || getAttr(activeProfile, "storeId") || 0),
    basedOnProfileId:
      Number(getAttr(existingRequest, "basedOnProfileId") || getAttr(activeProfile, "id") || 0) || null,
    accountName: normalizeRequiredDraftText(
      getEditableDraftValue(parsedData, "accountName", fallbackValue("accountName"))
    ),
    merchantName: normalizeRequiredDraftText(
      getEditableDraftValue(parsedData, "merchantName", fallbackValue("merchantName"))
    ),
    merchantId: normalizeNullableText(
      getEditableDraftValue(parsedData, "merchantId", fallbackValue("merchantId"))
    ),
    qrisImageUrl: normalizeRequiredDraftText(
      getEditableDraftValue(parsedData, "qrisImageUrl", fallbackValue("qrisImageUrl"))
    ),
    qrisPayload: normalizeNullableText(
      getEditableDraftValue(parsedData, "qrisPayload", fallbackValue("qrisPayload"))
    ),
    instructionText: normalizeNullableText(
      getEditableDraftValue(parsedData, "instructionText", fallbackValue("instructionText"))
    ),
    sellerNote: normalizeNullableText(
      getEditableDraftValue(parsedData, "sellerNote", getAttr(existingRequest, "sellerNote"))
    ),
  };
};

const persistSellerPaymentProfileRequest = async ({
  storeId,
  parsedData,
  activeProfile,
  existingRequest,
  mode,
  actorUserId,
}: {
  storeId: number;
  parsedData: Record<string, unknown>;
  activeProfile: any;
  existingRequest: any;
  mode: "SAVE_DRAFT" | "SUBMIT";
  actorUserId: number | null;
}) => {
  const nextStatus =
    mode === "SUBMIT"
      ? "SUBMITTED"
      : getOpenRequestStatusCode(existingRequest) === "NEEDS_REVISION"
        ? "NEEDS_REVISION"
        : "DRAFT";
  const nextPayload: Record<string, unknown> = {
    ...buildSellerRequestPayload(parsedData, existingRequest, activeProfile),
    storeId,
    requestStatus: nextStatus,
  };

  if (mode === "SUBMIT") {
    nextPayload.submittedByUserId = actorUserId;
    nextPayload.submittedAt = new Date();
    nextPayload.reviewedByAdminId = null;
    nextPayload.reviewedAt = null;
  } else if (nextStatus === "DRAFT") {
    nextPayload.submittedByUserId = null;
    nextPayload.submittedAt = null;
    nextPayload.reviewedByAdminId = null;
    nextPayload.reviewedAt = null;
    nextPayload.adminReviewNote = null;
  }

  if (existingRequest) {
    await existingRequest.update(nextPayload);
  } else {
    await StorePaymentProfileRequest.create(nextPayload as any);
  }

  return findLatestOpenStorePaymentProfileRequest(storeId);
};

const validateRequiredPaymentProfileFields = (payload: any) => {
  const missingFields = requiredPaymentProfileFields.filter(
    (field) => !hasText(payload?.[field.key])
  );

  return {
    ok: missingFields.length === 0,
    missingFields,
  };
};

router.get(
  "/stores/:storeId/payment-profile",
  requireSellerStoreAccess(["PAYMENT_PROFILE_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const sellerAccess = (req as any).sellerAccess;
      const activeProfile = await loadActiveStorePaymentProfile(storeId);
      const pendingRequest = await findLatestOpenStorePaymentProfileRequest(storeId);

      return res.json({
        success: true,
        data: serializeSellerPaymentProfile(activeProfile, pendingRequest, {
          store: sellerAccess?.store || null,
          sellerAccess,
        }),
      });
    } catch (error) {
      console.error("[seller/payment-profile] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller payment profile.",
      });
    }
  }
);

router.put(
  "/stores/:storeId/payment-profile/request",
  requireSellerStoreAccess(["PAYMENT_PROFILE_EDIT"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const sellerAccess = (req as any).sellerAccess;
      const actorUserId = Number((req as any).user?.id || 0) || null;
      const parsed = sellerPaymentProfileDraftSchema.safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid payload.",
          errors: parsed.error.flatten(),
        });
      }

      const activeProfile = await loadActiveStorePaymentProfile(storeId);
      const existingRequest = await findLatestOpenStorePaymentProfileRequest(storeId);
      if (isSellerPaymentProfileRequestLockedForEdit(existingRequest)) {
        return res.status(409).json({
          success: false,
          code: "PAYMENT_PROFILE_REVIEW_LOCKED",
          message: "The latest seller payment setup request is already under admin review.",
        });
      }
      const pendingRequest = await persistSellerPaymentProfileRequest({
        storeId,
        parsedData: parsed.data,
        activeProfile,
        existingRequest,
        mode: "SAVE_DRAFT",
        actorUserId,
      });

      return res.json({
        success: true,
        data: serializeSellerPaymentProfile(activeProfile, pendingRequest, {
          store: sellerAccess?.store || null,
          sellerAccess,
        }),
      });
    } catch (error) {
      console.error("[seller/payment-profile request save] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to save seller payment setup request.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/payment-profile/request/submit",
  requireSellerStoreAccess(["PAYMENT_PROFILE_EDIT"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const sellerAccess = (req as any).sellerAccess;
      const actorUserId = Number((req as any).user?.id || 0) || null;
      const parsed = sellerPaymentProfileDraftSchema.safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid payload.",
          errors: parsed.error.flatten(),
        });
      }

      const activeProfile = await loadActiveStorePaymentProfile(storeId);
      const existingRequest = await findLatestOpenStorePaymentProfileRequest(storeId);
      if (isSellerPaymentProfileRequestLockedForEdit(existingRequest)) {
        return res.status(409).json({
          success: false,
          code: "PAYMENT_PROFILE_REVIEW_LOCKED",
          message: "The latest seller payment setup request is already under admin review.",
        });
      }
      const mergedDraft = buildSellerRequestPayload(parsed.data, existingRequest, activeProfile);
      const requiredCheck = validateRequiredPaymentProfileFields(mergedDraft);

      if (!requiredCheck.ok) {
        return res.status(400).json({
          success: false,
          code: "PAYMENT_PROFILE_INCOMPLETE",
          message: "Complete the required payment setup fields before submitting for review.",
          fields: requiredCheck.missingFields.map((field) => ({
            key: field.key,
            label: field.label,
          })),
        });
      }

      const pendingRequest = await persistSellerPaymentProfileRequest({
        storeId,
        parsedData: parsed.data,
        activeProfile,
        existingRequest,
        mode: "SUBMIT",
        actorUserId,
      });

      return res.json({
        success: true,
        data: serializeSellerPaymentProfile(activeProfile, pendingRequest, {
          store: sellerAccess?.store || null,
          sellerAccess,
        }),
      });
    } catch (error) {
      console.error("[seller/payment-profile request submit] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to submit seller payment setup request.",
      });
    }
  }
);

export default router;
