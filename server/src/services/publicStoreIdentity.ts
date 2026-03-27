import { Op, QueryTypes } from "sequelize";
import { Product, sequelize } from "../models/index.js";

export const PUBLIC_STORE_IDENTITY_ATTRIBUTES = [
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
  "createdAt",
  "updatedAt",
] as const;

export const PUBLIC_STORE_IDENTITY_SELLER_OWNED_FIELDS = [
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

export const PUBLIC_STORE_IDENTITY_ADMIN_OWNED_FIELDS = [
  "name",
  "slug",
  "status",
] as const;

export const PUBLIC_STORE_IDENTITY_PUBLIC_SAFE_FIELDS = [
  "name",
  "slug",
  ...PUBLIC_STORE_IDENTITY_SELLER_OWNED_FIELDS,
] as const;

const toText = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toIsoString = (value: unknown) => {
  if (!value) return "";
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
};

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const pickLatestIsoString = (...values: unknown[]) => {
  const timestamps = values
    .map((value) => {
      const iso = toIsoString(value);
      if (!iso) return null;
      const parsed = Date.parse(iso);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value): value is number => value !== null);

  if (!timestamps.length) return "";
  return new Date(Math.max(...timestamps)).toISOString();
};

export const readStoreIdentityAttr = (store: any, key: string) =>
  store?.getDataValue?.(key) ??
  store?.get?.(key) ??
  store?.dataValues?.[key] ??
  store?.[key] ??
  undefined;

export const toPreferredWhatsAppLink = (preferredValue: unknown, fallbackValue: unknown) => {
  const preferred = toText(preferredValue);
  if (preferred) {
    const lowered = preferred.toLowerCase();
    if (
      lowered.startsWith("https://wa.me/") ||
      lowered.startsWith("https://api.whatsapp.com/")
    ) {
      return preferred;
    }

    const digits = preferred.replace(/\D+/g, "");
    if (digits) {
      return `https://wa.me/${digits}`;
    }
  }

  return toText(fallbackValue);
};

export const buildPublicStoreStatusMeta = (statusValue: unknown) => {
  const code = toText(statusValue, "ACTIVE").toUpperCase();

  if (code === "ACTIVE") {
    return {
      code,
      label: "Active",
      tone: "success",
      description: "Store identity is active on public storefront routes.",
    };
  }

  if (code === "INACTIVE") {
    return {
      code,
      label: "Inactive",
      tone: "neutral",
      description: "Store exists, but public storefront availability is limited by store status.",
    };
  }

  return {
    code,
    label: code.replace(/_/g, " "),
    tone: "neutral",
    description: "Public store visibility follows the current store governance status.",
  };
};

export const serializePublicStoreIdentityContract = () => ({
  authoritativeSource: "STORE",
  sellerOwnedFields: [...PUBLIC_STORE_IDENTITY_SELLER_OWNED_FIELDS],
  publicSafeFields: [...PUBLIC_STORE_IDENTITY_PUBLIC_SAFE_FIELDS],
  adminOwnedFields: [...PUBLIC_STORE_IDENTITY_ADMIN_OWNED_FIELDS],
  internalOnlyFields: ["id"],
  adminManagedSurfaces: [
    "marketplace-header-copy",
    "marketplace-contact-layout",
    "store-microsite-rich-about",
  ],
  notes: [
    "Public store identity and store microsite contact fields read from Store.",
    "Store.name, Store.slug, and Store.status remain admin-governed core identity fields.",
    "Store microsite hero artwork and public outbound links read seller-owned Store fields when present.",
    "Global marketplace header copy and contact-page layout remain admin customization-managed.",
    "Store description is the fallback for store microsite about content when rich-about customization is empty.",
  ],
});

export const buildPublicStoreSummary = async (store: any) => {
  const storeId = Number(readStoreIdentityAttr(store, "id") || 0);
  const status = buildPublicStoreStatusMeta(readStoreIdentityAttr(store, "status"));

  if (!(storeId > 0)) {
    return {
      status,
      productCount: null,
      ratingAverage: null,
      ratingCount: 0,
      followerCount: null,
      responseRate: null,
      responseTimeLabel: null,
      joinedAt: "",
      chatMode: "disabled",
      canChat: false,
      canContact: false,
    };
  }

  const productCount = await Product.count({
    where: {
      storeId,
      status: "active",
      isPublished: { [Op.in]: [1, true] },
      sellerSubmissionStatus: "none",
    } as any,
  });

  const rows = (await sequelize.query(
    `
      SELECT
        ROUND(AVG(pr.rating), 1) AS ratingAverage,
        COUNT(pr.id) AS ratingCount
      FROM product_reviews pr
      INNER JOIN products p ON p.id = pr.product_id
      WHERE p.store_id = :storeId
        AND p.status = 'active'
        AND p.published IN (1, true)
        AND COALESCE(p.seller_submission_status, 'none') = 'none'
    `,
    {
      replacements: { storeId },
      type: QueryTypes.SELECT,
    }
  )) as Array<{ ratingAverage?: number | string | null; ratingCount?: number | string | null }>;

  const aggregate = rows[0] || {};
  const ratingAverageRaw = toNumberOrNull(aggregate.ratingAverage);
  const ratingAverage =
    Number.isFinite(Number(ratingAverageRaw)) && Number(ratingAverageRaw) > 0
      ? Number(Number(ratingAverageRaw).toFixed(1))
      : null;
  const ratingCount = Math.max(0, Math.round(Number(aggregate.ratingCount || 0)));

  const storeWhatsApp = toPreferredWhatsAppLink(readStoreIdentityAttr(store, "whatsapp"), "");
  const hasContact = Boolean(
    toText(readStoreIdentityAttr(store, "email")) ||
      toText(readStoreIdentityAttr(store, "phone")) ||
      storeWhatsApp
  );

  return {
    status,
    productCount: Number(productCount) || 0,
    ratingAverage,
    ratingCount,
    followerCount: null,
    responseRate: null,
    responseTimeLabel: null,
    joinedAt: toIsoString(readStoreIdentityAttr(store, "createdAt")),
    chatMode: storeWhatsApp ? "enabled" : hasContact ? "contact_fallback" : "disabled",
    canChat: Boolean(storeWhatsApp),
    canContact: hasContact,
  };
};

export const serializePublicStoreIdentity = async (store: any) => {
  const summary = await buildPublicStoreSummary(store);

  if (!store) {
    return {
      id: null,
      name: "",
      slug: "",
      description: "",
      logoUrl: "",
      bannerUrl: "",
      email: "",
      phone: "",
      whatsapp: "",
      websiteUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
      createdAt: "",
      updatedAt: "",
      summary,
      contract: serializePublicStoreIdentityContract(),
    };
  }

  return {
    id: Number(readStoreIdentityAttr(store, "id")),
    name: toText(readStoreIdentityAttr(store, "name")),
    slug: toText(readStoreIdentityAttr(store, "slug")),
    description: toText(readStoreIdentityAttr(store, "description")),
    logoUrl: toText(readStoreIdentityAttr(store, "logoUrl")),
    bannerUrl: toText(readStoreIdentityAttr(store, "bannerUrl")),
    email: toText(readStoreIdentityAttr(store, "email")),
    phone: toText(readStoreIdentityAttr(store, "phone")),
    whatsapp: toText(readStoreIdentityAttr(store, "whatsapp")),
    websiteUrl: toText(readStoreIdentityAttr(store, "websiteUrl")),
    instagramUrl: toText(readStoreIdentityAttr(store, "instagramUrl")),
    tiktokUrl: toText(readStoreIdentityAttr(store, "tiktokUrl")),
    addressLine1: toText(readStoreIdentityAttr(store, "addressLine1")),
    addressLine2: toText(readStoreIdentityAttr(store, "addressLine2")),
    city: toText(readStoreIdentityAttr(store, "city")),
    province: toText(readStoreIdentityAttr(store, "province")),
    postalCode: toText(readStoreIdentityAttr(store, "postalCode")),
    country: toText(readStoreIdentityAttr(store, "country")),
    createdAt: toIsoString(readStoreIdentityAttr(store, "createdAt")),
    updatedAt: toIsoString(readStoreIdentityAttr(store, "updatedAt")),
    summary,
    contract: serializePublicStoreIdentityContract(),
  };
};

export const toPublicStoreIdentityPayload = (
  identity: Record<string, any> | null | undefined
) => {
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
    return identity;
  }

  const { id: _internalId, ...publicSafeIdentity } = identity;
  return publicSafeIdentity;
};

