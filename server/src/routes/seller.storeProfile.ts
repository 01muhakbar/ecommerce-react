import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Store } from "../models/index.js";
import {
  READ_ONLY_STORE_PROFILE_FIELDS,
  SELLER_EDITABLE_STORE_PROFILE_FIELDS,
  STORE_PROFILE_ATTRIBUTES,
  sellerStoreProfilePatchSchema,
  serializeStoreProfileSnapshot,
} from "../services/sharedContracts/storeProfileGovernance.js";
import { buildPublicStoreOperationalReadiness } from "../services/sharedContracts/publicStoreIdentity.js";
import { STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES } from "../services/sharedContracts/storePaymentProfileCompat.js";

const router = Router();

const serializeSellerStoreProfilePayload = (store: any, sellerAccess: any) => ({
  ...serializeStoreProfileSnapshot(store, {
    actor: "seller",
    canEdit: Array.isArray(sellerAccess?.permissionKeys)
      ? sellerAccess.permissionKeys.includes("STORE_EDIT")
      : false,
  }),
  operationalReadiness: buildPublicStoreOperationalReadiness(store),
  boundaries: {
    readinessSourceOfTruth:
      "Operational readiness is derived by the backend from store status and active payment profile readiness.",
    storefrontBoundary:
      "Public store and visit-store CTAs stay gated until operational readiness is READY.",
  },
});

const getSellerStoreProfileResponse = async (req: any, res: any) => {
  try {
    const storeId = Number(req.params.storeId);
    const sellerAccess = req.sellerAccess;
    const store = await Store.findByPk(storeId, {
      attributes: [...STORE_PROFILE_ATTRIBUTES],
      include: [
        {
          association: "paymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
        {
          association: "activePaymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
      ],
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    return res.json({
      success: true,
      data: serializeSellerStoreProfilePayload(store, sellerAccess),
    });
  } catch (error) {
    console.error("[seller/store-profile:get] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load seller store profile.",
    });
  }
};

const patchSellerStoreProfileResponse = async (req: any, res: any) => {
  try {
    const storeId = Number(req.params.storeId);
    const sellerAccess = req.sellerAccess;
    const requestBody =
      req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const forbiddenFields = Object.keys(requestBody).filter((field) =>
      (READ_ONLY_STORE_PROFILE_FIELDS as readonly string[]).includes(field)
    );

    if (forbiddenFields.length > 0) {
      return res.status(403).json({
        success: false,
        code: "READ_ONLY_STORE_PROFILE_FIELDS",
        message: "One or more read-only store fields cannot be updated from seller workspace.",
        fields: forbiddenFields,
      });
    }

    const parsed = sellerStoreProfilePatchSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STORE_PROFILE_PAYLOAD",
        message: "Invalid payload.",
        errors: parsed.error.flatten(),
      });
    }

    const updatePayload = Object.fromEntries(
      Object.entries(parsed.data).filter(
        ([key, value]) =>
          value !== undefined &&
          (SELLER_EDITABLE_STORE_PROFILE_FIELDS as readonly string[]).includes(key)
      )
    );

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No allowed store profile fields were provided.",
      });
    }

    const store = await Store.findByPk(storeId, {
      attributes: [...STORE_PROFILE_ATTRIBUTES],
      include: [
        {
          association: "paymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
        {
          association: "activePaymentProfile",
          attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
          required: false,
        },
      ],
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
      data: serializeSellerStoreProfilePayload(store, sellerAccess),
    });
  } catch (error) {
    console.error("[seller/store-profile:patch] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update seller store profile.",
    });
  }
};

router.get(
  "/stores/:storeId/profile",
  requireSellerStoreAccess(["STORE_VIEW"]),
  getSellerStoreProfileResponse
);

router.get(
  "/stores/:storeId/store-profile",
  requireSellerStoreAccess(["STORE_VIEW"]),
  getSellerStoreProfileResponse
);

router.patch(
  "/stores/:storeId/profile",
  requireSellerStoreAccess(["STORE_EDIT"]),
  patchSellerStoreProfileResponse
);

router.patch(
  "/stores/:storeId/store-profile",
  requireSellerStoreAccess(["STORE_EDIT"]),
  patchSellerStoreProfileResponse
);

export default router;
