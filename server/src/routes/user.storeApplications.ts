import { Router } from "express";
import { Op } from "sequelize";
import requireAuth from "../middleware/requireAuth.js";
import { Store, StoreApplication, User } from "../models/index.js";
import {
  STORE_APPLICATION_OPEN_STATUSES,
  buildStoreApplicationCompleteness,
  buildStoreApplicationMutationMetadata,
  canTransitionStoreApplicationStatus,
  createDefaultOwnerIdentitySnapshot,
  normalizeStoreApplicationDraftInput,
  normalizeStoreApplicationSnapshots,
  serializeStoreApplication,
} from "../services/storeApplication.js";

const router = Router();

const getAuthUserId = (req: any) => {
  const userId = Number(req?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const applicationInclude = [
  {
    model: User,
    as: "applicantUser",
    attributes: ["id", "name", "email", "phoneNumber"],
    required: false,
  },
  {
    model: User,
    as: "reviewedByUser",
    attributes: ["id", "name", "email"],
    required: false,
  },
];

const loadOwnedStoreApplicationById = async (applicationId: number, userId: number) =>
  StoreApplication.findOne({
    where: {
      id: applicationId,
      applicantUserId: userId,
    } as any,
    include: applicationInclude as any,
  });

const loadCurrentUserStoreApplication = async (userId: number) => {
  const rows = await StoreApplication.findAll({
    where: { applicantUserId: userId } as any,
    include: applicationInclude as any,
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  if (!rows.length) return null;

  const openStatuses = new Set(STORE_APPLICATION_OPEN_STATUSES);
  const openRow = rows.find((row: any) => openStatuses.has(String(row.status) as any));
  return openRow || rows[0] || null;
};

const loadOpenUserStoreApplication = async (userId: number) =>
  StoreApplication.findOne({
    where: {
      applicantUserId: userId,
      status: {
        [Op.in]: [...STORE_APPLICATION_OPEN_STATUSES],
      },
    } as any,
    include: applicationInclude as any,
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });

const sendNotFound = (res: any) =>
  res.status(404).json({
    success: false,
    code: "STORE_APPLICATION_NOT_FOUND",
    message: "Store application not found.",
  });

router.use(requireAuth);

router.get("/store-applications/current", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const application = await loadCurrentUserStoreApplication(userId);
    return res.json({
      success: true,
      data: serializeStoreApplication(application),
    });
  } catch (error) {
    console.error("[user/store-applications:current] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load the current store application.",
    });
  }
});

router.get("/store-applications/:applicationId", async (req, res) => {
  const userId = getAuthUserId(req);
  const applicationId = Number(req.params.applicationId);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_STORE_APPLICATION_ID",
      message: "Invalid store application id.",
    });
  }

  try {
    const application = await loadOwnedStoreApplicationById(applicationId, userId);
    if (!application) return sendNotFound(res);

    return res.json({
      success: true,
      data: serializeStoreApplication(application),
    });
  } catch (error) {
    console.error("[user/store-applications:get] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load the store application.",
    });
  }
});

router.post("/store-applications/draft", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const [existingStore, openApplication, applicantUser] = await Promise.all([
      Store.findOne({
        where: { ownerUserId: userId } as any,
        attributes: ["id", "name", "slug", "status"],
      }),
      loadOpenUserStoreApplication(userId),
      User.findByPk(userId, {
        attributes: ["id", "name", "email", "phoneNumber"],
      }),
    ]);

    if (existingStore) {
      return res.status(409).json({
        success: false,
        code: "STORE_ALREADY_EXISTS_FOR_USER",
        message: "This account already owns a store.",
        store: {
          id: Number((existingStore as any).id),
          name: String((existingStore as any).name || ""),
          slug: String((existingStore as any).slug || ""),
          status: String((existingStore as any).status || "ACTIVE"),
        },
      });
    }

    if (openApplication) {
      return res.status(409).json({
        success: false,
        code: "OPEN_STORE_APPLICATION_EXISTS",
        message: "An open store application already exists for this account.",
        data: serializeStoreApplication(openApplication),
      });
    }

    const normalizedInput = normalizeStoreApplicationDraftInput(req.body ?? {});
    const ownerIdentitySnapshot = {
      ...createDefaultOwnerIdentitySnapshot(applicantUser),
      ...(normalizedInput.ownerIdentitySnapshot || {}),
    };

    const application = await StoreApplication.create({
      applicantUserId: userId,
      status: "draft",
      currentStep: normalizedInput.currentStep || "owner_identity",
      ownerIdentitySnapshot,
      storeInformationSnapshot: normalizedInput.storeInformationSnapshot || null,
      operationalAddressSnapshot: normalizedInput.operationalAddressSnapshot || null,
      payoutPaymentSnapshot: normalizedInput.payoutPaymentSnapshot || null,
      complianceSnapshot: normalizedInput.complianceSnapshot || null,
      internalMetadata: buildStoreApplicationMutationMetadata(null, {
        createdFrom: "user_self_service",
        submittedCount: 0,
      }),
    } as any);

    const created = await loadOwnedStoreApplicationById(Number((application as any).id), userId);

    return res.status(201).json({
      success: true,
      message: "Store application draft created.",
      data: serializeStoreApplication(created),
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_PAYLOAD",
        message: "Invalid store application payload.",
        errors: error.flatten?.() || null,
      });
    }
    console.error("[user/store-applications:create-draft] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create the store application draft.",
    });
  }
});

