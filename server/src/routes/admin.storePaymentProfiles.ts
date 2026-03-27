import { Op } from "sequelize";
import { Router } from "express";
import { z } from "zod";
import {
  Store,
  StorePaymentProfile,
  StorePaymentProfileRequest,
  User,
} from "../models/index.js";
import {
  resolvePreferredStorePaymentProfile,
  STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES,
} from "../services/sharedContracts/storePaymentProfileCompat.js";
import {
  adminVisibleStorePaymentRequestStatuses as adminVisibleRequestStatuses,
  buildEmptyStorePaymentProfileReadiness as buildEmptyReadiness,
  getStorePaymentProfileAttr as getAttr,
  serializeStorePaymentProfileActiveSnapshot as serializeActiveSnapshot,
  serializeStorePaymentProfilePendingRequest as serializePendingRequest,
  storePaymentProfileRequestAttributes as requestSummaryAttributes,
} from "../services/sharedContracts/storePaymentProfileState.js";
import {
  buildWorkspaceReadinessSummary,
  emptyProductPipelineSummary,
  loadProductPipelineSummaryByStoreIds,
} from "../services/sellerWorkspaceReadiness.js";

const router = Router();

const reviewSchema = z.object({
  verificationStatus: z.enum(["ACTIVE", "REJECTED", "INACTIVE"]),
  adminReviewNote: z.string().trim().max(4_000).optional().nullable(),
});

const storeIdentityPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one identity field must be provided.",
    path: ["name"],
  });

const buildAdminWorkflow = (paymentProfile: any, pendingRequest: any) => {
  const completenessSource = pendingRequest?.readiness || paymentProfile?.readiness || buildEmptyReadiness();
  const requestStatus = String(pendingRequest?.requestStatus || "").toUpperCase();

  let primaryStatus = {
    code: "WAITING_SELLER",
    label: "Waiting for seller setup",
    tone: "neutral",
    description: "No submitted seller payment setup request is waiting in the admin review lane.",
  };
  let requestState = {
    code: pendingRequest ? requestStatus || "SUBMITTED" : "INACTIVE",
    label: pendingRequest
      ? requestStatus === "NEEDS_REVISION"
        ? "Needs revision"
        : "Submitted for review"
      : "No open request",
    tone: pendingRequest
      ? requestStatus === "NEEDS_REVISION"
        ? "danger"
        : "warning"
      : "neutral",
    description: pendingRequest
      ? requestStatus === "NEEDS_REVISION"
        ? "Seller must revise and resubmit this request before a new snapshot can be promoted."
        : "This seller request is waiting for admin review and promotion decision."
      : "Admin review becomes actionable after seller submits a request.",
  };
  let reviewStatus = pendingRequest
    ? {
        code: requestStatus || "SUBMITTED",
        label: requestStatus === "NEEDS_REVISION" ? "Needs revision" : "Pending review",
        tone: requestStatus === "NEEDS_REVISION" ? "danger" : "warning",
        description:
          requestStatus === "NEEDS_REVISION"
            ? "Admin already reviewed this request and asked the seller to revise it."
            : "Admin review is still pending for the current seller request.",
        reviewedAt: pendingRequest.reviewedAt || null,
        reviewedBy: pendingRequest.reviewedBy || null,
        adminReviewNote: pendingRequest.adminReviewNote || null,
        source: "PENDING_REQUEST",
      }
    : {
        code: String(paymentProfile?.verificationStatus || "NOT_CONFIGURED"),
        label: paymentProfile?.verificationMeta?.label || "Not reviewed yet",
        tone: paymentProfile?.verificationMeta?.tone || "neutral",
        description:
          paymentProfile?.verificationMeta?.description ||
          "No active payment snapshot is waiting for admin review.",
        reviewedAt: paymentProfile?.verifiedAt || null,
        reviewedBy: null,
        adminReviewNote: null,
        source: "ACTIVE_SNAPSHOT",
      };
  let nextStep = {
    code: "WAIT_FOR_SUBMISSION",
    label: "Wait for seller submission",
    lane: "SELLER_PAYMENT_SETUP",
    actor: "SELLER",
    description: "Admin review actions remain idle until seller submits a store-scoped request.",
  };

  if (pendingRequest && requestStatus === "SUBMITTED") {
    primaryStatus = {
      code: "PENDING_ADMIN_REVIEW",
      label: "Pending admin review",
      tone: "warning",
      description:
        "A submitted seller request is ready for admin approval or revision feedback. The active snapshot stays unchanged until promotion.",
    };
    nextStep = {
      code: "REVIEW_AND_DECIDE",
      label: "Review and decide",
      lane: "ADMIN_REVIEW",
      actor: "ADMIN",
      description:
        "Approve to promote a new immutable active snapshot, or request revision to send the request back to seller.",
    };
  } else if (pendingRequest && requestStatus === "NEEDS_REVISION") {
    primaryStatus = {
      code: "WAITING_SELLER_REVISION",
      label: "Waiting for seller revision",
      tone: "danger",
      description:
        "Admin feedback has been sent. The request remains visible here for audit context while seller revises it.",
    };
    nextStep = {
      code: "WAIT_FOR_RESUBMISSION",
      label: "Wait for seller revision",
      lane: "SELLER_PAYMENT_SETUP",
      actor: "SELLER",
      description: "Seller must update the request and resubmit before admin can promote a new snapshot.",
    };
  } else if (paymentProfile?.readiness?.isReady) {
    primaryStatus = {
      code: "ACTIVE_APPROVED",
      label: "Active approved snapshot",
      tone: "success",
      description: "The current active snapshot is complete, approved, and available to checkout.",
    };
    reviewStatus = {
      ...reviewStatus,
      label: paymentProfile?.verificationMeta?.label || "Verified",
      tone: paymentProfile?.verificationMeta?.tone || "success",
    };
    nextStep = {
      code: "MONITOR_ACTIVE_SNAPSHOT",
      label: "Monitor active snapshot",
      lane: "ADMIN_REVIEW",
      actor: "ADMIN",
      description: "No request is pending. Admin can keep the active snapshot as-is or toggle activation if needed.",
    };
  }

  return {
    primaryStatus,
    requestState,
    reviewStatus,
    completeness: {
      completedFields: Number(completenessSource?.completedFields || 0),
      totalFields: Number(completenessSource?.totalFields || 0),
      allRequiredPresent: Array.isArray(completenessSource?.missingFields)
        ? completenessSource.missingFields.length === 0
        : false,
      missingFields: Array.isArray(completenessSource?.missingFields)
        ? completenessSource.missingFields
        : [],
    },
    nextStep,
    governance: {
      managedBy: "ADMIN_FINAL_APPROVAL",
      canApprovePromotion: requestStatus === "SUBMITTED",
      canRequestRevision: Boolean(pendingRequest),
      canToggleActiveSnapshot: Boolean(paymentProfile),
      note:
        "Admin remains the final review and activation authority. Seller request edits never promote a snapshot by themselves.",
    },
  };
};

