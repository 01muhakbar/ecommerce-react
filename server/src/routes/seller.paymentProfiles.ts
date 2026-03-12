import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { StorePaymentProfile } from "../models/index.js";

const router = Router();

const requiredPaymentProfileFields = [
  { key: "accountName", label: "Account name" },
  { key: "merchantName", label: "Merchant name" },
  { key: "qrisImageUrl", label: "QRIS image" },
] as const;

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const hasText = (value: unknown) => String(value || "").trim().length > 0;

const buildVerificationMeta = (verificationStatusValue: unknown) => {
  const code = String(verificationStatusValue || "PENDING").toUpperCase();

  if (code === "ACTIVE") {
    return {
      code,
      label: "Verified",
      tone: "success",
      description: "Admin review has marked this payment profile as approved.",
    };
  }

  if (code === "REJECTED") {
    return {
      code,
      label: "Rejected",
      tone: "danger",
      description: "Admin review rejected this payment profile. The seller should update it through the existing account or admin lane.",
    };
  }

  if (code === "INACTIVE") {
    return {
      code,
      label: "Inactive",
      tone: "neutral",
      description: "The payment profile exists, but it is not active for seller operations.",
    };
  }

  return {
    code,
    label: "Pending review",
    tone: "warning",
    description: "Payment profile data has been submitted and is still waiting for admin review.",
  };
};

const buildActivityMeta = (isActiveValue: unknown) => {
  const isActive = Boolean(isActiveValue);
  return {
    code: isActive ? "ACTIVE" : "INACTIVE",
    label: isActive ? "Active" : "Inactive",
    tone: isActive ? "success" : "neutral",
    description: isActive
      ? "This payment destination is active for the store."
      : "This payment destination is not active yet.",
  };
};

const buildPaymentProfileReadiness = (profile: any) => {
  const missingFields = requiredPaymentProfileFields
    .filter((field) => !hasText(getAttr(profile, field.key)))
    .map((field) => ({
      key: field.key,
      label: field.label,
    }));

  const totalFields = requiredPaymentProfileFields.length;
  const completedFields = totalFields - missingFields.length;
  const verificationStatus = String(getAttr(profile, "verificationStatus") || "PENDING").toUpperCase();
  const isActive = Boolean(getAttr(profile, "isActive"));
  let code = "PENDING_REVIEW";
  let label = "Pending review";
  let tone = "warning";
  let description =
    "Required payment fields are present, but admin review still decides whether the profile can go live.";

  if (missingFields.length > 0) {
    code = "INCOMPLETE";
    label = "Incomplete";
    tone = "warning";
    description =
      "Some required payment destination fields are still missing. Complete them through the existing account or admin-managed flow.";
  } else if (verificationStatus === "REJECTED") {
    code = "REJECTED";
    label = "Rejected";
    tone = "danger";
    description =
      "The payment profile was reviewed and rejected. Seller can only monitor the snapshot here.";
  } else if (verificationStatus === "ACTIVE" && isActive) {
    code = "READY";
    label = "Ready";
    tone = "success";
    description = "The payment profile is complete, approved, and active for seller operations.";
  } else if (verificationStatus === "INACTIVE" || !isActive) {
    code = "INACTIVE";
    label = "Inactive";
    tone = "neutral";
    description =
      "The payment profile exists, but activation is still blocked by the existing review or store configuration flow.";
  }

  return {
    code,
    label,
    tone,
    description,
    isReady: code === "READY",
    isIncomplete: code === "INCOMPLETE",
    completedFields,
    totalFields,
    missingFields,
  };
};

