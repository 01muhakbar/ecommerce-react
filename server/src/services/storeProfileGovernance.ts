import { z } from "zod";
import {
  PUBLIC_STORE_IDENTITY_ADMIN_OWNED_FIELDS,
  PUBLIC_STORE_IDENTITY_ATTRIBUTES,
  PUBLIC_STORE_IDENTITY_PUBLIC_SAFE_FIELDS,
  PUBLIC_STORE_IDENTITY_SELLER_OWNED_FIELDS,
} from "./sharedContracts/publicStoreIdentity.js";

export const STORE_PROFILE_ATTRIBUTES = [...PUBLIC_STORE_IDENTITY_ATTRIBUTES] as const;

export const SELLER_EDITABLE_STORE_PROFILE_FIELDS = [
  ...PUBLIC_STORE_IDENTITY_SELLER_OWNED_FIELDS,
] as const;

export const ADMIN_OWNED_STORE_PROFILE_FIELDS = [
  ...PUBLIC_STORE_IDENTITY_ADMIN_OWNED_FIELDS,
] as const;

export const READ_ONLY_STORE_PROFILE_FIELDS = ["id", "createdAt", "updatedAt"] as const;

export const PUBLIC_SAFE_STORE_PROFILE_FIELDS = [
  ...PUBLIC_STORE_IDENTITY_PUBLIC_SAFE_FIELDS,
] as const;

export const STOREFRONT_USAGE = {
  PUBLIC_STOREFRONT: "PUBLIC_STOREFRONT",
  OPERATIONAL_CLIENT: "OPERATIONAL_CLIENT",
  NOT_SURFACED: "NOT_SURFACED",
} as const;

type StorefrontUsageKey =
  (typeof STOREFRONT_USAGE)[keyof typeof STOREFRONT_USAGE];

type StoreProfileFieldContract = {
  key: string;
  label: string;
  storefrontUsage: StorefrontUsageKey;
  notes: string;
};

const storeProfileFieldMatrix: StoreProfileFieldContract[] = [
  {
    key: "id",
    label: "Store ID",
    storefrontUsage: STOREFRONT_USAGE.NOT_SURFACED,
    notes: "Internal identifier for seller and admin APIs only.",
  },
  {
    key: "name",
    label: "Store Name",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes:
      "Authoritative public store identity for microsite, public identity endpoint, and marketplace header branding. Governance remains admin-owned.",
  },
  {
    key: "slug",
    label: "Slug",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Public store identifier used for /store/:slug microsite routing and store identity lookup.",
  },
  {
    key: "status",
    label: "Status",
    storefrontUsage: STOREFRONT_USAGE.OPERATIONAL_CLIENT,
    notes: "Used for store governance and operational summaries, not rendered as public storefront content.",
  },
  {
    key: "description",
    label: "Description",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes:
      "Used by public store identity and as the fallback body for microsite rich-about content when customization is empty.",
  },
  {
    key: "logoUrl",
    label: "Logo URL",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes:
      "Used by public store identity and preferred by the marketplace header before customization headerLogoUrl fallback.",
  },
  {
    key: "bannerUrl",
    label: "Banner URL",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Used as the preferred public microsite hero artwork when present.",
  },
  {
    key: "email",
    label: "Email",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes:
      "Used by store microsite contact blocks and preferred by the marketplace contact page over customization email fallback.",
  },
  {
    key: "phone",
    label: "Phone",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes:
      "Used by store microsite contact blocks and preferred by marketplace header/contact surfaces before customization phone fallback.",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes:
      "Used by store microsite contact blocks and preferred by marketplace header before customization WhatsApp fallback.",
  },
  {
    key: "websiteUrl",
    label: "Website URL",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Shown as a public outbound link on the store microsite when present.",
  },
  {
    key: "instagramUrl",
    label: "Instagram URL",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Shown as a public outbound link on the store microsite when present.",
  },
  {
    key: "tiktokUrl",
    label: "TikTok URL",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Shown as a public outbound link on the store microsite when present.",
  },
  {
    key: "addressLine1",
    label: "Address Line 1",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes:
      "Rendered on the store microsite address block. Marketplace contact page address remains admin customization-owned.",
  },
  {
    key: "addressLine2",
    label: "Address Line 2",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Rendered with the store microsite address block when present.",
  },
  {
    key: "city",
    label: "City",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Rendered with the store microsite address block when present.",
  },
  {
    key: "province",
    label: "Province",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Rendered with the store microsite address block when present.",
  },
  {
    key: "postalCode",
    label: "Postal Code",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Rendered with the store microsite address block when present.",
  },
  {
    key: "country",
    label: "Country",
    storefrontUsage: STOREFRONT_USAGE.PUBLIC_STOREFRONT,
    notes: "Rendered with the store microsite address block when present.",
  },
  {
    key: "createdAt",
    label: "Created At",
    storefrontUsage: STOREFRONT_USAGE.NOT_SURFACED,
    notes: "Audit metadata only.",
  },
  {
    key: "updatedAt",
    label: "Updated At",
    storefrontUsage: STOREFRONT_USAGE.NOT_SURFACED,
    notes: "Audit metadata only.",
  },
] as const;