const serializeProfileRow = (
  store: any,
  pendingRequest: any = null,
  productSummary: any = null
) => {
  const owner = store.owner || store.get?.("owner") || null;
  const profile = resolvePreferredStorePaymentProfile(store);
  const paymentProfile = serializeActiveSnapshot(profile);
  const serializedPendingRequest = serializePendingRequest(pendingRequest, profile);
  const workflow = buildAdminWorkflow(paymentProfile, serializedPendingRequest);
  const workspaceReadiness = buildWorkspaceReadinessSummary({
    store,
    activePaymentProfile: profile,
    pendingPaymentRequest: pendingRequest,
    productSummary: productSummary || emptyProductPipelineSummary(),
    sellerAccess: {
      permissionKeys: ["STORE_VIEW", "PRODUCT_VIEW", "PAYMENT_PROFILE_VIEW"],
    },
    includeTeamInfo: false,
  });
  return {
    store: {
      id: Number(store.id),
      ownerUserId: Number(store.ownerUserId),
      activeStorePaymentProfileId:
        store.activeStorePaymentProfileId != null ? Number(store.activeStorePaymentProfileId) : null,
      name: String(store.name || ""),
      slug: String(store.slug || ""),
      status: String(store.status || "ACTIVE"),
    },
    owner: owner
      ? {
          id: Number(owner.id),
          name: String(owner.name || ""),
          email: String(owner.email || ""),
          role: String(owner.role || ""),
        }
      : null,
    paymentProfile,
    pendingRequest: serializedPendingRequest,
    workflow,
    reviewStatus: workflow.reviewStatus,
    workspaceReadiness,
  };
};

