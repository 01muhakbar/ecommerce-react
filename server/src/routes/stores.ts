import { Router } from "express";
import { z } from "zod";
import requireAuth from "../middleware/requireAuth.js";
import { Store, StorePaymentProfile, User } from "../models/index.js";
import {
  resolvePreferredStorePaymentProfile,
  STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES,
} from "../services/storePaymentProfileCompat.js";

const router = Router();

const paymentProfileSchema = z.object({
  accountName: z.string().trim().min(2).max(160),
  merchantName: z.string().trim().min(2).max(160),
  merchantId: z.string().trim().max(160).nullable().optional(),
  qrisImageUrl: z.string().trim().min(5).max(2_000_000),
  qrisPayload: z.string().trim().max(2_000_000).nullable().optional(),
  instructionText: z.string().trim().max(4_000).nullable().optional(),
});

const getAuthUser = (req: any) => {
  const userId = Number(req?.user?.id);
  return {
    id: Number.isFinite(userId) ? userId : null,
    role: String(req?.user?.role || "").toLowerCase().trim(),
  };
};

const isAdminRole = (role: string) =>
  role === "admin" || role === "super_admin" || role === "staff";

const storeAttributes = ["id", "ownerUserId", "activeStorePaymentProfileId", "name", "slug", "status"] as const;
const profileAttributes = [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES] as const;

const serializePaymentProfile = (profile: any) => {
  if (!profile) return null;
  return {
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
  };
};

const serializeStore = (store: any) => {
  if (!store) return null;
  const owner = store.owner || store.get?.("owner") || null;
  const paymentProfile = resolvePreferredStorePaymentProfile(store);
  return {
    id: Number(store.id),
    ownerUserId: Number(store.ownerUserId),
    activeStorePaymentProfileId:
      store.activeStorePaymentProfileId != null ? Number(store.activeStorePaymentProfileId) : null,
    name: String(store.name || ""),
    slug: String(store.slug || ""),
    status: String(store.status || "ACTIVE"),
    owner: owner
      ? {
          id: Number(owner.id),
          name: String(owner.name || ""),
          email: String(owner.email || ""),
          role: String(owner.role || ""),
        }
      : null,
    paymentProfile: serializePaymentProfile(paymentProfile),
  };
};

router.use(requireAuth);

router.get("/mine", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const store = await Store.findOne({
      where: { ownerUserId: authUser.id },
      attributes: [...storeAttributes],
      include: [
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...profileAttributes],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...profileAttributes],
          required: false,
        },
      ],
    });

    return res.json({
      success: true,
      data: serializeStore(store),
    });
  } catch (error) {
    console.error("[stores/mine] error", error);
    return res.status(500).json({ success: false, message: "Failed to load store." });
  }
});

router.get("/:storeId/payment-profile", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const storeId = Number(req.params.storeId);
    if (!Number.isFinite(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store id." });
    }

    const store = await Store.findByPk(storeId, {
      attributes: [...storeAttributes],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...profileAttributes],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...profileAttributes],
          required: false,
        },
      ],
    });

    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    if (Number((store as any).ownerUserId) !== authUser.id && !isAdminRole(authUser.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this store payment profile.",
      });
    }

    return res.json({
      success: true,
      data: serializeStore(store),
    });
  } catch (error) {
    console.error("[stores/payment-profile get] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load store payment profile.",
    });
  }
});

router.post("/:storeId/payment-profile", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const storeId = Number(req.params.storeId);
    if (!Number.isFinite(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store id." });
    }

    const parsed = paymentProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload.",
        errors: parsed.error.flatten(),
      });
    }

    const store = await Store.findByPk(storeId, {
      attributes: [...storeAttributes],
      include: [
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...profileAttributes],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...profileAttributes],
          required: false,
        },
      ],
    });

    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    if (Number((store as any).ownerUserId) !== authUser.id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this store payment profile.",
      });
    }

    const payload = {
      storeId,
      providerCode: "MANUAL_QRIS" as const,
      paymentType: "QRIS_STATIC" as const,
      accountName: parsed.data.accountName,
      merchantName: parsed.data.merchantName,
      merchantId: parsed.data.merchantId || null,
      qrisImageUrl: parsed.data.qrisImageUrl,
      qrisPayload: parsed.data.qrisPayload || null,
      instructionText: parsed.data.instructionText || null,
      isActive: false,
      verificationStatus: "PENDING" as const,
      verifiedByAdminId: null,
      verifiedAt: null,
    };

    const existingProfile =
      resolvePreferredStorePaymentProfile(store) ??
      (store as any).paymentProfile ??
      (store as any).get?.("paymentProfile") ??
      null;

    if (existingProfile) {
      await existingProfile.update(payload);
    } else {
      await StorePaymentProfile.create(payload as any);
    }

    const refreshed = await Store.findByPk(storeId, {
      attributes: [...storeAttributes],
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email", "role"] },
        {
          model: StorePaymentProfile,
          as: "paymentProfile",
          attributes: [...profileAttributes],
        },
        {
          model: StorePaymentProfile,
          as: "activePaymentProfile",
          attributes: [...profileAttributes],
          required: false,
        },
      ],
    });

    return res.json({
      success: true,
      data: serializeStore(refreshed),
    });
  } catch (error) {
    console.error("[stores/payment-profile post] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save store payment profile.",
    });
  }
});

export default router;
