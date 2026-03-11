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

const editableStoreProfileFields = [
  "name",
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
] as const;

const readOnlyStoreProfileFields = ["id", "slug", "status", "createdAt", "updatedAt"] as const;

const profileCompletenessFields = [
  { key: "name", label: "Store name" },
  { key: "description", label: "Store description" },
  { key: "email", label: "Store email" },
  { key: "phone", label: "Store phone" },
  { key: "logoUrl", label: "Logo URL" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "country", label: "Country" },
] as const;

const normalizeNullableText = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const hasForbiddenProtocol = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol !== "http:" && url.protocol !== "https:";
  } catch {
    return true;
  }
};

const hasAllowedHost = (value: string, hosts: string[]) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

const nullableStringField = (max: number) =>
  z.preprocess(
    normalizeNullableText,
    z.string().max(max).nullable().optional()
  );

const nullableUrlField = () =>
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .url()
      .max(2048)
      .refine((value) => !hasForbiddenProtocol(value), {
        message: "URL must use http or https.",
      })
      .nullable()
      .optional()
  );

const nullableEmailField = () =>
  z.preprocess(
    normalizeNullableText,
    z.string().email().max(160).nullable().optional()
  );

const nullablePhoneField = (label: string) =>
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .max(64)
      .regex(/^[0-9+().\-\s]{6,64}$/, {
        message: `${label} format is invalid.`,
      })
      .nullable()
      .optional()
  );

const nullablePostalCodeField = () =>
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .max(32)
      .regex(/^[A-Z0-9\- ]{3,32}$/i, {
        message: "Postal code format is invalid.",
      })
      .nullable()
      .optional()
  );

const nullableSocialUrlField = (hosts: string[], label: string) =>
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .url()
      .max(2048)
      .refine((value) => !hasForbiddenProtocol(value), {
        message: "URL must use http or https.",
      })
      .refine((value) => hasAllowedHost(value, hosts), {
        message: `${label} must use a valid ${label.toLowerCase()} URL.`,
      })
      .nullable()
      .optional()
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
    phone: nullablePhoneField("Phone"),
    whatsapp: nullablePhoneField("WhatsApp"),
    websiteUrl: nullableUrlField(),
    instagramUrl: nullableSocialUrlField(["instagram.com"], "Instagram"),
    tiktokUrl: nullableSocialUrlField(["tiktok.com"], "TikTok"),
    addressLine1: nullableStringField(255),
    addressLine2: nullableStringField(255),
    city: nullableStringField(120),
    province: nullableStringField(120),
    postalCode: nullablePostalCodeField(),
    country: nullableStringField(120),
  })
  .strict();

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const hasText = (value: unknown) => String(value || "").trim().length > 0;

const buildStoreStatusMeta = (statusValue: unknown) => {
  const code = String(statusValue || "ACTIVE").toUpperCase();

  if (code === "ACTIVE") {
    return {
      code,
      label: "Active",
      tone: "success",
      description: "Store identity is active in the current seller workspace source of truth.",
    };
  }

  if (code === "INACTIVE") {
    return {
      code,
      label: "Inactive",
      tone: "neutral",
      description:
        "Store is inactive. Seller metadata can still be reviewed, but storefront behavior follows store governance.",
    };
  }

  return {
    code,
    label: code.replace(/_/g, " "),
    tone: "neutral",
    description: "Store status is controlled by the existing store governance flow.",
  };
};

const buildStoreProfileCompleteness = (store: any) => {
  const missingFields = profileCompletenessFields
    .filter((field) => !hasText(getAttr(store, field.key)))
    .map((field) => ({
      key: field.key,
      label: field.label,
    }));

  const totalFields = profileCompletenessFields.length;
  const completedFields = totalFields - missingFields.length;
  const score = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  return {
    score,
    completedFields,
    totalFields,
    isComplete: missingFields.length === 0,
    label: missingFields.length === 0 ? "Profile complete" : "Profile needs attention",
    description:
      missingFields.length === 0
        ? "Core store identity, contact, and address fields are filled for seller operations."
        : "Some editable store metadata is still missing. Complete it to reduce profile ambiguity across seller and storefront lanes.",
    missingFields,
  };
};

const serializeSellerStoreProfile = (store: any, options: { canEdit?: boolean } = {}) => {
  if (!store) return null;

  const status = String(getAttr(store, "status") || "ACTIVE");

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
    status,
    verificationStatus: null,
    statusMeta: buildStoreStatusMeta(status),
    governance: {
      canView: true,
      canEdit: Boolean(options.canEdit),
      editableFields: [...editableStoreProfileFields],
      readOnlyFields: [...readOnlyStoreProfileFields],
      managedBy: "SELLER_WORKSPACE",
      note: Boolean(options.canEdit)
        ? "Editable metadata stays limited to seller-safe store identity fields."
        : "This actor can review the profile, but editing remains restricted by store permissions.",
    },
    completeness: buildStoreProfileCompleteness(store),
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
      const sellerAccess = (req as any).sellerAccess;
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
        data: serializeSellerStoreProfile(store, {
          canEdit: Array.isArray(sellerAccess?.permissionKeys)
            ? sellerAccess.permissionKeys.includes("STORE_EDIT")
            : false,
        }),
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
      const sellerAccess = (req as any).sellerAccess;
      const requestBody =
        req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      const forbiddenFields = Object.keys(requestBody).filter((field) =>
        (readOnlyStoreProfileFields as readonly string[]).includes(field)
      );

      if (forbiddenFields.length > 0) {
        return res.status(403).json({
          success: false,
          code: "READ_ONLY_STORE_PROFILE_FIELDS",
          message: "One or more read-only store fields cannot be updated from seller workspace.",
          fields: forbiddenFields,
        });
      }

      const parsed = profilePatchSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          code: "INVALID_STORE_PROFILE_PAYLOAD",
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
        data: serializeSellerStoreProfile(store, {
          canEdit: Array.isArray(sellerAccess?.permissionKeys)
            ? sellerAccess.permissionKeys.includes("STORE_EDIT")
            : true,
        }),
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
