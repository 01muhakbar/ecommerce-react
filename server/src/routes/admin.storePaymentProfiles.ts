import { Router } from "express";
import { z } from "zod";
import { Store, StorePaymentProfile, User } from "../models/index.js";

const router = Router();

const reviewSchema = z.object({
  verificationStatus: z.enum(["ACTIVE", "REJECTED", "INACTIVE"]),
});

const serializeProfileRow = (store: any) => {
  const owner = store.owner || store.get?.("owner") || null;
  const profile = store.paymentProfile || store.get?.("paymentProfile") || null;
  return {
    store: {
      id: Number(store.id),
      ownerUserId: Number(store.ownerUserId),
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
        }
      : null,
  };
};

router.get("/payment-profiles", async (_req, res) => {
  try {
    const stores = await Store.findAll({
      attributes: ["id", "ownerUserId", "name", "slug", "status", "createdAt"],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
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
            "verifiedByAdminId",
            "verifiedAt",
            "updatedAt",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      data: stores.map(serializeProfileRow),
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
      attributes: ["id", "ownerUserId", "name", "slug", "status"],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
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
            "verifiedByAdminId",
            "verifiedAt",
            "updatedAt",
          ],
        },
      ],
    });

    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    const profile =
      (store as any).paymentProfile ?? (store as any).get?.("paymentProfile") ?? null;
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Store payment profile not found.",
      });
    }

    const nextStatus = parsed.data.verificationStatus;
    await profile.update({
      verificationStatus: nextStatus,
      isActive: nextStatus === "ACTIVE",
      verifiedByAdminId: adminUserId,
      verifiedAt: new Date(),
    });

    const refreshed = await Store.findByPk(storeId, {
      attributes: ["id", "ownerUserId", "name", "slug", "status"],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
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
            "verifiedByAdminId",
            "verifiedAt",
            "updatedAt",
          ],
        },
      ],
    });

    return res.json({
      success: true,
      data: serializeProfileRow(refreshed),
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