const loadAdminVisibleRequestsByStore = async (storeIds: number[]) => {
  if (!storeIds.length) return new Map<number, any>();

  const rows = await StorePaymentProfileRequest.findAll({
    where: {
      storeId: { [Op.in]: storeIds },
      requestStatus: { [Op.in]: [...adminVisibleRequestStatuses] },
    },
    attributes: [...requestSummaryAttributes],
    include: [
      {
        model: User,
        as: "submittedByUser",
        attributes: ["id", "name", "email"],
        required: false,
      },
      {
        model: User,
        as: "reviewedByAdmin",
        attributes: ["id", "name", "email"],
        required: false,
      },
    ],
    order: [
      ["storeId", "ASC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  const map = new Map<number, any>();
  for (const row of rows) {
    const storeId = Number(getAttr(row, "storeId") || 0);
    if (!storeId || map.has(storeId)) continue;
    map.set(storeId, row);
  }
  return map;
};

const buildSnapshotPayloadFromRequest = async (
  storeId: number,
  pendingRequest: any,
  currentActiveProfile: any,
  adminUserId: number,
  transaction: any
) => {
  const maxVersionRaw = await StorePaymentProfile.max("version", {
    where: { storeId },
    transaction,
  });
  const maxVersion = Number(maxVersionRaw || 0);
  const now = new Date();

  return {
    storeId,
    providerCode: currentActiveProfile?.providerCode || "MANUAL_QRIS",
    paymentType: currentActiveProfile?.paymentType || "QRIS_STATIC",
    version: maxVersion + 1,
    snapshotStatus: "ACTIVE" as const,
    accountName: String(getAttr(pendingRequest, "accountName") || ""),
    merchantName: String(getAttr(pendingRequest, "merchantName") || ""),
    merchantId: getAttr(pendingRequest, "merchantId") ? String(getAttr(pendingRequest, "merchantId")) : null,
    qrisImageUrl: String(getAttr(pendingRequest, "qrisImageUrl") || ""),
    qrisPayload: getAttr(pendingRequest, "qrisPayload") ? String(getAttr(pendingRequest, "qrisPayload")) : null,
    instructionText: getAttr(pendingRequest, "instructionText")
      ? String(getAttr(pendingRequest, "instructionText"))
      : null,
    isActive: true,
    verificationStatus: "ACTIVE" as const,
    sourceRequestId: Number(getAttr(pendingRequest, "id") || 0) || null,
    verifiedByAdminId: adminUserId,
    verifiedAt: now,
    activatedByAdminId: adminUserId,
    activatedAt: now,
  };
};

router.get("/payment-profiles", async (_req, res) => {
  try {
    const stores = await Store.findAll({
      attributes: [
        "id",
        "ownerUserId",
        "activeStorePaymentProfileId",
        "name",
        "slug",
        "status",
        "description",
        "logoUrl",
        "email",
        "phone",
        "addressLine1",
        "city",
        "province",
        "country",
        "createdAt",
      ],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const requestMap = await loadAdminVisibleRequestsByStore(
      stores.map((store) => Number(store.id))
    );
    const productSummaryMap = await loadProductPipelineSummaryByStoreIds(
      stores.map((store) => Number(store.id))
    );
    const seenStoreIds = new Set<number>();
    const items = stores
      .map((store) =>
        serializeProfileRow(
          store,
          requestMap.get(Number(store.id)) || null,
          productSummaryMap.get(Number(store.id)) || emptyProductPipelineSummary()
        )
      )
      .filter((entry) => {
        const storeId = Number(entry?.store?.id || 0);
        if (!storeId || seenStoreIds.has(storeId)) return false;
        seenStoreIds.add(storeId);
        return true;
      });

    return res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("[admin.store-payment-profiles list] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load store payment profiles.",
    });
  }
});

router.patch("/:storeId/identity", async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isFinite(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store id." });
    }

    const parsed = storeIdentityPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload.",
        errors: parsed.error.flatten(),
      });
    }

    const store = await Store.findByPk(storeId, {
      attributes: [
        "id",
        "ownerUserId",
        "activeStorePaymentProfileId",
        "name",
        "slug",
        "status",
        "description",
        "logoUrl",
        "email",
        "phone",
        "addressLine1",
        "city",
        "province",
        "country",
      ],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
      ],
    });

    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    const updatePayload: Record<string, string> = {};
    if (parsed.data.name !== undefined) {
      updatePayload.name = parsed.data.name;
    }
    if (parsed.data.status !== undefined) {
      updatePayload.status = parsed.data.status;
    }

    await store.update(updatePayload as any);

    const refreshedRequestMap = await loadAdminVisibleRequestsByStore([storeId]);
    const productSummaryMap = await loadProductPipelineSummaryByStoreIds([storeId]);
    return res.json({
      success: true,
      data: serializeProfileRow(
        store,
        refreshedRequestMap.get(storeId) || null,
        productSummaryMap.get(storeId) || emptyProductPipelineSummary()
      ),
    });
  } catch (error) {
    console.error("[admin.store-payment-profiles identity] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update store identity.",
    });
  }
});

