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

const serializeSellerPaymentProfile = (profile: any, options: { store?: any } = {}) => {
  if (!profile) return null;

  const verificationStatus = String(getAttr(profile, "verificationStatus") || "PENDING");
  const isActive = Boolean(getAttr(profile, "isActive"));

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
      });

      return res.json({
        success: true,
        data: serializeSellerPaymentProfile(profile, {
          store: sellerAccess?.store || null,
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