const buildPaymentProfileReadModel = (profile: any, sellerAccess: any = null) => {
  const readiness = buildPaymentProfileReadiness(profile);
  const verificationStatus = String(getAttr(profile, "verificationStatus") || "PENDING").toUpperCase();
  const verificationMeta = buildVerificationMeta(verificationStatus);
  const reviewedAt = getAttr(profile, "verifiedAt") || null;
  const verifiedByAdmin = profile?.verifiedByAdmin ?? profile?.get?.("verifiedByAdmin") ?? null;
  const actorIsOwner = Boolean(sellerAccess?.isOwner);

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
      "No seller action is exposed in seller workspace while this payment profile is still under admin review.",
  };

  if (readiness.isIncomplete) {
    primaryStatus = {
      code: "NEEDS_ACTION",
      label: "Needs action",
      tone: "warning",
      description:
        "Required payment destination fields are still incomplete, so the store is not ready for payment operations yet.",
    };
    nextStep = {
      code: "COMPLETE_PROFILE",
      label: actorIsOwner ? "Complete profile in account lane" : "Ask owner or admin to complete profile",
      lane: actorIsOwner ? "ACCOUNT_PAYMENT_PROFILE" : "ACCOUNT_ADMIN",
      actor: actorIsOwner ? "SELLER_OWNER" : "STORE_OWNER_OR_ADMIN",
      description: actorIsOwner
        ? "Complete the missing payment profile fields through the existing account payment profile form, then wait for admin review."
        : "Seller workspace is read-only here. The store owner or admin must complete the payment profile through the existing account or admin lane.",
    };
  } else if (verificationStatus === "REJECTED") {
    primaryStatus = {
      code: "NEEDS_ACTION",
      label: "Needs action",
      tone: "danger",
      description:
        "Admin review rejected this payment profile. The seller should treat the profile as not ready until the snapshot is corrected and re-submitted.",
    };
    nextStep = {
      code: "UPDATE_AND_RESUBMIT",
      label: actorIsOwner ? "Update profile in account lane" : "Ask owner or admin to update profile",
      lane: actorIsOwner ? "ACCOUNT_PAYMENT_PROFILE" : "ACCOUNT_ADMIN",
      actor: actorIsOwner ? "SELLER_OWNER" : "STORE_OWNER_OR_ADMIN",
      description: actorIsOwner
        ? "Update the payment profile through the existing account payment profile form. Saving there re-submits the profile for admin review."
        : "Seller workspace is read-only here. The store owner or admin must update the payment profile through the existing account or admin lane before review can restart.",
    };
  } else if (readiness.isReady) {
    primaryStatus = {
      code: "READY",
      label: "Ready for payment operations",
      tone: "success",
      description:
        "The payment profile is complete, approved, and active for store payment operations.",
    };
    nextStep = {
      code: "NO_ACTION_REQUIRED",
      label: "No action required",
      lane: "MONITOR_ONLY",
      actor: "SELLER",
      description:
        "Seller can monitor this snapshot here. Buyer payment proof review and order payment events stay on separate payment lanes.",
    };
  } else if (readiness.code === "INACTIVE") {
    primaryStatus = {
      code: "INACTIVE",
      label: "Inactive",
      tone: "neutral",
      description:
        "The profile exists but is not active for payment operations yet, even though the required fields are present.",
    };
    nextStep = {
      code: "FOLLOW_EXISTING_REVIEW_LANE",
      label: actorIsOwner ? "Follow up in account or admin lane" : "Ask owner or admin to follow up",
      lane: "ACCOUNT_ADMIN",
      actor: actorIsOwner ? "SELLER_OWNER_OR_ADMIN" : "STORE_OWNER_OR_ADMIN",
      description:
        "Seller workspace does not expose activation controls. Follow the existing account or admin-managed flow to understand why activation is still blocked.",
    };
  }

  return {
    primaryStatus,
    reviewStatus: {
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
    },
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
        "Seller workspace remains read-only for this payment profile snapshot. Changes still belong to the existing account or admin lane.",
    },
  };
};

const serializeSellerPaymentProfile = (
  profile: any,
  options: { store?: any; sellerAccess?: any } = {}
) => {
  if (!profile) return null;

  const verificationStatus = String(getAttr(profile, "verificationStatus") || "PENDING");
  const isActive = Boolean(getAttr(profile, "isActive"));
  const readModel = buildPaymentProfileReadModel(profile, options.sellerAccess);

  return {
    id: Number(getAttr(profile, "id")),
    storeId: Number(getAttr(profile, "storeId")),
    providerCode: String(getAttr(profile, "providerCode") || "MANUAL_QRIS"),
    paymentType: String(getAttr(profile, "paymentType") || "QRIS_STATIC"),
    accountName: String(getAttr(profile, "accountName") || ""),
    merchantName: String(getAttr(profile, "merchantName") || ""),
    merchantId: getAttr(profile, "merchantId") ? String(getAttr(profile, "merchantId")) : null,
    qrisImageUrl: getAttr(profile, "qrisImageUrl") ? String(getAttr(profile, "qrisImageUrl")) : null,
    qrisPayload: getAttr(profile, "qrisPayload") ? String(getAttr(profile, "qrisPayload")) : null,
    instructionText: getAttr(profile, "instructionText")
      ? String(getAttr(profile, "instructionText"))
      : null,
    isActive,
    verificationStatus,
    verificationMeta: buildVerificationMeta(verificationStatus),
    activityMeta: buildActivityMeta(isActive),
    readiness: buildPaymentProfileReadiness(profile),
    readModel,
    governance: {
      canView: true,
      canEdit: false,
      mode: "READ_ONLY_SNAPSHOT",
      managedBy: "ACCOUNT_ADMIN",
      readOnlyFields: [
        "providerCode",
        "paymentType",
        "accountName",
        "merchantName",
        "merchantId",
        "qrisImageUrl",
        "qrisPayload",
        "instructionText",
        "verificationStatus",
        "isActive",
      ],
      note: "Seller workspace only exposes a read-only payment setup snapshot. Changes still belong to the existing account or admin flow.",
    },
    store: options.store
      ? {
          id: Number(options.store.id || getAttr(profile, "storeId") || 0),
          name: String(options.store.name || ""),
          slug: String(options.store.slug || ""),
          status: String(options.store.status || "ACTIVE"),
        }
      : null,
    verifiedAt: getAttr(profile, "verifiedAt") || null,
    updatedAt: getAttr(profile, "updatedAt") || null,
    createdAt: getAttr(profile, "createdAt") || null,
  };
};

router.get(
  "/stores/:storeId/payment-profile",
  requireSellerStoreAccess(["PAYMENT_PROFILE_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const sellerAccess = (req as any).sellerAccess;
      const profile = await StorePaymentProfile.findOne({
        where: { storeId },
        attributes: [
          "id",
          "storeId",
          "providerCode",
          "paymentType",
          "accountName",
          "merchantName",
          "merchantId",
          "qrisImageUrl",
          "qrisPayload",
          "instructionText",
          "isActive",
          "verificationStatus",
          "verifiedAt",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            association: "verifiedByAdmin",
            attributes: ["id", "name", "email"],
            required: false,
          },
        ],
      });

      return res.json({
        success: true,
        data: serializeSellerPaymentProfile(profile, {
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

export default router;