router.patch("/:storeId/payment-profile/review", async (req, res) => {
  try {
    const adminUserId = Number((req as any).user?.id);
    if (!Number.isFinite(adminUserId)) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const storeId = Number(req.params.storeId);
    if (!Number.isFinite(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store id." });
    }

    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload.",
        errors: parsed.error.flatten(),
      });
    }

    const store = await Store.findByPk(storeId, {
      attributes: [
        "id",
        "ownerUserId",
        "activeStorePaymentProfileId",
        "name",
        "slug",
        "status",
        "description",
        "logoUrl",
        "email",
        "phone",
        "addressLine1",
        "city",
        "province",
        "country",
      ],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
      ],
    });

    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    const profile = resolvePreferredStorePaymentProfile(store);
    const pendingRequest = await StorePaymentProfileRequest.findOne({
      where: {
        storeId,
        requestStatus: { [Op.in]: [...adminVisibleRequestStatuses] },
      },
      attributes: [...requestSummaryAttributes],
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],
    });
    const nextStatus = parsed.data.verificationStatus;
    const adminReviewNote = parsed.data.adminReviewNote
      ? String(parsed.data.adminReviewNote).trim() || null
      : null;

    if (pendingRequest && nextStatus === "ACTIVE") {
      await Store.sequelize!.transaction(async (transaction) => {
        const currentStore = await Store.findByPk(storeId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const currentActiveProfile =
          (currentStore?.activeStorePaymentProfileId
            ? await StorePaymentProfile.findByPk(currentStore.activeStorePaymentProfileId, {
                transaction,
                lock: transaction.LOCK.UPDATE,
              })
            : null) ??
          (await StorePaymentProfile.findOne({
            where: { storeId, snapshotStatus: "ACTIVE" },
            order: [
              ["version", "DESC"],
              ["id", "DESC"],
            ],
            transaction,
            lock: transaction.LOCK.UPDATE,
          }));

        const nextSnapshotPayload = await buildSnapshotPayloadFromRequest(
          storeId,
          pendingRequest,
          currentActiveProfile,
          adminUserId,
          transaction
        );
        const promotedProfile = await StorePaymentProfile.create(nextSnapshotPayload as any, {
          transaction,
        });

        if (currentActiveProfile) {
          await currentActiveProfile.update(
            {
              isActive: false,
              snapshotStatus: "SUPERSEDED",
              supersededByProfileId: promotedProfile.id,
              supersededAt: new Date(),
            },
            { transaction }
          );
        }

        await currentStore!.update(
          {
            activeStorePaymentProfileId: promotedProfile.id,
          },
          { transaction }
        );

        await pendingRequest.update(
          {
            requestStatus: "PROMOTED",
            promotedProfileId: promotedProfile.id,
            reviewedByAdminId: adminUserId,
            reviewedAt: new Date(),
            adminReviewNote,
          },
          { transaction }
        );
      });
    } else if (pendingRequest && nextStatus === "REJECTED") {
      await pendingRequest.update({
        requestStatus: "NEEDS_REVISION",
        reviewedByAdminId: adminUserId,
        reviewedAt: new Date(),
        adminReviewNote,
      });
    } else {
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Store payment profile not found.",
        });
      }

      await profile.update({
        verificationStatus: nextStatus,
        isActive: nextStatus === "ACTIVE",
        verifiedByAdminId: adminUserId,
        verifiedAt: new Date(),
      });
    }

    const refreshed = await Store.findByPk(storeId, {
      attributes: [
        "id",
        "ownerUserId",
        "activeStorePaymentProfileId",
        "name",
        "slug",
        "status",
        "description",
        "logoUrl",
        "email",
        "phone",
        "addressLine1",
        "city",
        "province",
        "country",
      ],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
      ],
    });
    const refreshedRequestMap = await loadAdminVisibleRequestsByStore([storeId]);
    const productSummaryMap = await loadProductPipelineSummaryByStoreIds([storeId]);

    return res.json({
      success: true,
      data: serializeProfileRow(
        refreshed,
        refreshedRequestMap.get(storeId) || null,
        productSummaryMap.get(storeId) || emptyProductPipelineSummary()
      ),
    });
  } catch (error) {
    console.error("[admin.store-payment-profiles review] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to review store payment profile.",
    });
  }
});

export default router;
