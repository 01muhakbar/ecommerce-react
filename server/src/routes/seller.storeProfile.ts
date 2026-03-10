import { Router } from "express";
import { z } from "zod";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Store } from "../models/index.js";

const router = Router();

const storeProfileAttributes = [
  "id",
  "name",
  "slug",
  "status",
  "description",
  "logoUrl",
  "bannerUrl",
  "email",
  "phone",
  "whatsapp",
  "websiteUrl",
  "instagramUrl",
  "tiktokUrl",
  "addressLine1",
  "addressLine2",
  "city",
  "province",
  "postalCode",
  "country",
  "updatedAt",
  "createdAt",
] as const;

const normalizeNullableText = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const nullableStringField = (max: number) =>
  z.preprocess(
    normalizeNullableText,
    z.string().max(max).nullable().optional()
  );

const nullableUrlField = () =>
  z.preprocess(
    normalizeNullableText,
    z.string().url().max(2048).nullable().optional()
  );

const nullableEmailField = () =>
  z.preprocess(
    normalizeNullableText,
    z.string().email().max(160).nullable().optional()
  );

const profilePatchSchema = z
  .object({
    name: z
      .preprocess(
        (value) => {
          if (value === undefined) return undefined;
          return String(value).trim();
        },
        z.string().min(2).max(160).optional()
      )
      .optional(),
    description: nullableStringField(4000),
    logoUrl: nullableUrlField(),
    bannerUrl: nullableUrlField(),
    email: nullableEmailField(),
    phone: nullableStringField(64),
    whatsapp: nullableStringField(64),
    websiteUrl: nullableUrlField(),
    instagramUrl: nullableUrlField(),
    tiktokUrl: nullableUrlField(),
    addressLine1: nullableStringField(255),
    addressLine2: nullableStringField(255),
    city: nullableStringField(120),
    province: nullableStringField(120),
    postalCode: nullableStringField(32),
    country: nullableStringField(120),
  })
  .strict();

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const serializeSellerStoreProfile = (store: any) => {
  if (!store) return null;

  return {
    id: Number(getAttr(store, "id")),
    name: String(getAttr(store, "name") || ""),
    slug: String(getAttr(store, "slug") || ""),
    description: getAttr(store, "description")
      ? String(getAttr(store, "description"))
      : null,
    logoUrl: getAttr(store, "logoUrl") ? String(getAttr(store, "logoUrl")) : null,
    bannerUrl: getAttr(store, "bannerUrl") ? String(getAttr(store, "bannerUrl")) : null,
    email: getAttr(store, "email") ? String(getAttr(store, "email")) : null,
    phone: getAttr(store, "phone") ? String(getAttr(store, "phone")) : null,
    whatsapp: getAttr(store, "whatsapp") ? String(getAttr(store, "whatsapp")) : null,
    websiteUrl: getAttr(store, "websiteUrl") ? String(getAttr(store, "websiteUrl")) : null,
    instagramUrl: getAttr(store, "instagramUrl")
      ? String(getAttr(store, "instagramUrl"))
      : null,
    tiktokUrl: getAttr(store, "tiktokUrl") ? String(getAttr(store, "tiktokUrl")) : null,
    addressLine1: getAttr(store, "addressLine1")
      ? String(getAttr(store, "addressLine1"))
      : null,
    addressLine2: getAttr(store, "addressLine2")
      ? String(getAttr(store, "addressLine2"))
      : null,
    city: getAttr(store, "city") ? String(getAttr(store, "city")) : null,
    province: getAttr(store, "province") ? String(getAttr(store, "province")) : null,
    postalCode: getAttr(store, "postalCode") ? String(getAttr(store, "postalCode")) : null,
    country: getAttr(store, "country") ? String(getAttr(store, "country")) : null,
    status: String(getAttr(store, "status") || "ACTIVE"),
    verificationStatus: null,
    createdAt: getAttr(store, "createdAt") || null,
    updatedAt: getAttr(store, "updatedAt") || null,
  };
};

router.get(
  "/stores/:storeId/profile",
  requireSellerStoreAccess(["STORE_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const store = await Store.findByPk(storeId, {
        attributes: [...storeProfileAttributes],
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found.",
        });
      }

      return res.json({
        success: true,
        data: serializeSellerStoreProfile(store),
      });
    } catch (error) {
      console.error("[seller/store-profile:get] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller store profile.",
      });
    }
  }
);

router.patch(
  "/stores/:storeId/profile",
  requireSellerStoreAccess(["STORE_EDIT"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const parsed = profilePatchSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
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
          message: "No allowed store profile fields were provided.",
        });
      }

      const store = await Store.findByPk(storeId, {
        attributes: [...storeProfileAttributes],
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
        data: serializeSellerStoreProfile(store),
      });
    } catch (error) {
      console.error("[seller/store-profile:patch] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update seller store profile.",
      });
    }
  }
);

export default router;