export const serializePublicStoreIdentityPayload = async (store: any) =>
  toPublicStoreIdentityPayload(await serializePublicStoreIdentity(store));

export const serializePublicSellerInfo = async (store: any) => {
  if (!store) return null;

  const identity = await serializePublicStoreIdentity(store);
  const summary = identity.summary || {};
  const storeSlug = toText(identity.slug);
  const storeWhatsApp = toPreferredWhatsAppLink(identity.whatsapp, "");
  const hasContactFallback = Boolean(storeSlug && (identity.phone || identity.email));
  const chatMode =
    summary.chatMode === "enabled" || summary.chatMode === "contact_fallback"
      ? summary.chatMode
      : storeWhatsApp
        ? "enabled"
        : hasContactFallback
          ? "contact_fallback"
          : "disabled";
  const canVisitStore = Boolean(storeSlug);

  return {
    storeId: identity.id,
    name: identity.name || "Store",
    slug: storeSlug,
    logoUrl: identity.logoUrl || null,
    shortDescription: identity.description || null,
    status: summary.status || buildPublicStoreStatusMeta("ACTIVE"),
    productCount:
      Number.isFinite(Number(summary.productCount)) ? Number(summary.productCount) : null,
    ratingAverage:
      Number.isFinite(Number(summary.ratingAverage)) ? Number(summary.ratingAverage) : null,
    ratingCount: Number.isFinite(Number(summary.ratingCount)) ? Number(summary.ratingCount) : 0,
    followerCount:
      Number.isFinite(Number(summary.followerCount)) ? Number(summary.followerCount) : null,
    responseRate:
      Number.isFinite(Number(summary.responseRate)) ? Number(summary.responseRate) : null,
    responseTimeLabel: toText(summary.responseTimeLabel) || null,
    joinedAt: summary.joinedAt || identity.createdAt || null,
    canVisitStore,
    visitStoreHref: canVisitStore ? `/store/${encodeURIComponent(storeSlug)}` : null,
    canChat: chatMode !== "disabled",
    chatMode,
    chatHref:
      chatMode === "enabled"
        ? storeWhatsApp
        : hasContactFallback
          ? `/store/${encodeURIComponent(storeSlug)}`
          : null,
    chatLabel:
      chatMode === "enabled"
        ? "Chat Toko"
        : hasContactFallback
          ? "Hubungi Toko"
          : "Chat segera hadir",
    chatHelper:
      chatMode === "enabled"
        ? "Opens the store WhatsApp contact in a new tab."
        : hasContactFallback
          ? "Store contact details are currently shown on the public store page."
          : "Direct seller chat is not available in this storefront yet.",
    publicContact: {
      phone: identity.phone || null,
      email: identity.email || null,
      whatsapp: storeWhatsApp || null,
    },
    contract: {
      sourceOfTruth: "STORE",
      productCountScope: "PUBLIC_ACTIVE_PUBLISHED_PRODUCTS",
      ratingScope: "PUBLIC_PRODUCT_REVIEWS_FOR_THIS_STORE",
      notes: [
        "Only public-safe store identity is exposed in the PDP seller card.",
        "Follower, response rate, and response speed remain null until a validated source of truth exists.",
        "Chat CTA uses WhatsApp when the store has a public WhatsApp contact. Otherwise it falls back to the public store page when contact details are available there.",
      ],
    },
  };
};