router.patch("/store-applications/:applicationId/draft", async (req, res) => {
  const userId = getAuthUserId(req);
  const applicationId = Number(req.params.applicationId);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_STORE_APPLICATION_ID",
      message: "Invalid store application id.",
    });
  }

  try {
    const application = await loadOwnedStoreApplicationById(applicationId, userId);
    if (!application) return sendNotFound(res);

    const currentStatus = String((application as any).status || "draft");
    if (!["draft", "revision_requested"].includes(currentStatus)) {
      return res.status(409).json({
        success: false,
        code: "STORE_APPLICATION_NOT_EDITABLE",
        message: "This store application is not editable in its current status.",
        data: serializeStoreApplication(application),
      });
    }

    const normalizedInput = normalizeStoreApplicationDraftInput(req.body ?? {});
    const currentSnapshots = normalizeStoreApplicationSnapshots(application);
    const metadata = buildStoreApplicationMutationMetadata(
      (application as any).internalMetadata,
      {
        lastEditedByUserId: userId,
      }
    );

    await application.update(
      {
        currentStep: normalizedInput.currentStep || (application as any).currentStep,
        ownerIdentitySnapshot: normalizedInput.ownerIdentitySnapshot
          ? {
              ...currentSnapshots.ownerIdentitySnapshot,
              ...normalizedInput.ownerIdentitySnapshot,
            }
          : currentSnapshots.ownerIdentitySnapshot,
        storeInformationSnapshot: normalizedInput.storeInformationSnapshot
          ? {
              ...currentSnapshots.storeInformationSnapshot,
              ...normalizedInput.storeInformationSnapshot,
            }
          : currentSnapshots.storeInformationSnapshot,
        operationalAddressSnapshot: normalizedInput.operationalAddressSnapshot
          ? {
              ...currentSnapshots.operationalAddressSnapshot,
              ...normalizedInput.operationalAddressSnapshot,
            }
          : currentSnapshots.operationalAddressSnapshot,
        payoutPaymentSnapshot: normalizedInput.payoutPaymentSnapshot
          ? {
              ...currentSnapshots.payoutPaymentSnapshot,
              ...normalizedInput.payoutPaymentSnapshot,
            }
          : currentSnapshots.payoutPaymentSnapshot,
        complianceSnapshot: normalizedInput.complianceSnapshot
          ? {
              ...currentSnapshots.complianceSnapshot,
              ...normalizedInput.complianceSnapshot,
            }
          : currentSnapshots.complianceSnapshot,
        internalMetadata: metadata,
      } as any
    );

    const updated = await loadOwnedStoreApplicationById(applicationId, userId);

    return res.json({
      success: true,
      message: "Store application draft updated.",
      data: serializeStoreApplication(updated),
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_APPLICATION_PAYLOAD",
        message: "Invalid store application payload.",
        errors: error.flatten?.() || null,
      });
    }
    console.error("[user/store-applications:update-draft] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update the store application draft.",
    });
  }
});

