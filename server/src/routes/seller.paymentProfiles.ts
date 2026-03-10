import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { StorePaymentProfile } from "../models/index.js";

const router = Router();

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const serializeSellerPaymentProfile = (profile: any) => {
  if (!profile) return null;

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
    isActive: Boolean(getAttr(profile, "isActive")),
    verificationStatus: String(getAttr(profile, "verificationStatus") || "PENDING"),
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
        data: serializeSellerPaymentProfile(profile),
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