const profileCompletenessFields = [
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

const normalizeSlugInput = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
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

export const sellerStoreProfilePatchSchema = z
  .object({
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

export const adminStoreProfilePatchSchema = z
  .object({
    name: z.preprocess(
      normalizeNullableText,
      z.string().min(2).max(160).optional()
    ),
    slug: z.preprocess(
      normalizeSlugInput,
      z
        .string()
        .min(2)
        .max(180)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
          message: "Slug may contain only lowercase letters, numbers, and dashes.",
        })
        .optional()
    ),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .strict();

export const getStoreProfileAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const hasText = (value: unknown) => String(value || "").trim().length > 0;

const sellerEditableFieldSet = new Set<string>(SELLER_EDITABLE_STORE_PROFILE_FIELDS);
const adminOwnedFieldSet = new Set<string>(ADMIN_OWNED_STORE_PROFILE_FIELDS);
const readOnlyFieldSet = new Set<string>(READ_ONLY_STORE_PROFILE_FIELDS);
const publicSafeFieldSet = new Set<string>(PUBLIC_SAFE_STORE_PROFILE_FIELDS);

export const buildStoreProfileContract = () => {
  const fieldMatrix = storeProfileFieldMatrix.map((field) => ({
    key: field.key,
    label: field.label,
    editableBySeller: sellerEditableFieldSet.has(field.key),
    editableByAdmin: adminOwnedFieldSet.has(field.key),
    sellerEditable: sellerEditableFieldSet.has(field.key),
    adminOwned: adminOwnedFieldSet.has(field.key),
    readOnlyForSeller: readOnlyFieldSet.has(field.key) || adminOwnedFieldSet.has(field.key),
    publicSafe: publicSafeFieldSet.has(field.key),
    storefrontUsage: field.storefrontUsage,
    notes: field.notes,
  }));

  return {
    notes: [
      "Backend store profile remains the source of truth for store identity ownership.",
      "Admin owns core public store identity fields: name, slug, and status.",
      "Seller owns storefront-facing profile, contact, and address fields.",
      "Client/storefront may only read public-safe fields exposed by the public identity serializer.",
      "Store Customization remains separate for layout, rich content, and marketplace-wide copy.",
    ],
    categories: {
      editableFields: [...SELLER_EDITABLE_STORE_PROFILE_FIELDS],
      readOnlyFields: [...READ_ONLY_STORE_PROFILE_FIELDS, ...ADMIN_OWNED_STORE_PROFILE_FIELDS],
      adminOwnedFields: [...ADMIN_OWNED_STORE_PROFILE_FIELDS],
      sellerEditableFields: [...SELLER_EDITABLE_STORE_PROFILE_FIELDS],
      publicSafeFields: [...PUBLIC_SAFE_STORE_PROFILE_FIELDS],
      publicStorefrontFields: fieldMatrix
        .filter((field) => field.storefrontUsage === STOREFRONT_USAGE.PUBLIC_STOREFRONT)
        .map((field) => field.key),
      operationalClientFields: fieldMatrix
        .filter((field) => field.storefrontUsage === STOREFRONT_USAGE.OPERATIONAL_CLIENT)
        .map((field) => field.key),
      notSurfacedFields: fieldMatrix
        .filter((field) => field.storefrontUsage === STOREFRONT_USAGE.NOT_SURFACED)
        .map((field) => field.key),
    },
    fieldMatrix,
  };
};

export const buildStoreStatusMeta = (statusValue: unknown) => {
  const code = String(statusValue || "ACTIVE").toUpperCase();

  if (code === "ACTIVE") {
    return {
      code,
      label: "Active",
      tone: "success",
      description: "Store identity is active in the current store profile source of truth.",
    };
  }

  if (code === "INACTIVE") {
    return {
      code,
      label: "Inactive",
      tone: "neutral",
      description:
        "Store is inactive. Metadata can still be reviewed, but storefront behavior follows store governance.",
    };
  }

  return {
    code,
    label: code.replace(/_/g, " "),
    tone: "neutral",
    description: "Store status is controlled by the existing store governance flow.",
  };
};

export const buildStoreProfileCompleteness = (store: any) => {
  const missingFields = profileCompletenessFields
    .filter((field) => !hasText(getStoreProfileAttr(store, field.key)))
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
        ? "Core store identity, contact, and address fields are filled for cross-workspace operations."
        : "Some store metadata is still missing. Complete it to reduce ambiguity across seller, admin, and storefront lanes.",
    missingFields,
  };
};

export const serializeStoreProfileSnapshot = (
  store: any,
  options: { actor: "seller" | "admin"; canEdit?: boolean } = { actor: "seller" }
) => {
  if (!store) return null;

  const status = String(getStoreProfileAttr(store, "status") || "ACTIVE");
  const isAdminActor = options.actor === "admin";

  return {
    id: Number(getStoreProfileAttr(store, "id")),
    name: String(getStoreProfileAttr(store, "name") || ""),
    slug: String(getStoreProfileAttr(store, "slug") || ""),
    description: getStoreProfileAttr(store, "description")
      ? String(getStoreProfileAttr(store, "description"))
      : null,
    logoUrl: getStoreProfileAttr(store, "logoUrl") ? String(getStoreProfileAttr(store, "logoUrl")) : null,
    bannerUrl: getStoreProfileAttr(store, "bannerUrl")
      ? String(getStoreProfileAttr(store, "bannerUrl"))
      : null,
    email: getStoreProfileAttr(store, "email") ? String(getStoreProfileAttr(store, "email")) : null,
    phone: getStoreProfileAttr(store, "phone") ? String(getStoreProfileAttr(store, "phone")) : null,
    whatsapp: getStoreProfileAttr(store, "whatsapp")
      ? String(getStoreProfileAttr(store, "whatsapp"))
      : null,
    websiteUrl: getStoreProfileAttr(store, "websiteUrl")
      ? String(getStoreProfileAttr(store, "websiteUrl"))
      : null,
    instagramUrl: getStoreProfileAttr(store, "instagramUrl")
      ? String(getStoreProfileAttr(store, "instagramUrl"))
      : null,
    tiktokUrl: getStoreProfileAttr(store, "tiktokUrl")
      ? String(getStoreProfileAttr(store, "tiktokUrl"))
      : null,
    addressLine1: getStoreProfileAttr(store, "addressLine1")
      ? String(getStoreProfileAttr(store, "addressLine1"))
      : null,
    addressLine2: getStoreProfileAttr(store, "addressLine2")
      ? String(getStoreProfileAttr(store, "addressLine2"))
      : null,
    city: getStoreProfileAttr(store, "city") ? String(getStoreProfileAttr(store, "city")) : null,
    province: getStoreProfileAttr(store, "province")
      ? String(getStoreProfileAttr(store, "province"))
      : null,
    postalCode: getStoreProfileAttr(store, "postalCode")
      ? String(getStoreProfileAttr(store, "postalCode"))
      : null,
    country: getStoreProfileAttr(store, "country")
      ? String(getStoreProfileAttr(store, "country"))
      : null,
    status,
    verificationStatus: null,
    statusMeta: buildStoreStatusMeta(status),
    governance: {
      canView: true,
      canEdit: Boolean(options.canEdit),
      editableFields: isAdminActor
        ? [...ADMIN_OWNED_STORE_PROFILE_FIELDS]
        : [...SELLER_EDITABLE_STORE_PROFILE_FIELDS],
      readOnlyFields: isAdminActor
        ? [...READ_ONLY_STORE_PROFILE_FIELDS, ...SELLER_EDITABLE_STORE_PROFILE_FIELDS]
        : [...READ_ONLY_STORE_PROFILE_FIELDS, ...ADMIN_OWNED_STORE_PROFILE_FIELDS],
      adminOwnedFields: [...ADMIN_OWNED_STORE_PROFILE_FIELDS],
      sellerEditableFields: [...SELLER_EDITABLE_STORE_PROFILE_FIELDS],
      publicSafeFields: [...PUBLIC_SAFE_STORE_PROFILE_FIELDS],
      managedBy: isAdminActor
        ? "ADMIN_WORKSPACE_WITH_SELLER_PROFILE_PREVIEW"
        : "SELLER_WORKSPACE_WITH_ADMIN_CORE_GOVERNANCE",
      note: isAdminActor
        ? Boolean(options.canEdit)
          ? "Admin may edit the core store identity fields. Seller-owned profile and contact fields remain visible here as cross-workspace preview."
          : "Admin can review the full store profile contract here, but editing is currently unavailable."
        : Boolean(options.canEdit)
          ? "Editable metadata stays limited to seller-owned profile, contact, and address fields. Store name, slug, and status stay admin-governed."
          : "This actor can review the profile, but editing remains restricted by store permissions.",
    },
    contract: buildStoreProfileContract(),
    completeness: buildStoreProfileCompleteness(store),
    createdAt: getStoreProfileAttr(store, "createdAt") || null,
    updatedAt: getStoreProfileAttr(store, "updatedAt") || null,
  };
};