router.post("/store-applications/:applicationId/submit", async (req, res) => {
  const userId = getAuthUserId(req);
  const applicationId = Number(req.params.applicationId);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_STORE_APPLICATION_ID",
      message: "Invalid store application id.",
    });
  }

  try {
    const application = await loadOwnedStoreApplicationById(applicationId, userId);
    if (!application) return sendNotFound(res);

    const currentStatus = String((application as any).status || "draft");
    if (!canTransitionStoreApplicationStatus(currentStatus as any, "submitted")) {
      return res.status(409).json({
        success: false,
        code: "STORE_APPLICATION_SUBMIT_NOT_ALLOWED",
        message: "This store application cannot be submitted from its current status.",
        data: serializeStoreApplication(application),
      });
    }

    const completeness = buildStoreApplicationCompleteness(application);
    if (!completeness.isComplete) {
      return res.status(422).json({
        success: false,
        code: "STORE_APPLICATION_INCOMPLETE",
        message: "Complete the required application fields before submitting.",
        details: completeness,
      });
    }

    const currentMetadata = (application as any).internalMetadata || {};
    const submittedCount = Number(currentMetadata?.submittedCount || 0) + 1;

    await application.update(
      {
        status: "submitted",
        currentStep: "review",
        submittedAt: new Date(),
        internalMetadata: buildStoreApplicationMutationMetadata(currentMetadata, {
          submittedCount,
          lastSubmittedAt: new Date().toISOString(),
        }),
      } as any
    );

    const updated = await loadOwnedStoreApplicationById(applicationId, userId);

    return res.json({
      success: true,
      message: "Store application submitted.",
      data: serializeStoreApplication(updated),
    });
  } catch (error) {
    console.error("[user/store-applications:submit] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit the store application.",
    });
  }
});

router.post("/store-applications/:applicationId/resubmit", async (req, res) => {
  const userId = getAuthUserId(req);
  const applicationId = Number(req.params.applicationId);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_STORE_APPLICATION_ID",
      message: "Invalid store application id.",
    });
  }

  try {
    const application = await loadOwnedStoreApplicationById(applicationId, userId);
    if (!application) return sendNotFound(res);

    const currentStatus = String((application as any).status || "draft");
    if (currentStatus !== "revision_requested") {
      return res.status(409).json({
        success: false,
        code: "STORE_APPLICATION_RESUBMIT_NOT_ALLOWED",
        message: "Only revision-requested applications can be resubmitted.",
        data: serializeStoreApplication(application),
      });
    }

    const completeness = buildStoreApplicationCompleteness(application);
    if (!completeness.isComplete) {
      return res.status(422).json({
        success: false,
        code: "STORE_APPLICATION_INCOMPLETE",
        message: "Complete the required application fields before resubmitting.",
        details: completeness,
      });
    }

    const currentMetadata = (application as any).internalMetadata || {};
    const submittedCount = Number(currentMetadata?.submittedCount || 0) + 1;

    await application.update(
      {
        status: "submitted",
        currentStep: "review",
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedByUserId: null,
        revisionNote: null,
        rejectReason: null,
        internalMetadata: buildStoreApplicationMutationMetadata(currentMetadata, {
          submittedCount,
          lastResubmittedAt: new Date().toISOString(),
        }),
      } as any
    );

    const updated = await loadOwnedStoreApplicationById(applicationId, userId);

    return res.json({
      success: true,
      message: "Store application resubmitted.",
      data: serializeStoreApplication(updated),
    });
  } catch (error) {
    console.error("[user/store-applications:resubmit] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resubmit the store application.",
    });
  }
});

router.post("/store-applications/:applicationId/cancel", async (req, res) => {
  const userId = getAuthUserId(req);
  const applicationId = Number(req.params.applicationId);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_STORE_APPLICATION_ID",
      message: "Invalid store application id.",
    });
  }

  try {
    const application = await loadOwnedStoreApplicationById(applicationId, userId);
    if (!application) return sendNotFound(res);

    const currentStatus = String((application as any).status || "draft");
    if (!canTransitionStoreApplicationStatus(currentStatus as any, "cancelled")) {
      return res.status(409).json({
        success: false,
        code: "STORE_APPLICATION_CANCEL_NOT_ALLOWED",
        message: "This store application cannot be cancelled from its current status.",
        data: serializeStoreApplication(application),
      });
    }

    await application.update(
      {
        status: "cancelled",
        internalMetadata: buildStoreApplicationMutationMetadata(
          (application as any).internalMetadata,
          {
            cancelledAt: new Date().toISOString(),
          }
        ),
      } as any
    );

    const updated = await loadOwnedStoreApplicationById(applicationId, userId);

    return res.json({
      success: true,
      message: "Store application cancelled.",
      data: serializeStoreApplication(updated),
    });
  } catch (error) {
    console.error("[user/store-applications:cancel] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel the store application.",
    });
  }
});

export default router;
