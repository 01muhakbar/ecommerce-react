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
} from "../services/storePaymentProfileCompat.js";

const router = Router();

const adminVisibleRequestStatuses = ["SUBMITTED", "NEEDS_REVISION"] as const;

const reviewSchema = z.object({
  verificationStatus: z.enum(["ACTIVE", "REJECTED", "INACTIVE"]),
  adminReviewNote: z.string().trim().max(4_000).optional().nullable(),
});

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const requestSummaryAttributes = [
  "id",
  "storeId",
  "basedOnProfileId",
  "requestStatus",
  "accountName",
  "merchantName",
  "merchantId",
  "qrisImageUrl",
  "qrisPayload",
  "instructionText",
  "sellerNote",
  "adminReviewNote",
  "submittedByUserId",
  "submittedAt",
  "reviewedByAdminId",
  "reviewedAt",
  "promotedProfileId",
  "updatedAt",
] as const;

const serializePendingRequest = (request: any) => {
  if (!request) return null;
  const submittedByUser = request?.submittedByUser ?? request?.get?.("submittedByUser") ?? null;
  const reviewedByAdmin = request?.reviewedByAdmin ?? request?.get?.("reviewedByAdmin") ?? null;

  return {
    id: Number(getAttr(request, "id") || 0),
    storeId: Number(getAttr(request, "storeId") || 0),
    basedOnProfileId: Number(getAttr(request, "basedOnProfileId") || 0) || null,
    requestStatus: String(getAttr(request, "requestStatus") || "DRAFT"),
    accountName: String(getAttr(request, "accountName") || ""),
    merchantName: String(getAttr(request, "merchantName") || ""),
    merchantId: getAttr(request, "merchantId") ? String(getAttr(request, "merchantId")) : null,
    qrisImageUrl: getAttr(request, "qrisImageUrl") ? String(getAttr(request, "qrisImageUrl")) : null,
    qrisPayload: getAttr(request, "qrisPayload") ? String(getAttr(request, "qrisPayload")) : null,
    instructionText: getAttr(request, "instructionText")
      ? String(getAttr(request, "instructionText"))
      : null,
    sellerNote: getAttr(request, "sellerNote") ? String(getAttr(request, "sellerNote")) : null,
    adminReviewNote: getAttr(request, "adminReviewNote")
      ? String(getAttr(request, "adminReviewNote"))
      : null,
    submittedAt: getAttr(request, "submittedAt") || null,
    reviewedAt: getAttr(request, "reviewedAt") || null,
    updatedAt: getAttr(request, "updatedAt") || null,
    promotedProfileId: Number(getAttr(request, "promotedProfileId") || 0) || null,
    submittedBy: submittedByUser
      ? {
          id: Number(getAttr(submittedByUser, "id") || 0) || null,
          name: String(getAttr(submittedByUser, "name") || ""),
          email: String(getAttr(submittedByUser, "email") || ""),
        }
      : null,
    reviewedBy: reviewedByAdmin
      ? {
          id: Number(getAttr(reviewedByAdmin, "id") || 0) || null,
          name: String(getAttr(reviewedByAdmin, "name") || ""),
          email: String(getAttr(reviewedByAdmin, "email") || ""),
        }
      : null,
  };
};

const serializeProfileRow = (store: any, pendingRequest: any = null) => {
  const owner = store.owner || store.get?.("owner") || null;
  const profile = resolvePreferredStorePaymentProfile(store);
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
    paymentProfile: profile
      ? {
          id: Number(profile.id),
          storeId: Number(profile.storeId),
          providerCode: String(profile.providerCode || "MANUAL_QRIS"),
          paymentType: String(profile.paymentType || "QRIS_STATIC"),
          accountName: String(profile.accountName || ""),
          merchantName: String(profile.merchantName || ""),
          merchantId: profile.merchantId ? String(profile.merchantId) : null,
          qrisImageUrl: String(profile.qrisImageUrl || ""),
          qrisPayload: profile.qrisPayload ? String(profile.qrisPayload) : null,
          instructionText: profile.instructionText ? String(profile.instructionText) : null,
          isActive: Boolean(profile.isActive),
          verificationStatus: String(profile.verificationStatus || "PENDING"),
          verifiedByAdminId:
            profile.verifiedByAdminId != null ? Number(profile.verifiedByAdminId) : null,
          verifiedAt: profile.verifiedAt || null,
          version: Number(profile.version || 1),
          snapshotStatus: String(profile.snapshotStatus || "INACTIVE"),
          updatedAt: profile.updatedAt || null,
        }
      : null,
    pendingRequest: serializePendingRequest(pendingRequest),
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

    return res.json({
      success: true,
      data: stores.map((store) => serializeProfileRow(store, requestMap.get(Number(store.id)) || null)),
    });
  } catch (error) {
    console.error("[admin.store-payment-profiles list] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load store payment profiles.",
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
      attributes: ["id", "ownerUserId", "activeStorePaymentProfileId", "name", "slug", "status"],
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
      attributes: ["id", "ownerUserId", "activeStorePaymentProfileId", "name", "slug", "status"],
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

    return res.json({
      success: true,
      data: serializeProfileRow(refreshed, refreshedRequestMap.get(storeId) || null),
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
