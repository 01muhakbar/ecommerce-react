import { Router } from "express";
import { Store, User } from "../models/index.js";
import {
  ADMIN_OWNED_STORE_PROFILE_FIELDS,
  STORE_PROFILE_ATTRIBUTES,
  adminStoreProfilePatchSchema,
  serializeStoreProfileSnapshot,
} from "../services/sharedContracts/storeProfileGovernance.js";
import { serializePublicStoreIdentityPayload } from "../services/sharedContracts/publicStoreIdentity.js";

const router = Router();

const ownerAttributes = ["id", "name", "email", "role"] as const;

const serializeAdminStoreProfileEntry = async (store: any) => ({
  store: serializeStoreProfileSnapshot(store, {
    actor: "admin",
    canEdit: true,
  }),
  publicIdentity: await serializePublicStoreIdentityPayload(store),
  owner: store?.owner
    ? {
        id: Number(store.owner.id),
        name: String(store.owner.name || ""),
        email: String(store.owner.email || ""),
        role: String(store.owner.role || ""),
      }
    : null,
});

router.get("/store/profiles", async (_req, res) => {
  try {
    const stores = await Store.findAll({
      attributes: [...STORE_PROFILE_ATTRIBUTES],
      include: [{ model: User, as: "owner", attributes: [...ownerAttributes], required: false }],
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    const items = await Promise.all(stores.map((store) => serializeAdminStoreProfileEntry(store)));

    return res.json({
      success: true,
      data: items,
      governance: {
        adminOwnedFields: [...ADMIN_OWNED_STORE_PROFILE_FIELDS],
      },
    });
  } catch (error) {
    console.error("[admin/store-profiles:list] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load admin store profiles.",
    });
  }
});

router.patch("/store/profiles/:storeId", async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isFinite(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store id.",
      });
    }

    const parsed = adminStoreProfilePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ADMIN_STORE_PROFILE_PAYLOAD",
        message: "Invalid payload.",
        errors: parsed.error.flatten(),
      });
    }

    const updatePayload = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No admin-owned store profile fields were provided.",
      });
    }

    const store = await Store.findByPk(storeId, {
      attributes: [...STORE_PROFILE_ATTRIBUTES],
      include: [{ model: User, as: "owner", attributes: [...ownerAttributes], required: false }],
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    await store.update(updatePayload as any);

    return res.json({
      success: true,
      data: await serializeAdminStoreProfileEntry(store),
    });
  } catch (error: any) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        code: "STORE_PROFILE_SLUG_CONFLICT",
        message: "Store slug is already in use.",
      });
    }
    console.error("[admin/store-profiles:patch] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update admin store profile.",
    });
  }
});

export default router;
